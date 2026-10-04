import { GoogleGenAI } from "@google/genai";

export const classifyGeminiError = (error: any) => {
  let details = error;
  try {
    const parsed = JSON.parse(String(error?.message || ""));
    details = parsed.error || parsed;
  } catch { /* SDK network errors may have plain text messages. */ }
  const rawStatus = Number(error?.status || error?.code || details?.code);
  const status = Number.isFinite(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 502;
  const message = String(details?.message || error?.message || "");
  const apiKeyInvalid = /API_KEY_INVALID|API key not valid|invalid api key/i.test(message)
    || details?.details?.some((item: any) => item.reason === "API_KEY_INVALID");
  const timedOut = /timeout|timed out|abort/i.test(String(error?.name || "") + " " + message);
  if (apiKeyInvalid) return { status, code: "API_KEY_INVALID", message: "Gemini API 키가 유효하지 않습니다. 서버의 GEMINI_API_KEY를 확인해 주세요." };
  if (status === 400) return { status, code: "INVALID_REQUEST", message: "Gemini가 요청을 거부했습니다. 모델 설정 또는 요청 형식을 확인해야 합니다." };
  if (status === 404) return { status, code: "MODEL_UNAVAILABLE", message: "설정된 AI 모델을 사용할 수 없습니다. 서버의 GEMINI_MODEL 설정을 확인해 주세요." };
  if (status === 429) return { status, code: "QUOTA_EXCEEDED", message: "AI 요청 한도에 도달했습니다. API 할당량과 결제 설정을 확인해 주세요." };
  if (status === 401 || status === 403) return { status, code: "ACCESS_DENIED", message: "AI 연결 인증에 실패했습니다. 서버의 API 키와 모델 사용 권한을 확인해 주세요." };
  if (timedOut) return { status, code: "UPSTREAM_TIMEOUT", message: "Gemini 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요." };
  if (status === 500 || status === 503) return { status, code: "UPSTREAM_UNAVAILABLE", message: "Gemini 서비스가 일시적으로 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  return { status, code: "UPSTREAM_CONNECTION_FAILED", message: "Gemini 연결 중 오류가 발생했습니다. 서버 로그에서 연결 상태를 확인해야 합니다." };
};

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }
  const prompt = req.body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) return res.status(400).json({ error: "질문을 입력해 주세요." });
  if (Buffer.byteLength(prompt, "utf8") > 1000000) return res.status(413).json({ error: "분석 자료가 너무 큽니다. 조회 범위를 줄여 주세요." });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI 연결 설정이 없습니다. 서버의 GEMINI_API_KEY를 설정해 주세요." });
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 50000 } });
    const response = await ai.models.generateContent({ model, contents: prompt });
    if (!response.text?.trim()) return res.status(502).json({ error: "AI가 답변을 반환하지 않았습니다. 질문을 바꿔 다시 시도해 주세요." });
    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    const diagnostic = classifyGeminiError(error);
    console.error("[Gemini API]", { status: diagnostic.status, code: diagnostic.code, model });
    return res.status(diagnostic.status === 429 ? 429 : 502).json({
      error: diagnostic.message, code: diagnostic.code, upstreamStatus: diagnostic.status,
    });
  }
}
