import crypto from 'crypto';
import net from 'net';
import tls from 'tls';

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

class IncompleteRedisReply extends Error {}

interface RedisMap {
  [key: string]: RedisReply;
}

type RedisReply = string | number | boolean | null | RedisReply[] | RedisMap;

class RedisHttpResponseError extends Error {
  constructor(prefix: string) {
    super(`Redis endpoint returned an HTTP response (${prefix}). Retrying with TLS when possible.`);
  }
}

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL is not configured');
  }

  return new URL(redisUrl);
}

function rateKey(ipAddress: string) {
  const minute = Math.floor(Date.now() / 60000);
  return `cleon:pastes:rate:${ipAddress}:${minute}`;
}

function encodeCommand(args: Array<string | number>) {
  return args.reduce((command, arg) => {
    const value = String(arg);
    return `${command}$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }, `*${args.length}\r\n`);
}

function readLine(buffer: Buffer, offset: number) {
  const end = buffer.indexOf('\r\n', offset);
  if (end === -1) throw new IncompleteRedisReply();

  return {
    line: buffer.subarray(offset, end).toString('utf8'),
    offset: end + 2,
  };
}

function parseReply(buffer: Buffer, offset = 0): { value: RedisReply; offset: number } {
  if (offset >= buffer.length) throw new IncompleteRedisReply();

  const prefix = buffer[offset];
  const payloadOffset = offset + 1;

  if (buffer.subarray(offset, offset + 5).toString('utf8') === 'HTTP/') {
    throw new RedisHttpResponseError(buffer.subarray(offset, offset + 12).toString('utf8'));
  }

  if (prefix === 43) {
    const parsed = readLine(buffer, payloadOffset);
    return { value: parsed.line, offset: parsed.offset };
  }

  if (prefix === 45) {
    const parsed = readLine(buffer, payloadOffset);
    throw new Error(`Redis error: ${parsed.line}`);
  }

  if (prefix === 33) {
    const parsed = readLine(buffer, payloadOffset);
    const byteLength = Number(parsed.line);
    const valueEnd = parsed.offset + byteLength;
    if (buffer.length < valueEnd + 2) throw new IncompleteRedisReply();
    const message = buffer.subarray(parsed.offset, valueEnd).toString('utf8');
    throw new Error(`Redis error: ${message}`);
  }

  if (prefix === 58) {
    const parsed = readLine(buffer, payloadOffset);
    return { value: Number(parsed.line), offset: parsed.offset };
  }

  if (prefix === 44 || prefix === 40) {
    const parsed = readLine(buffer, payloadOffset);
    return { value: Number(parsed.line), offset: parsed.offset };
  }

  if (prefix === 35) {
    const parsed = readLine(buffer, payloadOffset);
    return { value: parsed.line === 't', offset: parsed.offset };
  }

  if (prefix === 95) {
    const parsed = readLine(buffer, payloadOffset);
    return { value: null, offset: parsed.offset };
  }

  if (prefix === 36) {
    const parsed = readLine(buffer, payloadOffset);
    const byteLength = Number(parsed.line);

    if (byteLength === -1) {
      return { value: null, offset: parsed.offset };
    }

    const valueEnd = parsed.offset + byteLength;
    if (buffer.length < valueEnd + 2) throw new IncompleteRedisReply();

    return {
      value: buffer.subarray(parsed.offset, valueEnd).toString('utf8'),
      offset: valueEnd + 2,
    };
  }

  if (prefix === 61) {
    const parsed = readLine(buffer, payloadOffset);
    const byteLength = Number(parsed.line);
    const valueEnd = parsed.offset + byteLength;
    if (buffer.length < valueEnd + 2) throw new IncompleteRedisReply();
    const value = buffer.subarray(parsed.offset, valueEnd).toString('utf8');
    return {
      value: value.includes(':') ? value.slice(value.indexOf(':') + 1) : value,
      offset: valueEnd + 2,
    };
  }

  if (prefix === 42 || prefix === 126 || prefix === 62) {
    const parsed = readLine(buffer, payloadOffset);
    const length = Number(parsed.line);

    if (length === -1) {
      return { value: null, offset: parsed.offset };
    }

    const values: RedisReply[] = [];
    let nextOffset = parsed.offset;

    for (let index = 0; index < length; index += 1) {
      const item = parseReply(buffer, nextOffset);
      values.push(item.value);
      nextOffset = item.offset;
    }

    return { value: values, offset: nextOffset };
  }

  if (prefix === 37) {
    const parsed = readLine(buffer, payloadOffset);
    const length = Number(parsed.line);

    if (length === -1) {
      return { value: null, offset: parsed.offset };
    }

    const values: RedisMap = {};
    let nextOffset = parsed.offset;

    for (let index = 0; index < length; index += 1) {
      const key = parseReply(buffer, nextOffset);
      nextOffset = key.offset;
      const value = parseReply(buffer, nextOffset);
      nextOffset = value.offset;
      values[String(key.value)] = value.value;
    }

    return { value: values, offset: nextOffset };
  }

  if (prefix === 124) {
    const parsed = readLine(buffer, payloadOffset);
    let nextOffset = parsed.offset;
    const length = Number(parsed.line);

    for (let index = 0; index < length; index += 1) {
      const key = parseReply(buffer, nextOffset);
      nextOffset = key.offset;
      const value = parseReply(buffer, nextOffset);
      nextOffset = value.offset;
    }

    return parseReply(buffer, nextOffset);
  }

  throw new Error(`Unsupported Redis response prefix: ${String.fromCharCode(prefix)} (${prefix})`);
}

function isHttpRedisUrl(redisUrl: URL) {
  return redisUrl.protocol === 'http:' || redisUrl.protocol === 'https:';
}

function getRestAuthToken(redisUrl: URL) {
  return process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.REDIS_REST_TOKEN
    || decodeURIComponent(redisUrl.password || '');
}

async function runRedisRestCommand(redisUrl: URL, args: Array<string | number>) {
  const token = getRestAuthToken(redisUrl);
  const response = await fetch(redisUrl.origin, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(args),
  });

  const payload = await response.json().catch(() => null) as { result?: RedisReply; error?: string } | null;

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `Redis REST request failed with ${response.status}`);
  }

  return payload?.result ?? null;
}

async function runRedisSocketCommand(redisUrl: URL, args: Array<string | number>, forceTls = false) {
  const port = Number(redisUrl.port || (redisUrl.protocol === 'rediss:' ? 6380 : 6379));
  const host = redisUrl.hostname;
  const password = decodeURIComponent(redisUrl.password || '');
  const username = decodeURIComponent(redisUrl.username || '');
  const database = redisUrl.pathname.replace('/', '');
  const useTls = forceTls || redisUrl.protocol === 'rediss:';
  const socket = useTls
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });

  socket.setTimeout(5000);

  const commands: Array<Array<string | number>> = [];

  if (password) {
    commands.push(username ? ['AUTH', username, password] : ['AUTH', password]);
  }

  if (database) {
    commands.push(['SELECT', database]);
  }

  commands.push(args);

  return new Promise<RedisReply>((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let replyIndex = 0;
    let lastReply: RedisReply = null;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
    };

    socket.on('connect', () => {
      socket.write(commands.map(encodeCommand).join(''));
    });

    socket.on('timeout', () => {
      cleanup();
      reject(new Error('Redis request timed out'));
    });

    socket.on('error', (error) => {
      cleanup();
      reject(error);
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      try {
        while (replyIndex < commands.length) {
          const reply = parseReply(buffer);
          lastReply = reply.value;
          buffer = buffer.subarray(reply.offset);
          replyIndex += 1;
        }

        cleanup();
        resolve(lastReply);
      } catch (error) {
        if (error instanceof IncompleteRedisReply) return;

        cleanup();
        reject(error);
      }
    });
  });
}

async function runRedisCommand(args: Array<string | number>) {
  const redisUrl = getRedisUrl();

  if (isHttpRedisUrl(redisUrl)) {
    return runRedisRestCommand(redisUrl, args);
  }

  try {
    return await runRedisSocketCommand(redisUrl, args);
  } catch (error) {
    if (redisUrl.protocol === 'redis:' && error instanceof RedisHttpResponseError) {
      return runRedisSocketCommand(redisUrl, args, true);
    }

    throw error;
  }
}

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
  const key = rateKey(ipAddress || 'unknown');
  const count = await runRedisCommand(['INCR', key]);

  if (count === 1) {
    await runRedisCommand(['EXPIRE', key, 60]);
  }

  if (typeof count === 'number' && count > 30) {
    throw new Error('Too many paste attempts. Try again in a minute.');
  }
}
