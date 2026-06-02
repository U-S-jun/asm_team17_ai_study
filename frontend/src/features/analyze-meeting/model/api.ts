import { apiClient } from "@/shared/api/http";
import { meetingAnalysisResponseSchema } from "@/shared/api/meeting.schema";
import type {
  AnalyzeMeetingPayload,
  MeetingAnalysisResponse,
} from "@/shared/model/meeting";

export async function analyzeMeeting(
  payload: AnalyzeMeetingPayload,
): Promise<MeetingAnalysisResponse> {
  const formData = new FormData();

  formData.append("chatFile", payload.chatFile);
  formData.append("targetDateText", payload.targetDateText);
  formData.append("discussionStartedAt", payload.discussionStartedAt);
  formData.append("discussionEndedAt", payload.discussionEndedAt);
  formData.append("participants", JSON.stringify(payload.participants));

  const response = await apiClient.post("/api/meetings/analyze", formData);
  return meetingAnalysisResponseSchema.parse(response.data);
}
