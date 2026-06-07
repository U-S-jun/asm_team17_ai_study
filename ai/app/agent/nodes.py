from __future__ import annotations

import json
import logging
import os
import re
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
    CandidateHint,
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


PRIMARY_KEYWORDS = ("1순위", "확정", "거의 확정", "제일 무난", "가장 무난", "기본 제안")
FALLBACK_KEYWORDS = ("자리 없으면", "안 되면", "대체", "2순위", "후보로 두자")
REJECT_KEYWORDS = ("빼자", "제외", "애매", "너무 멀", "불편", "부담스럽", "이동이 좀 늘")
CLOCK_PATTERN = re.compile(r"(?P<hour>\d{1,2}):(?P<minute>\d{2})")
KOREAN_TIME_PATTERN = re.compile(
    r"(?P<hour>\d{1,2})\s*시\s*(?P<half>반)?\s*(?P<minute>\d{1,2})?\s*분?"
)


def _normalize_text(value: str | None) -> str:
    return re.sub(r"[\s,./()_-]+", "", value or "").lower()


def _has_hint_value(hint: CandidateHint | None) -> bool:
    return bool(hint and (hint.time.strip() or hint.place.strip() or hint.menu.strip()))


def _message_body(line: str) -> str:
    parts = line.split(",", 2)
    if len(parts) == 3 and re.match(r"\d{4}[.-]\d{2}[.-]\d{2}\s+\d{2}:\d{2}", parts[0]):
        return parts[2]
    return line


def _merge_hints(previous: CandidateHint | None, current: CandidateHint) -> CandidateHint:
    if not previous:
        return current
    return CandidateHint(
        time=current.time or previous.time,
        place=current.place or previous.place,
        menu=current.menu or previous.menu,
        reason=current.reason or previous.reason,
    )


def _prepend_reason(reasons: list[str], reason: str) -> list[str]:
    cleaned = [r for r in reasons if r and r != reason]
    return [reason, *cleaned][:6]


def _clamp_score(score: float | int | None) -> float:
    try:
        value = float(score if score is not None else 0.0)
    except (TypeError, ValueError):
        value = 0.0
    return max(0.0, min(100.0, value))


def _extract_clock_text(text: str, candidate_times: list[str]) -> str:
    clock_match = CLOCK_PATTERN.search(text)
    if clock_match:
        target = f"{int(clock_match.group('hour')):02d}:{clock_match.group('minute')}"
    else:
        korean_match = KOREAN_TIME_PATTERN.search(text)
        if not korean_match:
            return ""
        hour = int(korean_match.group("hour"))
        if hour < 12:
            hour += 12
        minute = 30 if korean_match.group("half") else int(korean_match.group("minute") or 0)
        target = f"{hour:02d}:{minute:02d}"

    for candidate_time in candidate_times:
        if target in candidate_time:
            return candidate_time
    return target


def _find_option(options: list[str], text: str) -> str:
    normalized_text = _normalize_text(text)
    for option in sorted(options, key=len, reverse=True):
        normalized_option = _normalize_text(option)
        if normalized_option and (
            normalized_option in normalized_text or normalized_text in normalized_option
        ):
            return option

        for token in re.split(r"[\s/,_-]+", option):
            normalized_token = _normalize_text(token)
            if len(normalized_token) >= 2 and normalized_token in normalized_text:
                return option
    return ""


def _hint_from_line(
    line: str,
    extracted: ExtractionResult,
    *,
    fallback: bool = False,
) -> CandidateHint:
    search_text = _message_body(line)
    if fallback:
        for keyword in FALLBACK_KEYWORDS:
            if keyword in search_text:
                search_text = search_text.split(keyword, 1)[-1]
                break
    else:
        for keyword in FALLBACK_KEYWORDS:
            if keyword in search_text:
                search_text = search_text.split(keyword, 1)[0]
                break

    return CandidateHint(
        time=_extract_clock_text(search_text, extracted.candidateTimes),
        place=_find_option(extracted.candidatePlaces, search_text),
        menu=_find_option(extracted.candidateMenus, search_text),
        reason=line.strip(),
    )


def _augment_decision_hints(extracted: ExtractionResult, current_lines: list[str]) -> ExtractionResult:
    primary = extracted.primaryCandidate
    fallbacks = list(extracted.fallbackCandidates)
    rejected = list(extracted.rejectedOptions)

    for line in current_lines:
        if any(keyword in line for keyword in PRIMARY_KEYWORDS):
            hint = _hint_from_line(line, extracted)
            if _has_hint_value(hint):
                primary = _merge_hints(primary, hint)

        if any(keyword in line for keyword in FALLBACK_KEYWORDS):
            hint = _hint_from_line(line, extracted, fallback=True)
            if _has_hint_value(hint):
                fallbacks.append(hint)

        if any(keyword in line for keyword in REJECT_KEYWORDS):
            hint = _hint_from_line(line, extracted)
            if _has_hint_value(hint):
                rejected.append(hint)

    extracted.primaryCandidate = primary if _has_hint_value(primary) else None
    extracted.fallbackCandidates = _dedupe_hints(fallbacks)
    extracted.rejectedOptions = _dedupe_hints(rejected)
    return extracted


def _dedupe_hints(hints: list[CandidateHint]) -> list[CandidateHint]:
    seen: set[tuple[str, str, str]] = set()
    deduped: list[CandidateHint] = []
    for hint in hints:
        if not _has_hint_value(hint):
            continue
        key = (
            _normalize_text(hint.time),
            _normalize_text(hint.place),
            _normalize_text(hint.menu),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(hint)
    return deduped


def _time_matches(candidate_time: str, hint_time: str) -> bool:
    if not hint_time:
        return True
    candidate_clock = CLOCK_PATTERN.search(candidate_time)
    hint_clock = CLOCK_PATTERN.search(hint_time)
    if candidate_clock and hint_clock:
        return candidate_clock.group(0) == hint_clock.group(0)
    candidate_norm = _normalize_text(candidate_time)
    hint_norm = _normalize_text(hint_time)
    return bool(hint_norm and (hint_norm in candidate_norm or candidate_norm in hint_norm))


def _field_matches(candidate_value: str, hint_value: str) -> bool:
    if not hint_value:
        return True
    candidate_norm = _normalize_text(candidate_value)
    hint_norm = _normalize_text(hint_value)
    return bool(hint_norm and (hint_norm in candidate_norm or candidate_norm in hint_norm))


def _candidate_matches_hint(candidate: RankedCandidate, hint: CandidateHint) -> bool:
    checks = []
    if hint.time:
        checks.append(_time_matches(candidate.time, hint.time))
    if hint.place:
        checks.append(_field_matches(candidate.place, hint.place))
    if hint.menu:
        checks.append(_field_matches(candidate.menu, hint.menu))
    return bool(checks) and all(checks)


def _resolve_time(hint: CandidateHint, extracted: ExtractionResult) -> str:
    if hint.time:
        clock = CLOCK_PATTERN.search(hint.time)
        if clock:
            for candidate_time in extracted.candidateTimes:
                if clock.group(0) in candidate_time:
                    return candidate_time
        return hint.time
    return extracted.candidateTimes[0] if extracted.candidateTimes else "미정"


def _resolve_place(
    hint: CandidateHint,
    extracted: ExtractionResult,
    primary: CandidateHint | None = None,
) -> str:
    if hint.place:
        return hint.place

    primary_location = ""
    if primary and primary.place:
        primary_location = re.split(r"[\s/,_-]+", primary.place.strip())[0]

    menu_norm = _normalize_text(hint.menu).replace("집", "")
    location_norm = _normalize_text(primary_location)
    if menu_norm and location_norm:
        for place in extracted.candidatePlaces:
            place_norm = _normalize_text(place)
            if location_norm in place_norm and menu_norm in place_norm:
                return place

    if primary_location:
        return primary_location
    return extracted.candidatePlaces[0] if extracted.candidatePlaces else "미정"


def _resolve_menu(hint: CandidateHint, extracted: ExtractionResult) -> str:
    if hint.menu:
        return hint.menu
    return extracted.candidateMenus[0] if extracted.candidateMenus else "미정"


def _candidate_key(candidate: RankedCandidate) -> tuple[str, str, str]:
    return (
        _normalize_text(candidate.time),
        _normalize_text(candidate.place),
        _normalize_text(candidate.menu),
    )


def _pop_matching_candidate(
    candidates: list[RankedCandidate],
    hint: CandidateHint,
) -> RankedCandidate | None:
    for index, candidate in enumerate(candidates):
        if _candidate_matches_hint(candidate, hint):
            return candidates.pop(index)
    return None


def _candidate_from_hint(
    hint: CandidateHint,
    extracted: ExtractionResult,
    *,
    score: float,
    primary: CandidateHint | None = None,
) -> RankedCandidate:
    return RankedCandidate(
        candidateId="candidate-0",
        rank=0,
        time=_resolve_time(hint, extracted),
        place=_resolve_place(hint, extracted, primary),
        menu=_resolve_menu(hint, extracted),
        totalScore=score,
        reasons=[],
    )


def _postprocess_ranked_candidates(
    candidates: list[RankedCandidate],
    extracted: ExtractionResult,
) -> list[RankedCandidate]:
    working = list(candidates)
    for candidate in working:
        candidate.totalScore = _clamp_score(candidate.totalScore)

    primary = extracted.primaryCandidate if _has_hint_value(extracted.primaryCandidate) else None
    fallbacks = _dedupe_hints(extracted.fallbackCandidates)
    rejected = _dedupe_hints(extracted.rejectedOptions)

    ordered: list[RankedCandidate] = []

    if primary:
        candidate = _pop_matching_candidate(working, primary) or _candidate_from_hint(
            primary, extracted, score=100.0
        )
        candidate.totalScore = 100.0
        candidate.reasons = _prepend_reason(
            candidate.reasons,
            f"현재 논의에서 1순위/확정 후보로 명시됨: {primary.reason or '명시 후보'}",
        )
        ordered.append(candidate)

    for fallback in fallbacks:
        candidate = _pop_matching_candidate(working, fallback) or _candidate_from_hint(
            fallback, extracted, score=92.0, primary=primary
        )
        candidate.totalScore = min(92.0, max(_clamp_score(candidate.totalScore), 88.0))
        candidate.reasons = _prepend_reason(
            candidate.reasons,
            f"현재 논의에서 대체안으로 명시됨: {fallback.reason or '명시 대체안'}",
        )
        ordered.append(candidate)
        if len(ordered) >= 3:
            break

    rest: list[RankedCandidate] = []
    for candidate in working:
        for rejected_hint in rejected:
            if _candidate_matches_hint(candidate, rejected_hint):
                candidate.totalScore = _clamp_score(candidate.totalScore - 25.0)
                candidate.reasons = _prepend_reason(
                    candidate.reasons,
                    f"현재 논의에서 제외/부담 후보로 언급됨: {rejected_hint.reason or '제외 후보'}",
                )
                break

        if primary and not any(_candidate_matches_hint(candidate, hint) for hint in [primary, *fallbacks]):
            candidate.totalScore = min(candidate.totalScore, 88.0)
            candidate.reasons = _prepend_reason(
                candidate.reasons,
                "과거 양보 이력은 현재 명시 합의를 뒤집지 않는 보조 기준으로만 반영됨",
            )

        candidate.totalScore = _clamp_score(candidate.totalScore)
        rest.append(candidate)

    rest.sort(key=lambda candidate: candidate.totalScore, reverse=True)

    result: list[RankedCandidate] = []
    seen: set[tuple[str, str, str]] = set()
    for candidate in [*ordered, *rest]:
        key = _candidate_key(candidate)
        if key in seen:
            continue
        seen.add(key)
        result.append(candidate)
        if len(result) == 3:
            break

    times = extracted.candidateTimes or ["미정"]
    places = extracted.candidatePlaces or ["미정"]
    menus = extracted.candidateMenus or ["미정"]
    while len(result) < 3:
        idx = len(result)
        result.append(
            RankedCandidate(
                candidateId=f"candidate-{idx + 1}",
                rank=idx + 1,
                time=times[idx % len(times)],
                place=places[idx % len(places)],
                menu=menus[idx % len(menus)],
                totalScore=max(0.0, (result[-1].totalScore if result else 50.0) - 10.0),
                reasons=["대안 후보 (상위 후보와 유사한 조건으로 자동 생성)"],
            )
        )

    for index, candidate in enumerate(result[:3], start=1):
        candidate.rank = index
        candidate.candidateId = f"candidate-{index}"
        candidate.totalScore = _clamp_score(candidate.totalScore)

    return result[:3]


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
    result = _augment_decision_hints(result, current_lines or state["chat_text"].splitlines())
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
    decision_hints_json = json.dumps(
        {
            "primaryCandidate": (
                extracted.primaryCandidate.model_dump()
                if extracted.primaryCandidate
                else None
            ),
            "fallbackCandidates": [c.model_dump() for c in extracted.fallbackCandidates],
            "rejectedOptions": [c.model_dump() for c in extracted.rejectedOptions],
        },
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

현재 논의에서 명시된 후보:
{decision_hints_json}

참여자 개인 추가 조건:
{participants_conditions or "없음"}
{history_section}"""

    llm = _get_llm()
    result = await llm.with_structured_output(RankingResult).ainvoke(
        [SystemMessage(content=RANK_SYSTEM_PROMPT), HumanMessage(content=user_message)]
    )

    candidates = _postprocess_ranked_candidates(result.rankedCandidates, extracted)
    return {"ranked_candidates": candidates}


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
