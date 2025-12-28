import json
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
from smart_notebook_be.schemas import (
    ChatRequest,
    TranslateRequest,
    TranslateTextRequest,
    MessageList,
)
from smart_notebook_be.db import supabase
from smart_notebook_be.services.llm import llm_service
from smart_notebook_be.deps import get_current_user_id

router = APIRouter()


async def stream_generator(
    thread_id: str,
    user_content: str,
    translate_to_english: bool,
    auto_translate_responses: bool,
    model: str,
    user_id: str,
) -> AsyncGenerator[str, None]:

    # 0. Verify Thread Ownership (if thread_id exists and is not new/placeholder)
    # Actually, thread_id is passed. If it's a real thread, we should check.
    # If thread_id is -99 (or whatever new thread logic), we might skip, but usually a thread is created before chat.
    # In App.tsx, sendMessage creates thread first if !threadToUse.
    if thread_id and thread_id != "-99":
        try:
            t_res = (
                supabase.table("threads")
                .select("user_id")
                .eq("id", thread_id)
                .execute()
            )
            if t_res.data:
                # If thread exists, check user_id
                t_user_id = t_res.data[0].get("user_id")
                if t_user_id and t_user_id != user_id:
                    yield f"data: {json.dumps({'error': 'Unauthorized access to this thread'})}\n\n"
                    return
        except Exception as e:
            print(f"Error checking thread ownership: {e}")

    # 1. Create User Message (Original Language)
    # We assume input is Korean if translate_to_english is True, but we store what we got.
    user_msg_data = {
        "thread_id": thread_id,
        "role": "user",
        "content": user_content,
        "original_language": "ko" if translate_to_english else "en",
    }

    try:
        user_msg_res = supabase.table("messages").insert(user_msg_data).execute()
        user_msg = user_msg_res.data[0]
        user_msg_id = user_msg["id"]

        # Send USER_MESSAGE event so FE knows the ID
        user_event_data = {
            "id": user_msg_id,
            "content": user_content,
            "originalLanguage": user_msg["original_language"],
            "translatedContent": "",
        }
        yield f"data: [USER_MESSAGE:{json.dumps(user_event_data)}]\n\n"

        # This variable will hold the text we send to the Main Chat LLM.
        # Default to original content.
        llm_input_content = user_content

        # 2. Translate User Message to English (if requested)
        user_translation = ""
        if translate_to_english:
            yield "data: [PHASE:TRANSLATING]\n\n"

            # Stream translation (Korean -> English)
            async for content in llm_service.translate_text_stream(
                user_content, "English"
            ):
                user_translation += content
                yield f"data: {json.dumps({'content': content})}\n\n"

            # Update user message with translation in DB
            supabase.table("messages").update(
                {"translated_content": user_translation}
            ).eq("id", user_msg_id).execute()

            # Send updated User Message (Full)
            user_msg_final = {
                "id": user_msg_id,
                "role": "user",
                "content": user_content,
                "translatedContent": user_translation,
                "originalLanguage": "ko",
            }
            yield f"data: [USER_MESSAGE:{json.dumps(user_msg_final)}]\n\n"

            # CRITICAL: Use the English translation for the Chat LLM input
            llm_input_content = user_translation

        # 3. Create Assistant Message Placeholder
        asst_msg_data = {"thread_id": thread_id, "role": "assistant", "content": ""}
        asst_msg_res = supabase.table("messages").insert(asst_msg_data).execute()
        asst_msg_id = asst_msg_res.data[0]["id"]

        yield f"data: [ASSISTANT_MESSAGE_ID:{asst_msg_id}]\n\n"

        # 4. Generate Assistant Response (using English context)
        yield "data: [PHASE:RESPONDING]\n\n"

        # Fetch history for context
        history_res = (
            supabase.table("messages")
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        history = history_res.data[::-1]

        formatted_history = []
        for msg in history:
            if msg["id"] == asst_msg_id:
                continue
            if msg["id"] == user_msg_id:
                continue  # We will append the current message manually with the correct version

            role = msg["role"]
            content = msg["content"]

            # If it's a past user message and we have an English translation, use it for context consistency
            if (
                role == "user"
                and msg.get("translated_content")
                and translate_to_english
            ):
                content = msg.get("translated_content")

            formatted_history.append({"role": role, "content": content})

        # Append the current message (English version if translated)
        formatted_history.append({"role": "user", "content": llm_input_content})

        assistant_content = ""
        # The prompt for generate_chat_stream handles the system prompt.
        async for content in llm_service.generate_chat_stream(formatted_history, model):
            assistant_content += content
            yield f"data: {json.dumps({'content': content})}\n\n"

        # Update Assistant Message with the English response
        supabase.table("messages").update({"content": assistant_content}).eq(
            "id", asst_msg_id
        ).execute()

        # 5. Translate Response to Korean (if requested)
        if auto_translate_responses:
            yield "data: [PHASE:TRANSLATING_RESPONSE]\n\n"

            assistant_translation = ""
            # Stream translation (English -> Korean)
            async for content in llm_service.translate_text_stream(
                assistant_content, "Korean"
            ):
                assistant_translation += content
                yield f"data: {json.dumps({'content': content})}\n\n"

            # Update Assistant Message with Korean translation
            supabase.table("messages").update(
                {"translated_content": assistant_translation}
            ).eq("id", asst_msg_id).execute()

        yield "data: [DONE]\n\n"

    except asyncio.CancelledError:
        print(f"Stream cancelled by user for thread {thread_id}")
        return
    except Exception as e:
        # Check for socket/connection errors specifically if possible,
        # but here we just catch generic to prevent server spam if client disconnected.
        err_str = str(e)
        if "socket.send() raised exception" in err_str or "Broken pipe" in err_str:
            print(f"Client disconnected during stream for thread {thread_id}")
            return

        yield f"data: {json.dumps({'error': err_str})}\n\n"
        print(f"Error in stream: {e}")
        import traceback

        traceback.print_exc()


@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest, user_id: str = Depends(get_current_user_id)
):
    # Verify ownership BEFORE streaming
    try:
        thread = (
            supabase.table("threads")
            .select("user_id")
            .eq("id", request.threadId)
            .execute()
        )
        if not thread.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        if thread.data[0].get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

    return StreamingResponse(
        stream_generator(
            request.threadId,
            request.message,
            request.translateToEnglish,
            request.autoTranslateResponses,
            request.model,
            user_id,
        ),
        media_type="text/event-stream",
    )


@router.post("/translate-text")
async def translate_text_endpoint(
    req: TranslateTextRequest, user_id: str = Depends(get_current_user_id)
):
    try:
        text = req.text
        is_word = len(text.split()) == 1

        # Align prompts with user reference
        system_prompt = (
            "You are a translator. Provide the Korean translation and meaning of this English word. Keep it concise (1-2 sentences)."
            if is_word
            else "You are a translator. Translate this English sentence to Korean. Only output the translation."
        )

        # Direct call to LLM service (adding a method for custom system prompt would be best, or just using direct client)
        # Using public client from llm_service or adding method
        # Let's add a helper provided by llm_service if possible, or just use client

        # For now, let's assume llm_service can handle this or we access client
        from services.llm import llm_service

        completion = await llm_service.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
        )

        return {"translation": completion.choices[0].message.content}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/translate", response_model=MessageList)
async def translate_endpoint(
    request: TranslateRequest, user_id: str = Depends(get_current_user_id)
):
    try:
        # Fetch message
        res = (
            supabase.table("messages").select("*").eq("id", request.messageId).execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Message not found")

        msg = res.data[0]

        # Verify Thread ownership
        thread = (
            supabase.table("threads")
            .select("user_id")
            .eq("id", msg["thread_id"])
            .execute()
        )
        if not thread.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        if thread.data[0].get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        content = msg["content"]

        # Decide direction based on role
        # User (likely Korean) -> English
        # Assistant (likely English) -> Korean
        target_lang = "English" if msg["role"] == "user" else "Korean"

        # Use LLM Service
        translation = await llm_service.translate_text(content, target_lang)

        # Update message
        supabase.table("messages").update({"translated_content": translation}).eq(
            "id", request.messageId
        ).execute()

        # Return updated messages for the thread
        msgs_res = (
            supabase.table("messages")
            .select("*")
            .eq("thread_id", msg["thread_id"])
            .order("created_at")
            .execute()
        )
        return MessageList(messages=msgs_res.data)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
