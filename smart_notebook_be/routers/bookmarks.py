from fastapi import APIRouter, HTTPException, Depends
from smart_notebook_be.db import supabase
from smart_notebook_be.schemas import (
    BookmarkCreate,
    BookmarkList,
    ThreadList,
    ThreadActionRequest,
    SuccessResponse,
    CreateBookmarkResponse,
)
from smart_notebook_be.deps import get_current_user_id

router = APIRouter()


@router.get("/bookmarks/{thread_id}", response_model=BookmarkList)
async def get_bookmarks(thread_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        # Verify thread ownership
        thread = (
            supabase.table("threads").select("user_id").eq("id", thread_id).execute()
        )
        if not thread.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        if thread.data[0].get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        response = (
            supabase.table("bookmarks")
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at", desc=True)
            .execute()
        )
        return BookmarkList(bookmarks=response.data)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bookmarks", response_model=CreateBookmarkResponse)
async def create_bookmark(
    bookmark: BookmarkCreate, user_id: str = Depends(get_current_user_id)
):
    try:
        # Pydantic handles camelCase to snake_case mapping for us via model_dump()
        # But wait, our schemas.py defines both validation and serialization alias as to_camel.
        # So model_dump(by_alias=False) will give us snake_case (the field names).
        data = bookmark.model_dump(by_alias=True)
        # Note: BookmarkCreate uses validation_alias for inputs (threadId -> thread_id)
        # We need the output to be snake_case keys for the DB insert?
        # Check schemas.py:
        # class BookmarkCreate(BaseModel):
        #    id: str
        #    thread_id: str = Field(..., validation_alias="threadId")
        #
        # model_dump(by_alias=True) -> uses alias if serialization_alias is set? No.
        # model_dump(by_alias=False) -> uses field names (thread_id).
        # We want field names (thread_id) for the DB.

        # Verify thread ownership
        thread_id = bookmark.thread_id
        thread = (
            supabase.table("threads").select("user_id").eq("id", thread_id).execute()
        )
        if not thread.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        if thread.data[0].get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        data = bookmark.model_dump(by_alias=False)
        response = supabase.table("bookmarks").insert(data).execute()
        if response.data:
            return CreateBookmarkResponse(bookmark=response.data[0])
        raise HTTPException(status_code=400, detail="Failed to create bookmark")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bookmarked-threads", response_model=ThreadList)
async def get_bookmarked_threads(user_id: str = Depends(get_current_user_id)):
    # This endpoint is already implemented in threads.py?
    # bookmarks.py also has it? Let's check the file content.
    # Yes, the file content showed it handles bookmarked-threads.
    # WAIT! routers/threads.py has it, AND routers/bookmarks.py has it?
    # That's a route conflict if they are both included in main.py.
    # Let's check main.py later. But I should probably update it here too seamlessly or remove it.
    # The user request said "Existing tables... must remain compatible".
    # If I see duplication, I should fix both to be safe or investigate.

    # Assuming this file serves specific bookmark routes.
    # I will replicate logic or refactor. Given "Minimal diff", I will just add auth logic here too.
    try:
        bm_res = supabase.table("bookmarked_threads").select("thread_id").execute()
        ids = [row["thread_id"] for row in bm_res.data]

        if not ids:
            return ThreadList(threads=[])

        # Fetch threads and filter by user
        # Note: In threads.py I did fetch-then-filter.
        threads_res = (
            supabase.table("threads")
            .select("*")
            .in_("id", ids)
            .order("updated_at", desc=True)
            .execute()
        )

        my_threads = [t for t in threads_res.data if t.get("user_id") == user_id]

        return ThreadList(threads=my_threads)

    except Exception as e:
        print(f"Error fetching bookmarked threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bookmarked-threads/add", response_model=SuccessResponse)
async def add_bookmarked_thread(
    req: ThreadActionRequest, user_id: str = Depends(get_current_user_id)
):
    try:
        # Verify ownership
        thread = (
            supabase.table("threads").select("user_id").eq("id", req.threadId).execute()
        )
        if not thread.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        if thread.data[0].get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Check if exists
        check = (
            supabase.table("bookmarked_threads")
            .select("*")
            .eq("thread_id", req.threadId)
            .execute()
        )
        if not check.data:
            supabase.table("bookmarked_threads").insert(
                {"thread_id": req.threadId}
            ).execute()
        return SuccessResponse(success=True)
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error adding bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bookmarked-threads/remove", response_model=SuccessResponse)
async def remove_bookmarked_thread(
    req: ThreadActionRequest, user_id: str = Depends(get_current_user_id)
):
    try:
        # Verify ownership (even for removal, strict security)
        thread = (
            supabase.table("threads").select("user_id").eq("id", req.threadId).execute()
        )
        if not thread.data:
            # If thread doesn't exist, maybe just return success? Or 404.
            raise HTTPException(status_code=404, detail="Thread not found")
        if thread.data[0].get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        supabase.table("bookmarked_threads").delete().eq(
            "thread_id", req.threadId
        ).execute()
        return SuccessResponse(success=True)
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error removing bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))
