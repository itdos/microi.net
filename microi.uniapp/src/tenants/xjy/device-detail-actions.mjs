import {
  extractQrCodePath,
  extractQrCodeValue,
  normalizeQrCodeStorageValue
} from '../../platform/qrcode-value.mjs'
import { canAddMenuRecord, canEditMenuRecord } from '../../platform/menu-permission.js'

function normalizedId(value) {
  return String(value || '').trim()
}

export function canGenerateDeviceQrCode(menuId, user = {}, mode = 'Edit') {
  // 入口与服务端都沿用设备列表表单权限；新增态校验 Add，已有记录校验 Edit。
  return String(mode || '').toLowerCase() === 'add'
    ? canAddMenuRecord(normalizedId(menuId), user)
    : canEditMenuRecord(normalizedId(menuId), user)
}

export async function resolveDeviceProductId(device = {}, loadOrderProduct) {
  const directProductId = normalizedId(
    device.ShangpinID || device._ShangpinModel?.Id || device._DingdanSPModel?.ShangpinID
  )
  if (directProductId) return directProductId

  const orderProductId = normalizedId(device.DingdanSPID || device._DingdanSPModel?.Id)
  if (!orderProductId) throw new Error('该设备未关联订单商品，暂时无法预览商品详情')
  if (typeof loadOrderProduct !== 'function') throw new Error('商品关联查询不可用')

  const result = await loadOrderProduct(orderProductId)
  if (!result || Number(result.Code) !== 1 || !result.Data) {
    throw new Error((result && result.Msg) || '未找到设备关联的订单商品')
  }

  const productId = normalizedId(result.Data.ShangpinID || result.Data._ShangpinModel?.Id)
  if (!productId) throw new Error('关联订单商品未配置商品，暂时无法预览')
  return productId
}

export function withDeviceActionTimeout(task, timeoutMs = 12000, message = '操作超时，请重试') {
  const duration = Math.max(1000, Number(timeoutMs) || 12000)
  let timer = null
  return Promise.race([
    Promise.resolve(task),
    new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message)), duration)
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export function createDeviceQrCodeAdapters(client, options = {}) {
  if (!client?.ApiEngine?.RunLegacy || !client?.FormEngine?.Request) {
    throw new Error('设备二维码服务不可用')
  }
  const menuId = normalizedId(options.menuId || options.sysMenuId)
  const isAdd = options.isAdd === true
  return {
    // AddSBCode 是历史接口引擎，必须沿用 PC/旧小程序的 ApiEngineKey 调用协议。
    callApiEngine: (key, data) => client.ApiEngine.RunLegacy(key, {
      ...(data || {}),
      ...(menuId ? { SysMenuId: menuId } : {}),
      ...(isAdd ? { IsAdd: true } : {})
    }, {
      checkCode: false,
      timeout: 10000
    }),
    getFormData: (tableName, params) => client.FormEngine.Request('getformdata', tableName, {
      ...(params || {}),
      ...(menuId ? { _SysMenuId: menuId } : {})
    }, {
      checkCode: false,
      timeout: 8000,
      readUseQueryEngine: false
    }),
    getTableData: (tableName, params) => client.FormEngine.Request('gettabledata', tableName, {
      ...(params || {}),
      ...(menuId ? { _SysMenuId: menuId } : {})
    }, {
      checkCode: false,
      timeout: 8000,
      readUseQueryEngine: false
    })
  }
}

function ensureSuccess(result, fallback) {
  if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || fallback)
  return result
}

export async function generateDeviceQrCode(deviceId, adapters = {}) {
  const id = normalizedId(deviceId)
  if (!id) throw new Error('缺少设备编号，无法生成二维码')
  if (typeof adapters.callApiEngine !== 'function') throw new Error('二维码生成服务不可用')

  const result = ensureSuccess(
    await adapters.callApiEngine('AddSBCode', { Id: id }),
    '二维码生成失败'
  )
  let qrCode = normalizeQrCodeStorageValue(extractQrCodeValue(result))
  let qrPath = extractQrCodePath(result)

  // 新版接口会返回整条设备对象并已完成落库；部分接口异步落库，做短时有界回读。
  if ((!qrCode || !qrPath) && typeof adapters.getFormData === 'function') {
    const wait = typeof adapters.wait === 'function'
      ? adapters.wait
      : (duration) => new Promise((resolve) => setTimeout(resolve, duration))
    for (const delay of [0, 250, 700]) {
      if (delay) await wait(delay)
      const refreshed = ensureSuccess(await adapters.getFormData('Diy_KehuSB', {
        Id: id,
        _SelectFields: ['Id', 'ShebeiEWM', 'ShebeiEWMPath']
      }), '二维码读取失败')
      if (!qrCode) qrCode = normalizeQrCodeStorageValue(extractQrCodeValue(refreshed))
      if (!qrPath) qrPath = extractQrCodePath(refreshed)
      if (qrCode && qrPath) break
    }
  }
  if (!qrCode && !qrPath) throw new Error('二维码已生成，但接口未返回二维码图片')

  // AddSBCode 在服务端完成生成、落库和回读校验；客户端直接使用返回值刷新当前页，
  // 避免事务提交完成前再次更新/回读造成误报或遮罩残留。
  return {
    ShebeiEWM: qrCode,
    ShebeiEWMPath: qrPath
  }
}
