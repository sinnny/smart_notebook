from fastapi import Header, HTTPException, Depends
from typing import Optional
from db import supabase
from datetime import datetime

async def get_current_user_id(x_user_id: Optional[str] = Header(None, alias="X-User-Id")) -> str:
    """
    Dependency to get the current user ID from the header.
    If the user does not exist in the DB, create a guest user.
    """
    if not x_user_id:
        # For now, we require the header. In a stricter 'guest' mode, we might generate one?
        # But the requirement says "frontend sends X-User-Id".
        # If missing, it's a client error (or we could optionally fallback to temporary UUID but explicit is better)
        raise HTTPException(status_code=400, detail="X-User-Id header is required")

    try:
        # Check if user exists
        # We assume supabase (DBWrapper) acts synchronously for now as per db.py definition (psycopg2)
        # But wait, routers are async def. DBWrapper uses psycopg2 directly (blocking).
        # We should ideally run this in run_in_executor if it's blocking, but existing code doesn't seem to care much.
        # We'll stick to the existing pattern.
        
        user_res = supabase.table("users").select("id").eq("id", x_user_id).execute()
        
        if not user_res.data:
            # Create guest user
            new_user = {
                "id": x_user_id,
                "user_type": "guest",
                "last_active_at": datetime.now().isoformat()
            }
            # Insert returns the created row
            supabase.table("users").insert(new_user).execute()
        else:
            # Update last active
            # Optimisation: Maybe don't update on EVERY read? But for MVP/Prototype separation it's fine.
            supabase.table("users").update({"last_active_at": datetime.now().isoformat()}).eq("id", x_user_id).execute()
            
        return x_user_id

    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during user validation")
