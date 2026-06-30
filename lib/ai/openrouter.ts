/**
 * OpenRouter AI provider.
 *
 * Implements `AiProvider` for the OpenRouter chat-completions API
 * (OpenAI-compatible). Reads `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` from
 * the environment and returns the model's raw, unvalidated JSON response. The
 * orchestrator (task 6.3) is responsible for validating the shape.
 */

import type { AiProvider } from "../types";
import {
  ROAST_SYSTEM_PROMPT,
  buildUserPrompt,
  parseJsonFromText,
  requireEnv,
} from "./prompt";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const openRouterProvider: AiProvider = {
  name: "openrouter",
  get model(): string {
    return process.env.OPENROUTER_MODEL ?? "";
  },
  async generate(summary: string): Promise<unknown> {
    const apiKey = requireEnv("OPENROUTER_API_KEY");
    const model = requireEnv("OPENROUTER_MODEL");

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: ROAST_SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(summary) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenRouter request failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenRouter response missing message content");
    }

    return parseJsonFromText(content);
  },
};

export default openRouterProvider;
