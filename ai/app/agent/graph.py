from langgraph.graph import StateGraph, START, END
from app.agent.state import AgentState
from app.agent.nodes import (
    history_node,
    extract_node,
    rank_node,
    recommend_node,
    negotiate_node,
    fallback_node,
    route_after_extract,
    route_after_rank,
)


def build_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("history", history_node)
    workflow.add_node("extract", extract_node)
    workflow.add_node("rank", rank_node)
    workflow.add_node("recommend", recommend_node)
    workflow.add_node("negotiate", negotiate_node)
    workflow.add_node("fallback", fallback_node)

    workflow.add_edge(START, "history")
    workflow.add_edge("history", "extract")

    # 분기 1: LLM 판단 — 정보 충분 여부
    workflow.add_conditional_edges(
        "extract",
        route_after_extract,
        {"sufficient": "rank", "insufficient": "fallback"},
    )

    # 분기 2: 점수 차이 — 단독 추천 vs 복수 제시
    workflow.add_conditional_edges(
        "rank",
        route_after_rank,
        {"clear": "recommend", "close": "negotiate"},
    )

    workflow.add_edge("recommend", END)
    workflow.add_edge("negotiate", END)
    workflow.add_edge("fallback", END)

    return workflow.compile()


graph = build_graph()
