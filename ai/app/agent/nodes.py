import json
import logging
import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.state import AgentState
from app.agent.chat_parser import filter_chat_lines
from app.agent.prompts import (
    HISTORY_SYSTEM_PROMPT,
    EXTRACT_SYSTEM_PROMPT,
    RANK_SYSTEM_PROMPT,
    RECOMMEND_SYSTEM_PROMPT,
    NEGOTIATE_SYSTEM_PROMPT,
    FALLBACK_SYSTEM_PROMPT,
)
from app.schemas.meeting import (
    ConcessionHistoryResult,
    ExtractionResult,
    InfoSufficiencyJudgment,
    RankedCandidate,
    RankingResult,
    RecommendationResult,
)

logger = logging.getLogger(__name__)


def _get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=os.getenv("UPSTAGE_MODEL", "solar-pro"),
        temperature=0,
        api_key=os.getenv("UPSTAGE_API_KEY"),
        base_url="https://api.upstage.ai/v1",
    )


# ── 1. history_node ────────────────────────────────────────────────────────────
# discussionStartedAt 이전 메시지를 파싱하여 참여자별 양보 이력을 수치화합니다.

async def history_node(state: AgentState) -> dict:
    started_at = state["discussion_started_at"]
    participant_names = [p.name for p in state["participants"]]

    history_lines = filter_chat_lines(
        state["chat_text"],
        started_at,
        before_start=True,
    )

    if not history_lines:
        logger.info("과거 이력 없음 — history_node 스킵")
        return {
            "concession_history": ConcessionHistoryResult(
                hasHistory=False, participants=[], summary="과거 약속 이력 없음"
            )
        }

    history_text = "\n".join(history_lines)
    llm = _get_llm()
    structured_llm = llm.with_structured_output(ConcessionHistoryResult)

    user_message = f"""참여자: {participant_names}
현재 논의 시작 시각: {started_at}

[현재 논의 이전의 과거 채팅 내용]
---
{history_text}
---
위 내용에서 과거 약속 관련 대화를 찾아 참여자별 양보 이력을 수치화하세요."""

    result = await structured_llm.ainvoke(
        [SystemMessage(content=HISTORY_SYSTEM_PROMPT), HumanMessage(content=user_message)]
    )
    logger.info("양보 이력 분석 완료 — hasHistory=%s", result.hasHistory)
    return {"concession_history": result}


# ── 2. extract_node ────────────────────────────────────────────────────────────
# discussionStartedAt ~ discussionEndedAt 구간의 현재 논의를 분석합니다.

async def extract_node(state: AgentState) -> dict:
    started_at = state["discussion_started_at"]
    ended_at = state["discussion_ended_at"]

    current_lines = filter_chat_lines(
        state["chat_text"],
        started_at,
        ended_at,
    )

    chat_window = "\n".join(current_lines) if current_lines else state["chat_text"]

    participants_info = "\n".join(
        f"- {p.name} (출발지: {p.startLocation}, 조건: {p.conditionText or '없음'})"
        for p in state["participants"]
    )

    user_message = f"""채팅 내용 (논의 구간: {started_at} ~ {ended_at}):
---
{chat_window or "(채팅 내용 없음)"}
---

참여자 정보:
{participants_info or "(참여자 정보 없음)"}

목표 날짜: {state["target_date_text"] or "미정"}
"""

    llm = _get_llm()
    result = await llm.with_structured_output(ExtractionResult).ainvoke(
        [SystemMessage(content=EXTRACT_SYSTEM_PROMPT), HumanMessage(content=user_message)]
    )
    return {"extracted": result}


# ── 3. rank_node ───────────────────────────────────────────────────────────────
# 양보 이력을 가중치로 반영하여 후보를 점수화합니다.

async def rank_node(state: AgentState) -> dict:
    extracted = state["extracted"]
    history = state.get("concession_history")

    participants_conditions = "\n".join(
        f"- {p.name}: {p.conditionText}"
        for p in state["participants"]
        if p.conditionText.strip()
    )

    constraints_json = json.dumps(
        [c.model_dump() for c in extracted.constraints],
        ensure_ascii=False,
        indent=2,
    )

    history_section = ""
    if history and history.hasHistory:
        history_section = "\n[과거 양보 이력 — 점수 보정에 반영하세요]\n"
        history_section += f"요약: {history.summary}\n"
        for p in history.participants:
            history_section += (
                f"- {p.participantName}: 누적 양보 점수 {p.totalConcessionScore}점\n"
            )
            for r in p.records:
                history_section += (
                    f"  · {r.meetingDate} {r.concessionType} 양보 "
                    f"(강도 {r.weight}/10): {r.description}\n"
                )
        history_section += (
            "\n양보 점수가 높은 참여자의 선호를 더 우선시하여 이동거리 형평성 점수를 보정하세요.\n"
        )

    user_message = f"""후보 시간: {extracted.candidateTimes}
후보 장소: {extracted.candidatePlaces}
후보 메뉴: {extracted.candidateMenus}

채팅 기반 제약 조건:
{constraints_json}

참여자 개인 추가 조건:
{participants_conditions or "없음"}
{history_section}"""

    llm = _get_llm()
    result = await llm.with_structured_output(RankingResult).ainvoke(
        [SystemMessage(content=RANK_SYSTEM_PROMPT), HumanMessage(content=user_message)]
    )

    candidates = result.rankedCandidates

    # 3개 미만이면 부족한 슬롯을 기본값으로 채움
    times = extracted.candidateTimes or ["미정"]
    places = extracted.candidatePlaces or ["미정"]
    menus = extracted.candidateMenus or ["미정"]

    while len(candidates) < 3:
        idx = len(candidates)
        candidates.append(
            RankedCandidate(
                candidateId=f"candidate-{idx + 1}",
                rank=idx + 1,
                time=times[idx % len(times)],
                place=places[idx % len(places)],
                menu=menus[idx % len(menus)],
                totalScore=max(0.0, (candidates[-1].totalScore if candidates else 50.0) - 10.0),
                reasons=["대안 후보 (상위 후보와 유사한 조건으로 자동 생성)"],
            )
        )
        logger.info("후보 자동 보완 — candidate-%d 추가", idx + 1)

    # rank 필드 순서 정렬 보장
    for i, c in enumerate(candidates[:3]):
        c.rank = i + 1

    return {"ranked_candidates": candidates[:3]}


# ── 4. recommend_node ──────────────────────────────────────────────────────────

async def recommend_node(state: AgentState) -> dict:
    candidates_json = json.dumps(
        [c.model_dump() for c in state["ranked_candidates"]],
        ensure_ascii=False,
        indent=2,
    )
    participant_names = [p.name for p in state["participants"]]

    user_message = f"""참여자: {participant_names}

순위별 후보 목록:
{candidates_json}
"""

    llm = _get_llm()
    result = await llm.with_structured_output(RecommendationResult).ainvoke(
        [SystemMessage(content=RECOMMEND_SYSTEM_PROMPT), HumanMessage(content=user_message)]
    )
    return {"recommendation": result}


# ── 5. negotiate_node ──────────────────────────────────────────────────────────

async def negotiate_node(state: AgentState) -> dict:
    candidates = state["ranked_candidates"]
    candidates_json = json.dumps(
        [c.model_dump() for c in candidates],
        ensure_ascii=False,
        indent=2,
    )

    history = state.get("concession_history")
    history_note = ""
    if history and history.hasHistory:
        top_conceder = max(
            history.participants,
            key=lambda p: p.totalConcessionScore,
            default=None,
        )
        if top_conceder and top_conceder.totalConcessionScore > 0:
            history_note = (
                f"\n참고: {top_conceder.participantName}이(가) 과거에 가장 많이 양보했습니다"
                f" (누적 {top_conceder.totalConcessionScore}점). "
                "이번 메시지에서 해당 참여자를 배려하는 선택지를 우선 제시하세요."
            )

    user_message = f"""참여자: {[p.name for p in state['participants']]}

상위 후보들 (점수 차이가 근소함):
{candidates_json}
{history_note}
"""

    llm = _get_llm()
    result = await llm.with_structured_output(RecommendationResult).ainvoke(
        [SystemMessage(content=NEGOTIATE_SYSTEM_PROMPT), HumanMessage(content=user_message)]
    )
    return {"recommendation": result}


# ── 6. fallback_node ───────────────────────────────────────────────────────────

async def fallback_node(state: AgentState) -> dict:
    extracted = state["extracted"]
    needs = extracted.needsMoreInfo if extracted else []

    user_message = f"""추출된 정보가 부족하여 순위를 결정하기 어렵습니다.
부족한 항목: {json.dumps(needs, ensure_ascii=False)}
참여자: {[p.name for p in state['participants']]}
"""

    llm = _get_llm()
    result = await llm.with_structured_output(RecommendationResult).ainvoke(
        [SystemMessage(content=FALLBACK_SYSTEM_PROMPT), HumanMessage(content=user_message)]
    )

    placeholder = RankedCandidate(
        candidateId="candidate-1",
        rank=1,
        time="미정",
        place="미정",
        menu="미정",
        totalScore=0.0,
        reasons=["정보 부족으로 자동 순위를 결정할 수 없습니다."],
    )
    return {
        "ranked_candidates": [placeholder],
        "recommendation": result,
    }


# ── 라우터 함수 ────────────────────────────────────────────────────────────────

async def route_after_extract(state: AgentState) -> str:
    """LLM이 현재 논의 추출 결과를 보고 랭킹 진행 여부를 판단합니다."""
    extracted = state.get("extracted")
    if not extracted:
        return "insufficient"

    if not extracted.candidatePlaces and not extracted.candidateTimes:
        logger.info("route_after_extract → insufficient (장소/시간 모두 없음)")
        return "insufficient"

    llm = _get_llm()
    judgment = await llm.with_structured_output(InfoSufficiencyJudgment).ainvoke(
        [
            SystemMessage(
                content="채팅 분석 결과를 보고, 약속 후보를 의미있게 랭킹하고 추천하기에 "
                "충분한 정보가 추출되었는지 판단하세요. "
                "장소 또는 시간 후보가 1개 이상 있으면 sufficient로 판단하세요."
            ),
            HumanMessage(
                content=f"후보 장소: {extracted.candidatePlaces}\n"
                f"후보 시간: {extracted.candidateTimes}\n"
                f"후보 메뉴: {extracted.candidateMenus}\n"
                f"제약 조건 수: {len(extracted.constraints)}\n"
                f"추가 정보 필요 항목: {extracted.needsMoreInfo}"
            ),
        ]
    )

    route = "sufficient" if judgment.is_sufficient else "insufficient"
    logger.info("route_after_extract → %s (%s)", route, judgment.reason)
    return route


def route_after_rank(state: AgentState) -> str:
    """1위~2위 점수 차이로 단독 추천(clear) vs 복수 제시(close)를 결정합니다."""
    candidates = state.get("ranked_candidates") or []
    if len(candidates) >= 2:
        gap = candidates[0].totalScore - candidates[1].totalScore
        route = "clear" if gap >= 10 else "close"
        logger.info(
            "route_after_rank → %s (1위 %.1f, 2위 %.1f, 차이 %.1f)",
            route,
            candidates[0].totalScore,
            candidates[1].totalScore,
            gap,
        )
        return route
    return "clear"
