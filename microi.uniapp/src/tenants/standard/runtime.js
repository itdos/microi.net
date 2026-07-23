export async function loadHomeSummary() {
  return { orders: 0, devices: 0, services: 0, tasks: 0, customers: 0 }
}

export async function openBusiness() {
  uni.showToast({ title: '请从业务应用中选择模块', icon: 'none' })
}

export function scanDevice() {
  uni.showToast({ title: '当前应用未配置设备扫码场景', icon: 'none' })
}

export default {
  loadHomeSummary,
  openBusiness,
  scanDevice
}
