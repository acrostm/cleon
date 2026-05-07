#!/usr/bin/env node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const args = process.argv.slice(2);
const buildStatus = args[0] || "success";
const currentTime =
  args[1] || new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
const serverIp = args[2] || "Unknown";

const BARK_REQUEST_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; CleonBarkNotifier/1.0; +https://cleon.jiachz.com)",
};

function isCloudflareChallenge(status, responseText) {
  return (
    status === 403 &&
    (responseText.includes("Just a moment") ||
      responseText.includes("challenges.cloudflare.com") ||
      responseText.includes("__cf_chl_"))
  );
}

function formatBarkErrorResponse(status, responseText) {
  if (isCloudflareChallenge(status, responseText)) {
    return "Cloudflare Managed Challenge blocked the Bark request.";
  }

  return responseText.slice(0, 500);
}

function createBarkGetUrl(baseUrl, payload) {
  const baseWithSlash = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(
    `${encodeURIComponent(payload.title)}/${encodeURIComponent(payload.body)}`,
    baseWithSlash,
  );

  const searchParams = {
    sound: payload.sound,
    group: payload.group,
    category: payload.category,
    icon: payload.icon,
    url: payload.url,
    level: payload.level,
    badge: payload.badge?.toString(),
    copy: payload.copy,
    autoCopy: payload.autoCopy,
    isArchive: payload.isArchive,
  };

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function readBarkConfig() {
  const connectionString =
    process.env.PRISMA_DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    console.warn("No database URL found. Skipping notification.");
    return [];
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    return await prisma.barkConfig.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    if (error?.code === "P2021") {
      console.warn("BarkConfig table does not exist. Skipping notification.");
      return [];
    }

    console.error("Failed to read bark config from database:", error);
    return [];
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function sendBarkNotification(config, payload) {
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: BARK_REQUEST_HEADERS,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`✓ Notification sent to ${config.name}`);
      return true;
    }

    const responseText = await response.text().catch(() => "");
    console.error(
      `✗ Failed to send notification to ${config.name}: ${response.status} ${response.statusText}`,
      formatBarkErrorResponse(response.status, responseText),
    );

    if (isCloudflareChallenge(response.status, responseText)) {
      const fallbackResponse = await fetch(createBarkGetUrl(config.url, payload), {
        method: "GET",
        headers: BARK_REQUEST_HEADERS,
      });

      if (fallbackResponse.ok) {
        console.log(`✓ Fallback notification sent to ${config.name}`);
        return true;
      }

      const fallbackResponseText = await fallbackResponse.text().catch(() => "");
      console.error(
        `✗ Failed to send fallback notification to ${config.name}: ${fallbackResponse.status} ${fallbackResponse.statusText}`,
        formatBarkErrorResponse(fallbackResponse.status, fallbackResponseText),
      );
    }

    return false;
  } catch (error) {
    console.error(
      `✗ Error sending notification to ${config.name}:`,
      error.message,
    );
    return false;
  }
}

async function main() {
  console.log("Starting build notification system...");

  const configs = await readBarkConfig();

  if (configs.length === 0) {
    console.warn("No enabled bark configs found. Skipping notification.");
    return;
  }

  console.log(`Found ${configs.length} enabled bark config(s)`);

  const isSuccess = buildStatus === "success";
  const title = isSuccess
    ? "Cleon Build Success"
    : "Cleon Build Failed";
  const body = isSuccess
    ? `Build Status: SUCCESS\n\nBuild Time: ${currentTime}\n\nServer IP: ${serverIp}\n\nCleon has been successfully built.`
    : `Build Status: FAILED\n\nFailure Time: ${currentTime}\n\nServer IP: ${serverIp}\n\nPlease check the Vercel build logs.`;
  const sound = isSuccess ? "shake.caf" : "ladder.caf";

  const results = await Promise.all(
    configs.map((config) =>
      sendBarkNotification(config, {
        body,
        title,
        sound,
        group: config.defaultGroup,
        category: config.defaultCategory,
        icon: config.defaultIcon,
      }),
    ),
  );

  const successCount = results.filter(Boolean).length;
  console.log(
    `Sent ${successCount}/${configs.length} notification(s) successfully`,
  );

  if (successCount === 0 && configs.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
