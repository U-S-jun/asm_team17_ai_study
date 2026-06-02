"use client";

import { Clock3, MapPin, RotateCcw, Utensils, Wand2 } from "lucide-react";
import type { MeetingAnalysisResponse } from "@/shared/model/meeting";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";

type ResultViewProps = {
  result: MeetingAnalysisResponse;
  onReset: () => void;
};

export function ResultView({ result, onReset }: ResultViewProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-neutral-200 bg-white px-5 py-4 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Result
          </p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-950">
            후보 3순위
          </h2>
        </div>
        <Button type="button" variant="secondary" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          다시 분석
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {result.rankedCandidates.map((candidate) => (
          <Panel
            className="overflow-hidden"
            key={candidate.candidateId}
            title={`${candidate.rank}순위`}
            eyebrow={`${candidate.totalScore}점`}
          >
            <div className="space-y-4">
              <dl className="space-y-3">
                <div className="flex items-center gap-3">
                  <Clock3 className="size-4 shrink-0 text-neutral-500" />
                  <div>
                    <dt className="text-xs font-medium text-neutral-500">시간</dt>
                    <dd className="text-sm font-semibold text-neutral-950">
                      {candidate.time}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="size-4 shrink-0 text-neutral-500" />
                  <div>
                    <dt className="text-xs font-medium text-neutral-500">장소</dt>
                    <dd className="text-sm font-semibold text-neutral-950">
                      {candidate.place}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Utensils className="size-4 shrink-0 text-neutral-500" />
                  <div>
                    <dt className="text-xs font-medium text-neutral-500">메뉴</dt>
                    <dd className="text-sm font-semibold text-neutral-950">
                      {candidate.menu}
                    </dd>
                  </div>
                </div>
              </dl>

              <div className="border-t border-neutral-200 pt-4">
                <p className="text-xs font-semibold text-neutral-500">근거</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
                  {candidate.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="최종 초안" eyebrow="Message">
        <div className="flex items-start gap-3">
          <Wand2 className="mt-1 size-5 shrink-0 text-emerald-700" />
          <div className="space-y-3">
            <p className="text-base font-semibold text-neutral-950">
              {result.recommendation.summary}
            </p>
            <p className="rounded-md bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
              {result.recommendation.groupMessageDraft}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
