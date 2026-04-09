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
  return match ? match[1] : null;
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

    // 2. SSRF Protection: Block localhost and private/reserved IP ranges
    const hostname = url.hostname;

    // Strip trailing dots (e.g. "localhost." normalises to "localhost")
    // Strip IPv6 brackets added by the URL API (e.g. "[::1]" → "::1")
    const normalizedHostname = hostname.replace(/\.+$/, '').replace(/^\[|\]$/g, '').toLowerCase();

    // IPv4 private / reserved ranges
    if (
      normalizedHostname === 'localhost' ||
      normalizedHostname === '0.0.0.0' ||
      normalizedHostname.startsWith('127.') ||
      normalizedHostname.startsWith('10.') ||
      normalizedHostname.startsWith('192.168.') ||
      normalizedHostname.startsWith('169.254.') || // link-local
      normalizedHostname.endsWith('.local')
    ) {
      return false;
    }

    // 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
    if (normalizedHostname.startsWith('172.')) {
      const secondOctet = parseInt(normalizedHostname.split('.')[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return false;
      }
    }

    // IPv6 loopback (::1), link-local (fe80::/10), and ULA (fc00::/7 covers fc and fd prefixes)
    if (
      normalizedHostname === '::1' ||
      normalizedHostname.startsWith('fe80:') ||
      normalizedHostname.startsWith('fc') ||
      normalizedHostname.startsWith('fd')
    ) {
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

