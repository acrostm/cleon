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

const SPACE_PATTERN = /^[a-z0-9-]{12,64}$/;

class IncompleteRedisReply extends Error {}

type RedisReply = string | number | null | RedisReply[];

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL is not configured');
  }

  return new URL(redisUrl);
}

export function createPasteSpace() {
  return crypto.randomBytes(12).toString('hex');
}

export function normalizePasteSpace(space: string | null) {
  if (!space) return null;

  const normalized = space.trim().toLowerCase();
  return SPACE_PATTERN.test(normalized) ? normalized : null;
}

function pasteKey(space: string) {
  return `cleon:pastes:${space}`;
}

function rateKey(space: string, ipAddress: string) {
  const minute = Math.floor(Date.now() / 60000);
  return `cleon:pastes:rate:${space}:${ipAddress}:${minute}`;
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

  if (prefix === 43) {
    const parsed = readLine(buffer, payloadOffset);
    return { value: parsed.line, offset: parsed.offset };
  }

  if (prefix === 45) {
    const parsed = readLine(buffer, payloadOffset);
    throw new Error(`Redis error: ${parsed.line}`);
  }

  if (prefix === 58) {
    const parsed = readLine(buffer, payloadOffset);
    return { value: Number(parsed.line), offset: parsed.offset };
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

  if (prefix === 42) {
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

  throw new Error('Unsupported Redis response');
}

async function runRedisCommand(args: Array<string | number>) {
  const redisUrl = getRedisUrl();
  const port = Number(redisUrl.port || (redisUrl.protocol === 'rediss:' ? 6380 : 6379));
  const host = redisUrl.hostname;
  const password = decodeURIComponent(redisUrl.password || '');
  const username = decodeURIComponent(redisUrl.username || '');
  const database = redisUrl.pathname.replace('/', '');
  const socket = redisUrl.protocol === 'rediss:'
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

export async function getRecentPastes(space: string, limit = PASTE_LIMIT) {
  const reply = await runRedisCommand(['LRANGE', pasteKey(space), 0, Math.max(0, limit - 1)]);

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

export async function savePaste(space: string, content: string, source: string) {
  const item: PasteItem = {
    id: crypto.randomUUID(),
    content,
    createdAt: new Date().toISOString(),
    source,
  };

  await runRedisCommand(['LPUSH', pasteKey(space), JSON.stringify(item)]);
  await runRedisCommand(['LTRIM', pasteKey(space), 0, PASTE_LIMIT - 1]);
  await runRedisCommand(['EXPIRE', pasteKey(space), PASTE_TTL_SECONDS]);

  return item;
}

export async function clearPastes(space: string) {
  await runRedisCommand(['DEL', pasteKey(space)]);
}

export async function assertPasteRateLimit(space: string, ipAddress: string) {
  const key = rateKey(space, ipAddress || 'unknown');
  const count = await runRedisCommand(['INCR', key]);

  if (count === 1) {
    await runRedisCommand(['EXPIRE', key, 60]);
  }

  if (typeof count === 'number' && count > 30) {
    throw new Error('Too many paste attempts. Try again in a minute.');
  }
}
