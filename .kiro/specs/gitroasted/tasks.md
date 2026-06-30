# Implementation Plan: GitRoasted

## Overview

This plan implements GitRoasted incrementally in TypeScript on Next.js (App Router). The build order moves from foundation outward: project scaffold and shared types → pure logic layers (validators, GitHub client, analyzer, AI fallback orchestrator, slug) → persistence (Mongoose models, DB connection) → caching and rate limiting → API route handlers → frontend pages and components → integration wiring. Property-based tests for the 15 correctness properties are placed next to the code they validate so logic errors surface early.

The project uses **Vitest** as the test runner and **fast-check** for property-based testing. Each property test runs a minimum of 100 iterations and is tagged with its design property comment.

## Tasks

- [x] 1. Set up Next.js project scaffold and tooling
  - Initialize a Next.js 16+ App Router project with TypeScript
  - Add dependencies: `mongoose`, `zod`, `fast-check`, `vitest`, `@vitejs/plugin-react` (or equivalent), and testing-library packages
  - Create the directory structure: `lib/`, `lib/ai/`, `models/`, `app/`, `app/api/roast/`, `app/r/[slug]/`, `components/roast/`
  - Configure Vitest (config file, test scripts) and a `.env.example` listing `MONGODB_URI`, `GITHUB_TOKEN`, AI provider keys/models, `CACHE_DURATION_HOURS`, `RATE_LIMIT_PER_HOUR`, `AI_PRIMARY_PROVIDER`, `NEXT_PUBLIC_APP_URL`
  - _Requirements: 12.1_

- [x] 2. Define shared domain types and Zod schemas
  - [x] 2.1 Create core TypeScript interfaces and the validation schemas
    - In `lib/types.ts` (or co-located files) define `GitHubProfile`, `GitHubRepo`, `GitHubStats`, `AnalysisResult`, `RoastOutput`, `AiMeta`, `GenerationResult`, `AiProvider`
    - In `lib/validators.ts` define `GITHUB_USERNAME_REGEX`, `usernameSchema`, `roastRequestSchema`, `roastOutputSchema`, and the `validateUsername` and `parseRoastOutput` helpers returning typed `{ ok }` results
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3_

  - [ ]* 2.2 Write property test for username validation
    - **Property 1: Username validation matches the GitHub rule**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

  - [ ]* 2.3 Write property test for roast output schema range rejection
    - **Property 11: Out-of-range scores are rejected**
    - **Validates: Requirements 8.2**

  - [ ]* 2.4 Write unit tests for validator boundaries
    - Cover 39-char accept vs 40-char reject, `""`, `"   "`, leading/trailing hyphen, disallowed characters
    - _Requirements: 1.4, 1.5_

- [ ] 3. Implement the GitHub client
  - [ ] 3.1 Implement `fetchGitHubData` in `lib/github.ts`
    - GET `/users/{username}` then GET `/users/{username}/repos?per_page=100&sort=updated`, using `GITHUB_TOKEN` when present
    - Map profile 404 to `{ ok: false, kind: "not_found" }`, map 403/429/5xx/network failures to `{ ok: false, kind: "upstream_error" }`, return `{ ok: true, profile, repos }` (empty array allowed) on success
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 3.2 Write unit tests for the GitHub client
    - Mock fetch responses for success, profile 404, 403/5xx upstream errors, and an existing profile with an empty repos array; assert the correct typed result for each
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 4. Implement the profile analyzer
  - [ ] 4.1 Implement `analyzeProfile` in `lib/analyzer.ts`
    - Compute `GitHubStats` (total stars/forks, top languages, description coverage counts, original vs forked counts, homepage and recent-activity counts), all zero-valued for an empty repo list
    - Compute the Developer_Score as a clamped, rounded integer in `[0, 100]` and build the compact `summary` string embedding the key stats
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 4.2 Write property test for analyzer aggregation consistency
    - **Property 4: Analyzer aggregation is consistent**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 4.3 Write property test for bounded integer score
    - **Property 5: Developer score is a bounded integer**
    - **Validates: Requirements 6.3**

  - [ ]* 4.4 Write property test for the summary string
    - **Property 6: Analyzer produces a usable summary**
    - **Validates: Requirements 6.4**

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement the AI fallback system
  - [ ] 6.1 Implement the rule-based engine and default roast in `lib/ai/fallback.ts`
    - Implement `ruleBasedRoast(profile, stats, score)` building roast lines from heuristics and deriving a grade from the score
    - Define `DEFAULT_ROAST` as a constant that always satisfies `roastOutputSchema`
    - _Requirements: 7.3, 7.4_

  - [ ] 6.2 Implement the individual AI provider modules
    - Create `lib/ai/openrouter.ts`, `lib/ai/gemini.ts`, `lib/ai/openai.ts`, `lib/ai/grok.ts`, each implementing `AiProvider` with name, model, and a `generate(summary)` HTTP call returning the raw unvalidated response
    - _Requirements: 7.1_

  - [ ] 6.3 Implement the orchestrator in `lib/ai/index.ts`
    - Implement `generateRoast(summary, analyzerScore)` attempting providers in order OpenRouter → Gemini → OpenAI → Grok, validating each response with `parseRoastOutput`, skipping any throwing or invalid provider, falling back to `ruleBasedRoast` then `DEFAULT_ROAST`, and populating `aiMeta` (providerUsed, modelUsed, aiFailed, fallbackUsed)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.3_

  - [ ]* 6.4 Write unit tests for provider modules
    - For each provider, mock the HTTP response and assert `generate` maps it into the expected raw object
    - _Requirements: 7.1_

  - [ ]* 6.5 Write property test for fallback chain order and validity
    - **Property 8: AI fallback chain order and validity**
    - **Validates: Requirements 7.1, 7.2, 7.3, 8.1, 8.3**

  - [ ]* 6.6 Write property test for guaranteed valid roast
    - **Property 9: Generation always yields a valid roast**
    - **Validates: Requirements 7.4**

  - [ ]* 6.7 Write property test for AI metadata correctness
    - **Property 10: AI metadata reflects the producing path**
    - **Validates: Requirements 7.5**

- [ ] 7. Implement the slug generator
  - [ ] 7.1 Implement `generateSlug` in `lib/slug.ts`
    - Lowercase the username, strip characters outside `[a-z0-9-]`, append a hyphen and a 5-char random alphanumeric suffix
    - _Requirements: 9.1_

  - [ ]* 7.2 Write property test for slug format
    - **Property 12: Slug format**
    - **Validates: Requirements 9.1**

- [ ] 8. Implement persistence layer
  - [ ] 8.1 Implement the Mongoose connection helper in `lib/db.ts`
    - Implement a cached connection using `MONGODB_URI` safe for serverless reuse
    - _Requirements: 9.2_

  - [ ] 8.2 Implement the `Roast` model in `models/Roast.ts`
    - Define the schema with nested `githubProfile`, `githubStats`, `analysis`, `aiMeta`, `publicStats`, timestamps, a unique index on `slug`, and an index on `username`
    - _Requirements: 9.2, 9.3, 9.4_

  - [ ] 8.3 Implement the `RateLimit` model in `models/RateLimit.ts`
    - Define the schema with unique `ip`, `requests`, `windowStart`, `lastRequestAt`
    - _Requirements: 3.1_

  - [ ]* 8.4 Write property test for persistence round-trip and share URL
    - **Property 13: Persistence round-trip and share URL**
    - **Validates: Requirements 9.2, 9.4**

  - [ ]* 8.5 Write integration test for slug uniqueness at the DB level
    - **Property 14: Slug uniqueness**
    - Assert the unique index rejects a duplicate slug insert
    - **Validates: Requirements 9.3**

- [ ] 9. Implement caching and rate limiting logic
  - [ ] 9.1 Implement the cache lookup helper
    - Add a function that queries the `Roast` collection for a record for the username created within `CACHE_DURATION_HOURS`, returning the record on hit or null on miss
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 9.2 Write property test for the cache decision
    - **Property 7: Cache decision depends only on record age**
    - **Validates: Requirements 4.2, 4.3**

  - [ ] 9.3 Implement `checkAndRecord` in `lib/rate-limit.ts`
    - Read the IP's `RateLimit` doc; reset `requests` and `windowStart` when the window has elapsed, otherwise increment; return `allowed: false` with `retryAfterSeconds` when the limit would be exceeded; support an injectable clock for testing
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [ ]* 9.4 Write property test for the per-IP rate-limit window
    - **Property 2: Rate limiter enforces the per-IP window**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

  - [ ]* 9.5 Write property test for cached requests not consuming budget
    - **Property 3: Cached requests do not consume rate budget**
    - **Validates: Requirements 3.4**

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement API route handlers
  - [ ] 11.1 Implement `POST /api/roast` in `app/api/roast/route.ts`
    - Orchestrate: validate → cache lookup (hit returns slug/shareUrl with no AI and no rate count) → on miss check+record rate limit → fetch GitHub data → analyze → `generateRoast` → persist `Roast_Record` with a unique slug (bounded retry on collision) → respond with `{ success, slug, shareUrl }`
    - Map error codes to status: `VALIDATION` 400, `RATE_LIMIT` 429, `NOT_FOUND` 404, `UPSTREAM` 502, `GENERATION` 500; never return a share URL when no valid output was produced
    - _Requirements: 2.1, 3.2, 3.4, 4.1, 4.2, 4.3, 4.4, 5.3, 5.4, 5.5, 9.1, 9.2, 9.3, 9.4_

  - [ ] 11.2 Implement `GET /api/roast/[slug]` in `app/api/roast/[slug]/route.ts`
    - Return the `Roast_Record` for the slug, or 404 when none exists
    - _Requirements: 10.1, 10.2_

  - [ ]* 11.3 Write integration tests for the roast API routes
    - With mocked GitHub/AI/persistence: cache hit (no rate count), cache miss success, rate-limit rejection, not-found, upstream error, and generation-failure (no share URL) paths; and the GET route hit/miss
    - _Requirements: 2.1, 3.2, 3.4, 4.2, 4.4, 5.3, 5.4, 10.1, 10.2_

- [ ] 12. Implement frontend pages and components
  - [ ] 12.1 Implement the home page in `app/page.tsx`
    - Render the hero section describing the product and a control to begin entering a username; wrap primary content in an error boundary that renders a fallback error state
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 12.2 Implement `components/roast/UsernameForm.tsx` (client)
    - Controlled input with a client-side mirror of `usernameSchema`, loading state during submit, POST to `/api/roast`, navigation to `/r/[slug]` on success, inline error on failure (stay on form)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 12.2_

  - [ ] 12.3 Implement the result page in `app/r/[slug]/page.tsx` (server component)
    - Fetch the record by slug and render avatar, username, score circle, grade badge, title, short/long roast, stats grid, strengths, weaknesses, tips, and share caption; render a not-found view when the slug has no record; viewable without auth
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 12.4 Implement `components/roast/ShareButtons.tsx` (client)
    - Copy `shareUrl` to the clipboard via the Clipboard API, show confirmation on success and an error message on failure
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 12.5 Write property test for result rendering completeness
    - **Property 15: Result rendering includes all record fields**
    - **Validates: Requirements 10.1**

  - [ ]* 12.6 Write component tests for the UI flows
    - Cover valid/invalid submit, loading state, success navigation, error display (Req 2.1–2.4); not-found view and no-auth access (Req 10.2, 10.3); clipboard success/confirmation/failure (Req 11.1–11.3); home hero/CTA and fallback error state (Req 12.1–12.3)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 10.2, 10.3, 11.1, 11.2, 11.3, 12.1, 12.2, 12.3_

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP, though they validate the design's correctness properties and acceptance criteria.
- Each task references specific requirements for traceability, and each property test sub-task references its design property number.
- Property-based tests use fast-check (minimum 100 iterations each) with external effects (MongoDB, GitHub, AI HTTP) mocked or backed by an injected clock / in-memory store.
- Checkpoints ensure incremental validation at natural boundaries (after pure logic, after persistence + limits, and at the end).
- The AI orchestrator never throws to the API; the fallback chain guarantees a valid roast is always produced.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "6.1", "6.2", "7.1", "8.1"] },
    { "id": 3, "tasks": ["2.3", "3.2", "4.2", "6.3", "6.4", "7.2", "8.2", "8.3"] },
    { "id": 4, "tasks": ["2.4", "4.3", "6.5", "9.1", "9.3", "11.2"] },
    { "id": 5, "tasks": ["4.4", "6.6", "8.4", "9.2", "11.1"] },
    { "id": 6, "tasks": ["6.7", "8.5", "9.4", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 7, "tasks": ["9.5", "11.3", "12.5", "12.6"] }
  ]
}
```
