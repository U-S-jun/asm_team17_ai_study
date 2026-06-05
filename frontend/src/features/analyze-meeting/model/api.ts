import { apiClient } from "@/shared/api/http";
import type {
  AnalyzeMeetingPayload,
  MeetingAnalysisResponse,
} from "@/shared/model/meeting";
import { normalizeAnalysisResponse } from "./normalize-analysis-response";

export async function analyzeMeeting(
  payload: AnalyzeMeetingPayload,
): Promise<MeetingAnalysisResponse> {
  const formData = new FormData();
  const analysisRequest = {
    targetDateText: payload.targetDateText,
    discussionWindow: {
      startedAt: payload.discussionStartedAt,
      endedAt: payload.discussionEndedAt,
    },
    participants: payload.participants.map((participant) => ({
      name: participant.name,
      startLocation: participant.startLocation,
      conditionText: participant.conditionText,
    })),
  };

  formData.append("conversationFile", payload.chatFile);
  formData.append("analysisRequest", JSON.stringify(analysisRequest));

  const response = await apiClient.post("/api/analyze", formData);
  return normalizeAnalysisResponse(response.data, payload);
}
