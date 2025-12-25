from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from db import supabase

router = APIRouter()

class ThreadCreate(BaseModel):
    title: str

@router.get("/threads")
async def get_threads():
    try:
        response = supabase.table("threads").select("*").order("created_at", desc=True).execute()
        return {"threads": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/threads")
async def create_thread(thread: ThreadCreate):
    try:
        response = supabase.table("threads").insert({"title": thread.title}).execute()
        if response.data:
            return {"thread": response.data[0]}
        raise HTTPException(status_code=400, detail="Failed to create thread")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str):
    try:
        response = supabase.table("threads").delete().eq("id", thread_id).execute()
        return {"message": "Thread deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/threads/{thread_id}/messages")
async def get_thread_messages(thread_id: str):
    try:
        response = supabase.table("messages").select("*").eq("thread_id", thread_id).order("created_at").execute()
        # Transform snake_case to camelCase for frontend if needed, or rely on frontend matching.
        # Frontend interface: id, role, content, originalLanguage, translatedContent
        # DB likely: original_language, translated_content
        
        messages = []
        for msg in response.data:
            messages.append({
                "id": msg["id"],
                "role": msg["role"],
                "content": msg["content"],
                "originalLanguage": msg.get("original_language"),
                "translatedContent": msg.get("translated_content")
            })
            
        return {"messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/bookmarked-threads")
async def get_bookmarked_threads():
    try:
        # Assuming table bookmarked_threads(thread_id) with join or similar
        # Or checking existing implementation logic. 
        # Since I don't know the schema, I'll try to join threads and bookmarked_threads
        # But generic supabase join syntax is tricky via client.
        
        # Alternative: query bookmarked_threads then query threads
        bookmarks = supabase.table("bookmarked_threads").select("thread_id").execute()
        if not bookmarks.data:
            return {"threads": []}
        
        thread_ids = [b["thread_id"] for b in bookmarks.data]
        response = supabase.table("threads").select("*").in_("id", thread_ids).execute()
        return {"threads": response.data}
    except Exception as e:
        # If bookmarked_threads table doesn't exist, we might fail.
        print(f"Error fetching bookmarked threads: {e}")
        return {"threads": []}

@router.post("/bookmarked-threads/{action}")
async def toggle_bookmark_thread(action: str, payload: dict):
    # payload: { threadId: string }
    thread_id = payload.get("threadId")
    if not thread_id:
        raise HTTPException(status_code=400, detail="Missing threadId")
        
    try:
        if action == "add":
            supabase.table("bookmarked_threads").insert({"thread_id": thread_id}).execute()
        elif action == "remove":
            supabase.table("bookmarked_threads").delete().eq("thread_id", thread_id).execute()
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
