import { callApiEngine, openForm } from '@/platform/business-runtime.js'
import { getUser } from '@/utils/request.js'
import { isActionVisible, resolveActionParams } from './view-schema-core.mjs'

function modal(options) {
  return new Promise((resolve) => {
    uni.showModal({
      ...options,
      success: (result) => resolve(result)
    })
  })
}

function scanCode() {
  return new Promise((resolve, reject) => {
    uni.scanCode({
      success: resolve,
      fail: reject
    })
  })
}

function navigate(target) {
  if (!target) throw new Error('未配置 Target')
  if (/^\/pages\/[^?]+/.test(target)) {
    uni.navigateTo({ url: target })
    return
  }
  throw new Error('移动端 Target 必须是受信任的 /pages/ 页面路由')
}

function actionParams(action, context) {
  const params = resolveActionParams(action, {
    form: context.form || {},
    user: context.user || getUser() || {},
    menu: context.menu || {}
  })
  if (params.Id === undefined && context.form && context.form.Id) params.Id = context.form.Id
  if (params._SysMenuId === undefined && context.menu && context.menu.Id) {
    params._SysMenuId = context.menu.Id
  }
  return params
}

async function runAction(action, context) {
  const params = actionParams(action, context)
  switch (action.ActionType) {
    case 'ApiEngine':
      return callApiEngine(action.ApiEngineKey, params)
    case 'OpenDetail':
    case 'OpenForm':
      await openForm({
        table: action.TableName || params.TableName || context.tableName,
        rowId: params.Id || '',
        mode: action.ActionType === 'OpenDetail' ? 'View' : (params.FormMode || 'Add'),
        title: action.Label || '',
        defaultValues: params.DefaultValues || null,
        includeRelated: params.IncludeRelated !== false
      })
      return { Code: 1 }
    case 'OpenList': {
      const target = action.Target || params.Target ||
        (action.ModuleEngineKey ? `/pages/business/list?key=${encodeURIComponent(action.ModuleEngineKey)}` : '')
      navigate(target)
      return { Code: 1 }
    }
    case 'Navigate':
      navigate(action.Target || params.Target)
      return { Code: 1 }
    case 'Dial': {
      const phone = String(action.Target || params.Phone || params.Mobile || params.Value || '')
        .replace(/[^\d+*-]/g, '')
      if (!phone) throw new Error('未配置电话号码')
      uni.makePhoneCall({ phoneNumber: phone })
      return { Code: 1 }
    }
    case 'Scan': {
      const result = await scanCode()
      return { Code: 1, Data: { Result: result.result || '', ScanType: result.scanType || '' } }
    }
    case 'Map': {
      const latitude = Number(params.Latitude || params.latitude)
      const longitude = Number(params.Longitude || params.longitude)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('地图操作缺少有效经纬度')
      }
      uni.openLocation({
        latitude,
        longitude,
        name: params.Name || '',
        address: params.Address || ''
      })
      return { Code: 1 }
    }
    case 'Refresh':
      if (typeof context.refresh === 'function') await context.refresh()
      return { Code: 1 }
    case 'Back':
      uni.navigateBack()
      return { Code: 1 }
    case 'Copy': {
      const data = String(action.Target || params.Text || params.Value || '')
      if (!data) throw new Error('未配置复制内容')
      uni.setClipboardData({ data })
      return { Code: 1 }
    }
    default:
      throw new Error(`不支持的 ActionType：${action.ActionType}`)
  }
}

export async function executeViewAction(action, context = {}) {
  if (!action || !action.ActionType || !isActionVisible(action, context.form || {})) return null
  if (action.Confirm) {
    const result = await modal({
      title: action.Label || '确认操作',
      content: action.Confirm,
      confirmText: '确定',
      cancelText: '取消'
    })
    if (!result.confirm) return null
  }

  try {
    const result = await runAction(action, context)
    if (result && result.Code !== undefined && result.Code !== 1) {
      throw new Error(result.Msg || `${action.Label || '操作'}失败`)
    }
    if (action.SuccessMessage) {
      uni.showToast({ title: action.SuccessMessage, icon: 'success' })
    }
    for (const successAction of action.SuccessActions || []) {
      await runAction(successAction, context)
    }
    return result || { Code: 1 }
  } catch (error) {
    uni.showToast({ title: error.message || `${action.Label || '操作'}失败`, icon: 'none' })
    return { Code: 0, Msg: error.message || String(error) }
  }
}

export { isActionVisible }

export default {
  executeViewAction,
  isActionVisible
}
