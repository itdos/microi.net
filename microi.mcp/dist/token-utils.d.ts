export declare function normalizeAuthorizationToken(value?: string): string;
export declare function readJwtExpirationSeconds(value?: string): number | undefined;
export declare function readJwtIssuedAtSeconds(value?: string): number | undefined;
/**
 * Select the newest token for one tenant identity. Exact-key order remains the
 * tie-breaker for opaque/legacy values, while a freshly broker-issued JWT can
 * supersede a stale exact alias left behind by an older typed profile.
 */
export declare function selectPreferredAuthorizationToken(currentValue?: string, candidateValue?: string): string;
export declare function selectPreferredAuthorizationTokenFromCandidates(values: Array<string | undefined>): string;
export declare function shouldRefreshAuthorizationToken(value?: string, nowSeconds?: number, refreshLeadSeconds?: number): boolean;
//# sourceMappingURL=token-utils.d.ts.map