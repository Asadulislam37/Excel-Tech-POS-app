// Gemini vision: analyze a customer's phone-case/accessory photo so the owner
// can source it from Taobao / Pinduoduo / 1688. Returns a short description,
// a phone-model guess, and search keywords (Chinese for Taobao, English).
import { Type } from "@google/genai";
import { gemini } from "@/lib/agent/gemini";

// Vision needs a capable model; flash-lite is weaker at images.
const VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-flash-latest";

export type CoverAnalysis = {
  description: string;
  phoneModel: string; // best guess, or "" if not identifiable
  keywordsChinese: string;
  keywordsEnglish: string;
};

export async function analyzeCoverPhoto(base64: string, mimeType: string): Promise<CoverAnalysis> {
  const ai = gemini();
  const res = await ai.models.generateContent({
    model: VISION_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          {
            text:
              "A customer sent this photo of a phone case/cover (or phone accessory) they want us to " +
              "source from Taobao/Pinduoduo/1688. Describe it briefly (type, colour, material, pattern), " +
              "guess the phone model if visible, and give concise search keywords in Chinese (for Taobao) " +
              "and in English.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: "Short description: type, colour, material, pattern." },
          phoneModel: { type: Type.STRING, description: "Phone model if identifiable, else empty string." },
          keywordsChinese: { type: Type.STRING, description: "Taobao search keywords in Chinese." },
          keywordsEnglish: { type: Type.STRING, description: "Search keywords in English." },
        },
        required: ["description", "phoneModel", "keywordsChinese", "keywordsEnglish"],
      },
    },
  });

  try {
    const j = JSON.parse(res.text ?? "{}");
    return {
      description: String(j.description ?? "").trim(),
      phoneModel: String(j.phoneModel ?? "").trim(),
      keywordsChinese: String(j.keywordsChinese ?? "").trim(),
      keywordsEnglish: String(j.keywordsEnglish ?? "").trim(),
    };
  } catch {
    return { description: (res.text ?? "").slice(0, 300), phoneModel: "", keywordsChinese: "", keywordsEnglish: "" };
  }
}
