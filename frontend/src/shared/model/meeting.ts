export type ParticipantDraft = {
  id: string;
  name: string;
  startLocation: string;
  conditionText: string;
};

export type ExtractedConstraint = {
  participant: string;
  type: "time" | "place" | "menu" | "distance" | "budget" | "unknown";
  content: string;
};

export type RankedCandidate = {
  candidateId: string;
  rank: number;
  time: string;
  place: string;
  menu: string;
  totalScore: number;
  reasons: string[];
};

export type MeetingAnalysisResponse = {
  meetingId: number;
  extracted: {
    participants: string[];
    candidateTimes: string[];
    candidatePlaces: string[];
    candidateMenus: string[];
    constraints: ExtractedConstraint[];
    needsMoreInfo: string[];
  };
  rankedCandidates: RankedCandidate[];
  recommendation: {
    selectedCandidateId: string;
    summary: string;
    groupMessageDraft: string;
  };
};

export type AnalyzeMeetingPayload = {
  chatFile: File;
  targetDateText: string;
  discussionStartedAt: string;
  discussionEndedAt: string;
  participants: ParticipantDraft[];
};
