import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, threads, bookmarks

app = FastAPI()

# CORS configuration
cors_origins_env = os.getenv("CORS_ORIGINS", "")
origins = (
    [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    if cors_origins_env
    else ["http://localhost:5173", "http://localhost:3000"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = os.getenv("API_PREFIX", "/api")
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(threads.router, prefix=API_PREFIX)
app.include_router(bookmarks.router, prefix=API_PREFIX)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Smart Notebook Backend is running"}

@app.get(f"{API_PREFIX}")
def api_root():
    return {"status": "ok", "message": "Smart Notebook Backend API is running"}
