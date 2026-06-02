"use client";

import { FileText, Plus, Search, Trash2, Upload } from "lucide-react";
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
  "h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/10";

const textareaClass =
  "min-h-24 w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-3 text-sm leading-6 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/10";

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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Panel title="대화 파일" eyebrow="Input">
        <Field label="대화내역 전체 파일">
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center transition hover:border-neutral-500 hover:bg-white">
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
      </Panel>

      <Panel title="약속 조건" eyebrow="Schedule">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="약속 날짜">
            <input
              className={inputClass}
              type="text"
              placeholder="이번 주 토요일 저녁"
              value={targetDateText}
              onChange={(event) => onTargetDateTextChange(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
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

      <Panel
        title="참여자 조건"
        eyebrow="People"
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
        <div className="space-y-5">
          {participants.map((participant, index) => (
            <div
              className="border-t border-neutral-200 pt-5 first:border-t-0 first:pt-0"
              key={participant.id}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                  <FileText className="size-4 text-emerald-700" aria-hidden />
                  참여자 {index + 1}
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

              <div className="grid gap-3 md:grid-cols-2">
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
                <Field className="md:col-span-2" label="조건">
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
          ))}
        </div>
      </Panel>

      {errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="sticky bottom-0 -mx-1 bg-neutral-100/90 px-1 py-3 backdrop-blur">
        <Button
          className="h-12 w-full"
          type="submit"
          disabled={!canSubmit || isSubmitting}
        >
          <Search className="size-4" aria-hidden />
          분석하기
        </Button>
      </div>
    </form>
  );
}
