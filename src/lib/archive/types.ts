export const archiveAccountTypes = ["own", "authorized", "public"] as const;
export type ArchiveAccountType = (typeof archiveAccountTypes)[number];

export const archivePostStatuses = [
  "discovered",
  "visible",
  "unavailable",
  "deleted_or_hidden",
  "restricted",
  "login_required",
  "captcha_required",
  "parse_failed",
  "archive_failed",
  "unknown",
] as const;
export type ArchivePostStatus = (typeof archivePostStatuses)[number];

export const archiveJobStatuses = ["pending", "running", "success", "failed"] as const;
export type ArchiveJobStatus = (typeof archiveJobStatuses)[number];

export const archiveErrorCodes = [
  "PAGE_TIMEOUT",
  "NETWORK_ERROR",
  "ACCESS_DENIED",
  "LOGIN_REQUIRED",
  "CAPTCHA_REQUIRED",
  "PARSE_ERROR",
  "NO_CONTENT_FOUND",
  "IMAGE_DOWNLOAD_FAILED",
  "IMAGE_TOO_LARGE",
  "UNSUPPORTED_IMAGE_TYPE",
  "STORAGE_UPLOAD_FAILED",
  "DATABASE_ERROR",
  "UNKNOWN_ERROR",
] as const;
export type ArchiveErrorCode = (typeof archiveErrorCodes)[number];

export const MIN_AUTHORIZED_SCAN_INTERVAL_SECONDS = 300;
export const MIN_PUBLIC_SCAN_INTERVAL_SECONDS = 600;
export const DEFAULT_PUBLIC_SCAN_INTERVAL_SECONDS = 600;
export const DEFAULT_AUTHORIZED_SCAN_INTERVAL_SECONDS = 300;
export const MAX_ARCHIVE_IMAGES = 30;

export type ArchiveAccessState =
  | "visible"
  | "unavailable"
  | "deleted_or_hidden"
  | "restricted"
  | "login_required"
  | "captcha_required"
  | "parse_failed"
  | "unknown";

export type ParsedArchivePost = {
  originalUrl: string;
  platformNoteId?: string;
  title?: string;
  contentText: string;
  coverSourceUrl?: string;
  authorName?: string;
  publishTime?: Date;
  imageUrls: string[];
  rawData?: Record<string, unknown>;
  accessState: ArchiveAccessState;
};

export type ParsedArchivePostCard = {
  originalUrl: string;
  platformNoteId?: string;
  title?: string;
  coverSourceUrl?: string;
  authorName?: string;
};

export type ParsedArchiveProfile = {
  profileUrl: string;
  platformUserId?: string;
  nickname?: string;
  avatarUrl?: string;
  notes: ParsedArchivePostCard[];
  rawData?: Record<string, unknown>;
};
