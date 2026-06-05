from typing import Literal, Optional
from pydantic import BaseModel, Field


# ── 양보 이력 ──────────────────────────────────────────────────────────────────

class ConcessionRecord(BaseModel):
    meetingDate: str = Field(description="해당 약속이 이루어진 날짜 (추정)")
    concessionType: Literal["distance", "time", "menu", "budget"] = Field(
        description="양보 유형"
    )
    description: str = Field(description="양보 내용 (예: '서면→해운대 이동 감수')")
    weight: float = Field(description="양보 강도 0~10 (거리·시간·금액 기준으로 수치화)")


class ParticipantConcessionHistory(BaseModel):
    participantName: str
    totalConcessionScore: float = Field(
        description="과거 누적 양보 점수. 높을수록 이번에 더 배려받아야 함"
    )
    records: list[ConcessionRecord] = Field(description="개별 양보 기록 목록")


class ConcessionHistoryResult(BaseModel):
    hasHistory: bool = Field(description="분석 가능한 과거 약속 이력이 있는지")
    participants: list[ParticipantConcessionHistory] = Field(
        description="참여자별 양보 이력"
    )
    summary: str = Field(description="전체 이력 한 줄 요약")


# ── 정보 충분성 판단 ────────────────────────────────────────────────────────────

class InfoSufficiencyJudgment(BaseModel):
    is_sufficient: bool = Field(description="랭킹을 진행하기에 충분한 정보인지")
    reason: str = Field(description="판단 근거")


# ── 기존 스키마 ─────────────────────────────────────────────────────────────────

class ParticipantDraft(BaseModel):
    id: str
    name: str
    startLocation: str
    conditionText: str = ""


class AnalysisRequest(BaseModel):
    targetDateText: str
    discussionStartedAt: str = ""
    discussionEndedAt: str = ""
    participants: list[ParticipantDraft] = Field(default_factory=list)


class ExtractedConstraint(BaseModel):
    participant: str = Field(description="제약 조건을 가진 참여자 이름")
    type: Literal["time", "place", "menu", "distance", "budget", "unknown"] = Field(
        description="제약 조건 유형"
    )
    content: str = Field(description="제약 조건 내용")


class ExtractionResult(BaseModel):
    participants: list[str] = Field(description="채팅에서 확인된 참여자 이름 목록")
    candidateTimes: list[str] = Field(description="후보 약속 시간 목록 (예: '2024-01-20 19:00')")
    candidatePlaces: list[str] = Field(description="후보 장소 목록")
    candidateMenus: list[str] = Field(description="후보 메뉴/음식 카테고리 목록")
    constraints: list[ExtractedConstraint] = Field(description="참여자별 제약 조건 목록")
    needsMoreInfo: list[str] = Field(description="결정에 필요하지만 정보가 부족한 항목 목록")


class RankedCandidate(BaseModel):
    candidateId: str = Field(description="후보 ID (candidate-1, candidate-2, ...)")
    rank: int = Field(description="순위 (1부터 시작)")
    time: str = Field(description="약속 시간")
    place: str = Field(description="약속 장소")
    menu: str = Field(description="메뉴")
    totalScore: float = Field(description="총 점수 (0~100)")
    reasons: list[str] = Field(description="이 순위를 받은 이유 목록")


class RankingResult(BaseModel):
    rankedCandidates: list[RankedCandidate] = Field(description="순위별 후보 목록 (최대 3개)")


class RecommendationResult(BaseModel):
    selectedCandidateId: str = Field(description="선정된 후보의 ID")
    summary: str = Field(description="선정 이유를 포함한 요약문")
    groupMessageDraft: str = Field(description="단체 채팅방에 보낼 메시지 초안")


class MeetingAnalysisResponse(BaseModel):
    meetingId: int
    extracted: ExtractionResult
    rankedCandidates: list[RankedCandidate]
    recommendation: RecommendationResult
