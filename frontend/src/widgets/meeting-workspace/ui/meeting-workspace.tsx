"use client";

import { useState } from "react";
import { AnalysisForm } from "@/features/analyze-meeting/ui/analysis-form";
import { useAnalyzeMeeting } from "@/features/analyze-meeting/model/use-analyze-meeting";
import type {
  MeetingAnalysisResponse,
  ParticipantDraft,
} from "@/shared/model/meeting";
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
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <span className="size-10 shrink-0 rounded-full bg-amber-300" aria-hidden />
          <div>
            <p className="text-lg font-bold tracking-tight">니가양보해</p>
            <p className="text-xs text-slate-300">약속 시간·장소·메뉴 조율</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {screen === "form" && (
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950 md:text-4xl">
              이번 약속, 누가 얼마나 양보해야 공정할까?
            </h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600 md:text-base">
              대화 파일을 올리고 참여자 조건을 넣으면 시간·장소·메뉴를 함께
              정합니다.
            </p>
          </section>
        )}

        {screen === "loading" && <LoadingView />}

        {screen === "result" && result && (
          <ResultView result={result} onReset={handleReset} />
        )}

        {screen === "form" && (
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
        )}
      </div>
    </main>
  );
}
