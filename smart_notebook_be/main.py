from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import init_db
import logging
from routers import chat, threads, bookmarks


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행할 작업"""
    # 시작 시
    logger.info("🚀 애플리케이션 시작 중...")
    try:
        init_db()  # 여기서 DB 초기화
        logger.info("✅ 데이터베이스 준비 완료")
    except Exception as e:
        logger.error(f"❌ 데이터베이스 초기화 실패: {e}")
        # 필요시 앱 시작을 중단할 수 있음
        # raise e

    yield  # 앱 실행

    # 종료 시
    logger.info("👋 애플리케이션 종료")


# Exported ASGI app (imported by smart_notebook_be/api/index.py for deployments)
app = FastAPI(lifespan=lifespan)

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
