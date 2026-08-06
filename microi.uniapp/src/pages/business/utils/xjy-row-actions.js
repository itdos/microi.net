import { callApiEngine } from '@/platform/business-runtime.js'
import { V8, getUser } from '@/utils/request.js'
import { removeCachePrefix } from '@/platform/cache.js'

const MENU_IDS = {
  orders: 'fc56123e-cfa1-4690-a6a4-929f202a817b',
  visits: '86b10adc-3b2a-4ecd-b10f-0f88fb636fad'
}

function roleLimits(user) {
  const value = user && user._RoleLimits
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try { return JSON.parse(value) || [] } catch (error) { return [] }
  }
  return []
}

export function hasMenuPermission(menuId, name, user = getUser() || {}) {
  if (Number(user.Level || 0) >= 999) return true
  return roleLimits(user)
    .filter((item) => String(item.FkId || '') === String(menuId || ''))
    .some((row) => {
      const permission = row.Permission
      if (Array.isArray(permission)) return permission.some((item) => String(item.Name || item).includes(name))
      return String(permission || '').includes(name)
    })
}

function permissionNames(permission) {
  if (Array.isArray(permission)) return permission.map((item) => String(item && item.Name || item || '').trim())
  if (typeof permission === 'string') {
    try {
      const parsed = JSON.parse(permission)
      if (Array.isArray(parsed)) return permissionNames(parsed)
    } catch (error) {}
    return permission.split(',').map((item) => String(item || '').trim()).filter(Boolean)
  }
  return []
}

export function hasExactMenuPermission(menuId, names, user = getUser() || {}) {
  if (Number(user.Level || 0) >= 999) return true
  if (!menuId) return false
  const expected = (Array.isArray(names) ? names : [names]).map((item) => String(item || '').trim())
  return roleLimits(user)
    .filter((item) => String(item.FkId || '') === String(menuId))
    .some((row) => permissionNames(row.Permission).some((name) => expected.includes(name)))
}

export function canAddMenuRecord(menuId, user = getUser() || {}) {
  return hasExactMenuPermission(menuId, ['Add', '新增'], user)
}

export function canEditMenuRecord(menuId, user = getUser() || {}) {
  return hasExactMenuPermission(menuId, ['Edit', '编辑'], user)
}

function sameTenant(row, user) {
  if (Number(user.Level || 0) >= 999) return true
  const rowTenant = row.TenantId || row.ShangjiaID || ''
  if (rowTenant && user.TenantId) return String(rowTenant) === String(user.TenantId)
  const rowTenantName = row.TenantName || row.SuoshuSJ || ''
  return !rowTenantName || !user.TenantName || String(rowTenantName) === String(user.TenantName)
}

export function canApproveOrder(row = {}, user = getUser() || {}) {
  const state = String(row.DingdanZT || '').trim()
  const stateCode = Number(row.DingdanZTZ)
  const pendingApproval = state === '待审批' || stateCode === 1
  return pendingApproval && sameTenant(row, user) && hasMenuPermission(MENU_IDS.orders, '审批', user)
}

export function getBusinessRowActions(key, row = {}, user = getUser() || {}) {
  const actions = []
  if (key === 'orders' && sameTenant(row, user)) {
    const state = String(row.DingdanZT || '')
    if (canApproveOrder(row, user)) {
      actions.push({ key: 'order-approve', label: '审批', tone: 'primary', input: 'optional', inputTitle: '订单审批', inputPlaceholder: '审批意见（选填）' })
      actions.push({ key: 'order-reject', label: '驳回', tone: 'danger', input: 'required', inputTitle: '驳回订单', inputPlaceholder: '请输入驳回原因' })
    }
    if (hasMenuPermission(MENU_IDS.orders, '复制', user)) actions.push({ key: 'order-copy', label: '复制', confirm: '确认复制当前合同订单吗？' })
    if (!/作废|待审批作废/.test(state) && hasMenuPermission(MENU_IDS.orders, '作废申请', user)) {
      actions.push({ key: 'order-void-request', label: '申请作废', tone: 'danger', confirm: '申请作废后，该订单下设备将进入退机流程。确认继续吗？' })
    }
    if (/待审批作废/.test(state) && hasMenuPermission(MENU_IDS.orders, '作废审批', user)) {
      actions.push({ key: 'order-void-approve', label: '作废审批', tone: 'danger', confirm: '确认作废订单吗？该订单下设备状态将变为已退机。' })
    }
  }
  if (key === 'installationPositions') {
    if (row.ShangpinID) actions.push({ key: 'position-product', label: '设备详情' })
    actions.push({ key: 'position-copy', label: '复制', confirm: '确认复制当前安装位置吗？' })
    actions.push({ key: 'position-delete', label: '删除', tone: 'danger', confirm: '确认删除当前安装位置吗？删除后无法恢复。' })
  }
  if (key === 'proposals' && sameTenant(row, user)) {
    actions.push({ key: 'proposal-copy', label: '复制', confirm: '确认复制当前客户方案吗？' })
    actions.push({ key: 'proposal-delete', label: '删除', tone: 'danger', confirm: '确认删除当前客户方案吗？删除后无法恢复。' })
  }
  if (key === 'members' && Number(user.Level || 0) >= 999 && String(row.Id || '') !== String(user.Id || '')) {
    actions.push({ key: 'member-remove', label: '移出', tone: 'danger', confirm: `确认将${row.Name || row.Account || '该成员'}移出当前组织吗？` })
  }
  if (key === 'devices') {
    actions.push({ key: 'device-repair', label: '报修', tone: 'primary' })
    actions.push({ key: 'device-consumables', label: '耗材' })
    if (Number(user.Level || 0) >= 999 || user.TenantId) actions.push({ key: 'device-qrcode', label: '生成二维码', confirm: '确认重新生成该设备二维码吗？' })
  }
  if (key === 'visits') {
    const state = String(row.ShenpiZT || '')
    const stateCode = Number(row.ShenpiZTZ)
    const approvalFinished = /已审批|已驳回/.test(state) || stateCode === 1 || stateCode === 3
    if (!approvalFinished && sameTenant(row, user) && hasMenuPermission(MENU_IDS.visits, '审批', user)) {
      actions.push({ key: 'visit-approve', label: '审批', tone: 'primary', input: 'optional', inputTitle: '跟进审批', inputPlaceholder: '审批意见（选填）' })
      actions.push({ key: 'visit-reject', label: '驳回', tone: 'danger', input: 'required', inputTitle: '驳回跟进', inputPlaceholder: '请输入驳回原因' })
    }
    actions.push({ key: 'visit-message', label: '留言', input: 'required', inputTitle: '添加留言', inputPlaceholder: '请输入留言内容' })
    actions.push({ key: 'visit-care', label: '客户关怀', tone: 'primary' })
  }
  return actions
}

function ensure(result, fallback) {
  if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || fallback)
  return result
}

export async function loadApprovalOpinions() {
  try {
    const result = await V8.FormEngine.GetTableData('diy_sjyijian', {
      _SelectFields: ['Id', 'YijianNR'],
      _OrderBy: 'CreateTime',
      _OrderByType: 'DESC',
      _PageIndex: 1,
      _PageSize: 8
    })
    if (!result || Number(result.Code) !== 1) return []
    return (Array.isArray(result.Data) ? result.Data : [])
      .map((item) => String(item.YijianNR || '').trim())
      .filter(Boolean)
  } catch (error) {
    return []
  }
}

export async function executeBusinessRowAction(actionKey, row = {}, input = '', user = getUser() || {}) {
  const id = row.Id
  let rowPatch = null
  if (!id) throw new Error('缺少业务数据编号')
  if (actionKey === 'order-copy') ensure(await callApiEngine('dingdan_copy', { Id: id }), '订单复制失败')
  if (actionKey === 'order-approve') ensure(await callApiEngine('dingdan_shenpi', { Id: id, formData: { ShenpiYJ: input } }), '订单审批失败')
  if (actionKey === 'order-reject') {
    ensure(await callApiEngine('DingdanApproveReject', { rejectData: { Id: id }, formData: { ShenpiYJ: input } }), '订单驳回失败')
    ensure(await V8.FormEngine.UptFormData('Diy_Dingdan', { Id: id, DingdanZT: '已驳回', DingdanZTZ: 6, _InvokeType: 'Client' }), '订单状态更新失败')
  }
  if (actionKey === 'order-void-request') {
    ensure(await V8.FormEngine.UptFormData('Diy_Dingdan', { Id: id, DingdanZT: '待审批作废', DingdanZTZ: 5, _InvokeType: 'Client' }), '作废申请失败')
  }
  if (actionKey === 'order-void-approve') ensure(await callApiEngine('dingdan_zuofei', { Id: id }), '订单作废失败')
  if (actionKey === 'position-copy') ensure(await callApiEngine('add_datacopy', { FormEngineKey: 'diy_shebeiwz', Id: id }), '安装位置复制失败')
  if (actionKey === 'position-delete') {
    ensure(await V8.FormEngine.DelFormData({ FormEngineKey: 'diy_shebeiwz', Id: id, _InvokeType: 'Client' }), '安装位置删除失败')
    if (row.DingdanSPID) {
      const result = await callApiEngine('position-delete', { Id: row.DingdanSPID })
      if (result && Number(result.Code) === 0) throw new Error(result.Msg || '订单设备数量同步失败')
    }
  }
  if (actionKey === 'proposal-copy') ensure(await callApiEngine('add_datacopy', { FormEngineKey: 'diy_kehufaxx', Id: id }), '客户方案复制失败')
  if (actionKey === 'proposal-delete') ensure(await V8.FormEngine.DelFormData({ FormEngineKey: 'Diy_kehufaxx', Id: id, _InvokeType: 'Client' }), '客户方案删除失败')
  if (actionKey === 'member-remove') ensure(await callApiEngine('remove_menber', { Id: id }), '成员移出失败')
  if (actionKey === 'device-qrcode') {
    const result = ensure(await callApiEngine('AddSBCode', { Id: id }), '二维码生成失败')
    ensure(await V8.FormEngine.UptFormData('Diy_KehuSB', { Id: id, ShebeiEWM: result.Data, _InvokeType: 'Client' }), '二维码保存失败')
  }
  if (actionKey === 'visit-approve' || actionKey === 'visit-reject') {
    const approved = actionKey === 'visit-approve'
    ensure(await callApiEngine('GenjinJLMsgApprove', {
      approveData: { Id: id },
      formData: { Liuyan: `${input || ''}${approved ? '审批通过' : '审批不通过'}` }
    }), '跟进审批失败')
    ensure(await V8.FormEngine.UptFormData('Diy_GenjinJL', {
      Id: id,
      ShenpiZT: approved ? '已审批' : '已驳回',
      ShenpiZTZ: approved ? 1 : 3,
      _InvokeType: 'Client'
    }), '跟进状态更新失败')
    rowPatch = {
      ShenpiZT: approved ? '已审批' : '已驳回',
      ShenpiZTZ: approved ? 1 : 3
    }
  }
  if (actionKey === 'visit-message') {
    ensure(await V8.FormEngine.AddFormData('microi_datalog', {
      Title: `[${user.Name || user.Account || '用户'}]留言：${input}`,
      Type: 'Update', Content: '{}', DataId: id,
      TableId: 'c56bb1a1-50dd-42cb-a3aa-64fd219975ee', TableName: 'Diy_GenjinJL',
      Avatar: user.Avatar || '', Account: user.Account || '', _InvokeType: 'Client'
    }), '留言失败')
  }
  removeCachePrefix('module:')
  return { Code: 1, rowPatch }
}

export default {
  hasMenuPermission,
  hasExactMenuPermission,
  canAddMenuRecord,
  canEditMenuRecord,
  canApproveOrder,
  getBusinessRowActions,
  executeBusinessRowAction,
  loadApprovalOpinions
}
