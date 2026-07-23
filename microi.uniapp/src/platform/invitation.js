import appConfig from '@/config.js'

const INVITE_KEY = `mci:${appConfig.profileId || 'default'}:invite`
const LEGACY_KEYS = appConfig.profileId === 'xjy' ? ['xjy:invite'] : []

export function normalizeInvitation(value = {}) {
  return {
    InviterId: value.InviterId ? decodeURIComponent(String(value.InviterId)) : '',
    InviterName: value.InviterName ? decodeURIComponent(String(value.InviterName)) : '',
    InviterType: value.InviterType ? decodeURIComponent(String(value.InviterType)) : ''
  }
}

function readStoredInvitation() {
  const keys = [INVITE_KEY, ...LEGACY_KEYS]
  for (const key of keys) {
    try {
      const value = normalizeInvitation(uni.getStorageSync(key) || {})
      if (value.InviterId) {
        if (key !== INVITE_KEY) uni.setStorageSync(INVITE_KEY, value)
        return value
      }
    } catch (error) {}
  }
  return normalizeInvitation()
}

export function captureInvitation(options = {}) {
  const invitation = normalizeInvitation(options)
  if (!invitation.InviterId) return readStoredInvitation()
  try { uni.setStorageSync(INVITE_KEY, invitation) } catch (error) {}
  return invitation
}

export function getInvitation() {
  return readStoredInvitation()
}

export function clearInvitation() {
  for (const key of [INVITE_KEY, ...LEGACY_KEYS]) {
    try { uni.removeStorageSync(key) } catch (error) {}
  }
}

export function invitationPayload() {
  const value = getInvitation()
  return value.InviterId ? value : {}
}

export default {
  captureInvitation,
  getInvitation,
  clearInvitation,
  invitationPayload
}
