// Only explicit entitlement values enable unlimited display; balances are never a sentinel.
export function isUnlimitedQuota(value) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

export function normalizeRelayQuota(data = {}) {
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0
  return {
    GiftTokens: number(data.GiftTokens),
    UsedTokens: number(data.UsedTokens),
    RemainingTokens: number(data.RemainingTokens),
    IsUnlimited: isUnlimitedQuota(data.IsUnlimited)
  }
}
