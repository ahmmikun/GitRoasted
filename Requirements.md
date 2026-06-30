# GitRoasted — Detailed Full Stack Project Plan

## 1. Project Summary

**GitRoasted** is an AI-powered GitHub roast generator.

User enters a GitHub username. The app fetches public GitHub data, analyzes the profile and repositories, generates a funny roast using AI, calculates a developer score, saves the result in MongoDB, and gives the user a public shareable link.

No login required.

Example flow:

```txt
User enters: ahmmikun
↓
App fetches GitHub profile + repos
↓
AI generates roast + score + tips
↓
Result saved in MongoDB
↓
User gets public link:
https://gitroasted.vercel.app/r/ahmmikun-abc123
```

Anyone can open that link and see the roast.

---

# 2. Main Features

## MVP Features

```txt
1. No login required
2. Enter GitHub username
3. Fetch GitHub profile data
4. Fetch GitHub repositories
5. Analyze profile quality
6. Generate AI roast
7. Generate developer score /100
8. Generate serious improvement tips
9. Store result in MongoDB
10. Create public shareable roast link
11. Public result page
12. AI provider fallback system
13. Rate limiting
14. Reuse cached roasts to save tokens
15. Beautiful UI using shadcn/ui or DaisyUI
```

---

# 3. Recommended Project Stack

## Best Stack

```txt
Framework: Next.js 16+ App Router
Language: TypeScript 6
Styling: Tailwind CSS
UI Library: shadcn/ui
Database: MongoDB Atlas
ODM: Mongoose
AI Providers:
  - OpenRouter
  - Gemini
  - OpenAI
  - Grok / xAI
GitHub Data: GitHub REST API
Validation: Zod
Rate Limit: MongoDB-based simple rate limiter
Image Export: html-to-image
Deployment: Vercel
```

## Best UI Library Choice

Use **shadcn/ui**.

Why?

```txt
1. Looks more professional
2. Best for portfolio projects
3. Works perfectly with Tailwind
4. Easy to customize
5. Modern dark UI
6. Recruiter-friendly SaaS look
```

DaisyUI is easier, but shadcn/ui looks more premium.

Final recommendation:

```txt
Use shadcn/ui + Tailwind CSS
```

---

# 4. App Pages

```txt
/
Home page

/roast
Username input page

/r/[slug]
Public roast result page

/leaderboard
Public leaderboard of recent/top roasts

/about
About the project

/tips
GitHub profile improvement tips

/privacy
Privacy policy
```

No dashboard, no login for MVP.

---

# 5. User Flow

```txt
1. User opens website
2. User enters GitHub username
3. Frontend sends POST request to /api/roast
4. Backend validates username
5. Backend checks rate limit
6. Backend checks MongoDB cache
7. If recent roast exists, return existing share link
8. If no cache, fetch GitHub profile
9. Fetch user repositories
10. Analyze profile stats
11. Send compact summary to AI
12. If primary AI fails, try fallback provider
13. If all AI providers fail, use rule-based roast
14. Save result in MongoDB
15. Generate unique slug
16. Return shareable result URL
17. User is redirected to /r/[slug]
18. Anyone with link can view roast
```

---

# 6. AI Provider Fallback System

The app should support multiple AI providers.

Priority order:

```txt
1. OpenRouter
2. Gemini
3. OpenAI
4. Grok / xAI
5. Rule-based fallback
```

Example:

```txt
Try OpenRouter
↓ if fails
Try Gemini
↓ if fails
Try OpenAI
↓ if fails
Try Grok
↓ if fails
Use local rule-based roast engine
```

This prevents app failure.

---

# 7. Environment Variables

```env
MONGODB_URI=

GITHUB_TOKEN=

OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free

GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

GROK_API_KEY=
GROK_MODEL=grok-2-latest

NEXT_PUBLIC_APP_URL=http://localhost:3000

AI_PRIMARY_PROVIDER=openrouter
CACHE_DURATION_HOURS=24
RATE_LIMIT_PER_HOUR=5
```

---

# 8. Database Design

## Roast Collection

```ts
{
  _id: ObjectId,

  slug: string,
  username: string,

  githubProfile: {
    login: string,
    name: string,
    avatarUrl: string,
    bio: string,
    followers: number,
    following: number,
    publicRepos: number,
    profileUrl: string,
    blog: string,
    company: string,
    location: string,
    createdAt: Date
  },

  githubStats: {
    totalReposAnalyzed: number,
    totalStars: number,
    totalForks: number,
    topLanguages: string[],
    reposWithDescription: number,
    reposWithoutDescription: number,
    reposWithHomepage: number,
    recentlyUpdatedRepos: number,
    forkedRepos: number,
    originalRepos: number
  },

  analysis: {
    score: number,
    grade: string,
    title: string,
    shortRoast: string,
    longRoast: string,
    strengths: string[],
    weaknesses: string[],
    improvementTips: string[],
    shareCaption: string
  },

  aiMeta: {
    providerUsed: string,
    modelUsed: string,
    aiFailed: boolean,
    fallbackUsed: boolean
  },

  publicStats: {
    views: number,
    shares: number
  },

  createdAt: Date,
  updatedAt: Date
}
```

---

## RateLimit Collection

```ts
{
  ip: string,
  requests: number,
  windowStart: Date,
  lastRequestAt: Date
}
```

---

# 9. API Routes

```txt
POST /api/roast
Create new roast

GET /api/roast/[slug]
Get saved roast by shareable slug

GET /api/leaderboard
Get top/recent public roasts

POST /api/roast/[slug]/view
Increase view count

POST /api/roast/[slug]/share
Increase share count
```

---

# 10. POST /api/roast Request

```json
{
  "username": "ahmmikun",
  "roastMode": "brutal"
}
```

## Response

```json
{
  "success": true,
  "slug": "ahmmikun-x7k92",
  "shareUrl": "https://gitroasted.vercel.app/r/ahmmikun-x7k92"
}
```

---

# 11. AI Output JSON

AI must return strict JSON:

```json
{
  "score": 72,
  "grade": "B",
  "title": "Promising Developer With README Trauma",
  "shortRoast": "Your GitHub has potential, but your README files are fighting for survival.",
  "longRoast": "You have enough repositories to look active, but some of them feel like they were abandoned right after npm install.",
  "strengths": [
    "Good number of public repositories",
    "Multiple technologies used",
    "Some projects show real effort"
  ],
  "weaknesses": [
    "Several repositories lack proper descriptions",
    "README quality needs improvement",
    "Low public engagement through stars and forks"
  ],
  "improvementTips": [
    "Add professional README files",
    "Pin your best 6 repositories",
    "Add live demo links",
    "Use screenshots in project documentation",
    "Write better commit messages"
  ],
  "shareCaption": "I got roasted by GitRoasted 💀 My GitHub score is 72/100."
}
```

---

# 12. AI Prompt

```txt
You are GitRoasted, a funny but helpful GitHub profile reviewer.

You will receive public GitHub profile and repository analysis data.

Your job:
1. Generate a funny developer-focused roast.
2. Give a score out of 100.
3. Give a grade.
4. Mention strengths.
5. Mention weaknesses.
6. Give practical improvement tips.
7. Generate a short share caption.

Rules:
- Roast only GitHub profile, repositories, README quality, activity, stars, project structure, and presentation.
- Do not insult personal identity, religion, race, nationality, gender, appearance, health, or family.
- Keep the roast funny, playful, and useful.
- Do not be hateful or abusive.
- Return valid JSON only.
- Do not use markdown.

GitHub Summary:
{{GITHUB_SUMMARY}}

Return exactly this JSON structure:
{
  "score": number,
  "grade": string,
  "title": string,
  "shortRoast": string,
  "longRoast": string,
  "strengths": string[],
  "weaknesses": string[],
  "improvementTips": string[],
  "shareCaption": string
}
```

---

# 13. Project Folder Structure

```txt
gitroasted/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   │
│   ├── roast/
│   │   └── page.tsx
│   │
│   ├── r/
│   │   └── [slug]/
│   │       └── page.tsx
│   │
│   ├── leaderboard/
│   │   └── page.tsx
│   │
│   ├── about/
│   │   └── page.tsx
│   │
│   ├── tips/
│   │   └── page.tsx
│   │
│   ├── privacy/
│   │   └── page.tsx
│   │
│   └── api/
│       ├── roast/
│       │   ├── route.ts
│       │   └── [slug]/
│       │       └── route.ts
│       │
│       └── leaderboard/
│           └── route.ts
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── Container.tsx
│   │
│   ├── home/
│   │   ├── HeroSection.tsx
│   │   ├── ExampleRoastCard.tsx
│   │   ├── HowItWorks.tsx
│   │   └── FeatureGrid.tsx
│   │
│   ├── roast/
│   │   ├── UsernameForm.tsx
│   │   ├── RoastResult.tsx
│   │   ├── RoastCard.tsx
│   │   ├── ScoreCircle.tsx
│   │   ├── GitHubStatsGrid.tsx
│   │   ├── StrengthWeaknessList.tsx
│   │   ├── ImprovementTips.tsx
│   │   ├── ShareButtons.tsx
│   │   └── DownloadCardButton.tsx
│   │
│   └── ui/
│       └── shadcn components
│
├── lib/
│   ├── db.ts
│   ├── github.ts
│   ├── analyzer.ts
│   ├── slug.ts
│   ├── rate-limit.ts
│   ├── validators.ts
│   │
│   ├── ai/
│   │   ├── index.ts
│   │   ├── prompt.ts
│   │   ├── openrouter.ts
│   │   ├── gemini.ts
│   │   ├── openai.ts
│   │   ├── grok.ts
│   │   └── fallback.ts
│
├── models/
│   ├── Roast.ts
│   └── RateLimit.ts
│
├── types/
│   ├── github.ts
│   ├── roast.ts
│   └── ai.ts
│
├── public/
│   ├── logo.png
│   └── og-image.png
│
├── .env.local
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

---

# 14. Main Backend Files

## `lib/github.ts`

Responsible for:

```txt
1. Fetch GitHub user profile
2. Fetch repositories
3. Fetch README existence if needed
4. Handle GitHub errors
```

---

## `lib/analyzer.ts`

Responsible for:

```txt
1. Calculate total stars
2. Count languages
3. Count repos without descriptions
4. Check activity
5. Calculate score
6. Prepare compact summary for AI
```

---

## `lib/ai/index.ts`

Responsible for fallback system:

```txt
1. Try primary AI provider
2. If failed, try secondary provider
3. Continue fallback chain
4. If all fail, use rule-based roast
```

---

## `lib/ai/openrouter.ts`

Handles OpenRouter API call.

---

## `lib/ai/gemini.ts`

Handles Gemini API call.

---

## `lib/ai/openai.ts`

Handles OpenAI API call.

---

## `lib/ai/grok.ts`

Handles Grok/xAI API call.

---

## `lib/ai/fallback.ts`

Local roast generator without AI tokens.

---

# 15. Fallback Rule-Based Roast

Example logic:

```ts
if (!bio) {
  roast.push("Your GitHub bio is missing. Even npm packages have more identity.");
}

if (publicRepos < 3) {
  roast.push("Your repo count is so low, GitHub might think you are just visiting.");
}

if (totalStars === 0) {
  roast.push("The stars section is emptier than a fresh MongoDB collection.");
}

if (reposWithoutDescription > 5) {
  roast.push("Your repositories have no descriptions. Recruiters are developers, not detectives.");
}

if (topLanguages.length === 1) {
  roast.push("One language portfolio? Bro is trying to become full stack with one stack.");
}
```

---

# 16. UI Design Direction

## Style

```txt
Dark
Modern
Developer-focused
GitHub-inspired
Funny
Clean SaaS style
```

## Colors

```txt
Background: #0D1117
Cards: #161B22
Text: #F0F6FC
Muted Text: #8B949E
Accent: Neon green / purple / blue
Border: #30363D
```

## UI Components

Use shadcn/ui:

```txt
Button
Card
Input
Badge
Tabs
Progress
Skeleton
Alert
Dialog
Tooltip
Separator
```

---

# 17. Home Page Sections

```txt
1. Navbar
2. Hero section
3. GitHub username input
4. Example roast card
5. How it works
6. Feature cards
7. Leaderboard preview
8. CTA section
9. Footer
```

Hero copy:

```txt
Get Your GitHub Roasted by AI

Drop your GitHub username and let AI roast your repos, README files, commit habits, and profile quality — then get real tips to improve.
```

---

# 18. Result Page Sections

```txt
1. User avatar
2. Username
3. GitHub profile button
4. Score circle
5. Grade badge
6. Roast title
7. Short roast
8. Long roast
9. GitHub stats grid
10. Strengths
11. Weaknesses
12. Improvement tips
13. Share caption
14. Copy share link button
15. Download card button
16. Try another username button
```

---

# 19. Shareable Link System

When roast is generated, create slug:

```txt
username + random short id
```

Example:

```txt
ahmmikun-x7k92
```

Saved in DB:

```ts
slug: "ahmmikun-x7k92"
```

Public result URL:

```txt
/r/ahmmikun-x7k92
```

Anyone can open it without login.

---

# 20. Caching Logic

To save AI tokens:

```txt
If username already roasted in last 24 hours:
  return old result link

Else:
  generate new roast
```

Optional later:

```txt
Allow re-roast after 24 hours
```

---

# 21. Rate Limiting

No login means rate limiting is very important.

Simple rules:

```txt
Max 5 roast generations per IP per hour
Max 20 per IP per day
Cached results do not count as AI usage
```

If limit crossed:

```txt
Too many roasts. Try again later.
```

---

# 22. GitHub Username Validation

Valid username rules:

```txt
1. Only letters, numbers, hyphen
2. Cannot start or end with hyphen
3. Max 39 characters
```

Regex:

```txt
^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$
```

---

# 23. Build Order

## Phase 1 — UI Setup

```txt
1. Create Next.js app
2. Install Tailwind
3. Install shadcn/ui
4. Create layout
5. Create navbar/footer
6. Create home page
7. Create username input form
```

## Phase 2 — GitHub API

```txt
1. Create GitHub fetch functions
2. Fetch profile
3. Fetch repos
4. Calculate basic stats
5. Display raw stats on result page
```

## Phase 3 — Analyzer

```txt
1. Create scoring system
2. Create profile summary
3. Generate strengths
4. Generate weaknesses
5. Generate basic rule-based roast
```

## Phase 4 — AI System

```txt
1. Create AI prompt
2. Add OpenRouter support
3. Add Gemini support
4. Add OpenAI support
5. Add Grok support
6. Add fallback chain
7. Validate AI JSON response
```

## Phase 5 — Database

```txt
1. Connect MongoDB
2. Create Roast model
3. Save roast result
4. Create slug
5. Fetch result by slug
6. Add public result page
```

## Phase 6 — Protection

```txt
1. Add rate limiting
2. Add cache system
3. Add error handling
4. Add loading states
5. Add API validation
```

## Phase 7 — Viral Features

```txt
1. Copy share link
2. Share caption
3. Download roast card
4. Leaderboard
5. OG image later
```

---

# 24. Kiro Master Prompt

Use this:

```txt
Build a full-stack production-quality web app called GitRoasted.

GitRoasted is an AI-powered GitHub roast generator. Users do not need to login. A user enters a GitHub username, the app fetches public GitHub profile and repository data, analyzes the profile, generates a funny but safe AI roast, calculates a developer score out of 100, saves the result in MongoDB, and returns a public shareable result link. Anyone with that link can open the roast result page and see the roast, score, GitHub stats, strengths, weaknesses, and improvement tips.

Tech stack:
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- MongoDB with Mongoose
- GitHub REST API
- Zod validation
- AI provider fallback system

UI requirements:
- Use shadcn/ui components.
- Create a modern dark developer-focused UI.
- GitHub-inspired colors.
- Fully responsive design.
- Clean landing page.
- Beautiful roast result page.
- Shareable roast card.
- Loading states, skeletons, and error states.

Core pages:
1. Home page at /
2. Roast input page at /roast
3. Public roast result page at /r/[slug]
4. Leaderboard page at /leaderboard
5. About page at /about
6. Tips page at /tips
7. Privacy page at /privacy

Core functionality:
1. User enters GitHub username.
2. Validate GitHub username.
3. Check MongoDB cache.
4. If a recent roast exists for the username, return the existing shareable link.
5. If no cached roast exists, fetch GitHub profile data.
6. Fetch public repositories.
7. Analyze:
   - followers
   - following
   - public repos
   - total stars
   - forks
   - top languages
   - repo descriptions
   - repo activity
   - original repos vs forked repos
   - profile completeness
   - portfolio link availability
8. Generate developer score out of 100.
9. Generate compact GitHub summary for AI.
10. Use AI to generate:
   - score
   - grade
   - title
   - short roast
   - long roast
   - strengths
   - weaknesses
   - improvement tips
   - share caption
11. Save complete result in MongoDB.
12. Generate unique slug such as username-randomid.
13. Return shareable URL.
14. Public result page should fetch roast by slug.
15. Add view/share counters.

AI provider support:
- OpenRouter
- Gemini
- OpenAI
- Grok/xAI
- Rule-based fallback

AI fallback behavior:
1. Try OpenRouter first.
2. If OpenRouter fails, try Gemini.
3. If Gemini fails, try OpenAI.
4. If OpenAI fails, try Grok/xAI.
5. If all AI providers fail, use local rule-based roast generator.
6. Store providerUsed, modelUsed, aiFailed, and fallbackUsed in database.

Environment variables:
- MONGODB_URI
- GITHUB_TOKEN
- OPENROUTER_API_KEY
- OPENROUTER_MODEL
- GEMINI_API_KEY
- GEMINI_MODEL
- OPENAI_API_KEY
- OPENAI_MODEL
- GROK_API_KEY
- GROK_MODEL
- NEXT_PUBLIC_APP_URL
- AI_PRIMARY_PROVIDER
- CACHE_DURATION_HOURS
- RATE_LIMIT_PER_HOUR

Database:
Create Roast model with:
- slug
- username
- githubProfile
- githubStats
- analysis
- aiMeta
- publicStats
- createdAt
- updatedAt

Create RateLimit model with:
- ip
- requests
- windowStart
- lastRequestAt

API routes:
- POST /api/roast
- GET /api/roast/[slug]
- GET /api/leaderboard
- POST /api/roast/[slug]/view
- POST /api/roast/[slug]/share

Important safety rules:
- Roast only GitHub profile, repositories, README quality, stars, activity, project structure, and developer presentation.
- Do not roast race, religion, nationality, gender, appearance, disability, family, or private life.
- Keep humor playful, not hateful.
- Include useful improvement advice.

Project structure:
Create a clean folder structure with app, components, lib, lib/ai, models, types, and public folders.

Important:
- Do not add authentication in MVP.
- Do not overengineer.
- Make MVP working first.
- Code should be beginner-readable.
- Use reusable components.
- Add comments where logic is important.
- Add README with setup, env variables, features, and deployment instructions.
```

---

# 25. Best First Version Scope

Build only this first:

```txt
Home page
Username input
GitHub fetch
AI fallback system
MongoDB save
Public shareable link
Result page
Copy link button
Rate limiting
Cache
```

Login, dashboard, and user accounts are not needed.
