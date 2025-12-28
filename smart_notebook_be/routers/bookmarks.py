from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from smart_notebook_be.db import supabase

router = APIRouter()

class BookmarkCreate(BaseModel):
    threadId: str
    text: str
    translation: str
    type: str  # "word" | "sentence"

@router.get("/bookmarks/{thread_id}")
async def get_bookmarks(thread_id: str):
    try:
        response = supabase.table("bookmarks").select("*").eq("thread_id", thread_id).order("created_at", desc=True).execute()
        return {"bookmarks": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bookmarks")
async def create_bookmark(bookmark: BookmarkCreate):
    try:
        data = {
            "thread_id": bookmark.threadId,
            "text": bookmark.text,
            "translation": bookmark.translation,
            "type": bookmark.type
        }
        response = supabase.table("bookmarks").insert(data).execute()
        if response.data:
            return {"bookmark": response.data[0]}
        raise HTTPException(status_code=400, detail="Failed to create bookmark")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ThreadBookmarkRequest(BaseModel):
    threadId: str

@router.get("/bookmarked-threads")
async def get_bookmarked_threads():
    try:
        # User ref code returns { bookmarkedThreads: [id, id, ...] }
        # But wait, App.tsx (line 100) expects { threads: [ThreadObject, ...] }
        # "const validThreads = (data.threads || [])..."
        # My SQL table `bookmarked_threads` likely only has thread_id?
        # Let's check db.py init_db.
        # It has: thread_id TEXT PRIMARY KEY, created_at...
        # It does NOT join with threads table automatically.
        # But App.tsx expects full thread objects?
        # "const data = await response.json(); const validThreads = (data.threads || [])... setBookmarkedThreads(validThreads)"
        # validThreads are supposed to be Thread[] objects.
        
        # So I need to join or fetch threads.
        # 1. Fetch bookmarked thread IDs.
        # 2. Fetch those threads from `threads` table.
        
        bm_res = supabase.table("bookmarked_threads").select("thread_id").execute()
        ids = [row["thread_id"] for row in bm_res.data]
        
        if not ids:
             return {"threads": []}
             
        # Fetch threads where id IN ids (My DBWrapper has in_ method)
        threads_res = supabase.table("threads").select("*").in_("id", ids).order("updated_at", desc=True).execute()
        return {"threads": threads_res.data}
        
    except Exception as e:
        print(f"Error fetching bookmarked threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bookmarked-threads/add")
async def add_bookmarked_thread(req: ThreadBookmarkRequest):
    try:
        # Check if exists
        check = supabase.table("bookmarked_threads").select("*").eq("thread_id", req.threadId).execute()
        if not check.data:
            supabase.table("bookmarked_threads").insert({"thread_id": req.threadId}).execute()
        return {"success": True}
    except Exception as e:
        print(f"Error adding bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bookmarked-threads/remove")
async def remove_bookmarked_thread(req: ThreadBookmarkRequest):
    try:
        supabase.table("bookmarked_threads").delete().eq("thread_id", req.threadId).execute()
        return {"success": True}
    except Exception as e:
        print(f"Error removing bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))
