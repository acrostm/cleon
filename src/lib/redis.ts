import crypto from 'crypto';
import net from 'net';
import tls from 'tls';

class IncompleteRedisReply extends Error {}

export class RedisStoreConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisStoreConfigurationError';
  }
}

interface RedisMap {
  [key: string]: RedisReply;
}

type RedisReply = string | number | boolean | null | RedisReply[] | RedisMap;

class RedisHttpResponseError extends Error {
  constructor(prefix: string) {
    super(`Redis endpoint returned an HTTP response (${prefix}). Retrying with TLS when possible.`);
  }
}

type MemoryRateEntry = {
  count: number;
  expiresAt: number;
};

const rateMemory = globalThis as typeof globalThis & {
  cleonRateLimitMemory?: Map<string, MemoryRateEntry>;
};

function getMemoryRateLimitStore() {
  rateMemory.cleonRateLimitMemory ??= new Map<string, MemoryRateEntry>();
  return rateMemory.cleonRateLimitMemory;
}

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL
    || process.env.KV_URL;

  if (!redisUrl) {
    throw new RedisStoreConfigurationError(
      'Redis storage is not configured. Set KV_REST_API_URL/KV_REST_API_TOKEN or a valid REDIS_URL in Vercel.',
    );
  }

  return new URL(redisUrl);
}

function getRedisRestUrl() {
  return process.env.KV_REST_API_URL
    || process.env.KV_REST_API_REDIS_URL
    || process.env.UPSTASH_REDIS_REST_URL
    || process.env.REDIS_REST_URL
    || process.env.REDIS_URL_REST;
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
  return process.env.KV_REST_API_TOKEN
    || process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.REDIS_REST_TOKEN
    || decodeURIComponent(redisUrl.password || '');
}

async function runRedisRestCommand(redisUrl: URL, args: Array<string | number>) {
  const token = getRestAuthToken(redisUrl);

  if (!token) {
    throw new RedisStoreConfigurationError(
      'Redis REST token is missing. Set KV_REST_API_TOKEN, UPSTASH_REDIS_REST_TOKEN, or REDIS_REST_TOKEN in Vercel.',
    );
  }

  const endpointUrl = new URL(redisUrl);
  endpointUrl.username = '';
  endpointUrl.password = '';
  const endpoint = endpointUrl.toString().replace(/\/$/, '');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args),
  });

  const payload = await response.json().catch(() => null) as { result?: RedisReply; error?: string } | null;

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `Redis REST request failed with ${response.status}`);
  }

  return payload?.result ?? null;
}

function toRedisStoreError(error: unknown, redisUrl: URL) {
  const redisError = error instanceof Error ? error : new Error('Redis request failed');
  const errorWithCode = redisError as Error & { code?: string };
  const code = errorWithCode.code;
  const message = redisError.message || '';

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new RedisStoreConfigurationError(
      `Redis host "${redisUrl.hostname}" cannot be resolved. Prefer Vercel KV/Upstash REST env vars (KV_REST_API_URL and KV_REST_API_TOKEN), or replace REDIS_URL with a reachable redis/rediss endpoint.`,
    );
  }

  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
    return new RedisStoreConfigurationError(
      `Redis host "${redisUrl.hostname}" is not reachable from Vercel. Use the provider REST endpoint or verify the REDIS_URL host, port, TLS mode, and network access.`,
    );
  }

  if (code === 'EPROTO' || /handshake|wrong version|packet length|ssl|tls/i.test(message)) {
    return new RedisStoreConfigurationError(
      `Redis endpoint "${redisUrl.hostname}" failed TLS/protocol negotiation. Use a rediss:// URL for TLS sockets or set KV_REST_API_URL/KV_REST_API_TOKEN for REST access.`,
    );
  }

  return redisError;
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
    let settled = false;

    const cleanup = () => {
      clearTimeout(requestTimer);
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const complete = (reply: RedisReply) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(reply);
    };

    const requestTimer = setTimeout(() => {
      fail(new Error('Redis request timed out'));
    }, 5000);

    socket.on('connect', () => {
      socket.write(commands.map(encodeCommand).join(''));
    });

    socket.on('timeout', () => {
      fail(new Error('Redis request timed out'));
    });

    socket.on('error', (error) => {
      fail(error);
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

        complete(lastReply);
      } catch (error) {
        if (error instanceof IncompleteRedisReply) return;

        fail(error instanceof Error ? error : new Error('Redis request failed'));
      }
    });
  });
}

export async function runRedisCommand(args: Array<string | number>) {
  const redisRestUrl = getRedisRestUrl();
  if (redisRestUrl) {
    return runRedisRestCommand(new URL(redisRestUrl), args);
  }

  const redisUrl = getRedisUrl();

  if (isHttpRedisUrl(redisUrl)) {
    return runRedisRestCommand(redisUrl, args);
  }

  try {
    return await runRedisSocketCommand(redisUrl, args);
  } catch (error) {
    if (redisUrl.protocol === 'redis:' && error instanceof RedisHttpResponseError) {
      try {
        return await runRedisSocketCommand(redisUrl, args, true);
      } catch (tlsError) {
        throw toRedisStoreError(tlsError, redisUrl);
      }
    }

    throw toRedisStoreError(error, redisUrl);
  }
}

function assertMemoryWindowRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  message: string,
) {
  const now = Date.now();
  const store = getMemoryRateLimitStore();

  for (const [entryKey, entry] of store) {
    if (entry.expiresAt <= now) store.delete(entryKey);
  }

  const existing = store.get(key);
  const entry = existing && existing.expiresAt > now
    ? existing
    : { count: 0, expiresAt: now + windowSeconds * 1000 };

  entry.count += 1;
  store.set(key, entry);

  if (entry.count > limit) {
    throw new Error(message);
  }
}

export async function assertWindowRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  message: string,
) {
  try {
    const count = await runRedisCommand(['INCR', key]);

    const numericCount = typeof count === 'number'
      ? count
      : typeof count === 'string'
        ? Number.parseInt(count, 10)
        : Number.NaN;

    if (numericCount === 1) {
      await runRedisCommand(['EXPIRE', key, windowSeconds]);
    }

    if (Number.isFinite(numericCount) && numericCount > limit) {
      throw new Error(message);
    }
  } catch (error) {
    if (error instanceof Error && error.message === message) {
      throw error;
    }

    const reason = error instanceof Error ? error.message : 'unknown error';
    console.warn('Redis rate limit unavailable, using in-memory fallback:', reason);
    assertMemoryWindowRateLimit(key, limit, windowSeconds, message);
  }
}

export function hashedRateLimitKey(prefix: string, parts: string[]) {
  const digest = crypto
    .createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 32);

  return `cleon:rate:${prefix}:${digest}`;
}
