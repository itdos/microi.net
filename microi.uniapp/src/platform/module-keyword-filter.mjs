const SENSITIVE_FIELD_PATTERN = /password|passwd|pwd|secret|token|openid|unionid|密码|密钥|令牌/i

export function buildModuleKeywordWhere(searchFields = [], keyword = '') {
  const value = String(keyword || '').trim()
  if (!value) return []
  const names = []
  const normalizedNames = new Set()
  for (const item of Array.isArray(searchFields) ? searchFields : []) {
    const name = String(item || '').trim()
    const normalizedName = name.toLowerCase()
    if (!name || SENSITIVE_FIELD_PATTERN.test(name) || normalizedNames.has(normalizedName)) continue
    normalizedNames.add(normalizedName)
    names.push(name)
  }
  return names.map((name, index) => ({
    AndOr: index === 0 ? 'AND' : 'OR',
    GroupStart: index === 0,
    Name: name,
    Type: 'Like',
    Value: value,
    GroupEnd: index === names.length - 1
  }))
}

export default { buildModuleKeywordWhere }
