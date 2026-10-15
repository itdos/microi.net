import { nativeFieldRoleVisibility } from '../../platform/native-field-visibility.mjs'
import { canAddMenuRecord, canEditMenuRecord } from '../../platform/menu-permission.js'

export const DEVICE_IOT_TABLE = 'Diy_KehuSB'
export const IOT_DEVICE_TABLE = 'diy_iot_device'
const ACTION_FIELDS = { link: 'XuanzeIoT', unlink: 'JiechuIoT', create: 'XinzengIoT' }

export function isDeviceIoTSelector(table, field) {
  return String(table || '').toLowerCase() === DEVICE_IOT_TABLE.toLowerCase()
    && String(field?.Name || '').toLowerCase() === ACTION_FIELDS.link.toLowerCase()
}

export function deviceIoTField(definition, action) {
  const name = ACTION_FIELDS[action]
  return (definition?.fields || []).find(field =>
    String(field.Name || '').toLowerCase() === String(name || '').toLowerCase()) || null
}

function configOf(field) {
  if (field?.config) return field.config
  try { return typeof field?.Config === 'string' ? JSON.parse(field.Config) : field?.Config || {} }
  catch { return {} }
}

export function deviceIoTMenuId(definition) {
  return String(configOf(deviceIoTField(definition, 'link')).OpenTable?.SysMenuId || '')
}

export function deviceIoTPolicy({ definition, user = {}, menuId = '', form = {} }) {
  const editable = Boolean(form.Id && menuId && canEditMenuRecord(menuId, user))
  const policy = {}
  for (const action of Object.keys(ACTION_FIELDS)) {
    const field = deviceIoTField(definition, action)
    // 每个按钮分别读取实时字段权限；字段缺失、隐藏或未取得设备编辑授权时失败关闭。
    const visible = Boolean(field && field.visible !== false
      && Number(field.Visible ?? 1) !== 0 && Number(field.AppVisible ?? field.Visible ?? 1) !== 0
      && Number(field.IsDeleted || 0) !== 1 && nativeFieldRoleVisibility(field, user).visible)
    policy[action] = editable && visible
      && (action !== 'create' || canAddMenuRecord(deviceIoTMenuId(definition), user))
  }
  return policy
}

export function assertDeviceIoTAction(action, context) {
  if (!Object.hasOwn(ACTION_FIELDS, action) || !deviceIoTPolicy(context)[action]) {
    throw new Error('当前账号没有此 IoT 操作权限，请刷新页面后重试')
  }
}

export function deviceIoTWhere(form = {}, user = {}) {
  const tenantId = form.TenantId || user.TenantId || ''
  return [
    { Name: 'Enabled', Type: '=', Value: 1 },
    ...(tenantId ? [{ Name: 'TenantId', Type: '=', Value: tenantId }] : [])
  ]
}

export async function saveDeviceIoTBinding(action, context, selected, update) {
  assertDeviceIoTAction(action, context)
  if (!['link', 'unlink'].includes(action)) throw new Error('不支持此关联操作')
  if (action === 'link' && !selected?.Id) throw new Error('请选择一台 IoT 设备')
  // 不提交设备整行或客户端商家值；服务端表单事件在事务中重算标签并核对归属与占用。
  const result = await update(DEVICE_IOT_TABLE, {
    Id: context.form.Id,
    IoTDeviceId: action === 'link' ? selected.Id : null,
    ...(action === 'unlink' ? { IoTDeviceNames: '' } : {}),
    _SysMenuId: context.menuId,
    _InvokeType: 'Client'
  })
  if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || 'IoT 关联保存失败')
  return result
}

export async function newIoTDeviceDefaults(form = {}, user = {}, adapters = {}) {
  let orderId = form.DingdanID || ''
  if (!orderId && form.DingdanSPID) {
    const result = await adapters.loadOrderProduct(form.DingdanSPID)
    if (!result || Number(result.Code) !== 1 || !result.Data) throw new Error(result?.Msg || '订单商品读取失败')
    orderId = result.Data.DingdanID || ''
  }
  let tenantId = form.TenantId || user.TenantId || ''
  let tenantName = form.TenantName || user.TenantName || ''
  if (orderId) {
    const result = await adapters.loadOrder(orderId)
    if (!result || Number(result.Code) !== 1 || !result.Data) throw new Error(result?.Msg || '合同订单读取失败')
    tenantId = result.Data.TenantId || ''
    tenantName = result.Data.TenantName || ''
  }
  return { Enabled: 1, DeviceName: form.ShangpinMC || form.ShangpinXH || '',
    DeviceModel: form.ShebeiXH || form.ShangpinXH || form.ShebeiBH || '',
    Location: form.AnzhuangWZ || '', TenantId: tenantId, TenantName: tenantName }
}
