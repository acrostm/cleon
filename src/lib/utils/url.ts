import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const DEFAULT_FETCH_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_DATA_IMAGE_BYTES = 12 * 1024 * 1024;

type FetchValidatedUrlOptions = {
  maxRedirects?: number;
  timeoutMs?: number;
  maxBytes?: number;
};

/**
 * Extracts the first absolute HTTP/HTTPS URL from a given text string.
 * This handles dirty share links pasted from social media platforms.
 * 
 * @param text - The raw input string potentially containing a URL
 * @returns The extracted URL string, or null if no URL is found
 */
export function extractUrl(text: string): string | null {
  if (!text) return null;
  // Match http:// or https:// followed by any non-whitespace characters
  const urlRegex = /(https?:\/\/[^\s]+)/;
  const match = text.match(urlRegex);
  return match ? normalizeUrl(match[1]) : null;
}

/**
 * Normalizes specific platform URLs to their canonical equivalents.
 * For example, translates Jinshi download/forward links to flash detail links.
 */
export function normalizeUrl(urlString: string): string {
  if (!urlString) return urlString;
  let normalized = urlString;
  
  // Jinshi Data: dl.jin10.com/f/ID -> flash.jin10.com/detail/ID
  const jinshiMatch = normalized.match(/^https?:\/\/dl\.jin10\.com\/f\/(\d+)/);
  if (jinshiMatch) {
    normalized = `https://flash.jin10.com/detail/${jinshiMatch[1]}`;
  }
  
  return normalized;
}

function normalizeHostname(hostname: string) {
  return hostname.replace(/\.+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
}

function ipv4FromMappedIpv6(hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (!normalized.startsWith('::ffff:')) return null;

  const mapped = normalized.slice('::ffff:'.length);
  if (isIP(mapped) === 4) return mapped;

  const groups = mapped.split(':');
  if (groups.length !== 2) return null;

  const high = Number.parseInt(groups[0], 16);
  const low = Number.parseInt(groups[1], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low) || high < 0 || low < 0 || high > 0xffff || low > 0xffff) {
    return null;
  }

  return [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff,
  ].join('.');
}

function isUnsafeIpv4(hostname: string) {
  const mappedIpv4 = ipv4FromMappedIpv6(hostname);
  const candidate = mappedIpv4 || normalizeHostname(hostname);
  if (isIP(candidate) !== 4) return false;

  const octets = candidate.split('.').map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isUnsafeIpv6(hostname: string) {
  const normalizedHostname = normalizeHostname(hostname);
  if (ipv4FromMappedIpv6(normalizedHostname)) {
    return isUnsafeIpv4(normalizedHostname);
  }

  if (isIP(normalizedHostname) !== 6) return false;

  return (
    normalizedHostname === '::' ||
    normalizedHostname === '::1' ||
    normalizedHostname.startsWith('fe80:') ||
    normalizedHostname.startsWith('fc') ||
    normalizedHostname.startsWith('fd') ||
    normalizedHostname.startsWith('ff') ||
    normalizedHostname.startsWith('2001:db8:')
  );
}

function isUnsafeHostname(hostname: string) {
  const normalizedHostname = normalizeHostname(hostname);

  if (
    normalizedHostname === 'localhost' ||
    normalizedHostname === 'metadata' ||
    normalizedHostname === 'metadata.google.internal' ||
    normalizedHostname.endsWith('.localhost') ||
    normalizedHostname.endsWith('.local') ||
    normalizedHostname.endsWith('.internal')
  ) {
    return true;
  }

  if (!normalizedHostname.includes('.') && isIP(normalizedHostname) === 0) {
    return true;
  }

  return isUnsafeIpv4(normalizedHostname) || isUnsafeIpv6(normalizedHostname);
}

/**
 * Validates a given URL string for safety and correctness.
 * - Must be a valid URL format.
 * - Must use HTTP or HTTPS protocol.
 * - Must not be a local or private IP address (SSRF protection).
 * 
 * @param urlString - The URL string to validate
 * @returns boolean indicating if the URL is safe and valid
 */
export function validateUrl(urlString: string): boolean {
  if (!urlString) return false;

  try {
    const url = new URL(urlString);

    // 1. Strict protocol check
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    // 2. SSRF Protection: Block localhost, metadata, and private/reserved IP ranges.
    if (isUnsafeHostname(url.hostname)) {
      return false;
    }
    
    // 3. Prevent extremely long URLs (DDoS/Buffer overflow protection)
    if (urlString.length > 2048) {
      return false;
    }

    return true;
  } catch {
    // If new URL() throws, it's not a valid URL structure
    return false;
  }
}

export async function assertUrlResolvesPublic(urlString: string) {
  if (!validateUrl(urlString)) {
    throw new Error('Invalid or unsafe URL provided');
  }

  const { hostname } = new URL(urlString);
  const normalizedHostname = normalizeHostname(hostname);

  if (isIP(normalizedHostname) !== 0 || ipv4FromMappedIpv6(normalizedHostname)) {
    return;
  }

  const addresses = await lookup(normalizedHostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error('Unable to resolve URL host');
  }

  if (addresses.some(({ address }) => isUnsafeHostname(address))) {
    throw new Error('URL host resolves to a private or reserved address');
  }
}

export async function isSafeRemoteUrl(urlString: string) {
  try {
    await assertUrlResolvesPublic(urlString);
    return true;
  } catch {
    return false;
  }
}

function base64ByteLength(base64Value: string) {
  const normalized = base64Value.replace(/\s/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

export function isSafeDataImageUrl(urlString: string, maxBytes = DEFAULT_MAX_DATA_IMAGE_BYTES) {
  const match = urlString.match(/^data:image\/(png|jpe?g|gif|webp);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return false;
  return base64ByteLength(match[2]) <= maxBytes;
}

export function isSafeRetainedMediaUrl(urlString: string) {
  return isSafeDataImageUrl(urlString) || validateUrl(urlString);
}

export function redactUrlForLog(urlString: string | null | undefined) {
  if (!urlString) return '';

  try {
    const url = new URL(urlString);
    url.username = '';
    url.password = '';
    url.hash = '';
    if (url.search) url.search = '?[redacted]';
    return url.toString().slice(0, 240);
  } catch {
    return '[invalid-url]';
  }
}

function resolveRedirectLocation(location: string, currentUrl: string) {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return null;
  }
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

export async function fetchValidatedUrl(
  urlString: string,
  init: RequestInit = {},
  options: FetchValidatedUrlOptions | number = {},
): Promise<Response> {
  let currentUrl = urlString;
  const normalizedOptions = typeof options === 'number' ? { maxRedirects: options } : options;
  const maxRedirects = normalizedOptions.maxRedirects ?? 3;
  const timeoutMs = normalizedOptions.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertUrlResolvesPublic(currentUrl);

    const response = await fetch(currentUrl, {
      ...init,
      redirect: 'manual',
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });

    const contentLength = Number.parseInt(response.headers.get('content-length') || '', 10);
    if (normalizedOptions.maxBytes && Number.isFinite(contentLength) && contentLength > normalizedOptions.maxBytes) {
      throw new Error('Response body is too large');
    }

    const location = response.headers.get('location');
    if (!isRedirectStatus(response.status) || !location) {
      return response;
    }

    const nextUrl = resolveRedirectLocation(location, currentUrl);
    if (!nextUrl || !validateUrl(nextUrl)) {
      throw new Error('Redirect target is invalid or unsafe');
    }

    currentUrl = nextUrl;
  }

  throw new Error('Too many redirects');
}
