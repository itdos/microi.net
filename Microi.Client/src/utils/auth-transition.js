export function normalizeAuthorizationToken(token) {
    return String(token || "").replace(/^Bearer\s+/i, "").trim();
}

export function hasAuthorizationIdentityChanged(requestToken, currentToken) {
    const requested = normalizeAuthorizationToken(requestToken);
    const current = normalizeAuthorizationToken(currentToken);
    return requested !== current && Boolean(requested || current);
}
