import { z } from "zod";

export const meetingAnalysisResponseSchema = z.object({
  meetingId: z.number(),
  extracted: z.object({
    participants: z.array(z.string()),
    candidateTimes: z.array(z.string()),
    candidatePlaces: z.array(z.string()),
    candidateMenus: z.array(z.string()),
    constraints: z.array(
      z.object({
        participant: z.string(),
        type: z.enum(["time", "place", "menu", "distance", "budget", "unknown"]),
        content: z.string(),
      }),
    ),
    needsMoreInfo: z.array(z.string()),
  }),
  rankedCandidates: z.array(
    z.object({
      candidateId: z.string(),
      rank: z.number(),
      time: z.string(),
      place: z.string(),
      menu: z.string(),
      totalScore: z.number(),
      reasons: z.array(z.string()),
    }),
  ),
  recommendation: z.object({
    selectedCandidateId: z.string(),
    summary: z.string(),
    groupMessageDraft: z.string(),
  }),
});
