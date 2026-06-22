import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m3u8)(\?.*)?$/i.test(url) || (url.includes('/video/') && !url.includes('bilibili.com'));
}

export function isEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.replace(/\.+$/, '').toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    if (hostname === 'player.bilibili.com') {
      return pathname === '/player.html';
    }

    if (
      hostname === 'www.youtube.com' ||
      hostname === 'youtube.com' ||
      hostname === 'www.youtube-nocookie.com'
    ) {
      return pathname.startsWith('/embed/');
    }

    if (hostname === 'player.vimeo.com') {
      return pathname.startsWith('/video/');
    }

    return false;
  } catch {
    return false;
  }
}
