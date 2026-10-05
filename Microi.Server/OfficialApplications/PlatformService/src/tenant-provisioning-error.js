const originalErrorMarker = '【原始错误详情】'

export function splitTenantProvisioningError(value) {
  const message = String(value || '').trim()
  const index = message.indexOf(originalErrorMarker)
  return index < 0
    ? { summary: message, details: '' }
    : { summary: message.slice(0, index).trim(), details: message.slice(index + originalErrorMarker.length).trim() }
}
