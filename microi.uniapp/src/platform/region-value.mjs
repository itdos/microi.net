export const REGION_ALL_VALUE = '全部'

export function normalizeRegionSelection(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3)
}

export function formatRegionSelection(value) {
  const [province = '', city = '', district = ''] = normalizeRegionSelection(value)
  if (!province) return ''
  if (city === REGION_ALL_VALUE) return `${province}${REGION_ALL_VALUE}`
  if (!city) return province
  if (district === REGION_ALL_VALUE) return `${province}${city}${REGION_ALL_VALUE}`
  return [province, city, district].filter(Boolean).join('')
}

function regionPrefixCandidates(value, allowShort) {
  const text = String(value || '').trim()
  if (!text || text === REGION_ALL_VALUE) return []
  const candidates = [text]
  if (allowShort) {
    const short = text.replace(/(?:壮族|回族|维吾尔族)?自治区$|特别行政区$|省$|市$/, '')
    if (short && short !== text && short.length >= 2) candidates.push(short)
  }
  return [...new Set(candidates)].sort((left, right) => right.length - left.length)
}

export function stripRegionFromAddress(address = '', region = []) {
  let detail = String(address || '').trim()
  if (!detail) return ''
  const values = Array.isArray(region) ? region : []
  values.forEach((value, index) => {
    const prefix = regionPrefixCandidates(value, index < 2).find((item) => detail.startsWith(item))
    if (prefix) detail = detail.slice(prefix.length).replace(/^[\s,，、-]+/, '')
  })
  return detail.trim()
}
