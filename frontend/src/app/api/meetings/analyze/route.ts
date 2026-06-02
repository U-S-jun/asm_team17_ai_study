import type {
  ExtractedConstraint,
  MeetingAnalysisResponse,
  ParticipantDraft,
  RankedCandidate,
} from "@/shared/model/meeting";

export const dynamic = "force-dynamic";

const places = ["서면", "부산대", "광안리"];
const menus = ["파스타", "고기", "초밥"];

export async function POST(request: Request) {
  const formData = await request.formData();
  const chatFile = formData.get("chatFile");

  if (!(chatFile instanceof File)) {
    return Response.json({ message: "chatFile is required." }, { status: 400 });
  }

  const chatText = await chatFile.text();
  const targetDateText = readString(formData.get("targetDateText"));
  const discussionStartedAt = readString(formData.get("discussionStartedAt"));
  const discussionEndedAt = readString(formData.get("discussionEndedAt"));
  const participants = parseParticipants(formData.get("participants"));

  await wait(1400);

  const candidateTimes = buildTimes(targetDateText);
  const candidatePlaces = extractKnownWords(chatText, places, places);
  const candidateMenus = extractKnownWords(chatText, menus, menus);
  const constraints = buildConstraints(participants);
  const rankedCandidates = buildCandidates(
    candidateTimes,
    candidatePlaces,
    candidateMenus,
    participants,
  );

  const response: MeetingAnalysisResponse = {
    meetingId: Date.now(),
    extracted: {
      participants: participants.map((participant) => participant.name),
      candidateTimes,
      candidatePlaces,
      candidateMenus,
      constraints,
      needsMoreInfo:
        discussionStartedAt && discussionEndedAt
          ? []
          : ["약속 논의 시간 범위를 확인해야 합니다."],
    },
    rankedCandidates,
    recommendation: {
      selectedCandidateId: rankedCandidates[0]?.candidateId ?? "candidate-1",
      summary: `${rankedCandidates[0]?.place ?? "서면"}, ${
        rankedCandidates[0]?.time ?? "지정 날짜 19:00"
      }, ${rankedCandidates[0]?.menu ?? "파스타"} 조합이 가장 무난합니다.`,
      groupMessageDraft: `이번엔 ${rankedCandidates[0]?.place ?? "서면"}에서 ${
        rankedCandidates[0]?.time ?? "지정 날짜 19:00"
      }에 ${rankedCandidates[0]?.menu ?? "파스타"}로 가면 부담이 제일 덜할 것 같아.`,
    },
  };

  return Response.json(response);
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function parseParticipants(value: FormDataEntryValue | null): ParticipantDraft[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((participant) => participant?.name && participant?.startLocation)
      .map((participant) => ({
        id: String(participant.id),
        name: String(participant.name),
        startLocation: String(participant.startLocation),
        conditionText: String(participant.conditionText ?? ""),
      }));
  } catch {
    return [];
  }
}

function buildTimes(targetDateText: string) {
  const dateLabel = targetDateText.trim() || "지정 날짜";

  return [`${dateLabel} 19:00`, `${dateLabel} 18:30`, `${dateLabel} 20:00`];
}

function extractKnownWords(
  chatText: string,
  knownWords: string[],
  fallback: string[],
) {
  const found = knownWords.filter((word) => chatText.includes(word));
  return found.length > 0 ? found : fallback;
}

function buildConstraints(participants: ParticipantDraft[]): ExtractedConstraint[] {
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

function buildCandidates(
  candidateTimes: string[],
  candidatePlaces: string[],
  candidateMenus: string[],
  participants: ParticipantDraft[],
): RankedCandidate[] {
  const avoidsSpicy = participants.some((participant) =>
    participant.conditionText.includes("매운"),
  );

  const placeOrder = candidatePlaces.slice(0, 3);
  const menuOrder = candidateMenus.slice(0, 3);

  return [0, 1, 2].map((index) => {
    const menu = menuOrder[index] ?? menus[index];
    const scorePenalty = avoidsSpicy && menu.includes("마라") ? 12 : 0;
    const totalScore = Math.max(64, 88 - index * 7 - scorePenalty);

    return {
      candidateId: `candidate-${index + 1}`,
      rank: index + 1,
      time: candidateTimes[index] ?? candidateTimes[0],
      place: placeOrder[index] ?? places[index],
      menu,
      totalScore,
      reasons: buildReasons(participants, menu, index),
    };
  });
}

function buildReasons(
  participants: ParticipantDraft[],
  menu: string,
  index: number,
) {
  const participantNames = participants.map((participant) => participant.name);
  const base =
    participantNames.length > 0
      ? `${participantNames.join(", ")} 조건을 기준으로 정렬했습니다.`
      : "입력된 조건을 기준으로 정렬했습니다.";

  const menuReason = menu.includes("마라")
    ? "매운 음식 조건이 있으면 점수가 낮아질 수 있습니다."
    : "메뉴 조건 충돌이 적은 후보입니다.";

  return index === 0
    ? [base, menuReason]
    : [base, "상위 후보보다 시간 또는 이동 조건이 조금 덜 맞습니다."];
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
