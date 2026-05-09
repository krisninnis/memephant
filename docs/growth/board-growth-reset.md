# Memephant Growth Reset

Date: 2026-05-09

Memephant is functional enough to acquire users, but the current launch motion is too dependent on one-off social posts. This plan treats growth as a system: positioning, search intent, conversion, founder-led distribution, community proof, and a feedback loop.

## Boardroom Diagnosis

### CEO / Strategy

The product has a real wedge: people using more than one AI assistant lose project continuity. The current public story has been slightly too broad ("remember everything") and not specific enough about the high-pain moment: switching AI tools or starting a fresh thread on a long-running project.

### SEO

The homepage had useful metadata, but the strongest phrase was not consistently used across title, description, OpenGraph, and page copy. The download page also needed stronger search context. A stale alternate landing page still referenced the old domain/brand and unverified social proof, which could dilute trust if crawled or shared.

### Product Marketing

The primary promise should be:

> Move your project between AI tools without ever rebuilding context.

The strongest ICP is not "everyone using AI"; it is builders with long-running projects who already use multiple AI tools.

### Growth

X and LinkedIn posts are not enough without a repeatable funnel. Each post needs a matching landing page, a demo, a concrete ask, a feedback channel, and a follow-up loop. Distribution should move from broadcast-only to direct community and design-partner outreach.

### Conversion Rate Optimisation

Cold visitors need to understand in five seconds:

1. What it does: portable project memory for AI tools.
2. Who it is for: builders using multiple AI assistants.
3. Why it matters: no repeated context rebuilding.
4. How it works: store, copy, work, paste update, approve.
5. Why to trust it: local-first, no automatic AI connection, explicit review.

### Content

The product needs pain-led content that names concrete workflows:

- "Claude for planning, Codex for code, ChatGPT for quick reasoning."
- "How to hand off a project to a fresh AI thread."
- "How to avoid pasting the same project brief every day."

### Developer Relations

GitHub should be treated as a conversion surface. The README, releases, issues, and discussions should all point people toward the core loop and the demo.

### Analytics

Do not add invasive tracking. For now, use privacy-safe manual metrics:

- GitHub release downloads.
- GitHub stars/watchers.
- Issue/discussion creation.
- Email signups if the endpoint is active.
- Direct replies from outreach.
- Product Hunt / directory referral clicks if available from platform dashboards.

### Community / Distribution

Priority communities are builders with immediate pain, not general AI spectators:

1. Indie Hackers.
2. Hacker News / Show HN when the demo and page are ready.
3. Reddit communities where self-promotion is allowed or feedback is requested carefully.
4. AI coding/dev tool Discords.
5. GitHub discussions and open-source-adjacent channels.
6. Product Hunt after a two-week prep window.

### Engineering

Do not build new growth features until the funnel proves where people drop. The safest repo work now is metadata, landing copy, demo placement, sitemap hygiene, and growth docs.

## ICP

### Primary ICP

Solo developers and indie hackers using two or more AI tools to build a real product over multiple weeks.

Pain:

- They keep restarting context in new chats.
- Different AI tools are better for different tasks.
- Long threads become stale or expensive.
- They need continuity without handing everything to one platform.

Message:

> Keep one project memory and hand it to the AI you want to use next.

### Secondary ICP

Technical founders, freelancers, and students managing long-running AI-assisted work.

Message:

> Stop rebuilding project context every time you change tool, thread, or session.

## Positioning

Primary:

> Move your project between AI tools without ever rebuilding context.

Supporting:

- Local-first project memory for ChatGPT, Claude, Perplexity, Gemini, Codex, Grok, and local LLMs.
- Store project context once. Copy a clean handoff when you need it.
- Review changes before Memephant updates memory.
- Your project data stays local by default.

Avoid:

- "AI remembers everything" because it sounds like hidden automation.
- "Sell your data" because it undermines trust.
- "Never hit a context limit" because it overclaims.
- Fake social proof, fake traction, or unverified testimonials.

## Landing Page Audit

What changed now:

- Homepage title and metadata now match the core positioning.
- OpenGraph/Twitter image now uses the existing large OG image.
- Homepage structured data now includes Organization, WebSite, and SoftwareApplication.
- Hero copy now says exactly what Memephant does.
- Demo section added as a placeholder until the real video is uploaded.
- Audience section added for solo developers, indie hackers, and technical founders.
- Download page metadata improved.
- Sitemap includes the download page.
- Stale alternate landing page now redirects to the current homepage.

Next landing improvements:

- Replace the demo placeholder with the real hosted video or a local `/demo.webm`.
- Add one real screenshot of the copy handoff flow near the demo.
- Add an explicit "Get feedback / become a design partner" CTA.
- Add two real quotes only after users actually give permission.

## SEO Checklist

Done in repo:

- Descriptive homepage title.
- Descriptive homepage meta description.
- Canonical homepage URL.
- OpenGraph and Twitter metadata.
- SoftwareApplication structured data.
- Organization and WebSite structured data.
- Download page metadata and canonical URL.
- Sitemap includes homepage and download page.

Next:

- Add a public changelog/release notes page.
- Add 5-10 search-led guides under `/docs` or a public blog once the landing page is stable.
- Submit sitemap in Google Search Console and Bing Webmaster Tools.
- Add the demo transcript to a public page once video is live.

## Distribution Channels Ranked

1. Direct design-partner outreach to solo devs and indie hackers.
2. Indie Hackers build-in-public posts with specific workflows.
3. GitHub README/releases/discussions.
4. Product Hunt after two weeks of prep.
5. Show HN with a technical "local-first project memory" angle.
6. Reddit feedback posts in communities that allow tools.
7. YouTube Shorts / Loom clips cut from the demo.
8. AI tool directories and devtool directories.
9. LinkedIn founder posts with practical examples.
10. X posts only when tied to a thread, demo, or community prompt.

## Product Hunt Plan

Do not launch immediately.

Prep:

- Finalize demo video.
- Add 8-12 screenshots/GIFs.
- Recruit 20-30 real people to test before launch day.
- Write a maker comment explaining the pain and local-first boundaries.
- Prepare FAQ around privacy, cloud sync, supported platforms, and licensing.
- Line up personal replies and feedback for launch day.

Launch day:

- Founder is present all day.
- Reply to every comment with specifics.
- Push people to try one real project, not just upvote.
- Collect feedback into GitHub discussions/issues.

After:

- Publish "What we learned from launch" within 48 hours.
- Ship one small fix from launch feedback within a week.

## 14-Day Action Plan

Day 1:

- Upload the 60-second demo.
- Replace homepage demo placeholder.
- Pin one direct demo post on X and LinkedIn.

Day 2:

- Update GitHub README with the same positioning and demo.
- Create a "Design partners wanted" GitHub discussion.

Day 3:

- Send 20 direct outreach messages to solo developers and indie hackers.
- Ask for one concrete action: "Try it on a real project and tell me where it breaks."

Day 4:

- Post a practical thread: "How I hand off a project from Claude to Codex without re-explaining it."

Day 5:

- Submit to 3-5 relevant directories with honest early access language.

Day 6:

- Record a second workflow clip: fresh-thread handoff.

Day 7:

- Review replies/downloads/issues. Fix the biggest onboarding blocker.

Day 8:

- Indie Hackers post asking for feedback, not upvotes.

Day 9:

- Reach out to 20 more design partners, focused on AI coding workflows.

Day 10:

- Publish a short guide: "How to stop repeating project context across AI tools."

Day 11:

- Prepare Product Hunt assets and FAQ.

Day 12:

- Test Product Hunt copy with 5 trusted people.

Day 13:

- Ship one visible improvement based on user feedback.

Day 14:

- Decide whether Product Hunt launch is ready or needs another week.

## 30 / 60 / 90-Day Plan

### 30 Days

- 50 meaningful design-partner conversations.
- 5 public workflow guides.
- Demo embedded on homepage and README.
- Directory listings submitted.
- GitHub issues/discussions used as feedback loop.

### 60 Days

- Product Hunt or Show HN launch with tested funnel.
- First onboarding metrics from privacy-safe sources.
- Clear split between Project Memory and Personal Memory Vault positioning.
- At least 3 user-permitted quotes or case studies, if earned.

### 90 Days

- One primary acquisition channel selected based on evidence.
- Strong onboarding loop for "create first project -> copy first handoff -> apply first update."
- Personal Memory Vault messaging tested separately from Project Memory so it does not confuse first-time buyers.
- Pricing/packaging validated with real interviews before activation.

## Content Ideas

- "ChatGPT vs Claude vs Codex: how to keep one project memory across all three."
- "Fresh AI threads are useful. Rebuilding context is not."
- "Local-first AI memory: what should stay on your machine?"
- "How to hand off a coding project to an AI without pasting your whole repo."
- "Why long AI chats decay and how to restart cleanly."
- "The difference between project memory and personal memory."

## Metrics Dashboard Definition

Manual weekly dashboard:

- Homepage visits from hosting dashboard if available.
- Download page visits from hosting dashboard if available.
- GitHub release downloads.
- GitHub stars/watchers/forks.
- Email signups.
- Issues/discussions opened by non-founder users.
- Direct outreach sent.
- Direct replies received.
- Completed design-partner calls.
- First-run activation feedback from users.

Privacy boundary:

- Do not capture project content.
- Do not capture Personal Memory Vault content.
- Do not capture prompt exports.
- Do not add session replay or invasive analytics.

## What Not To Do

- Do not run more broad social posts without a specific audience and CTA.
- Do not claim traction that does not exist.
- Do not invent testimonials.
- Do not overpromise privacy or legal enforceability.
- Do not wire Personal Memory Vault into marketing analytics.
- Do not build a growth dashboard before the founder has manual signal.
- Do not launch on Product Hunt until the demo, README, landing page, and outreach list are ready.
