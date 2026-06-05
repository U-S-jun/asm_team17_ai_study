export const dynamic = "force-dynamic";

const places = ["서면", "부산대", "광안리"];
const menus = ["파스타", "고기", "초밥"];

export async function POST(request: Request) {
  const formData = await request.formData();
  const conversationFile = formData.get("conversationFile");
  const analysisRequest = readAnalysisRequest(formData.get("analysisRequest"));

  if (!(conversationFile instanceof File)) {
    return Response.json(
      { success: false, data: null, error: "conversationFile is required." },
      { status: 400 },
    );
  }

  const chatText = await conversationFile.text();
  const targetDateText = analysisRequest.targetDateText || "지정 날짜";
  const candidatePlaces = extractKnownWords(chatText, places, places);
  const candidateMenus = extractKnownWords(chatText, menus, menus);

  await wait(1000);

  return Response.json({
    success: true,
    data: {
      status: "SUCCESS",
      summary: `${candidatePlaces[0]}, ${targetDateText} 19:00, ${candidateMenus[0]} 조합이 가장 무난합니다.`,
      recommendations: [0, 1, 2].map((index) => ({
        rank: index + 1,
        datetime: `${targetDateText} ${index === 1 ? "18:30" : index === 2 ? "20:00" : "19:00"}`,
        location: candidatePlaces[index] ?? places[index],
        menu: candidateMenus[index] ?? menus[index],
        confidence: Math.max(0.72, 0.9 - index * 0.08),
        reason:
          index === 0
            ? "참여자 조건과 대화에서 나온 후보를 기준으로 가장 충돌이 적습니다."
            : "상위 후보보다 시간 또는 이동 조건이 조금 덜 맞습니다.",
      })),
    },
    error: null,
    meta: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
}

function readAnalysisRequest(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return { targetDateText: "" };
  }

  try {
    const parsed = JSON.parse(value);

    return {
      targetDateText:
        typeof parsed?.targetDateText === "string"
          ? parsed.targetDateText
          : "",
    };
  } catch {
    return { targetDateText: "" };
  }
}

function extractKnownWords(
  chatText: string,
  knownWords: string[],
  fallback: string[],
) {
  const found = knownWords.filter((word) => chatText.includes(word));
  return found.length > 0 ? found : fallback;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
