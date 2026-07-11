const BEARER_PREFIX = /^Bearer\s+/i;

export function normalizeAuthorizationToken(value?: string): string {
  return String(value || '').replace(BEARER_PREFIX, '').trim();
}

export function readJwtExpirationSeconds(value?: string): number | undefined {
  try {
    const token = normalizeAuthorizationToken(value);
    const parts = token.split('.');
    if (parts.length < 2) return undefined;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as { exp?: number };
    const expiresAt = Number(claims.exp);
    return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : undefined;
  } catch {
    return undefined;
  }
}

export function shouldRefreshAuthorizationToken(
  value?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  refreshLeadSeconds = 24 * 60 * 60,
): boolean {
  const expiresAt = readJwtExpirationSeconds(value);
  return expiresAt === undefined || expiresAt - nowSeconds <= refreshLeadSeconds;
}
