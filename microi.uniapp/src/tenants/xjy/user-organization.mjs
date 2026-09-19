// 小程序不能执行后台前端 V8；通讯录组织联动用显式租户规则复现，服务端仍负责权限与提交校验。
export function userOrganizationValues(payload = {}) {
  const row = payload.cleared ? null : payload.raw
  const ancestors = payload.option?.treeAncestorRows || []
  const company = row ? [...ancestors, row].reverse().find((item) => [true, 1, '1', 'true'].includes(item.IsCompany)) : null
  return {
    DeptName: row?.Name || '',
    DeptCode: row?.Code || '',
    CompanyId: company?.Id || '',
    CompanyName: company?.Name || '',
    CompanyCode: company?.Code || ''
  }
}
