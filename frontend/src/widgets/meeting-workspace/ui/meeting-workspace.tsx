"use client";

import { useMemo, useState } from "react";
import { AnalysisForm } from "@/features/analyze-meeting/ui/analysis-form";
import { useAnalyzeMeeting } from "@/features/analyze-meeting/model/use-analyze-meeting";
import type {
  MeetingAnalysisResponse,
  ParticipantDraft,
} from "@/shared/model/meeting";
import { Panel } from "@/shared/ui/panel";
import { LoadingView } from "./loading-view";
import { ResultView } from "./result-view";

type ScreenState = "form" | "loading" | "result";

const initialParticipants: ParticipantDraft[] = [
  {
    id: "participant-1",
    name: "",
    startLocation: "",
    conditionText: "",
  },
  {
    id: "participant-2",
    name: "",
    startLocation: "",
    conditionText: "",
  },
  {
    id: "participant-3",
    name: "",
    startLocation: "",
    conditionText: "",
  },
];

function createParticipant(): ParticipantDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    startLocation: "",
    conditionText: "",
  };
}

export function MeetingWorkspace() {
  const analyzeMeeting = useAnalyzeMeeting();
  const [screen, setScreen] = useState<ScreenState>("form");
  const [result, setResult] = useState<MeetingAnalysisResponse | null>(null);
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [targetDateText, setTargetDateText] = useState("");
  const [discussionStartedAt, setDiscussionStartedAt] = useState("");
  const [discussionEndedAt, setDiscussionEndedAt] = useState("");
  const [participants, setParticipants] =
    useState<ParticipantDraft[]>(initialParticipants);

  const filledParticipantCount = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.name.trim() && participant.startLocation.trim(),
      ).length,
    [participants],
  );

  function handleParticipantChange(
    id: string,
    field: keyof Omit<ParticipantDraft, "id">,
    value: string,
  ) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === id ? { ...participant, [field]: value } : participant,
      ),
    );
  }

  function handleSubmit() {
    if (!chatFile) {
      return;
    }

    const payloadParticipants = participants.filter(
      (participant) =>
        participant.name.trim() && participant.startLocation.trim(),
    );

    setScreen("loading");
    analyzeMeeting.mutate(
      {
        chatFile,
        targetDateText,
        discussionStartedAt,
        discussionEndedAt,
        participants: payloadParticipants,
      },
      {
        onSuccess: (data) => {
          setResult(data);
          setScreen("result");
        },
        onError: () => {
          setScreen("form");
        },
      },
    );
  }

  function handleReset() {
    analyzeMeeting.reset();
    setResult(null);
    setScreen("form");
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-neutral-300 pb-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              니가양보해
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-neutral-950 md:text-4xl">
              약속 후보 분석
            </h1>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-right text-sm md:min-w-80">
            <div>
              <dt className="text-neutral-500">파일</dt>
              <dd className="mt-1 font-semibold">
                {chatFile ? "선택됨" : "대기"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">참여자</dt>
              <dd className="mt-1 font-semibold">{filledParticipantCount}명</dd>
            </div>
            <div>
              <dt className="text-neutral-500">방식</dt>
              <dd className="mt-1 font-semibold">동기</dd>
            </div>
          </dl>
        </header>

        {screen === "loading" && <LoadingView />}

        {screen === "result" && result && (
          <ResultView result={result} onReset={handleReset} />
        )}

        {screen === "form" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <AnalysisForm
              chatFile={chatFile}
              targetDateText={targetDateText}
              discussionStartedAt={discussionStartedAt}
              discussionEndedAt={discussionEndedAt}
              participants={participants}
              isSubmitting={analyzeMeeting.isPending}
              errorMessage={
                analyzeMeeting.isError
                  ? "분석 요청에 실패했습니다. 입력값을 확인해 주세요."
                  : undefined
              }
              onChatFileChange={setChatFile}
              onTargetDateTextChange={setTargetDateText}
              onDiscussionStartedAtChange={setDiscussionStartedAt}
              onDiscussionEndedAtChange={setDiscussionEndedAt}
              onParticipantChange={handleParticipantChange}
              onAddParticipant={() =>
                setParticipants((current) => [...current, createParticipant()])
              }
              onRemoveParticipant={(id) =>
                setParticipants((current) =>
                  current.filter((participant) => participant.id !== id),
                )
              }
              onSubmit={handleSubmit}
            />

            <aside className="space-y-4">
              <Panel title="프론트 기준" eyebrow="Scope">
                <ul className="space-y-3 text-sm leading-6 text-neutral-700">
                  <li>대화내역 파일 업로드</li>
                  <li>약속 날짜와 논의 시간 지정</li>
                  <li>참여자 출발지와 조건 입력</li>
                  <li>결과는 시간, 장소, 메뉴만 표시</li>
                </ul>
              </Panel>
              <Panel title="결과 표시" eyebrow="Output">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">후보</dt>
                    <dd className="font-semibold text-neutral-950">3순위</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">점수</dt>
                    <dd className="font-semibold text-neutral-950">총합만</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">역할</dt>
                    <dd className="font-semibold text-neutral-950">미표시</dd>
                  </div>
                </dl>
              </Panel>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
