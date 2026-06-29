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
  "auth_expired",
  "auth_setup_failed",
  "parse_failed",
  "archive_failed",
  "unknown",
] as const;
export type ArchivePostStatus = (typeof archivePostStatuses)[number];

export const archiveJobStatuses = ["pending", "running", "success", "failed"] as const;
export type ArchiveJobStatus = (typeof archiveJobStatuses)[number];

export const archiveAuthModes = ["public", "authorized_browser"] as const;
export type ArchiveAuthMode = (typeof archiveAuthModes)[number];

export const archiveAuthStatuses = [
  "none",
  "pending",
  "active",
  "expired",
  "captcha_required",
  "restricted",
  "setup_failed",
  "revoked",
] as const;
export type ArchiveAuthStatus = (typeof archiveAuthStatuses)[number];

export const archiveErrorCodes = [
  "PAGE_TIMEOUT",
  "NETWORK_ERROR",
  "ACCESS_DENIED",
  "LOGIN_REQUIRED",
  "AUTH_EXPIRED",
  "AUTH_SETUP_FAILED",
  "BROWSER_BUDGET_EXCEEDED",
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
  | "auth_expired"
  | "auth_setup_failed"
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

export type CloudflareArchiveAssetResult = {
  assetType: "cover" | "image" | "video" | string;
  sourceUrl: string;
  storageUrl?: string;
  sha256?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  downloadStatus?: "success" | "failed" | string;
  errorMessage?: string;
};

export type CloudflareArchivePostResult = ParsedArchivePost & {
  assets?: CloudflareArchiveAssetResult[];
  coverStorageUrl?: string;
};

export type CloudflareArchiveProfileResult = ParsedArchiveProfile & {
  accessState?: ArchiveAccessState;
};
