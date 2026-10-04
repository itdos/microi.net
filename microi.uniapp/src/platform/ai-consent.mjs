import { runtimeEndpointScope } from './runtime-endpoint.mjs'

export const AI_CONSENT_VERSION = '1.0'
const PREFIX = 'mci_ai_consent_v1'

function hashText(value) {
  let hash = 2166136261
  const source = String(value || '')
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function aiConsentStorageKey(apiBase, osClient, userId) {
  const scope = runtimeEndpointScope(apiBase, osClient)
  return `${PREFIX}:${hashText(`${scope}|${String(userId || '').trim()}`)}`
}

export function readAiConsent(apiBase, osClient, userId) {
  if (!userId) return null
  try {
    const value = uni.getStorageSync(aiConsentStorageKey(apiBase, osClient, userId))
    if (!value || typeof value !== 'object' || value.version !== AI_CONSENT_VERSION || !value.acceptedAt) return null
    return { version: value.version, acceptedAt: Number(value.acceptedAt) }
  } catch (error) {
    return null
  }
}

export function grantAiConsent(apiBase, osClient, userId) {
  if (!userId) return false
  try {
    uni.setStorageSync(aiConsentStorageKey(apiBase, osClient, userId), {
      version: AI_CONSENT_VERSION,
      acceptedAt: Date.now()
    })
    return true
  } catch (error) {
    return false
  }
}

export function revokeAiConsent(apiBase, osClient, userId) {
  if (!userId) return
  try { uni.removeStorageSync(aiConsentStorageKey(apiBase, osClient, userId)) } catch (error) {}
}

export default { AI_CONSENT_VERSION, aiConsentStorageKey, readAiConsent, grantAiConsent, revokeAiConsent }
