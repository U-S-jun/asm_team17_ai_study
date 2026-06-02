# 니가양보해 Frontend

단체 대화 파일과 참여자 조건을 받아 약속 시간, 장소, 메뉴 후보를 3순위까지 보여주는 프론트엔드 초기 세팅입니다.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- TanStack React Query
- Axios
- Zod
- Lucide React
- FSD 기반 폴더 구조

## Run

```bash
pnpm install
pnpm dev
```

기본 주소는 `http://localhost:3000`입니다.
테스트용 대화 파일은 `samples/sample-chat.txt`를 사용할 수 있습니다.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm format
```

## API

현재는 프론트 흐름 확인용 Mock API가 포함되어 있습니다.

- `POST /api/meetings/analyze`
- 요청 타입: `multipart/form-data`
- 필수 필드: `chatFile`, `targetDateText`, `discussionStartedAt`, `discussionEndedAt`, `participants`

실제 Spring API로 붙일 때는 `.env.local`에 API 주소를 넣으면 됩니다.

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS=false
```

## FSD Structure

```text
src/
  app/          # Next route, provider, route handler
  shared/       # 공통 타입, API client, UI primitive, util
  entities/     # 도메인 엔티티 타입
  features/     # 분석 요청 기능
  widgets/      # 화면 단위 조립
```

## Frontend Task Split

박준이:

- 분석 요청 상태 관리
- 파일 업로드 로직
- React Query mutation
- API 응답 타입/Zod 검증
- 로딩/에러 상태 연결
- 결과 데이터 매핑

이희은:

- 첫 화면 UI
- 참여자 조건 입력 UI
- 로딩 화면 UI
- 결과 화면 UI
- 후보 1~3순위 패널
- 반응형 QA

## 화면 기준

- 첫 화면: 파일 업로드, 날짜 지정, 참여자 지정, 분석하기
- 로딩 화면: 하단에 `결과 분석 중입니다`, `점수 산정 중입니다`
- 결과 화면: 역할 없이 시간, 장소, 메뉴만 표시
- 점수 표시: 공정성/선호도 분리 없이 총합 점수만 표시
