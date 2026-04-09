# Cleon Project Roadmap & AI Context

> **AI Context Note:** This document serves as the "Project Brain" for any newly bootstrapped AI agent. Read this to immediately understand the project's current state, architecture, and future trajectory without requiring the user to re-explain the repository.

## 🎯 Project Vision
**Cleon** is a personal, cross-platform information aggregation center. It captures scattered social media posts, videos, and articles, then parses and persists them into a unified, clean, chronologically ordered "Timeline" (Card Feed). Designed for rapid private deployment.

## 🏗 Architecture
- **Framework**: Next.js (App Router) optimized purely for Vercel Serverless.
- **Database**: Vercel Prisma Postgres.
- **ORM Tools**: Prisma 7.x strictly using `@prisma/adapter-pg` + `pg` module (No `accelerateUrl` limits).
- **Styling**: Tailwind CSS v4, fully utilizing Glassmorphism and dark mode (`dark:bg-slate-900`/`950`).
- **UI Components**: Shadcn UI (Radix/base-ui) & `framer-motion` for fluid micro-interactions and scroll sequences.
- **CI/CD**: Strict GitHub Flow. `main` is protected. All modifications must branch explicitly, merge via PR to trigger Vercel preview environments, and delete post-merge.

---

## 🚀 Development Phases & Progress

### ✅ Phase 1: MVP & Vercel Infrastructure (Completed)
- [x] Bootstrapped Next.js & Tailwind setup, replacing legacy Docker/Spring Boot architecture with lightweight Serverless structure.
- [x] Defined Prisma Postgres URL schema setup (`.env.local` mappings pulled via `vercel env`).
- [x] **Parser Strategies Implemented (Zero-Auth / Anti-Crawl Dodging)**:
  - `BilibiliParser`: Extracts native API BV details and thumbnails natively.
  - `TwitterParser`: Exploits `api.vxtwitter.com` community relays to scrape tweets cleanly.
  - `WebParser`: Native fetch with `cheerio` extracting OG metadata and title tags.
- [x] **Frontend Feed Construction**: Implemented glowing inputs, toast notifications (with proper console error passthrough), and a framer-motion skeleton loading timeline.
- [x] Configured Git branch protection, PR requirements, and AI agent rule injection (`AGENTS.md`).

### ⏳ Phase 2: AI Summarization & Deep Content
- [ ] **AI Integration (Vercel AI SDK)**: Feed the raw `contentText` from generic websites or video transcripts into an LLM at the time of URL submission to generate a concise summary bullet list inside the card.
- [ ] **High-Defense Parsers**: Explore strategies or third-party paid APIs for Xiaohongshu (RED), WeChat Official Accounts, and Douyin.
- [ ] **Data Polishing**: Fetch full-sized images automatically rather than compressed thumbnails. Fallbacks for dead image domains.

### 📅 Phase 3: Personal Multi-Device Sync & PWA
- [ ] **Authentication Shield**: Attach NextAuth / Clerk, wrapping the API in protected routes to ensure no random internet user can pollute the personal timeline.
- [ ] **Offline & PWA Support**: Configure Next.js Manifest/Service Workers to install Cleon as a native app on iOS/Android home screens.
- [ ] **Tagging & Search**: In-memory or Postgres Full-Text Search enabling `#tags` categorization.

---

## 🛠 Handover Checklist for Next AI Instance
1. Review `AGENTS.md` for standard operating procedures regarding code pushing, styling, and Prisma 7 limitations.
2. Read `src/lib/parsers/index.ts` before adding new parsers. The Factory Pattern requires new classes to extend `ContentParser`.
3. Never start coding without making a local branch `feat/<descriptive-name>`.
4. Ensure `pnpm run build` cleanly exits without Turbopack type-errors before issuing push commands.
