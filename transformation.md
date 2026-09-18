You are working on my existing GitHub developer analysis application.

IMPORTANT:
- First inspect the ENTIRE existing codebase before changing anything.
- Understand the current architecture, components, routes, API logic, scoring system, state management, styling, and data flow.
- Do NOT rebuild the application from scratch.
- Preserve all existing working functionality.
- Reuse existing components, utilities, API functions, types, and design system wherever possible.
- Make incremental, production-quality improvements.
- Do not introduce unnecessary dependencies.
- Keep the application fast, responsive, accessible, and mobile-friendly.
- Do not copy GitRoasted's code, branding, text, or exact UI. Use it only as product/design inspiration.

REFERENCE INSPIRATION:
GitRoasted GitHub:
https://github.com/MdKasif0/GitRoasted

Live site:
https://gitroasted.netlify.app/

Use these references specifically for ideas around:
- Developer leaderboard
- Developer comparison
- Improvement recommendations
- Gamified developer analytics
- Score visualization
- Navigation and information architecture

==================================================
PROJECT GOAL
==================================================

Improve my existing application into a polished GitHub developer analysis platform.

The application should allow developers to:
1. Analyze their GitHub profile
2. Understand their strengths and weaknesses
3. Compare themselves with other developers
4. See leaderboard rankings
5. Get actionable recommendations for improvement
6. Share/discover developer profiles
7. Support the project
8. Contact/follow the creator

Keep the existing core GitHub analysis functionality intact.

==================================================
1. LEADERBOARD
==================================================

Add a dedicated Leaderboard section/page.

Requirements:

- Create a clean developer leaderboard UI.
- Rank developers based on the application's EXISTING score system.
- Do not create a completely different scoring algorithm unless absolutely necessary.
- Reuse the existing score calculation logic.
- Show:
  - Rank
  - Avatar
  - GitHub username
  - Display name
  - Score
  - Relevant primary metric/category if already available
  - Link to GitHub profile
  - Link to the application's developer analysis/profile page where appropriate

Leaderboard UX:
- Top 3 developers should have visually distinct cards/positions.
- Remaining developers should appear in a clean table/list.
- Add pagination or lazy loading if the existing architecture/data source supports it.
- Add username search.
- Add responsive mobile layout.
- Make leaderboard loading/error/empty states polished.
- Avoid fake/mock rankings in production.
- Clearly handle cases where insufficient leaderboard data exists.

If persistent leaderboard storage is required:
- Inspect the current backend/database architecture first.
- Use the existing database if available.
- Do not introduce Firebase/Supabase/etc. just because GitRoasted uses it.
- Respect existing security rules.
- Never expose secrets client-side.

==================================================
2. COMPARE DEVELOPERS
==================================================

Add a "Compare Developers" feature.

Users should be able to enter/select two GitHub usernames and compare them.

Example:

Developer A: octocat
Developer B: torvalds

Display:

- Overall score
- Score difference
- Profile information
- Followers
- Public repositories
- Stars
- Forks
- Contributions/activity metrics if currently available
- Languages
- Account age
- Existing scoring categories
- Strengths
- Areas for improvement

Use the application's existing scoring categories wherever possible.

UI:
- Side-by-side comparison on desktop
- Stacked comparison on mobile
- Clear visual comparison
- Progress bars/cards/charts where useful
- Do not overwhelm the user with excessive charts

Important:
- The comparison should be factual and based on measured GitHub data.
- Avoid implying that one developer is objectively "better" outside the defined metrics.
- Clearly show which metrics produced the score difference.

Allow:
- URL/shareable comparison state if practical
- Swap Developer A / Developer B
- Clear/reset comparison

Handle:
- Invalid username
- Deleted/nonexistent account
- API errors
- Rate limits
- Loading states

==================================================
3. HOW TO IMPROVE / IMPROVEMENT ROADMAP
==================================================

Add a dedicated "How to Improve" section.

This should be one of the most useful parts of the application.

Do NOT provide generic advice like:

"Code more."
"Build projects."
"Get more followers."

Instead generate recommendations from the user's ACTUAL GitHub analysis.

Example:

If repositories are strong but documentation is weak:
→ "Improve README quality across your top repositories."

If activity is low:
→ "Increase consistent contribution activity."

If community metrics are weak:
→ "Contribute to open-source repositories and participate in discussions."

If repository quality is weak:
→ "Add tests, documentation, CI, issue templates, or better project structure."

Structure recommendations into:

1. Quick Wins
   - Changes that can be completed quickly

2. Short-Term
   - Improvements achievable over the next few weeks

3. Long-Term
   - Larger improvements requiring sustained work

For every recommendation show:

- Why this recommendation exists
- Which metric it affects
- Expected impact
- Suggested action
- Practical example

Only recommend improvements that are supported by available GitHub data.

Do not make unrealistic promises such as:
"Doing this will increase your score by exactly 100 points."

==================================================
4. CONTACT US
==================================================

Add a polished "Contact" section/page.

This should contain my social profiles:

GitHub:
https://github.com/ahmmikun

LinkedIn:
https://www.linkedin.com/in/ahmmikun

Twitter/X:
https://twitter.com/ahmmikun

Facebook:
https://facebook.com/AhmmiKun

Instagram:
https://instagram.com/ahmmikun

Use proper social icons if the project already has an icon library.

The section should feel like:

"Connect with the creator"

rather than a generic corporate contact page.

Include:
- Social links
- Short creator/project message
- Optional email/contact method ONLY if one already exists in the project
- Do not invent an email address.

Make every external link:
- Open safely
- Work on mobile
- Have accessible labels
- Use correct target/rel attributes where appropriate

==================================================
5. SUPPORT THE PROJECT
==================================================

Add a "Support" section.

Purpose:
Allow users who enjoy the project to support its development.

Use:

Buy Me a Coffee:
Username: ahmmikun

Link:
https://www.buymeacoffee.com/ahmmikun

Create a tasteful support card such as:

"Enjoying the project?"
"Support its development ☕"

Include a clear:
"Buy Me a Coffee"

CTA.

Important:
- Do not make the support CTA intrusive.
- Do not use aggressive donation language.
- Keep it consistent with the application's design.
- If the application has a footer, include a subtle support link there as well.

==================================================
6. NAVIGATION / INFORMATION ARCHITECTURE
==================================================

Update navigation to expose the new features cleanly.

Suggested navigation:

Analyze
Leaderboard
Compare
How to Improve
About / Contact
Support

Adapt this to the application's existing navigation rather than blindly replacing it.

On mobile:
- Use a clean mobile menu/navigation.
- Do not overcrowd the header.

==================================================
7. FOOTER
==================================================

Improve the footer.

Include:

- Application name
- Short description
- Analyze
- Leaderboard
- Compare
- How to Improve
- Contact
- Support
- GitHub
- LinkedIn
- Social links

Also include an appropriate copyright line.

Do not make the footer unnecessarily large.

==================================================
8. UI/UX IMPROVEMENT
==================================================

Use GitRoasted only as inspiration.

Improve the existing UI with:

- Strong visual hierarchy
- Better spacing
- Consistent cards
- Clear typography
- Good empty states
- Good loading states
- Smooth but subtle animations
- Responsive layouts
- Accessible contrast
- Keyboard navigation
- Clear CTA hierarchy

Keep the existing application's visual identity.

Do NOT blindly introduce:
- Glassmorphism everywhere
- Excessive gradients
- Excessive animations
- Huge text
- Unnecessary 3D effects
- Generic "AI SaaS" aesthetics

The final result should feel like a real developer tool, not an AI-generated template.

==================================================
9. PERFORMANCE
==================================================

Be careful with GitHub API usage.

Requirements:

- Reuse existing API functions.
- Avoid duplicate API requests.
- Parallelize independent requests where appropriate.
- Cache data where the existing architecture supports it.
- Handle GitHub rate limits gracefully.
- Do not expose GitHub tokens/secrets to the client.
- Add proper loading/error states.
- Avoid unnecessary re-renders.
- Do not fetch the same profile repeatedly when navigating between pages.

==================================================
10. SEO
==================================================

Add/update metadata for important pages.

Pages should have meaningful titles/descriptions such as:

GitHub Developer Analyzer
GitHub Developer Leaderboard
Compare GitHub Developers
How to Improve Your GitHub Profile

Also add:
- Open Graph metadata where the framework supports it
- Twitter/X metadata where appropriate
- Proper page headings
- Semantic HTML

Do not keyword-stuff.

==================================================
11. ACCESSIBILITY
==================================================

Make the new features accessible.

Requirements:

- Semantic HTML
- Keyboard navigation
- Accessible buttons
- Accessible links
- Proper labels
- Alt text for meaningful images
- aria-labels where needed
- Focus states
- Color should not be the only way to communicate information

==================================================
12. ERROR HANDLING
==================================================

Every new feature must handle:

- Invalid GitHub username
- GitHub API failure
- Rate limiting
- Missing data
- Empty leaderboard
- Comparison failure
- Network failure
- Loading states

Use user-friendly messages.

Do not expose raw API errors or stack traces to users.

==================================================
13. CODE QUALITY
==================================================

Before implementing:

1. Inspect existing project structure.
2. Identify reusable components.
3. Identify current scoring logic.
4. Identify current GitHub API functions.
5. Identify current routes/pages.
6. Identify existing styling conventions.
7. Identify current state/data management.
8. Identify whether a database already exists.

Then implement the features.

Follow the existing project's conventions.

Use TypeScript types properly if the project uses TypeScript.

Avoid:
- `any` unless absolutely necessary
- duplicated logic
- giant components
- unnecessary abstractions
- unnecessary dependencies
- hardcoded repeated values

Create reusable components where appropriate.

==================================================
14. TESTING
==================================================

After implementation:

- Run linting.
- Run type checking.
- Run tests if available.
- Run production build.
- Fix all errors.
- Check all new routes.
- Check mobile responsiveness.
- Test invalid usernames.
- Test API failures.
- Test leaderboard empty/loading states.
- Test developer comparison.
- Test all social links.
- Test Buy Me a Coffee link.

Do not consider the task complete if the production build fails.

==================================================
15. FINAL REVIEW
==================================================

After implementation, perform a final product review.

Check:

✓ Existing functionality still works
✓ Leaderboard works
✓ Developer comparison works
✓ How to Improve works
✓ Contact section works
✓ Social links work
✓ Support section works
✓ Buy Me a Coffee works
✓ Mobile UI works
✓ Desktop UI works
✓ Loading states work
✓ Error states work
✓ No unnecessary API calls
✓ No secrets exposed
✓ No TypeScript errors
✓ No lint errors
✓ Production build succeeds
✓ SEO metadata exists
✓ Accessibility is reasonable

Finally provide a concise summary containing:

1. What you changed
2. Files/components added or modified
3. Any environment variables required
4. Any database/schema changes required
5. Any remaining limitations
6. Commands used to verify the application

IMPORTANT:
Do not stop after planning.
Actually inspect the codebase and implement the features.