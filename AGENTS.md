<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:cleon-cicd-rules -->
# CLEON: CI/CD & AI Development Standard Operating Procedure (SOP)

**CRITICAL NOTICE FOR ALL AI AGENTS**: 
Whenever you are bootstrapped into a conversation for the `acrostm/cleon` project, you MUST strictly read, learn, and abide by the following architectural and CI/CD rules. Ignorance of these rules will cause fatal Vercel production outages and Github authentication lockouts.

## 1. Branching & Pull Request Protocol (GitHub Flow)
- **❌ NEVER PUSH DIRECTLY TO `main`**: The `main` branch is protected by API (`required_pull_request_reviews`). Any direct `git push origin main` attempt will be rejected.
- **✅ Always Create Feature Branches**: For any task asked by the user, immediately execute `git checkout -b <type>/<description>` (e.g., `feat/add-ai`, `fix/timeline-bug`).
- **PR Creation**: Complete the code, test it locally, push the branch to remote, and explicitly instruct the Human USER to create a Pull Request on GitHub to kick off the auto Copilot Review.
- **Branch Stacking**: If multiple unmerged branches overlap locally, favor committing to the newest/most comprehensive branch and making a single consolidated PR to avoid scattered review context.

## 2. Local Verification Check (MANDATORY)
- Before ANY `git push`, you **MUST** ensure the local build pipeline passes cleanly.
- **Command**: Run `pnpm run build` using your shell execution tool.
- **Criteria**: The build must successfully complete (`Exit Code 0`). You must resolve ALL Typescript strict type check errors and Next.js static evaluation runtime crashes (specifically Prisma initialization) before pushing.

## 3. Database & Prisma 7.x Limitations
- **Adapter-First Architecture**: We use Vercel/Prisma Postgres with direct postgres bindings. Because the connection pool hands us a standard `postgres://...` URL, **you MUST explicitly initialize PrismaClient with the pg Driver Adapter** (`@prisma/adapter-pg` + `pg` Pool).
- **Prohibited Configs**: Do NOT use `accelerateUrl: ` when passing a `postgres://` URL into the PrismaClient constructor in Prisma 7. It will crash on parsing.
- **Schema Push**: When modifying schema (`prisma/schema.prisma`), you must run `pnpm dlx prisma db push` loaded with the target Database URL `PRISMA_DATABASE_URL` extracted securely from the Vercel env, ensuring the remote tables actually exist.

## 4. Debug & Vercel Logging Standards
- **Silent Failures are Banned**: Frontend `toast.error()` popups must ALWAYS be accompanied by a `console.error` containing the full trace for browser debugging.
- **Backend Trace**: API routes (`/api/*`) MUST log raw error structures to `console.error` explicitly so they are caught and preserved by Vercel Serverless Log Drains. Send `error.stack` back to the frontend in development mode when possible.

## 5. UI/UX Design System
- **Stack**: Tailwind CSS v4, base-ui, Shadcn UI components.
- **Animations**: Components MUST integrate dynamic entrance and loading states utilizing `framer-motion` and skeleton loaders.
- **Aesthetic**: Emphasize Glassmorphism, deep contrast dark modes (`dark:bg-slate-900 / 950`), and vibrant micro-interactions. Never deliver raw unstructured HTML forms.
<!-- END:cleon-cicd-rules -->
