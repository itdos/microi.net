import {
  extractQrCodeValue,
  normalizeQrCodeStorageValue
} from '../../platform/qrcode-value.mjs'

function normalizedId(value) {
  return String(value || '').trim()
}

export function canGenerateDeviceQrCode(user = {}) {
  // 这里只控制移动端入口显隐，服务端接口仍负责最终权限校验。
  return Number(user.Level || 0) >= 999 || Boolean(normalizedId(user.TenantId))
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

export function createDeviceQrCodeAdapters(client) {
  if (!client?.ApiEngine?.RunLegacy || !client?.FormEngine?.Request) {
    throw new Error('设备二维码服务不可用')
  }
  return {
    // AddSBCode 是历史接口引擎，必须沿用 PC/旧小程序的 ApiEngineKey 调用协议。
    callApiEngine: (key, data) => client.ApiEngine.RunLegacy(key, data, {
      checkCode: false,
      timeout: 10000
    }),
    getFormData: (tableName, params) => client.FormEngine.Request('getformdata', tableName, params, {
      checkCode: false,
      timeout: 8000,
      readUseQueryEngine: false
    }),
    getTableData: (tableName, params) => client.FormEngine.Request('gettabledata', tableName, params, {
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

  // 新版接口会返回整条设备对象并已完成落库；部分接口异步落库，做短时有界回读。
  if (!qrCode && typeof adapters.getFormData === 'function') {
    const wait = typeof adapters.wait === 'function'
      ? adapters.wait
      : (duration) => new Promise((resolve) => setTimeout(resolve, duration))
    for (const delay of [0, 250, 700]) {
      if (delay) await wait(delay)
      const refreshed = ensureSuccess(await adapters.getFormData('Diy_KehuSB', {
        Id: id,
        _SelectFields: ['Id', 'ShebeiEWM']
      }), '二维码读取失败')
      qrCode = normalizeQrCodeStorageValue(extractQrCodeValue(refreshed))
      if (qrCode) break
    }
  }
  if (!qrCode) throw new Error('二维码已生成，但接口未返回二维码内容')

  // AddSBCode 在服务端完成生成、落库和回读校验；客户端直接使用返回值刷新当前页，
  // 避免事务提交完成前再次更新/回读造成误报或遮罩残留。
  return qrCode
}
