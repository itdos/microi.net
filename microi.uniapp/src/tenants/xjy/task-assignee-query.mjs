export const ASSIGNEE_KEYWORD_FIELDS = ['Name', 'Account', 'Phone', 'DeptName', 'TenantName']

const SUPPORT_ROLE_IDS = [
  'e757d4f5-e204-4039-9624-960bc3c60cbf',
  '1c4283aa-68c4-4680-a066-f931f593435e'
]

function groupedLikeWhere(fields, keyword) {
  const value = String(keyword || '').trim()
  if (!value) return []
  return fields.map((name, index) => ({
    ...(index === 0 ? { GroupStart: true } : { AndOr: 'OR' }),
    Name: name,
    Type: 'Like',
    Value: value,
    ...(index === fields.length - 1 ? { GroupEnd: true } : {})
  }))
}

function tenantWhere(tenantId) {
  const value = String(tenantId || '').trim()
  return value ? [{ Name: 'TenantId', Type: '=', Value: value }] : []
}

export function buildServiceAssigneeRequest(keyword = '') {
  return {
    Keyword: String(keyword || '').trim(),
    _OrderBy: 'Name',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 100
  }
}

export function buildSupportAssigneeWhere({ keyword = '', tenantId = '' } = {}) {
  return [
    { Name: 'State', Type: '=', Value: 1 },
    { Name: 'IsDeleted', Type: '=', Value: 0 },
    ...tenantWhere(tenantId),
    { GroupStart: true, Name: 'RoleIdsString', Type: 'Like', Value: '客服' },
    { AndOr: 'OR', Name: 'RoleIds', Type: 'Like', Value: SUPPORT_ROLE_IDS[0] },
    { AndOr: 'OR', Name: 'RoleIds', Type: 'Like', Value: SUPPORT_ROLE_IDS[1], GroupEnd: true },
    ...groupedLikeWhere(ASSIGNEE_KEYWORD_FIELDS, keyword)
  ]
}
