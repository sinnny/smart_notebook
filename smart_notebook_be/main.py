import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, threads, bookmarks

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "*"  # Verify if this is safe for production, usually specific origins are better
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(threads.router)
app.include_router(bookmarks.router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Smart Notebook Backend is running"}
