/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "Vercel 환경변수 GEMINI_API_KEY가 설정되어 있지 않습니다."
    });
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
    res.status(500).json({
      error: error?.message || "Gemini 호출 중 오류가 발생했습니다."
    });
  }
}
