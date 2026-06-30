/**
 * OpenAI provider.
 *
 * Implements `AiProvider` for the OpenAI chat-completions API. Reads
 * `OPENAI_API_KEY` and `OPENAI_MODEL` from the environment and returns the
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

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export const openAiProvider: AiProvider = {
  name: "openai",
  get model(): string {
    return process.env.OPENAI_MODEL ?? "";
  },
  async generate(summary: string): Promise<unknown> {
    const apiKey = requireEnv("OPENAI_API_KEY");
    const model = requireEnv("OPENAI_MODEL");

    const response = await fetch(OPENAI_ENDPOINT, {
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
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI response missing message content");
    }

    return parseJsonFromText(content);
  },
};

export default openAiProvider;
