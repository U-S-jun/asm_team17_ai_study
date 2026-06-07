import time
import logging
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from app.schemas.meeting import AnalysisRequest, MeetingAnalysisResponse
from app.agent.graph import graph
from app.api.file_decoder import decode_chat_file

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=MeetingAnalysisResponse)
async def analyze(
    conversationFile: UploadFile = File(..., description="채팅 텍스트 파일"),
    analysisRequest: str = Form(..., description="분석 요청 JSON 문자열"),
):
    request_started_at = time.perf_counter()
    meeting_id = int(time.time() * 1000)
    filename = conversationFile.filename or "(unknown)"

    try:
        raw_bytes = await conversationFile.read()
        chat_text = decode_chat_file(raw_bytes)
    except Exception as e:
        elapsed_ms = (time.perf_counter() - request_started_at) * 1000
        logger.exception(
            "[meetingId=%s] [0/6 request] ERROR - 파일 읽기 실패, file=%s, elapsed=%.0fms",
            meeting_id,
            filename,
            elapsed_ms,
        )
        raise HTTPException(status_code=400, detail=f"파일 읽기 실패: {e}")

    try:
        request_data = AnalysisRequest.model_validate_json(analysisRequest)
    except Exception as e:
        elapsed_ms = (time.perf_counter() - request_started_at) * 1000
        logger.exception(
            "[meetingId=%s] [0/6 request] ERROR - analysisRequest 파싱 실패, file=%s, elapsed=%.0fms",
            meeting_id,
            filename,
            elapsed_ms,
        )
        raise HTTPException(status_code=422, detail=f"analysisRequest 파싱 실패: {e}")

    logger.info(
        "[meetingId=%s] [0/6 request] START - file=%s, fileSize=%d bytes, chatLength=%d chars, "
        "participants=%d, targetDate=%s, discussionWindow=%s~%s",
        meeting_id,
        filename,
        len(raw_bytes),
        len(chat_text),
        len(request_data.participants),
        request_data.targetDateText,
        request_data.discussionStartedAt or "(없음)",
        request_data.discussionEndedAt or "(없음)",
    )

    initial_state: dict = {
        "chat_text": chat_text,
        "target_date_text": request_data.targetDateText,
        "discussion_started_at": request_data.discussionStartedAt,
        "discussion_ended_at": request_data.discussionEndedAt,
        "participants": request_data.participants,
        "meeting_id": meeting_id,
        "concession_history": None,
        "extracted": None,
        "ranked_candidates": None,
        "recommendation": None,
    }

    try:
        logger.info(
            "[meetingId=%s] [0/6 request] GRAPH_START - LangGraph 워크플로우 실행",
            meeting_id,
        )
        result = await graph.ainvoke(initial_state)
    except Exception as e:
        elapsed_ms = (time.perf_counter() - request_started_at) * 1000
        logger.exception(
            "[meetingId=%s] [0/6 request] ERROR - LangGraph 에이전트 실행 실패, elapsed=%.0fms",
            meeting_id,
            elapsed_ms,
        )
        raise HTTPException(status_code=500, detail=f"AI 분석 실패: {e}")

    elapsed_ms = (time.perf_counter() - request_started_at) * 1000
    recommendation = result["recommendation"]
    logger.info(
        "[meetingId=%s] [0/6 request] DONE - selectedCandidateId=%s, candidates=%d, totalElapsed=%.0fms",
        meeting_id,
        recommendation.selectedCandidateId if recommendation else "(없음)",
        len(result["ranked_candidates"] or []),
        elapsed_ms,
    )

    return MeetingAnalysisResponse(
        meetingId=result["meeting_id"],
        extracted=result["extracted"],
        rankedCandidates=result["ranked_candidates"],
        recommendation=result["recommendation"],
    )
