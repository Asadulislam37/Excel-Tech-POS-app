// Google Gemini client (free tier). One shared client for the whole agent.
import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new Error(
      "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com and add it to your environment (see .env.example)."
    );
  if (!_client) _client = new GoogleGenAI({ apiKey });
  return _client;
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// Model defaults use Google's "-latest" aliases so a specific model being
// retired for new users (as gemini-2.5-flash was) can't break the app.
//  - customer: flash-lite = fast + highest free-tier limits for high-volume chat
//  - owner: flash = a bit stronger for analysis
// Both overridable via env (GEMINI_CUSTOMER_MODEL / GEMINI_OWNER_MODEL).
export const CUSTOMER_MODEL = process.env.GEMINI_CUSTOMER_MODEL || "gemini-flash-lite-latest";
export const OWNER_MODEL = process.env.GEMINI_OWNER_MODEL || "gemini-flash-latest";
