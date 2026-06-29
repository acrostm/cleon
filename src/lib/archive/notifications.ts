import { barkNotification } from "@/lib/notification";

type ArchiveNotificationInput = {
  accountName?: string | null;
  title?: string | null;
  body?: string;
  url?: string;
};

export function notifyArchivePostCreated({
  accountName,
  title,
  body,
  url,
}: ArchiveNotificationInput) {
  return barkNotification.sendNotification({
    title: "Cleon 归档新增内容",
    body: `账号: ${accountName || "Manual import"}\n标题: ${title || "无标题"}${body ? `\n${body}` : ""}`,
    group: "Cleon Archive",
    category: "归档",
    sound: "shake.caf",
    url,
  });
}

export function notifyArchiveFailure({
  accountName,
  title,
  body,
  url,
}: ArchiveNotificationInput) {
  return barkNotification.sendNotification({
    title: "Cleon 归档失败",
    body: `目标: ${accountName || title || "Archive job"}${body ? `\n${body}` : ""}`,
    group: "Cleon Archive",
    category: "归档错误",
    sound: "minuet.caf",
    url,
  });
}

export function notifyArchiveStatusChanged({
  accountName,
  title,
  body,
  url,
}: ArchiveNotificationInput) {
  return barkNotification.sendNotification({
    title: "Cleon 归档状态变化",
    body: `账号: ${accountName || "Manual import"}\n内容: ${title || "无标题"}${body ? `\n${body}` : ""}`,
    group: "Cleon Archive",
    category: "状态变化",
    sound: "shake.caf",
    url,
  });
}

export function notifyArchiveAccountPaused({
  accountName,
  body,
  url,
}: ArchiveNotificationInput) {
  return barkNotification.sendNotification({
    title: "Cleon 归档账号已暂停",
    body: `账号: ${accountName || "Unknown account"}${body ? `\n${body}` : ""}`,
    group: "Cleon Archive",
    category: "扫描",
    sound: "minuet.caf",
    url,
  });
}
