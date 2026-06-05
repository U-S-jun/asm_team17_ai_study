# AI Meeting Analyzer

LangGraph 기반 모임 약속 분석 에이전트 서버입니다.
채팅 파일과 참여자 정보를 받아 최적의 약속 후보를 추천합니다.

---

## LangGraph란?

LangChain에서 만든 **그래프 기반 에이전트 프레임워크**입니다.

일반 LLM 호출이 `입력 → LLM → 출력` 단순 구조라면,
LangGraph는 여러 노드(LLM 호출 단위)를 연결하고 **이전 단계의 결과가 다음 단계의 입력에 영향**을 주며, **LLM의 판단으로 실행 흐름 자체가 바뀌는** 구조입니다.

### 핵심 개념

| 개념 | 설명 |
|---|---|
| **Node** | 하나의 처리 단위. 보통 LLM 호출 1번 |
| **Edge** | 노드 간 고정 연결 (`A → B` 항상 실행) |
| **Conditional Edge** | 조건에 따라 다른 노드로 분기 |
| **State** | 노드 간에 공유되는 데이터. 앞 노드의 출력이 뒤 노드의 입력이 됨 |

---

## 에이전트 구조

```
START
  │
  ▼
[history_node]
  과거 채팅(discussionStartedAt 이전) 분석
  → 참여자별 양보 이력 수치화 (0~10점)
  │
  ▼
[extract_node]
  현재 논의 구간(discussionStartedAt ~ EndedAt) 분석
  → 후보 장소/시간/메뉴/제약조건 추출
  │
  ▼
[route_after_extract] ← LLM 판단 분기
  장소·시간이 충분히 추출됐는지 판단
  │
  ├── sufficient ──→ [rank_node]
  │                   과거 양보 이력 가중치 반영해 후보 3개 점수화
  │                   │
  │                   ▼
  │                  [route_after_rank] ← 점수 차이 분기
  │                   1위~2위 점수 차이 계산
  │                   │
  │                   ├── clear (10점↑) → [recommend_node]
  │                   │                   1위 단독 추천 메시지 생성
  │                   │
  │                   └── close (10점↓) → [negotiate_node]
  │                                        "A안 vs B안" 복수 제시 메시지 생성
  │
  └── insufficient → [fallback_node]
                      정보 부족 안내 메시지 생성
```

### 노드별 역할

| 노드 | LLM 호출 | 역할 |
|---|---|---|
| `history_node` | O | `discussionStartedAt` 이전 채팅에서 누가 거리/시간/메뉴를 양보했는지 수치화 |
| `extract_node` | O | 현재 논의 구간에서 장소·시간·메뉴·제약조건 추출 |
| `route_after_extract` | O | 추출 결과가 랭킹하기에 충분한지 LLM이 판단 |
| `rank_node` | O | 후보 조합 3개를 점수화. 과거 양보 이력 반영해 가중치 조정 |
| `route_after_rank` | X | 1위~2위 점수 차 ≥ 10 → clear / < 10 → close |
| `recommend_node` | O | 1위 단독 추천 + 카톡 메시지 초안 생성 |
| `negotiate_node` | O | 점수 차이 작을 때 복수 선택지 제시. 과거 양보 많은 참여자 우선 배려 |
| `fallback_node` | O | 정보 부족 시 추가 논의 요청 메시지 생성 |

### State 흐름

```python
AgentState = {
    # 입력
    "chat_text": str,              # 전체 채팅 내용
    "target_date_text": str,       # 목표 날짜
    "discussion_started_at": str,  # 현재 논의 시작 시각
    "discussion_ended_at": str,    # 현재 논의 종료 시각
    "participants": [...],         # 참여자 목록

    # 각 노드가 채워가는 값
    "concession_history": ...,     # history_node 결과
    "extracted": ...,              # extract_node 결과
    "ranked_candidates": [...],    # rank_node 결과
    "recommendation": ...,         # recommend/negotiate/fallback 결과
}
```

---

## 프로젝트 구조

```
ai/
├── main.py                        # FastAPI 앱 진입점 (port 8000)
├── requirements.txt               # 패키지 목록
├── .env                           # API 키 (git 제외)
├── .env.example                   # 키 형식 참고용
├── samples/
│   └── sample_chat.csv            # 테스트용 채팅 파일 (시간,이름,본문)
└── app/
    ├── schemas/
    │   └── meeting.py             # 요청/응답 Pydantic 모델
    ├── agent/
    │   ├── state.py               # LangGraph AgentState 정의
    │   ├── prompts.py             # 각 노드 시스템 프롬프트
    │   ├── nodes.py               # 노드 함수 + 라우터 함수
    │   └── graph.py               # 그래프 조립 및 컴파일
    └── api/
        └── analyze.py             # POST /api/analyze 엔드포인트
```

---

## 실행 방법

### 1. 환경 설정

```bash
cd ai

# 가상환경 생성 및 활성화
python -m venv .venv
source .venv/bin/activate

# 패키지 설치
pip install -r requirements.txt

# .env 파일 생성
cp .env.example .env
```

### 2. .env 키 입력

```
# Upstage LLM
UPSTAGE_API_KEY=up-xxxxxxxxxxxxxxxx
UPSTAGE_MODEL=solar-pro

# LangSmith 트레이싱 (선택)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=ls__xxxxxxxxxxxxxxxx
LANGCHAIN_PROJECT=asm-team17-ai-study
```

| 키 | 발급처 |
|---|---|
| `UPSTAGE_API_KEY` | console.upstage.ai/api-keys |
| `LANGCHAIN_API_KEY` | smith.langchain.com → Settings → API Keys |

### 3. 서버 실행

```bash
uvicorn main:app --reload --port 8000
```

서버 정상 확인:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

Swagger 문서: `http://localhost:8000/docs`

---

## API 호출

**엔드포인트:** `POST /api/analyze`  
**형식:** `multipart/form-data`

| 필드 | 타입 | 설명 |
|---|---|---|
| `conversationFile` | File | 채팅 CSV 파일 (시간,이름,본문) |
| `analysisRequest` | String | JSON 문자열 |

### analysisRequest 구조

```json
{
  "targetDateText": "2025-06-22",
  "discussionStartedAt": "2025-06-20 09:15:03",
  "discussionEndedAt": "2025-06-20 09:23:48",
  "participants": [
    {"id": "1", "name": "준혁", "startLocation": "해운대", "conditionText": ""},
    {"id": "2", "name": "아름", "startLocation": "부산대", "conditionText": ""},
    {"id": "3", "name": "태양", "startLocation": "동구",  "conditionText": "생선 비린 것 못 먹음"},
    {"id": "4", name": "소희", "startLocation": "서면",  "conditionText": "오전 불가 오후 2시 이후"}
  ]
}
```

| 필드 | 설명 |
|---|---|
| `targetDateText` | 약속 목표 날짜 |
| `discussionStartedAt` | 현재 논의 시작 시각. **이 시각 이전 채팅은 과거 이력으로 분석** |
| `discussionEndedAt` | 현재 논의 종료 시각 |
| `participants[].startLocation` | 출발지 (이동거리 형평성 계산에 사용) |
| `participants[].conditionText` | 개인 제약 조건 (시간/메뉴/예산 등 자유 텍스트) |

### curl 예시
오류가 발생하면 파일 절대경로로 변경하면 동작

```bash
curl -X POST http://localhost:8000/api/analyze \
  -F "conversationFile=@samples/sample_chat.csv" \
  -F 'analysisRequest={
    "targetDateText": "2025-06-22",
    "discussionStartedAt": "2025-06-20 09:15:03",
    "discussionEndedAt": "2025-06-20 09:23:48",
    "participants": [
      {"id":"1","name":"준혁","startLocation":"해운대","conditionText":""},
      {"id":"2","name":"아름","startLocation":"부산대","conditionText":""},
      {"id":"3","name":"태양","startLocation":"동구","conditionText":"생선 비린 것 못 먹음"},
      {"id":"4","name":"소희","startLocation":"서면","conditionText":"오전 불가 오후 2시 이후"}
    ]
  }' | python3 -m json.tool --no-ensure-ascii
```

### 응답 구조

```json
{
  "meetingId": 1780668088478,
  "extracted": {
    "participants": ["준혁", "아름", "태양", "소희"],
    "candidateTimes": ["2025-06-22 14:00", "2025-06-22 14:30", "2025-06-22 15:00"],
    "candidatePlaces": ["송정", "송정역"],
    "candidateMenus": ["해산물", "해산물 뷔페"],
    "constraints": [
      {"participant": "소희", "type": "time", "content": "오전 불가, 오후 2시 이후 가능"},
      {"participant": "태양", "type": "menu", "content": "생선 비린 것 못 먹음"}
    ],
    "needsMoreInfo": []
  },
  "rankedCandidates": [
    {
      "candidateId": "candidate-1",
      "rank": 1,
      "time": "2025-06-22 15:00",
      "place": "송정역",
      "menu": "해산물 뷔페",
      "totalScore": 85.0,
      "reasons": ["소희 오후 2시 이후 조건 충족", "태양 생선 회피 조건 충족", ...]
    },
    { "candidateId": "candidate-2", "rank": 2, ... },
    { "candidateId": "candidate-3", "rank": 3, ... }
  ],
  "recommendation": {
    "selectedCandidateId": "candidate-1",
    "summary": "모든 참여자 조건을 충족하며 과거 양보 이력을 반영한 최적 조합입니다.",
    "groupMessageDraft": "2025-06-22 15:00 송정역 해산물 뷔페에서 만나요. 모두 일정 괜찮으신가요?"
  }
}
```

---

## Spring Boot 연동

Spring Boot 백엔드(`port 8080`)가 이 서버로 요청을 포워딩합니다.

```
FE → Spring Boot(:8080) /api/analyze → AI Server(:8000) /api/analyze
```

`application.yml`에서 AI 서버 주소 설정:
```yaml
ai:
  server:
    url: http://localhost:8000
```
