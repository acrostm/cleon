import { type BarkConfigItem, getEnabledBarkConfigs } from "@/lib/bark-config";

export interface BarkNotificationOptions {
  title: string;
  body: string;
  sound?: string;
  group?: string;
  category?: string;
  icon?: string;
  url?: string;
  level?: "active" | "timeSensitive" | "passive" | "critical";
  badge?: number;
  copy?: string;
  autoCopy?: string;
  isArchive?: string;
}

type BarkPayload = Required<Pick<BarkNotificationOptions, "title" | "body">> &
  Partial<Omit<BarkNotificationOptions, "title" | "body">>;

const BARK_REQUEST_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; CleonBarkNotifier/1.0; +https://cleon.jiachz.com)",
};

const isCloudflareChallenge = (status: number, responseText: string) =>
  status === 403 &&
  (responseText.includes("Just a moment") ||
    responseText.includes("challenges.cloudflare.com") ||
    responseText.includes("__cf_chl_"));

const formatBarkErrorResponse = (status: number, responseText: string) => {
  if (isCloudflareChallenge(status, responseText)) {
    return "Cloudflare Managed Challenge blocked the Bark request.";
  }

  return responseText.slice(0, 500);
};

const createBarkGetUrl = (baseUrl: string, payload: BarkPayload): string => {
  const baseWithSlash = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(
    `${encodeURIComponent(payload.title)}/${encodeURIComponent(payload.body)}`,
    baseWithSlash,
  );

  const searchParams: Record<string, string | undefined> = {
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
};

class BarkNotification {
  private async sendToConfig(
    config: BarkConfigItem,
    options: BarkNotificationOptions,
  ): Promise<boolean> {
    try {
      const payload = {
        title: options.title,
        body: options.body,
        sound: options.sound ?? config.defaultSound,
        group: options.group ?? config.defaultGroup,
        category: options.category ?? config.defaultCategory,
        icon: options.icon ?? config.defaultIcon,
        ...(options.url && { url: options.url }),
        ...(options.level && { level: options.level }),
        ...(options.badge && { badge: options.badge }),
        ...(options.copy && { copy: options.copy }),
        ...(options.autoCopy && { autoCopy: options.autoCopy }),
        ...(options.isArchive && { isArchive: options.isArchive }),
      };

      const response = await fetch(config.url, {
        method: "POST",
        headers: BARK_REQUEST_HEADERS,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        console.error(
          `Failed to send notification to ${config.name}: ${response.status} ${response.statusText}`,
          formatBarkErrorResponse(response.status, responseText),
        );

        if (isCloudflareChallenge(response.status, responseText)) {
          const fallbackResponse = await fetch(
            createBarkGetUrl(config.url, payload),
            {
              method: "GET",
              headers: BARK_REQUEST_HEADERS,
            },
          );

          if (!fallbackResponse.ok) {
            const fallbackResponseText = await fallbackResponse
              .text()
              .catch(() => "");
            console.error(
              `Failed to send fallback notification to ${config.name}: ${fallbackResponse.status} ${fallbackResponse.statusText}`,
              formatBarkErrorResponse(
                fallbackResponse.status,
                fallbackResponseText,
              ),
            );
          }

          return fallbackResponse.ok;
        }
      }

      return response.ok;
    } catch (error) {
      console.error(`Failed to send notification to ${config.name}:`, error);
      return false;
    }
  }

  async sendNotification(options: BarkNotificationOptions): Promise<boolean> {
    try {
      const configs = await getEnabledBarkConfigs();

      if (configs.length === 0) {
        console.warn("No enabled bark configs found");
        return false;
      }

      const results = await Promise.all(
        configs.map((config) => this.sendToConfig(config, options)),
      );

      return results.some(Boolean);
    } catch (error) {
      console.error("Failed to send Bark notification:", error);
      return false;
    }
  }

  async sendQuickNotification(title: string, body: string): Promise<boolean> {
    return this.sendNotification({
      title,
      body,
      group: "Cleon",
      category: "系统",
      sound: "default",
    });
  }
}

export const barkNotification = new BarkNotification();

export const notifyNewPostCreated = (
  platform: string,
  title: string | null,
  source: "WEB" | "FEISHU",
  postUrl: string,
) =>
  barkNotification.sendNotification({
    title: "Cleon 新内容已采集",
    body: `来源: ${source}\n平台: ${platform}\n标题: ${title || "无标题"}`,
    group: "Cleon",
    category: "采集",
    sound: "shake.caf",
    url: postUrl,
  });

export { BarkNotification };
