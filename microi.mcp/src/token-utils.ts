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

export function readJwtIssuedAtSeconds(value?: string): number | undefined {
  try {
    const token = normalizeAuthorizationToken(value);
    const parts = token.split('.');
    if (parts.length < 2) return undefined;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as {
      MicroiTokenIssuedAt?: number | string;
      iat?: number | string;
    };
    const issuedAt = Number(claims.MicroiTokenIssuedAt ?? claims.iat);
    return Number.isFinite(issuedAt) && issuedAt > 0 ? issuedAt : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Select the newest token for one tenant identity. Exact-key order remains the
 * tie-breaker for opaque/legacy values, while a freshly broker-issued JWT can
 * supersede a stale exact alias left behind by an older typed profile.
 */
export function selectPreferredAuthorizationToken(
  currentValue?: string,
  candidateValue?: string,
): string {
  const current = normalizeAuthorizationToken(currentValue);
  const candidate = normalizeAuthorizationToken(candidateValue);
  if (!current) return candidate;
  if (!candidate || candidate === current) return current;

  const currentIssuedAt = readJwtIssuedAtSeconds(current);
  const candidateIssuedAt = readJwtIssuedAtSeconds(candidate);
  if (currentIssuedAt !== undefined && candidateIssuedAt !== undefined) {
    return candidateIssuedAt > currentIssuedAt ? candidate : current;
  }
  if (currentIssuedAt === undefined && candidateIssuedAt !== undefined) return candidate;
  if (candidateIssuedAt === undefined && currentIssuedAt !== undefined) return current;
  return current;
}

export function selectPreferredAuthorizationTokenFromCandidates(
  values: Array<string | undefined>,
): string {
  return values.reduce<string>(
    (selected, candidate) => selectPreferredAuthorizationToken(selected, candidate),
    '',
  );
}

export function shouldRefreshAuthorizationToken(
  value?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  refreshLeadSeconds = 24 * 60 * 60,
): boolean {
  const expiresAt = readJwtExpirationSeconds(value);
  return expiresAt === undefined || expiresAt - nowSeconds <= refreshLeadSeconds;
}
