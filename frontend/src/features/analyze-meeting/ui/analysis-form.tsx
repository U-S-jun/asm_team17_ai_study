"use client";

import { Plus, Search, Trash2, Upload } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import type { ParticipantDraft } from "@/shared/model/meeting";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Panel } from "@/shared/ui/panel";

type AnalysisFormProps = {
  chatFile: File | null;
  targetDateText: string;
  discussionStartedAt: string;
  discussionEndedAt: string;
  participants: ParticipantDraft[];
  isSubmitting: boolean;
  errorMessage?: string;
  onChatFileChange: (file: File | null) => void;
  onTargetDateTextChange: (value: string) => void;
  onDiscussionStartedAtChange: (value: string) => void;
  onDiscussionEndedAtChange: (value: string) => void;
  onParticipantChange: (
    id: string,
    field: keyof Omit<ParticipantDraft, "id">,
    value: string,
  ) => void;
  onAddParticipant: () => void;
  onRemoveParticipant: (id: string) => void;
  onSubmit: () => void;
};

const inputClass =
  "h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10";

const textareaClass =
  "min-h-20 w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-6 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10";

const extractChips = ["시간 후보", "장소 후보", "메뉴 선호"];

export function AnalysisForm({
  chatFile,
  targetDateText,
  discussionStartedAt,
  discussionEndedAt,
  participants,
  isSubmitting,
  errorMessage,
  onChatFileChange,
  onTargetDateTextChange,
  onDiscussionStartedAtChange,
  onDiscussionEndedAtChange,
  onParticipantChange,
  onAddParticipant,
  onRemoveParticipant,
  onSubmit,
}: AnalysisFormProps) {
  const canSubmit =
    Boolean(chatFile) &&
    targetDateText.trim().length > 0 &&
    discussionStartedAt.length > 0 &&
    discussionEndedAt.length > 0 &&
    participants.some(
      (participant) =>
        participant.name.trim() && participant.startLocation.trim(),
    );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    onChatFileChange(event.target.files?.[0] ?? null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (canSubmit) {
      onSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-5">
          <Panel
            title="단체방 대화"
            description="카톡·슬랙·문자 대화내역 파일을 그대로 업로드"
          >
            <Field label="대화내역 전체 파일">
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center transition hover:border-teal-500 hover:bg-white">
                <input
                  className="sr-only"
                  type="file"
                  accept=".txt,.csv,.json,.md"
                  onChange={handleFileChange}
                />
                <Upload className="size-7 text-neutral-700" aria-hidden />
                <span className="mt-3 text-sm font-semibold text-neutral-950">
                  {chatFile ? chatFile.name : "파일 선택"}
                </span>
                <span className="mt-1 text-xs text-neutral-500">
                  txt, csv, json, md
                </span>
              </label>
            </Field>

            <p className="mt-4 text-xs leading-5 text-neutral-500">
              AI가 대화에서 시간 후보, 장소 후보, 메뉴 선호를 자동 추출합니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {extractChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700"
                >
                  {chip}
                </span>
              ))}
            </div>
          </Panel>

          <Panel
            title="예상 일정"
            description="약속 날짜와 논의 시간대를 지정"
          >
            <div className="grid gap-4">
              <Field label="약속 날짜">
                <input
                  className={inputClass}
                  type="text"
                  placeholder="이번 주 토요일 저녁"
                  value={targetDateText}
                  onChange={(event) => onTargetDateTextChange(event.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="논의 시작">
                  <input
                    className={inputClass}
                    type="datetime-local"
                    value={discussionStartedAt}
                    onChange={(event) =>
                      onDiscussionStartedAtChange(event.target.value)
                    }
                  />
                </Field>
                <Field label="논의 종료">
                  <input
                    className={inputClass}
                    type="datetime-local"
                    value={discussionEndedAt}
                    onChange={(event) =>
                      onDiscussionEndedAtChange(event.target.value)
                    }
                  />
                </Field>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel
            title="참여자 조건"
            description="출발지와 시간·메뉴 조건"
            action={
              <Button
                type="button"
                variant="secondary"
                className="h-9 px-3"
                onClick={onAddParticipant}
              >
                <Plus className="size-4" aria-hidden />
                추가
              </Button>
            }
          >
            <div className="space-y-4">
              {participants.map((participant, index) => {
                const initial = participant.name.trim().charAt(0);

                return (
                  <div
                    className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"
                    key={participant.id}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                          {initial || index + 1}
                        </span>
                        <span className="text-sm font-semibold text-neutral-950">
                          참여자 {index + 1}
                        </span>
                      </div>
                      {participants.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-neutral-500 hover:text-red-600"
                          onClick={() => onRemoveParticipant(participant.id)}
                          aria-label={`참여자 ${index + 1} 삭제`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="이름">
                        <input
                          className={inputClass}
                          type="text"
                          placeholder="이름"
                          value={participant.name}
                          onChange={(event) =>
                            onParticipantChange(
                              participant.id,
                              "name",
                              event.target.value,
                            )
                          }
                        />
                      </Field>
                      <Field label="출발지">
                        <input
                          className={inputClass}
                          type="text"
                          placeholder="부산대, 사상, 서면"
                          value={participant.startLocation}
                          onChange={(event) =>
                            onParticipantChange(
                              participant.id,
                              "startLocation",
                              event.target.value,
                            )
                          }
                        />
                      </Field>
                      <Field className="sm:col-span-2" label="조건">
                        <textarea
                          className={textareaClass}
                          placeholder="시간, 메뉴, 이동 관련 조건"
                          value={participant.conditionText}
                          onChange={(event) =>
                            onParticipantChange(
                              participant.id,
                              "conditionText",
                              event.target.value,
                            )
                          }
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {errorMessage && (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </p>
          )}

          <Button
            className="h-12 w-full"
            variant="gradient"
            type="submit"
            disabled={!canSubmit || isSubmitting}
          >
            <Search className="size-4" aria-hidden />
            분석하기
          </Button>
        </div>
      </div>
    </form>
  );
}
