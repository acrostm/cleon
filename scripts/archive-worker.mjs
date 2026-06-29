const baseUrl = (
  process.env.ARCHIVE_WORKER_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");

const secret = process.env.ARCHIVE_CRON_SECRET;

if (!secret) {
  console.error("ARCHIVE_CRON_SECRET is required to run the archive worker.");
  process.exit(1);
}

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : 3;

const response = await fetch(`${baseUrl}/api/archive/worker/run`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify({ limit }),
});

const payload = await response.json().catch(() => null);

if (!response.ok || !payload?.success) {
  console.error("Archive worker failed:", payload || response.statusText);
  process.exit(1);
}

console.log(JSON.stringify(payload.data, null, 2));
