const QR_CODE_KEYS = [
  'ShebeiEWM',
  'QrCode',
  'QRCode',
  'qrcode',
  'FileByteBase64',
  'Base64'
]

function parseJsonObject(value) {
  const text = String(value || '').trim()
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (error) {
    return null
  }
}

export function extractQrCodeValue(payload, depth = 0) {
  if (payload === null || payload === undefined || depth > 4) return ''
  if (typeof payload === 'string' || typeof payload === 'number') {
    const text = String(payload).trim()
    const parsed = parseJsonObject(text)
    return parsed ? extractQrCodeValue(parsed, depth + 1) : text
  }
  if (typeof payload !== 'object') return ''

  for (const key of QR_CODE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue
    const value = extractQrCodeValue(payload[key], depth + 1)
    if (value) return value
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'Data')) {
    return extractQrCodeValue(payload.Data, depth + 1)
  }
  return ''
}

export function normalizeQrCodeStorageValue(payload) {
  const value = extractQrCodeValue(payload)
  const dataUrl = value.match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/is)
  return (dataUrl ? dataUrl[1] : value).replace(/\s+/g, '')
}

export function resolveQrCodeImageSource(payload, resolveAssetUrl = (value) => value) {
  const value = extractQrCodeValue(payload)
  if (!value) return ''
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(value)) return value.replace(/\s+/g, '')
  if (/^(https?:|blob:|wxfile:|file:|\/)/i.test(value)) return resolveAssetUrl(value)

  const compact = value.replace(/\s+/g, '')
  if (compact.length >= 32 && /^[a-z0-9+/]+={0,2}$/i.test(compact)) {
    return `data:image/png;base64,${compact}`
  }
  return resolveAssetUrl(value)
}

export function parseQrCodeImage(payload, resolveAssetUrl = (value) => value) {
  const value = extractQrCodeValue(payload)
  if (!value) return { kind: 'empty', source: '', base64: '', mimeType: '' }

  const dataUrl = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is)
  if (dataUrl) {
    return {
      kind: 'base64',
      source: '',
      base64: dataUrl[2].replace(/\s+/g, ''),
      mimeType: dataUrl[1].toLowerCase()
    }
  }

  if (/^(https?:|blob:|wxfile:|file:|\/)/i.test(value)) {
    return { kind: 'url', source: resolveAssetUrl(value), base64: '', mimeType: '' }
  }

  const compact = value.replace(/\s+/g, '')
  if (compact.length >= 32 && /^[a-z0-9+/]+={0,2}$/i.test(compact)) {
    return { kind: 'base64', source: '', base64: compact, mimeType: 'image/png' }
  }
  return { kind: 'url', source: resolveAssetUrl(value), base64: '', mimeType: '' }
}

export async function materializeQrCodeImageSource(payload, options = {}) {
  const parsed = parseQrCodeImage(payload, options.resolveAssetUrl)
  if (parsed.kind !== 'base64') return parsed.source
  if (typeof options.writeBase64File === 'function') {
    return options.writeBase64File(parsed.base64, parsed.mimeType)
  }
  return `data:${parsed.mimeType};base64,${parsed.base64}`
}

export default {
  extractQrCodeValue,
  materializeQrCodeImageSource,
  normalizeQrCodeStorageValue,
  parseQrCodeImage,
  resolveQrCodeImageSource
}
