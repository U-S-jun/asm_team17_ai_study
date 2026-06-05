import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analyze import router as analyze_router

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("LANGCHAIN_TRACING_V2") == "true":
        logger.info(
            "LangSmith 트레이싱 활성화 — project: %s",
            os.getenv("LANGCHAIN_PROJECT", "(미설정)"),
        )
    else:
        logger.info("LangSmith 트레이싱 비활성화")
    logger.info("AI 서버 시작 완료")
    yield
    logger.info("AI 서버 종료")


app = FastAPI(
    title="AI Meeting Analyzer",
    description="LangGraph 기반 모임 약속 분석 에이전트",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router, prefix="/api", tags=["analyze"])


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}
