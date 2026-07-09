# 🔥 GitRoasted

AI-powered GitHub profile roast generator. Enter a username, get a witty, savage roast of their public GitHub activity — repos, languages, commit habits, and questionable life choices included.

Built with Next.js 16 (App Router), TypeScript, MongoDB, and a multi-provider AI fallback chain.

---

## Features

- **Roast any public GitHub profile** — fetches live data via the GitHub REST API.
- **Profile analysis** — computes stats and a 0–100 score from repos, languages, stars, and activity.
- **Multi-provider AI fallback** — tries OpenRouter → Gemini → OpenAI → Grok → rule-based → default, so a roast always comes back even if a provider is down.
- **Shareable results** — every roast gets a unique slug and a shareable link.
- **Caching** — repeat roasts within a configurable window are served from MongoDB instead of regenerating.
- **Rate limiting** — per-IP hourly cap on AI-requiring requests.
- **Neo-Brutalism UI** — responsive, animated loading, mobile-friendly.

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
| `GITHUB_TOKEN`           | GitHub PAT (public read) — raises API rate limit.            |
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
npm run dev         # start dev server
npm run build       # production build
npm run start       # run production build
npm run lint        # lint
npm run test        # run tests once
npm run test:watch  # run tests in watch mode
```

---

## Project Structure

```
app/
  api/roast/route.ts          POST — validate → cache → rate-limit → fetch → analyze → generate → persist
  api/roast/[slug]/route.ts   GET a stored roast
  page.tsx                    home page + username form
  r/[slug]/page.tsx           result page
components/
  roast/                      UsernameForm, RoastResult, ShareButtons
  ErrorBoundary.tsx
lib/
  github.ts                   GitHub REST client
  analyzer.ts                 profile → stats + score + summary
  ai/                         provider modules + generateRoast orchestrator + fallback
  validators.ts               Zod schemas
  db.ts                       cached Mongoose connection (serverless-safe)
  cache.ts                    cached-roast lookup
  rate-limit.ts               per-IP rate limiting
  slug.ts                     unique slug generator
models/
  Roast.ts, RateLimit.ts      Mongoose models
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
