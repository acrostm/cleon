export function getClientIp(req: Request) {
  const normalizeIp = (value: string | null | undefined) => {
    const normalized = value?.split(',').map((part) => part.trim()).filter(Boolean).pop();
    return normalized || null;
  };

  return (
    normalizeIp(req.headers.get('x-real-ip')) ||
    normalizeIp(req.headers.get('x-vercel-forwarded-for')) ||
    normalizeIp(req.headers.get('x-forwarded-for')) ||
    'local'
  );
}

export function getCoarseIp(ipAddress: string) {
  const ip = ipAddress.trim();

  if (!ip || ip === 'local') return 'local';

  if (ip.includes(':')) {
    return `${ip.split(':').slice(0, 4).join(':')}::/64`;
  }

  const octets = ip.split('.');
  if (octets.length === 4) {
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }

  return 'unknown';
}

export function getUserAgentSummary(req: Request, maxLength = 180) {
  const userAgent = req.headers.get('user-agent')?.replace(/\s+/g, ' ').trim();
  if (!userAgent) return 'unknown';
  return userAgent.length > maxLength ? `${userAgent.slice(0, maxLength)}...` : userAgent;
}

export function getRequestPath(req: Request) {
  try {
    const url = new URL(req.url);
    return `${url.pathname}${url.search}`;
  } catch {
    return '/';
  }
}
