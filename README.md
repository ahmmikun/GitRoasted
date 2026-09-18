# 🔥 GitRoasted

AI-powered GitHub developer analysis platform. Enter a username to get a witty AI roast **and** a measured Developer Score out of 1000 across eight dimensions — then compare developers, climb the leaderboard, and get a practical roadmap to improve.

Built with Next.js 16 (App Router), TypeScript, MongoDB, and a multi-provider AI fallback chain.

---

## Features

- **Roast any public GitHub profile** — fetches live data via the GitHub REST API.
- **1000-point Developer Score** — eight weighted dimensions (Impact, Consistency, Quality, Community, Diversity, Experience, Activity, Bonuses), each with a transparent breakdown.
- **Leaderboard** — ranks every analyzed developer by score, with top-3 podium, search, and pagination. No fake rankings: it fills up organically as profiles are analyzed.
- **Compare developers** — factual, side-by-side comparison across every dimension and headline metric, with a shareable URL.
- **How to Improve** — a deterministic roadmap (Quick Wins / Short-Term / Long-Term) derived from the profile's real data, never generic filler.
- **Multi-provider AI fallback** — OpenRouter → Gemini → OpenAI → Grok → rule-based → default, so a roast always comes back. The canonical score is always the analyzer's, never the model's.
- **Shareable results** — every roast gets a unique slug and a shareable link.
- **Caching** — repeat analyses within a configurable window are served from MongoDB instead of refetching.
- **Rate limiting** — per-IP hourly cap on AI-requiring requests.
- **Neo-Brutalism UI** — responsive, accessible, keyboard-navigable, mobile-friendly.

---

## Tech Stack

| Layer      | Tech                                        |
| ---------- | ------------------------------------------- |
| Framework  | Next.js 16 (App Router), React 19           |
| Language   | TypeScript                                  |
| Database   | MongoDB via Mongoose                         |
| Validation | Zod v4                                       |
| AI         | OpenRouter, Gemini, OpenAI, Grok (fallback) |
| Testing    | Vitest + fast-check                         |
| Icons/UI   | Radix UI, lucide-react                      |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A MongoDB database (e.g. MongoDB Atlas)
- A GitHub personal access token (public read)
- At least one AI provider API key (optional — falls back to rule-based roasts without one)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# then fill in the values in .env.local

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable                 | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `MONGODB_URI`            | MongoDB connection string.                                   |
| `GITHUB_TOKEN`           | GitHub PAT (public read) — raises the API rate limit and enables the GraphQL contribution calendar used by the Consistency dimension. Without it, Consistency is estimated from public events. |
| `AI_PRIMARY_PROVIDER`    | First provider to try: `openrouter` \| `gemini` \| `openai` \| `grok`. |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | OpenRouter credentials.                     |
| `GEMINI_API_KEY` / `GEMINI_MODEL`         | Google Gemini credentials.                  |
| `OPENAI_API_KEY` / `OPENAI_MODEL`         | OpenAI credentials.                         |
| `GROK_API_KEY` / `GROK_MODEL`             | Grok / xAI credentials.                     |
| `CACHE_DURATION_HOURS`   | Hours a roast is reused before regenerating (default `24`).  |
| `RATE_LIMIT_PER_HOUR`    | Max AI-requiring requests per IP per hour (default `5`).     |
| `NEXT_PUBLIC_APP_URL`    | Public base URL for shareable links.                         |

---

## Scripts

```bash
npm run dev              # start dev server
npm run build            # production build
npm run start            # run production build
npm run lint             # type-check (tsc --noEmit)
npm run typecheck        # type-check (alias)
npm run test             # run tests once
npm run test:watch       # run tests in watch mode

# Maintenance scripts (require Node 22+ for --experimental-strip-types)
npm run seed:leaderboard         # populate the leaderboard with well-known devs
npm run seed:leaderboard -- --dry   # analyze without writing
npm run migrate:scores           # rescale legacy 0–100 scores to 0–1000 (idempotent)
npm run migrate:scores -- --dry     # report what would change, write nothing
```

> The maintenance scripts run through Node's built-in TypeScript support via a
> tiny zero-dependency loader in `scripts/`. They read `MONGODB_URI` from
> `.env.local`/`.env`. `migrate:scores` rewrites stored data — run `--dry`
> first and prefer a development database.

---

## Project Structure

```
app/
  api/roast/route.ts          POST — validate → cache → rate-limit → analyze → generate → persist
  api/roast/[slug]/route.ts   GET a stored roast
  api/leaderboard/route.ts    GET ranked developers (page/pageSize/q)
  api/compare/route.ts        GET ?a=&b= factual comparison
  api/improve/route.ts        GET ?username= improvement roadmap
  page.tsx                    home page + username form
  r/[slug]/page.tsx           result page
  leaderboard/ compare/ improve/ about/ support/   feature pages
components/
  layout/                     NavBar, Footer, SocialIcon
  leaderboard/ compare/ improve/                    feature clients
  score/ScoreMeter.tsx        reusable dimension meter
  roast/                      UsernameForm, RoastResult, ShareButtons
  ErrorBoundary.tsx
lib/
  github.ts                   GitHub REST client + GraphQL contributions
  analyzer.ts                 profile → stats + score + summary
  scoring.ts                  8-dimension /1000 Developer Score engine
  analysis-service.ts         shared analyze-with-cache + leaderboard snapshot
  leaderboard.ts compare.ts recommendations.ts      feature logic
  site-config.ts              nav, socials, support links
  ai/                         provider modules + generateRoast orchestrator + fallback
  validators.ts               Zod schemas
  db.ts                       cached Mongoose connection (serverless-safe)
  cache.ts                    cached-roast lookup
  rate-limit.ts               per-IP rate limiting
  slug.ts                     unique slug generator
models/
  Roast.ts, RateLimit.ts, ProfileAnalysis.ts   Mongoose models
scripts/
  seed-leaderboard.ts, migrate-scores.ts        maintenance CLIs
```

---

## How It Works

1. User submits a GitHub username.
2. `POST /api/roast` validates input, checks the cache, then enforces the per-IP rate limit.
3. On a cache miss, it fetches public profile data from GitHub and analyzes it into stats + a score.
4. `generateRoast` walks the AI fallback chain (OpenRouter → Gemini → OpenAI → Grok → rule-based → default) until one returns.
5. The roast is persisted with a unique slug and served back with a shareable link.

---

## Testing

```bash
npm run test
```

Uses Vitest with fast-check property-based tests covering validation, analysis, slug generation, caching, and rate-limit logic.

---

## License

[MIT](LICENSE) © Salman Ahmad
