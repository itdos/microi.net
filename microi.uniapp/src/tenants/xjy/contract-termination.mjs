export const TERMINATION_TABLE = 'diy_duanyueshenqing'
export const TERMINATION_MENU_ID = '0e9ab867-af70-40ea-a6e0-f932671b8acb'

export function isTerminationForm(context) {
  return String(context.tableName || '').toLowerCase() === TERMINATION_TABLE
}

export function terminationFromOrder(context) {
  return context.mode === 'Add' && Boolean(context.defaultValues?.DingdanID)
}

function text(value, key) {
  if (value && typeof value === 'object') return String(value[key] ?? value.Value ?? value.Name ?? '')
  return String(value ?? '')
}

export function terminationOrderValues(order = {}) {
  return {
    DingdanID: text(order.Id, 'Id'), DingdanBH: text(order.DingdanBH, 'DingdanBH'),
    KehuMC: text(order.KehuMC, 'KehuMC'), KehuID: text(order.KehuID, 'Id'),
    HezuoFS: text(order.DingdanHZFS || order.AllDingdanHZFS || order.HezuoFS, 'Value')
  }
}

export function terminationGoodsValues(rows = []) {
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
  return {
    ShangpinMC: rows.map((row, index) => `${index + 1}. ${text(row.ShangpinMC, 'ShangpinMC')}`).join('\n'),
    Shuliang: rows.reduce((sum, row) => sum + number(row.Shuliang), 0),
    ShijiJG: rows.reduce((sum, row) => sum + number(row.Zongjia), 0)
  }
}

export async function bindTerminationOrder(context, order, V8) {
  const requestId = (context.state.terminationRequestId || 0) + 1
  context.state.terminationRequestId = requestId
  context.state.terminationGoodsReady = false
  context.patchForm({ ...terminationOrderValues(order), ...terminationGoodsValues() })
  if (!order?.Id) { context.state.terminationGoodsReady = true; return }
  const result = await V8.FormEngine.GetTableData('Diy_DingdanSP', {
    ...(context.state.terminationGoodsMenuId ? { _SysMenuId: context.state.terminationGoodsMenuId } : {}),
    _Where: [['DingdanID', '=', order.Id]], _PageSize: 1000, _PageIndex: 1
  })
  // 快速切换订单或清空选择后，旧请求不得覆盖当前订单的汇总。
  if (requestId !== context.state.terminationRequestId) return
  if (Number(result?.Code) !== 1) throw new Error(result?.Msg || '订单商品读取失败，请重新选择订单')
  if (Number(result.DataCount || 0) > (result.Data || []).length) throw new Error('订单商品未完整加载，请联系管理员')
  context.patchForm(terminationGoodsValues(result.Data || []))
  context.state.terminationGoodsReady = true
}
