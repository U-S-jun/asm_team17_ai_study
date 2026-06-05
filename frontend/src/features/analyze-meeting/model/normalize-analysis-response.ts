import {
  backendAnalyzeResponseSchema,
  meetingAnalysisResponseSchema,
} from "@/shared/api/meeting.schema";
import type {
  AnalyzeMeetingPayload,
  ExtractedConstraint,
  MeetingAnalysisResponse,
  ParticipantDraft,
  RankedCandidate,
} from "@/shared/model/meeting";

export function normalizeAnalysisResponse(
  rawResponse: unknown,
  payload: AnalyzeMeetingPayload,
): MeetingAnalysisResponse {
  const response =
    typeof rawResponse === "string" ? parseJson(rawResponse) : rawResponse;

  const frontendResponse = meetingAnalysisResponseSchema.safeParse(response);

  if (frontendResponse.success) {
    return frontendResponse.data;
  }

  const backendResponse = backendAnalyzeResponseSchema.safeParse(response);

  if (!backendResponse.success) {
    throw new Error("분석 응답 형식이 올바르지 않습니다.");
  }

  const recommendations = backendResponse.data.data?.recommendations ?? [];
  const rankedCandidates = recommendations.slice(0, 3).map((item, index) => {
    const time = formatDateTime(item.datetime ?? item.time ?? "");
    const place = item.location ?? item.place ?? "장소 추가 확인";
    const menu = item.menu ?? "메뉴 추가 확인";
    const totalScore = normalizeScore(item.score ?? item.confidence);
    const reasons = item.reasons?.length
      ? item.reasons
      : [item.reason ?? "AI 분석 결과를 기준으로 정렬했습니다."];

    return {
      candidateId: `candidate-${item.rank ?? index + 1}`,
      rank: item.rank ?? index + 1,
      time: time || "시간 추가 확인",
      place,
      menu,
      totalScore,
      reasons,
    };
  });

  const filledCandidates = fillCandidates(rankedCandidates);
  const selectedCandidate = filledCandidates[0];
  const summary =
    backendResponse.data.data?.summary ??
    `${selectedCandidate.place}, ${selectedCandidate.time} 조합이 가장 무난합니다.`;

  return {
    meetingId: Date.now(),
    extracted: {
      participants: payload.participants.map((participant) => participant.name),
      candidateTimes: unique(filledCandidates.map((candidate) => candidate.time)),
      candidatePlaces: unique(
        filledCandidates.map((candidate) => candidate.place),
      ),
      candidateMenus: unique(filledCandidates.map((candidate) => candidate.menu)),
      constraints: buildConstraints(payload.participants),
      needsMoreInfo: filledCandidates.some(
        (candidate) =>
          candidate.time.includes("추가 확인") ||
          candidate.place.includes("추가 확인") ||
          candidate.menu.includes("추가 확인"),
      )
        ? ["일부 후보는 시간·장소·메뉴 정보 추가 확인이 필요합니다."]
        : [],
    },
    rankedCandidates: filledCandidates,
    recommendation: {
      selectedCandidateId: selectedCandidate.candidateId,
      summary,
      groupMessageDraft: buildGroupMessage(selectedCandidate),
    },
  };
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeScore(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 70;
  }

  if (value <= 1) {
    return Math.round(value * 100);
  }

  return Math.round(value);
}

function formatDateTime(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function fillCandidates(candidates: RankedCandidate[]) {
  const filledCandidates = [...candidates].slice(0, 3);

  while (filledCandidates.length < 3) {
    const rank = filledCandidates.length + 1;

    filledCandidates.push({
      candidateId: `candidate-${rank}`,
      rank,
      time: "시간 추가 확인",
      place: "장소 추가 확인",
      menu: "메뉴 추가 확인",
      totalScore: Math.max(50, 70 - rank * 5),
      reasons: ["후보 정보가 부족해 추가 확인이 필요합니다."],
    });
  }

  return filledCandidates;
}

function buildConstraints(participants: ParticipantDraft[]) {
  return participants.flatMap((participant) => {
    const constraints: ExtractedConstraint[] = [
      {
        participant: participant.name,
        type: "distance",
        content: `${participant.startLocation} 출발`,
      },
    ];

    if (participant.conditionText.trim()) {
      constraints.push({
        participant: participant.name,
        type: inferConstraintType(participant.conditionText),
        content: participant.conditionText,
      });
    }

    return constraints;
  });
}

function inferConstraintType(text: string): ExtractedConstraint["type"] {
  if (text.includes("매운") || text.includes("메뉴") || text.includes("음식")) {
    return "menu";
  }

  if (text.includes("시간") || text.includes("이후") || text.includes("전")) {
    return "time";
  }

  if (text.includes("멀") || text.includes("이동") || text.includes("거리")) {
    return "distance";
  }

  return "unknown";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildGroupMessage(candidate: RankedCandidate) {
  const menuText = candidate.menu.includes("추가 확인")
    ? "메뉴는 한 번만 더 확인하면 될 것 같아."
    : `메뉴는 ${candidate.menu}로 가면 좋을 것 같아.`;

  return `이번엔 ${candidate.place}에서 ${candidate.time}에 보면 무난할 것 같아. ${menuText}`;
}
