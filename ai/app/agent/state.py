from typing import Optional
from typing_extensions import TypedDict
from app.schemas.meeting import (
    ConcessionHistoryResult,
    ExtractionResult,
    RankedCandidate,
    RecommendationResult,
    ParticipantDraft,
)


class AgentState(TypedDict):
    # 입력
    chat_text: str
    target_date_text: str
    discussion_started_at: str
    discussion_ended_at: str
    participants: list[ParticipantDraft]
    meeting_id: int

    # history_node 결과
    concession_history: Optional[ConcessionHistoryResult]

    # extract_node 결과
    extracted: Optional[ExtractionResult]

    # rank_node 결과
    ranked_candidates: Optional[list[RankedCandidate]]

    # recommend / negotiate / fallback 결과
    recommendation: Optional[RecommendationResult]
