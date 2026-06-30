// Task 6.4: Unit tests for each AI provider module.
// Mocks fetch and asserts that each provider correctly maps the HTTP response.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openRouterProvider } from "./openrouter";
import { geminiProvider } from "./gemini";
import { openAiProvider } from "./openai";
import { grokProvider } from "./grok";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const rawRoast = {
  score: 72,
  grade: "B",
  title: "Solid Dev",
  shortRoast: "Not bad.",
  longRoast: "Actually pretty good.",
  strengths: ["Consistency"],
  weaknesses: ["No bio"],
  improvementTips: ["Add a bio"],
  shareCaption: "Check out my roast!",
};

const SUMMARY = "GitHub user: testuser\nDeveloper score: 72/100";

beforeEach(() => {
  vi.clearAllMocks();
  // Provide required env vars for each provider
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.OPENROUTER_MODEL = "test-openrouter-model";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GEMINI_MODEL = "gemini-test-model";
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_MODEL = "gpt-test";
  process.env.GROK_API_KEY = "test-grok-key";
  process.env.GROK_MODEL = "grok-test";
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.GROK_API_KEY;
  delete process.env.GROK_MODEL;
});

describe("openRouterProvider", () => {
  it("extracts and parses the content from the choices envelope", async () => {
    const responseBody = {
      choices: [{ message: { content: JSON.stringify(rawRoast) } }],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => responseBody,
    });

    const result = await openRouterProvider.generate(SUMMARY);
    expect(result).toMatchObject(rawRoast);
  });

  it("throws when the HTTP response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(openRouterProvider.generate(SUMMARY)).rejects.toThrow("500");
  });

  it("throws when the content field is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    });
    await expect(openRouterProvider.generate(SUMMARY)).rejects.toThrow();
  });
});

describe("geminiProvider", () => {
  it("extracts and parses text from the candidates envelope", async () => {
    const responseBody = {
      candidates: [
        { content: { parts: [{ text: JSON.stringify(rawRoast) }] } },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => responseBody,
    });

    const result = await geminiProvider.generate(SUMMARY);
    expect(result).toMatchObject(rawRoast);
  });

  it("throws when the HTTP response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(geminiProvider.generate(SUMMARY)).rejects.toThrow("403");
  });

  it("throws when the candidate text is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [] }),
    });
    await expect(geminiProvider.generate(SUMMARY)).rejects.toThrow();
  });
});

describe("openAiProvider", () => {
  it("extracts and parses content from the choices envelope", async () => {
    const responseBody = {
      choices: [{ message: { content: JSON.stringify(rawRoast) } }],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => responseBody,
    });

    const result = await openAiProvider.generate(SUMMARY);
    expect(result).toMatchObject(rawRoast);
  });

  it("throws when the HTTP response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
    await expect(openAiProvider.generate(SUMMARY)).rejects.toThrow("429");
  });
});

describe("grokProvider", () => {
  it("extracts and parses content from the choices envelope", async () => {
    const responseBody = {
      choices: [{ message: { content: JSON.stringify(rawRoast) } }],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => responseBody,
    });

    const result = await grokProvider.generate(SUMMARY);
    expect(result).toMatchObject(rawRoast);
  });

  it("throws when the HTTP response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(grokProvider.generate(SUMMARY)).rejects.toThrow("500");
  });
});

describe("providers strip markdown fences from model responses", () => {
  it("openRouterProvider parses JSON wrapped in a ```json fence", async () => {
    const fenced = "```json\n" + JSON.stringify(rawRoast) + "\n```";
    const responseBody = {
      choices: [{ message: { content: fenced } }],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => responseBody,
    });
    const result = await openRouterProvider.generate(SUMMARY);
    expect(result).toMatchObject(rawRoast);
  });
});
