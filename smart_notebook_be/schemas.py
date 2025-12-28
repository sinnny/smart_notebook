from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from datetime import datetime

# --- Base Models (Output/DB representations) ---

class Thread(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class Message(BaseModel):
    id: str
    thread_id: str
    role: str
    content: str
    originalLanguage: Optional[str] = Field(None, validation_alias="original_language")
    translatedContent: Optional[str] = Field(None, validation_alias="translated_content")
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        populate_by_name = True

class Bookmark(BaseModel):
    id: str
    thread_id: str
    text: str
    translation: str
    type: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Request Models ---

class ThreadCreate(BaseModel):
    title: str

class ThreadActionRequest(BaseModel):
    threadId: str

class ChatRequest(BaseModel):
    threadId: str
    message: str
    translateToEnglish: bool
    autoTranslateResponses: bool
    model: str = "gpt-4o-mini"

class TranslateRequest(BaseModel):
    threadId: Optional[str] = None # made optional to fit different potential usages, though chat.py uses it
    messageId: str

class TranslateTextRequest(BaseModel):
    text: str

class BookmarkCreate(BaseModel):
    # Depending on what the frontend sends. 
    # bookmarks.py: supabase.table("bookmarks").insert(data)
    # The DB expects: thread_id, text, translation, type. 
    # Frontend likely sends camelCase or snake_case. 
    # Let's assume frontend sends camelCase for consistency, but we map to snake_case for DB.
    
    id: str
    thread_id: str = Field(..., validation_alias="threadId")
    text: str
    translation: str
    type: str
    
    class Config:
        populate_by_name = True

# --- Response Models ---

class ThreadList(BaseModel):
    threads: List[Thread]

class MessageList(BaseModel):
    messages: List[Message]

class BookmarkList(BaseModel):
    bookmarks: List[Bookmark]

class SuccessResponse(BaseModel):
    success: bool
    message: Optional[str] = None

class ThreadResponse(BaseModel):
    thread: Thread

class CreateBookmarkResponse(BaseModel):
    bookmark: Bookmark
