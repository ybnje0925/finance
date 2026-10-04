import { GoogleGenAI } from "@google/genai";

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
    const status = Number(error?.status || error?.code || 500);
    console.error("[Gemini API]", { status, model });
    const message = status === 404 ? "설정된 AI 모델을 사용할 수 없습니다. 서버의 GEMINI_MODEL 설정을 확인해 주세요."
      : status === 429 ? "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도하거나 API 할당량을 확인해 주세요."
      : status === 401 || status === 403 ? "AI 연결 인증에 실패했습니다. 서버의 API 키와 모델 사용 권한을 확인해 주세요."
      : "AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return res.status(status === 429 ? 429 : 502).json({ error: message });
  }
}
