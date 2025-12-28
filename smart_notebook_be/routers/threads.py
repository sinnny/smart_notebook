from fastapi import APIRouter, HTTPException, Depends
from smart_notebook_be.db import supabase
from smart_notebook_be.schemas import (
    ThreadCreate,
    ThreadList,
    ThreadResponse,
    MessageList,
    SuccessResponse,
    ThreadActionRequest,
)
from smart_notebook_be.deps import get_current_user_id

router = APIRouter()


@router.get("/threads", response_model=ThreadList)
async def get_threads(user_id: str = Depends(get_current_user_id)):
    try:
        # Filter by user_id
        response = (
            supabase.table("threads")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return ThreadList(threads=response.data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/threads", response_model=ThreadResponse)
async def create_thread(
    thread: ThreadCreate, user_id: str = Depends(get_current_user_id)
):
    try:
        # Insert with user_id
        data = {"title": thread.title, "user_id": user_id}
        response = supabase.table("threads").insert(data).execute()
        if response.data:
            return ThreadResponse(thread=response.data[0])
        raise HTTPException(status_code=400, detail="Failed to create thread")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/threads/{thread_id}", response_model=SuccessResponse)
async def delete_thread(thread_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        # Verify ownership (delete only if user_id matches)
        # supabase delete doesn't return count easily in this wrapper, so explicit check might be safer or just conditional delete
        # DBWrapper delete doesn't support multiple conditions easily (eq().eq() might work if implemented, lets check db.py)
        # db.py Table.eq overwrites _eq_col. It does NOT support multiple conditions.
        # It supports _in_col and _eq_col but not multiple ANDs for different cols easily?
        # Wait, db.py: eq() implementation sets self._eq_col = column. Calling it twice overwrites.
        # CRITICAL LIMITATION: DBWrapper cannot do WHERE id=X AND user_id=Y.
        # WORKAROUND: Select first to verify ownership, then delete.

        check = supabase.table("threads").select("id").eq("id", thread_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Thread not found")

        # We need to check if this thread belongs to user.
        # But wait, we can't select with two conditions either?
        # Check: db.py select implementation.
        # It handles _eq_col OR _in_col. Not both. And only one _eq_col.
        # LIMITATION: We can only filter by ONE column.

        # Solution: Fetch by ID (primary key unique), then check user_id in python.
        thread = supabase.table("threads").select("*").eq("id", thread_id).execute()
        if not thread.data:
            raise HTTPException(status_code=404, detail="Thread not found")

        if thread.data[0].get("user_id") != user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to delete this thread"
            )

        supabase.table("threads").delete().eq("id", thread_id).execute()
        return SuccessResponse(success=True, message="Thread deleted")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/threads/{thread_id}/messages", response_model=MessageList)
async def get_thread_messages(
    thread_id: str, user_id: str = Depends(get_current_user_id)
):
    try:
        # Verify ownership first
        # Ideally we join but wrapper is limited.
        thread = (
            supabase.table("threads").select("user_id").eq("id", thread_id).execute()
        )
        if not thread.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        if thread.data[0].get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        response = (
            supabase.table("messages")
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at")
            .execute()
        )
        return MessageList(messages=response.data)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bookmarked-threads", response_model=ThreadList)
async def get_bookmarked_threads(user_id: str = Depends(get_current_user_id)):
    try:
        # Strategy: Get all bookmarked thread IDs, then fetch those threads filtering by user_id
        # Note: bookmarked_threads table is just thread_id.
        bookmarks = supabase.table("bookmarked_threads").select("thread_id").execute()
        if not bookmarks.data:
            return ThreadList(threads=[])

        thread_ids = [b["thread_id"] for b in bookmarks.data]

        # Now fetch threads where id IN (...) AND user_id = current.
        # Wrapper limitation: Cannot do IN and EQ together?
        # db.py: if hasattr(self, "_eq_col") ... elif hasattr(self, "_in_col").
        # It's mutually exclusive block.

        # Workaround: Fetch threads by IN IDs, then filter in Python.
        response = supabase.table("threads").select("*").in_("id", thread_ids).execute()

        # Filter by user_id
        my_threads = [t for t in response.data if t.get("user_id") == user_id]

        # Re-sort if needed (though IN usually loses order, we sort by updated_at?)
        # Let's sort manually since we lost DB order capability if we did IN.
        # Although client might re-sort.
        my_threads.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

        return ThreadList(threads=my_threads)
    except Exception as e:
        print(f"Error fetching bookmarked threads: {e}")
        return ThreadList(threads=[])


@router.post("/bookmarked-threads/{action}", response_model=SuccessResponse)
async def toggle_bookmark_thread(
    action: str, req: ThreadActionRequest, user_id: str = Depends(get_current_user_id)
):
    try:
        # Verify ownership of the thread first
        thread = (
            supabase.table("threads").select("user_id").eq("id", req.threadId).execute()
        )
        if not thread.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        if thread.data[0].get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        if action == "add":
            # Check if already bookmarked
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
        elif action == "remove":
            supabase.table("bookmarked_threads").delete().eq(
                "thread_id", req.threadId
            ).execute()
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        return SuccessResponse(success=True)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
