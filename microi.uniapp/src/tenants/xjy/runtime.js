export async function loadHomeSummary(context, options = {}) {
  const {
    user = {},
    getRoleProfile,
    getBusinessModule,
    loadModuleRows,
    callApiEngine
  } = context
  const role = getRoleProfile(user)
  const summary = { orders: 0, devices: 0, services: 0, tasks: 0, customers: 0 }

  if (!role.isInternal) {
    try {
      const result = await callApiEngine('my_some_count', {})
      const data = result && result.Data ? result.Data : result || {}
      summary.orders = Number(data.orderCount ?? 0)
      summary.devices = Number(data.ShebeiCount ?? 0)
      summary.services = Number(data.FuwuCount ?? 0)
    } catch (error) {}
    return summary
  }

  const pendingStates = ['待接单', '待服务', '待商家验收', '待客户验收', '待评价', '暂停']
  const taskWhere = [{ Name: 'Zhuangtai', Type: 'In', Value: pendingStates }]
  if (role.isService && !role.isAdmin && user.Id) {
    taskWhere.push({ Name: 'ShouhouRYID', Type: '=', Value: user.Id })
  }
  const common = { pageIndex: 1, pageSize: 1, refresh: options.refresh === true }
  const requests = [
    loadModuleRows(getBusinessModule('orders'), common),
    loadModuleRows(getBusinessModule('devices'), common),
    loadModuleRows(getBusinessModule('serviceRecords'), common),
    loadModuleRows(getBusinessModule('tasks'), { ...common, extraWhere: taskWhere }),
    loadModuleRows(getBusinessModule('customers'), common)
  ]
  const results = await Promise.allSettled(requests)
  const keys = ['orders', 'devices', 'services', 'tasks', 'customers']
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') summary[keys[index]] = Number(result.value.count || 0)
  })
  return summary
}

export async function openBusiness(context, key) {
  const { getBusinessEntry, getBusinessModule, openForm } = context
  const moduleConfig = getBusinessModule(key)
  const entry = getBusinessEntry(key)
  if (!moduleConfig) {
    uni.showToast({ title: '功能配置不存在', icon: 'none' })
    return null
  }
  if (key === 'tasks' || moduleConfig.target === 'task-list') {
    uni.navigateTo({ url: '/pages/task/list' })
  } else if (moduleConfig.target === 'native-list') {
    uni.navigateTo({ url: `/pages/business/list?key=${encodeURIComponent(key)}` })
  } else if (moduleConfig.target === 'native-page') {
    uni.navigateTo({ url: moduleConfig.path })
  } else if (moduleConfig.target === 'form-add') {
    await openForm({
      table: moduleConfig.table,
      mode: 'Add',
      title: moduleConfig.title,
      menuAliases: moduleConfig.menuAliases
    })
  } else if (moduleConfig.table) {
    uni.navigateTo({ url: `/pages/business/list?key=${encodeURIComponent(key)}` })
  } else {
    uni.showToast({ title: '功能配置不完整', icon: 'none' })
  }
  return entry
}

export function scanDevice(context) {
  const { appConfig, parseDeviceId, requireLogin } = context
  if (!requireLogin()) return
  uni.scanCode({
    onlyFromCamera: false,
    success: (result) => {
      const deviceId = parseDeviceId(result.result)
      if (!deviceId) {
        uni.showModal({
          title: '未识别设备',
          content: `二维码中没有有效的设备编号，请确认扫描的是${appConfig.appName || '平台'}设备码。`,
          showCancel: false
        })
        return
      }
      uni.navigateTo({ url: `/pages/task/scan?deviceId=${encodeURIComponent(deviceId)}` })
    },
    fail: (error) => {
      const message = error && error.errMsg && error.errMsg.includes('cancel') ? '' : '扫码失败，请重试'
      if (message) uni.showToast({ title: message, icon: 'none' })
    }
  })
}

export default {
  loadHomeSummary,
  openBusiness,
  scanDevice
}
