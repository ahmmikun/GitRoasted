# Requirements Document

## Introduction

GitRoasted is an AI-powered GitHub roast generator. A visitor enters a public GitHub username; the application fetches the public profile and repository data, analyzes the profile, computes a developer score, generates a funny but safe roast through a multi-provider AI fallback chain, persists the result in MongoDB, and returns a public shareable link. Anyone with the link can view the roast result without authentication.

This document defines the requirements for the first version (MVP) scope only: home page, username input, GitHub data fetch, AI fallback system, MongoDB persistence, public shareable link, public result page, copy link action, rate limiting, and caching. Authentication, dashboards, user accounts, leaderboard, and downloadable roast cards are out of scope for this version.

## Glossary

- **GitRoasted_System**: The complete GitRoasted web application, including frontend, backend API, and persistence layer.
- **Roast_API**: The backend endpoint that accepts a roast request and orchestrates validation, caching, fetching, analysis, AI generation, and persistence.
- **GitHub_Client**: The component responsible for retrieving public profile and repository data from the GitHub REST API.
- **Username_Validator**: The component that validates a submitted string against GitHub username rules.
- **Profile_Analyzer**: The component that computes aggregate GitHub statistics, the developer score, strengths, weaknesses, and the compact AI summary.
- **AI_Orchestrator**: The component that attempts AI providers in priority order and falls back to the rule-based engine.
- **AI_Provider**: An external large-language-model service (OpenRouter, Gemini, OpenAI, or Grok/xAI) used to generate a roast.
- **Rule_Based_Engine**: The local roast generator that produces a roast without calling any external AI provider.
- **Roast_Output**: The structured roast object containing score, grade, title, shortRoast, longRoast, strengths, weaknesses, improvementTips, and shareCaption.
- **Roast_Record**: The persisted MongoDB document containing the slug, username, githubProfile, githubStats, analysis, aiMeta, publicStats, and timestamps.
- **Slug**: The unique public identifier for a Roast_Record, formed from the username and a random short identifier (e.g., `ahmmikun-x7k92`).
- **Cache_Window**: The time period (default 24 hours) during which an existing Roast_Record for a username is reused instead of generating a new roast.
- **Rate_Limiter**: The component that enforces per-IP request limits using the RateLimit collection.
- **Result_Page**: The public page at `/r/[slug]` that displays a stored roast.
- **Developer_Score**: An integer from 0 to 100 representing overall GitHub profile quality.

## Requirements

### Requirement 1: GitHub Username Validation

**User Story:** As a visitor, I want my GitHub username input validated before processing, so that invalid input is rejected early and clearly.

#### Acceptance Criteria

1. WHEN a username is submitted, THE Username_Validator SHALL accept the username only IF it matches the pattern `^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$`.
2. IF a submitted username contains characters other than letters, digits, or hyphens, THEN THE Username_Validator SHALL reject the username and return a validation error.
3. IF a submitted username starts or ends with a hyphen, THEN THE Username_Validator SHALL reject the username and return a validation error.
4. IF a submitted username exceeds 39 characters, THEN THE Username_Validator SHALL reject the username and return a validation error.
5. IF a submitted username is empty or contains only whitespace, THEN THE Username_Validator SHALL reject the username and return a validation error.

### Requirement 2: Roast Request Submission

**User Story:** As a visitor, I want to submit a GitHub username from the input form, so that the application generates a roast for that profile.

#### Acceptance Criteria

1. WHEN a visitor submits a valid username on the input form, THE GitRoasted_System SHALL send a POST request to the Roast_API containing the username.
2. WHILE a roast request is in progress, THE GitRoasted_System SHALL display a loading state to the visitor.
3. WHEN the Roast_API returns a successful response containing a share URL, THE GitRoasted_System SHALL navigate the visitor to the corresponding Result_Page.
4. IF the Roast_API returns an error response, THEN THE GitRoasted_System SHALL display an error message describing the failure and SHALL retain the visitor on the input form.

### Requirement 3: Rate Limiting

**User Story:** As a service operator, I want per-IP rate limiting on roast generation, so that AI token usage and abuse are controlled without requiring login.

#### Acceptance Criteria

1. WHEN a roast request that requires AI generation is received, THE Rate_Limiter SHALL record the request against the originating IP address within the current time window.
2. IF the originating IP address has reached the configured hourly request limit, THEN THE Roast_API SHALL reject the request with a rate-limit error and SHALL NOT generate a new roast.
3. THE Roast_API SHALL return a rate-limit error only when the originating IP address has exceeded its configured request limit.
4. WHEN a roast request is served entirely from cache, THE Rate_Limiter SHALL NOT count the request against the IP rate limit.
5. WHEN the current rate-limit time window has elapsed for an IP address, THE Rate_Limiter SHALL reset the request count for that IP address.

### Requirement 4: Roast Caching

**User Story:** As a service operator, I want recently generated roasts reused, so that AI tokens are conserved and repeat lookups are fast.

#### Acceptance Criteria

1. WHEN a roast request is received for a username, THE Roast_API SHALL query MongoDB for an existing Roast_Record for that username created within the Cache_Window.
2. WHERE a valid cached Roast_Record exists within the Cache_Window, THE Roast_API SHALL return the existing share URL without fetching GitHub data or invoking an AI_Provider.
3. IF no valid cached Roast_Record exists within the Cache_Window, THEN THE Roast_API SHALL proceed to fetch GitHub data and generate a new roast.
4. IF a new roast generation is attempted but fails to produce a valid Roast_Output, THEN THE Roast_API SHALL return an error response and SHALL NOT return a share URL.

### Requirement 5: GitHub Data Retrieval

**User Story:** As a visitor, I want the application to fetch my public GitHub data, so that the roast is based on real profile and repository information.

#### Acceptance Criteria

1. WHEN a new roast is being generated, THE GitHub_Client SHALL fetch the public profile data for the username from the GitHub REST API.
2. WHEN a new roast is being generated, THE GitHub_Client SHALL fetch the public repositories for the username from the GitHub REST API.
3. IF the GitHub REST API reports that the username does not exist, THEN THE Roast_API SHALL return a not-found error and SHALL NOT generate a roast.
4. IF the GitHub REST API returns a rate-limit or service error, THEN THE Roast_API SHALL return an upstream-error response describing the failure.
5. WHERE the username exists but returns no accessible repository data, THE Roast_API SHALL proceed to generate a roast using whatever profile data is available.

### Requirement 6: Profile Analysis and Scoring

**User Story:** As a visitor, I want my GitHub profile analyzed into meaningful statistics and a score, so that the roast and tips are grounded in measurable data.

#### Acceptance Criteria

1. WHEN profile and repository data are available, THE Profile_Analyzer SHALL compute total stars, total forks, top languages, count of repositories with descriptions, count of repositories without descriptions, count of original repositories, and count of forked repositories.
2. WHERE a profile has zero repositories, THE Profile_Analyzer SHALL compute all repository-derived statistics as zero rather than omitting them.
3. WHEN analysis statistics are computed, THE Profile_Analyzer SHALL compute a Developer_Score as an integer between 0 and 100 inclusive.
4. WHEN analysis is complete, THE Profile_Analyzer SHALL produce a compact GitHub summary suitable for inclusion in an AI prompt.

### Requirement 7: AI Roast Generation with Provider Fallback

**User Story:** As a visitor, I want the roast generated by AI with automatic fallback, so that I always receive a result even when an AI provider fails.

#### Acceptance Criteria

1. WHEN a new roast is generated, THE AI_Orchestrator SHALL attempt the configured AI_Provider list in the priority order OpenRouter, Gemini, OpenAI, then Grok/xAI.
2. IF an attempted AI_Provider fails or returns an invalid response, THEN THE AI_Orchestrator SHALL attempt the next AI_Provider in the priority order.
3. IF every configured AI_Provider fails, THEN THE AI_Orchestrator SHALL generate the roast using the Rule_Based_Engine.
4. IF the Rule_Based_Engine fails to produce a valid Roast_Output, THEN THE AI_Orchestrator SHALL return a hardcoded default Roast_Output so that a result is always produced.
5. WHEN a roast is generated, THE AI_Orchestrator SHALL record the last attempted AI_Provider, the model used, whether AI generation failed, and whether the fallback was used.

### Requirement 8: Roast Output Validation

**User Story:** As a service operator, I want AI responses validated against a strict schema, so that malformed AI output never reaches persistence or the result page.

#### Acceptance Criteria

1. WHEN an AI_Provider returns a response, THE AI_Orchestrator SHALL validate the response against the Roast_Output schema containing score, grade, title, shortRoast, longRoast, strengths, weaknesses, improvementTips, and shareCaption.
2. IF a validated Roast_Output contains a score outside the range 0 to 100 inclusive, THEN THE AI_Orchestrator SHALL treat the response as invalid.
3. IF an AI_Provider response fails Roast_Output schema validation, THEN THE AI_Orchestrator SHALL treat the provider attempt as failed and continue the fallback chain.

### Requirement 9: Roast Persistence and Slug Generation

**User Story:** As a visitor, I want my completed roast saved with a unique public link, so that I can share it and revisit it later.

#### Acceptance Criteria

1. WHEN a valid Roast_Output is produced, THE Roast_API SHALL generate a Slug composed of the username and a random short identifier.
2. WHEN a Roast_Record is persisted, THE Roast_API SHALL store the slug, username, githubProfile, githubStats, analysis, aiMeta, publicStats, and creation timestamp in MongoDB.
3. THE Roast_API SHALL ensure that each persisted Slug is unique across all Roast_Records.
4. WHEN a Roast_Record is successfully persisted, THE Roast_API SHALL return a response containing the slug and the public share URL.

### Requirement 10: Public Result Page

**User Story:** As anyone with a share link, I want to view the roast result page, so that I can see the score, roast, stats, strengths, weaknesses, and tips without logging in.

#### Acceptance Criteria

1. WHEN a visitor opens a Result_Page for an existing Slug, THE GitRoasted_System SHALL retrieve the corresponding Roast_Record and display the username, avatar, Developer_Score, grade, roast title, short roast, long roast, GitHub statistics, strengths, weaknesses, and improvement tips.
2. IF a visitor opens a Result_Page for a Slug that has no Roast_Record, THEN THE GitRoasted_System SHALL display a not-found message.
3. THE Result_Page SHALL be viewable without authentication.

### Requirement 11: Copy Share Link

**User Story:** As a visitor viewing a roast, I want to copy the share link with one action, so that I can share my roast easily.

#### Acceptance Criteria

1. WHEN a visitor activates the copy link control on a Result_Page, THE GitRoasted_System SHALL copy the public share URL of the displayed Roast_Record to the clipboard.
2. WHEN the share URL is copied to the clipboard, THE GitRoasted_System SHALL display confirmation feedback to the visitor.
3. IF the clipboard operation fails, THEN THE GitRoasted_System SHALL display an error message to the visitor.

### Requirement 12: Home Page

**User Story:** As a visitor, I want a clear home page, so that I understand the product and can start a roast.

#### Acceptance Criteria

1. WHEN a visitor opens the home page, THE GitRoasted_System SHALL display a hero section describing the product and a control to begin entering a GitHub username.
2. WHEN a visitor begins a roast from the home page, THE GitRoasted_System SHALL route the visitor to the username input flow.
3. IF the home page fails to render its primary content, THEN THE GitRoasted_System SHALL display a fallback error state to the visitor.
