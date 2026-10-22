import { nativeFieldRoleVisibility } from '../../platform/native-field-visibility.mjs'

export const DEVICE_CONTROL_ENGINE = 'xjy-device-iot-control'
export const DEVICE_CONTROL_OPERATIONS = [
  { key: 'power-on', field: 'IoTControlPowerOn', label: '设备开机', group: '电源控制', icon: 'power', tone: 'success', primary: true },
  { key: 'power-off', field: 'IoTControlPowerOff', label: '设备关机', group: '电源控制', icon: 'power', tone: 'danger', primary: true },
  { key: 'standby', field: 'IoTControlStandby', label: '设备待机', group: '电源控制', icon: 'pause', tone: 'neutral' },
  { key: 'cooling-on', field: 'IoTControlCoolingOn', label: '开启制冷', group: '温度控制', icon: 'cool', tone: 'primary' },
  { key: 'cooling-off', field: 'IoTControlCoolingOff', label: '关闭制冷', group: '温度控制', icon: 'cool', tone: 'neutral' },
  { key: 'heating-on', field: 'IoTControlHeatingOn', label: '开启制热', group: '温度控制', icon: 'heat', tone: 'warning' },
  { key: 'heating-off', field: 'IoTControlHeatingOff', label: '关闭制热', group: '温度控制', icon: 'heat', tone: 'neutral' },
  { key: 'filter-reset', field: 'IoTControlFilterReset', label: '滤芯复位', group: '维护操作', icon: 'reset', tone: 'warning', primary: true }
]

const controlNames = new Set([...DEVICE_CONTROL_OPERATIONS.map(item => item.field.toLowerCase()), 'iotcontrolstatus', 'iotcontrolfeedback'])
export function isDeviceControlField(field = {}) { return controlNames.has(String(field.Name || field.name || '').toLowerCase()) }

function fieldVisible(field, user) {
  return Boolean(field && field.visible !== false && Number(field.Visible ?? 1) !== 0
    && Number(field.AppVisible ?? field.Visible ?? 1) !== 0 && Number(field.IsDeleted || 0) !== 1
    && nativeFieldRoleVisibility(field, user).visible)
}

export function deviceControlFields(definition = {}, user = {}, tabKey = '') {
  return (definition.fields || []).filter(field => isDeviceControlField(field) && fieldVisible(field, user)
    && (!tabKey || field.formTabKey === tabKey))
}

export function deviceControlActions(fields = [], descriptor = {}) {
  const supported = descriptor?.Capabilities?.Operations || []
  return DEVICE_CONTROL_OPERATIONS.flatMap(item => {
    const field = fields.find(field => String(field.Name || '').toLowerCase() === item.field.toLowerCase())
    if (!field || !supported.includes(item.key)) return []
    return [{ ...item, label: field.Label || item.label, sort: Number(field.Sort || 0), readonly: Number(field.Readonly || 0) === 1 }]
  }).sort((a, b) => a.sort - b.sort)
}

export function newDeviceCommandId() {
  // 编号用于同一次 Prepare/Dispatch/Status 的幂等关联，不用于授权；小程序无需浏览器 crypto。
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, key => {
    const value = Math.floor(Math.random() * 16)
    return (key === 'x' ? value : (value & 3) | 8).toString(16)
  })
}

export function createDeviceControlSession({ parentId, menuId, call, canOperate, changed = () => {},
  refreshSnapshot = () => {}, newId = newDeviceCommandId, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 12 }) {
  const state = { descriptor: null, command: null, busy: false, loading: false, error: '', message: '', uncertainId: '', active: true }
  const update = patch => { if (state.active) { Object.assign(state, patch); changed({ ...state }) } }
  const sameId = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()
  const request = async params => {
    const result = await call(DEVICE_CONTROL_ENGINE, { ParentId: parentId, _SysMenuId: menuId, ...params })
    if (!result || Number(result.Code) !== 1 || !result.Data) throw new Error(result?.Msg || '控制服务未返回有效结果')
    return result.Data
  }
  function showCommand(command) {
    update({ command, message: command.Message || '正在等待设备确认。', uncertainId: command.Terminal ? '' : command.CommandId })
    // 只有设备回执或后续耗材复核才刷新快照；提交成功不能冒充设备执行成功。
    if (state.active && (command.Success === true || command.ReceiptConfirmed === true)) refreshSnapshot()
  }
  async function inspect() {
    update({ loading: true, error: '' })
    try {
      const descriptor = await request({ Action: 'Inspect' })
      update({ descriptor })
      if (!state.command && !state.uncertainId) update({ command: descriptor.PendingCommand || descriptor.LatestCommand || null })
      return descriptor
    } catch (error) {
      update({ descriptor: null, error: error.message || '控制状态读取失败' })
      return null
    } finally { update({ loading: false }) }
  }
  async function status() {
    if (!state.active || state.busy) return
    const id = state.uncertainId || state.command?.CommandId
    update({ busy: true, error: '' })
    try {
      if (id) {
        const data = await request({ Action: 'Status', CommandId: id })
        if (!sameId(data.Command?.CommandId, id)) throw new Error('指令编号不匹配，请保留原编号核对')
        showCommand(data.Command)
      }
      await inspect()
    } catch (error) { update({ error: error.message }) }
    finally { update({ busy: false }) }
  }
  async function execute(operation, { confirm, selectFilter } = {}) {
    if (!state.active || state.busy || state.loading || state.uncertainId) return
    update({ busy: true, error: '', message: '' })
    let id = ''
    try {
      const descriptor = await inspect()
      if (!state.active || !descriptor) return
      if (!canOperate(operation) || !descriptor.Capabilities?.Operations?.includes(operation)) throw new Error('当前设备或账号未获此操作授权')
      if (!descriptor.Ready) throw new Error(descriptor.Message || '设备当前不可控制')
      let reset = null
      if (operation === 'filter-reset') {
        if (!descriptor.FilterReset?.Ready) throw new Error(descriptor.FilterReset?.Message || '暂无可复位的滤芯参数')
        reset = await selectFilter(descriptor.FilterReset.Filters || [])
        if (!reset) return
      }
      if (!state.active) return
      if (!await confirm(reset) || !state.active) return
      // 确认期间字段权限可能变化，提交前再检查；权威授权、能力和在线状态仍由后端逐请求重算。
      if (!canOperate(operation)) throw new Error('操作权限已变化，请刷新后重试')
      id = newId()
      update({ uncertainId: id, command: null, message: '正在保存控制指令…' })
      const prepared = await request({ Action: 'Prepare', Operation: operation, CommandId: id,
        ...(reset ? { FilterLevel: reset.Level, ResetBasis: reset.Basis } : {}) })
      if (!state.active) return
      if (!sameId(prepared.CommandId, id)) throw new Error('指令编号不匹配，未继续下发')
      showCommand(prepared)
      if (prepared.Terminal) return
      // 准备事务提交后才发独立 Dispatch。任何超时/未知结果均只查原编号，绝不自动重发。
      try {
        const dispatched = await request({ Action: 'Dispatch', CommandId: id })
        if (!state.active) return
        if (sameId(dispatched.CommandId, id)) {
          showCommand(dispatched)
          if (dispatched.Terminal) return
        }
      } catch { /* 下发响应丢失不代表设备未执行，继续查询同一编号。 */ }
      for (let index = 0; index < attempts && state.active; index++) {
        try {
          const data = await request({ Action: 'Status', CommandId: id })
          if (!state.active) return
          if (sameId(data.Command?.CommandId, id)) {
            showCommand(data.Command)
            if (data.Command.Terminal) return
          }
        } catch { /* 有界状态查询允许暂时网络失败，但不能再次 Dispatch。 */ }
        if (index < attempts - 1 && state.active) await wait(1000)
      }
      update({ message: '暂未收到设备确认，请查询原指令状态，勿重复下发。' })
    } catch (error) {
      update({ error: `${error.message || '控制请求失败'}${id ? '；请保留原指令编号查询，勿重复下发。' : ''}` })
    } finally {
      // 后台刷新能力不能擦掉本次失败/结果未知的原因；保留原编号供人工查询。
      if (state.active && id) {
        const operationError = state.error
        await inspect()
        if (operationError) update({ error: operationError })
      }
      update({ busy: false })
    }
  }
  return { state, inspect, status, execute, dispose() { state.active = false } }
}
