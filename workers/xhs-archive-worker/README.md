# Cleon XHS Archive Worker

Cloudflare Worker for authorized Xiaohongshu archive scans. It uses Cloudflare Browser Run, KV, R2, and Cron Triggers.

## Setup

Install dependencies in this subproject:

```bash
pnpm --dir workers/xhs-archive-worker install
```

Create a KV namespace and replace the `AUTH_STATE` id in `wrangler.jsonc`:

```bash
pnpm --dir workers/xhs-archive-worker exec wrangler kv namespace create AUTH_STATE
```

Set `ARCHIVE_BUCKET.bucket_name` in `wrangler.jsonc` to the same R2 bucket used by Cleon media storage, or create a dedicated bucket:

```bash
pnpm --dir workers/xhs-archive-worker exec wrangler r2 bucket create cleon-xhs-archive
```

Set secrets:

```bash
pnpm --dir workers/xhs-archive-worker exec wrangler secret put CLEON_BASE_URL
pnpm --dir workers/xhs-archive-worker exec wrangler secret put ARCHIVE_WORKER_SECRET
pnpm --dir workers/xhs-archive-worker exec wrangler secret put AUTH_STATE_SECRET
pnpm --dir workers/xhs-archive-worker exec wrangler secret put R2_PUBLIC_DOMAIN
```

`AUTH_STATE_SECRET` must be at least 32 characters. `ARCHIVE_WORKER_SECRET` must match Cleon's Vercel `ARCHIVE_WORKER_SECRET`.

## Deploy

```bash
pnpm archive:cf:types
pnpm --dir workers/xhs-archive-worker run typecheck
pnpm archive:cf:deploy
```

After deployment, set Cleon's Vercel env:

```bash
ARCHIVE_CLOUDFLARE_WORKER_URL=https://cleon-xhs-archive-worker.<subdomain>.workers.dev
ARCHIVE_WORKER_SECRET=<same secret>
```

The Worker cron runs every minute, but each invocation only claims one due account and respects the free Browser Run soft budget.
