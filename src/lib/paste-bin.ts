import crypto from 'crypto';
import {
  assertWindowRateLimit,
  hashedRateLimitKey,
  RedisStoreConfigurationError,
  runRedisCommand,
} from '@/lib/redis';

export type PasteItem = {
  id: string;
  content: string;
  createdAt: string;
  source: string;
};

export const PASTE_LIMIT = 20;
export const PASTE_TTL_SECONDS = 60 * 60 * 6;
export const PASTE_MAX_CHARS = 12000;

const PASTE_KEY = 'cleon:pastes:shared';

export { RedisStoreConfigurationError as PasteStoreConfigurationError };

export async function getRecentPastes(limit = PASTE_LIMIT) {
  const reply = await runRedisCommand(['LRANGE', PASTE_KEY, 0, Math.max(0, limit - 1)]);

  if (!Array.isArray(reply)) {
    return [];
  }

  return reply
    .filter((item): item is string => typeof item === 'string')
    .map((item) => {
      try {
        return JSON.parse(item) as PasteItem;
      } catch {
        return null;
      }
    })
    .filter((item): item is PasteItem => Boolean(item));
}

export async function savePaste(content: string, source: string) {
  const item: PasteItem = {
    id: crypto.randomUUID(),
    content,
    createdAt: new Date().toISOString(),
    source,
  };

  await runRedisCommand(['LPUSH', PASTE_KEY, JSON.stringify(item)]);
  await runRedisCommand(['LTRIM', PASTE_KEY, 0, PASTE_LIMIT - 1]);
  await runRedisCommand(['EXPIRE', PASTE_KEY, PASTE_TTL_SECONDS]);

  return item;
}

export async function clearPastes() {
  await runRedisCommand(['DEL', PASTE_KEY]);
}

export async function assertPasteRateLimit(ipAddress: string) {
  await assertWindowRateLimit(
    hashedRateLimitKey('paste-bin', [ipAddress || 'unknown']),
    30,
    60,
    'Too many paste attempts. Try again in a minute.',
  );
}
