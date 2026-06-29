import {
  DEFAULT_AUTHORIZED_SCAN_INTERVAL_SECONDS,
  DEFAULT_PUBLIC_SCAN_INTERVAL_SECONDS,
  MIN_AUTHORIZED_SCAN_INTERVAL_SECONDS,
  MIN_PUBLIC_SCAN_INTERVAL_SECONDS,
  archiveAccountTypes,
  type ArchiveAccountType,
} from "@/lib/archive/types";
import { extractUrl, validateUrl } from "@/lib/utils/url";

const XIAOHONGSHU_HOSTS = ["xiaohongshu.com", "xhslink.com"];

export function isXiaohongshuUrl(urlString: string) {
  try {
    const hostname = new URL(urlString).hostname.toLowerCase();
    return XIAOHONGSHU_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function normalizeArchiveUrl(input: string) {
  const extracted = extractUrl(input) || input.trim();
  if (!validateUrl(extracted)) {
    throw new Error("Invalid or unsafe URL provided");
  }

  if (!isXiaohongshuUrl(extracted)) {
    throw new Error("Only Xiaohongshu public URLs are supported in the archive module");
  }

  const url = new URL(extracted);
  url.hash = "";

  Array.from(url.searchParams.keys()).forEach((key) => {
    if (!["xsec_token", "xsec_source", "source"].includes(key)) {
      url.searchParams.delete(key);
    }
  });

  return url.toString();
}

export function normalizeAccountType(value: unknown): ArchiveAccountType {
  if (typeof value === "string" && archiveAccountTypes.includes(value as ArchiveAccountType)) {
    return value as ArchiveAccountType;
  }

  return "public";
}

export function normalizeScanIntervalSeconds(accountType: ArchiveAccountType, rawValue: unknown) {
  const fallback = accountType === "public"
    ? DEFAULT_PUBLIC_SCAN_INTERVAL_SECONDS
    : DEFAULT_AUTHORIZED_SCAN_INTERVAL_SECONDS;
  const minimum = accountType === "public"
    ? MIN_PUBLIC_SCAN_INTERVAL_SECONDS
    : MIN_AUTHORIZED_SCAN_INTERVAL_SECONDS;
  const parsed = typeof rawValue === "number"
    ? rawValue
    : typeof rawValue === "string"
      ? Number.parseInt(rawValue, 10)
      : fallback;

  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(Math.trunc(parsed), minimum);
}

export function getXiaohongshuNoteId(urlString: string) {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split("/").filter(Boolean);
    const exploreIndex = segments.findIndex((segment) => segment === "explore");
    if (exploreIndex >= 0 && segments[exploreIndex + 1]) return segments[exploreIndex + 1];

    const itemIndex = segments.findIndex((segment) => segment === "item");
    if (itemIndex >= 0 && segments[itemIndex + 1]) return segments[itemIndex + 1];

    const discoveryIndex = segments.findIndex((segment) => segment === "discovery");
    if (discoveryIndex >= 0 && segments[discoveryIndex + 2]) return segments[discoveryIndex + 2];

    return segments.find((segment) => /^[a-z0-9]{12,}$/i.test(segment));
  } catch {
    return undefined;
  }
}

export function buildCanonicalXiaohongshuPostUrl(noteId: string, sourceUrl?: string) {
  const suffix = sourceUrl ? new URL(sourceUrl).search : "";
  return `https://www.xiaohongshu.com/explore/${noteId}${suffix}`;
}
