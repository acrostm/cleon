export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
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
