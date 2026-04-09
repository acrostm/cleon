import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m3u8)(\?.*)?$/i.test(url) || (url.includes('/video/') && !url.includes('bilibili.com'));
}

export function isEmbedUrl(url: string) {
  return url.includes('player.bilibili.com') || url.includes('youtube.com/embed/') || url.includes('player.vimeo.com');
}
