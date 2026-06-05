import time
import logging
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from app.schemas.meeting import AnalysisRequest, MeetingAnalysisResponse
from app.agent.graph import graph

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=MeetingAnalysisResponse)
async def analyze(
    conversationFile: UploadFile = File(..., description="채팅 텍스트 파일"),
    analysisRequest: str = Form(..., description="분석 요청 JSON 문자열"),
):
    try:
        raw_bytes = await conversationFile.read()
        chat_text = raw_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일 읽기 실패: {e}")

    try:
        request_data = AnalysisRequest.model_validate_json(analysisRequest)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"analysisRequest 파싱 실패: {e}")

    logger.info(
        "분석 요청 수신 - 파일: %s, 참여자 수: %d",
        conversationFile.filename,
        len(request_data.participants),
    )

    initial_state: dict = {
        "chat_text": chat_text,
        "target_date_text": request_data.targetDateText,
        "discussion_started_at": request_data.discussionStartedAt,
        "discussion_ended_at": request_data.discussionEndedAt,
        "participants": request_data.participants,
        "meeting_id": int(time.time() * 1000),
        "concession_history": None,
        "extracted": None,
        "ranked_candidates": None,
        "recommendation": None,
    }

    try:
        result = await graph.ainvoke(initial_state)
    except Exception as e:
        logger.exception("LangGraph 에이전트 실행 실패")
        raise HTTPException(status_code=500, detail=f"AI 분석 실패: {e}")

    return MeetingAnalysisResponse(
        meetingId=result["meeting_id"],
        extracted=result["extracted"],
        rankedCandidates=result["ranked_candidates"],
        recommendation=result["recommendation"],
    )
