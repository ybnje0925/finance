/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Vercel 서버리스 함수: 가족 공용 "마스터" Gemini API Key를 서버 환경변수(GEMINI_API_KEY)로만 보관하고,
// 클라이언트는 암구호를 입력했을 때 이 엔드포인트를 통해서만 Gemini를 호출한다(키 자체는 절대 브라우저로 내려주지 않음).
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "서버에 GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다. Vercel 프로젝트 설정에서 등록해 주세요." });
    return;
  }

  const prompt = req.body?.prompt;
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt가 필요합니다." });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt
    });
    res.status(200).json({ text: response.text || "" });
  } catch (error: any) {
    console.error("[Gemini API]", error);
    res.status(500).json({ error: error?.message || "Gemini 호출 중 오류가 발생했습니다." });
  }
}
