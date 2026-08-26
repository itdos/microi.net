const text = (value) => String(value ?? '').trim()

export const CUSTOMER_DEVICE_SELECT_FIELDS = [
  'Id', 'KehuID', 'DingdanID', 'DingdanSPID', 'ShebeiBH', 'AnzhuangWZ',
  'KehuSB_Lat', 'KehuSB_Lng'
]

export function customerDeviceLookupCandidates(taskDevice = {}) {
  const candidates = []
  const referencedId = text(taskDevice.KehuSBID)
  const deviceNumber = text(taskDevice.ShebeiBH || taskDevice.ShangpinBH)
  const orderId = text(taskDevice.DingdanID)
  const customerId = text(taskDevice.KehuID)

  if (referencedId) candidates.push({ type: 'id', query: { Id: referencedId } })
  if (!deviceNumber) return candidates

  const exactWhere = []
  if (orderId) exactWhere.push({ Name: 'DingdanID', Type: '=', Value: orderId })
  if (customerId) exactWhere.push({ Name: 'KehuID', Type: '=', Value: customerId })
  exactWhere.push({ Name: 'ShebeiBH', Type: '=', Value: deviceNumber })
  candidates.push({ type: 'business-key', query: { _Where: exactWhere } })

  if (exactWhere.length > 1) {
    candidates.push({
      type: 'device-number',
      query: { _Where: [{ Name: 'ShebeiBH', Type: '=', Value: deviceNumber }] }
    })
  }
  return candidates
}

export function customerDeviceMatches(taskDevice = {}, customerDevice = {}) {
  const expectedNumber = text(taskDevice.ShebeiBH || taskDevice.ShangpinBH)
  const actualNumber = text(customerDevice.ShebeiBH)
  return !expectedNumber || !actualNumber || expectedNumber === actualNumber
}

export async function resolveCustomerDeviceReference(taskDevice = {}, getFormData) {
  if (typeof getFormData !== 'function') throw new Error('客户设备查询方法未配置')
  const candidates = customerDeviceLookupCandidates(taskDevice)
  for (let index = 0; index < candidates.length; index += 1) {
    const result = await getFormData({
      ...candidates[index].query,
      _SelectFields: CUSTOMER_DEVICE_SELECT_FIELDS
    })
    if (result && Number(result.Code) === 1 && result.Data && customerDeviceMatches(taskDevice, result.Data)) {
      return result.Data
    }
    if (result && ![1, 2].includes(Number(result.Code))) {
      throw new Error(result.Msg || '客户设备档案查询失败')
    }
  }
  return null
}
