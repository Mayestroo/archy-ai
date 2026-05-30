// lib/openai.ts
// NOTE: This project primarily uses Google Gemini for AI generation.
// This client is kept for optional future use. It will only throw
// if you actually *call* it without OPENAI_API_KEY set.
import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}
