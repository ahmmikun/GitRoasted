/**
 * Google Gemini provider.
 *
 * Implements `AiProvider` for the Gemini `generateContent` API. Reads
 * `GEMINI_API_KEY` and `GEMINI_MODEL` from the environment and returns the
 * model's raw, unvalidated JSON response. The orchestrator (task 6.3) is
 * responsible for validating the shape.
 */

import type { AiProvider } from "../types";
import {
  ROAST_SYSTEM_PROMPT,
  buildUserPrompt,
  parseJsonFromText,
  requireEnv,
} from "./prompt";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

export const geminiProvider: AiProvider = {
  name: "gemini",
  get model(): string {
    return process.env.GEMINI_MODEL ?? "";
  },
  async generate(summary: string): Promise<unknown> {
    const apiKey = requireEnv("GEMINI_API_KEY");
    const model = requireEnv("GEMINI_MODEL");

    const endpoint = `${GEMINI_BASE_URL}/${encodeURIComponent(
      model,
    )}:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: ROAST_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: buildUserPrompt(summary) }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      throw new Error("Gemini response missing candidate text");
    }

    return parseJsonFromText(text);
  },
};

export default geminiProvider;
