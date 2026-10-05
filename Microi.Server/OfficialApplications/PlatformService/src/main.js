import { createApp, h, nextTick, shallowRef } from 'vue'
import CreateSaasTenant from './CreateSaasTenant.vue'
import TenantDatabaseUpgrade from './TenantDatabaseUpgrade.vue'
import AppStoreDataSelector from './AppStoreDataSelector.vue'
import AppPackageSelector from './AppPackageSelector.vue'
import OfflinePackageInstaller from './OfflinePackageInstaller.vue'
import DatabaseBackup from './DatabaseBackup.vue'
import PersonalSettings from './PersonalSettings.vue'
import SystemSettings from './SystemSettings.vue'
import Marketplace from './Marketplace.vue'
import SystemObservability from './SystemObservability.vue'
import PlatformOps from './PlatformOps.vue'
import PlatformReminders from './PlatformReminders.vue'
import SaasPromotion from './SaasPromotion.vue'
import SaasPublicTrial from './SaasPublicTrial.vue'
import { dispatch } from './microi.js'
import './style.css'

// Iframe 内的点击不会冒泡到宿主 document；显式通知宿主收起搜索等全局浮层。
// EventCenter 会去重相同数据，交互事件必须强制分发，否则第二次及之后的点击无法收起宿主浮层。
document.addEventListener('pointerdown', () => dispatch('micro-app:interaction', {}, { force: true }), true)

const readHostData = () => window.microApp?.getData?.() || {}
const readRoute = (data = readHostData()) => String(
  data.microRoute || data.MicroRoute || data.routePath || data.RoutePath || data.route ||
  `${window.location.pathname || ''}${window.location.hash || ''}`
)
const resolveRootComponent = route => route.includes('saas-trial') ? SaasPublicTrial
  : route.includes('saas-promotion') ? SaasPromotion
  : route.includes('tenant-database-upgrade')
  ? TenantDatabaseUpgrade
  : ['platform-reminders','message-notification','xiaoxitongzhisz','msg-event-log'].some(path=>route.includes(path))
  ? PlatformReminders
  : route.includes('platform-ops')
  ? PlatformOps
  : route.includes('system-observability')
  ? SystemObservability
  : route.includes('marketplace')
  ? Marketplace
  : route.includes('system-settings')
  ? SystemSettings
  : route.includes('personal-settings')
  ? PersonalSettings
  : route.includes('database-backup')
  ? DatabaseBackup
  : route.includes('offline-package-installer')
  ? OfflinePackageInstaller
  : route.includes('app-package-selector')
    ? AppPackageSelector
  : route.includes('app-store-data-selector')
    ? AppStoreDataSelector
    : CreateSaasTenant

const hostData = readHostData()
const activeRoute = shallowRef(readRoute(hostData))
let route = activeRoute.value
createApp({
  name: 'MicroiPlatformServiceRouter',
  setup() {
    return () => h(resolveRootComponent(activeRoute.value), { key: activeRoute.value, initialSection: activeRoute.value.includes('xiaoxitongzhisz') ? 'Business' : activeRoute.value.includes('msg-event-log') ? 'Logs' : 'Announcements' })
  }
}).mount('#app')

// micro-app 的 mounted 只代表宿主容器已挂载，不代表 Vue 根节点已经渲染。
// Vue nextTick + 双帧后回传真实 DOM/几何状态；同时监听 micro-app mounted，
// 覆盖 iframe 沙箱数据中心晚于模块脚本就绪的冷启动时序。
let readyTimer = 0
let readyAttempts = 0
const notifyHostReady = () => {
  const latestHostData = readHostData()
  const root = document.querySelector('#app')
  const rect = root?.getBoundingClientRect?.() || { width: 0, height: 0 }
  const rendered = !!root &&
    (root.childElementCount > 0 || String(root.textContent || '').trim().length > 0) &&
    Number(rect.width || root.scrollWidth || root.clientWidth || 0) > 0 &&
    Number(rect.height || root.scrollHeight || root.clientHeight || 0) > 0
  const delivered = dispatch('micro-app:ready', {
    hostGeneration: latestHostData.hostGeneration ?? hostData.hostGeneration,
    hostMountAttempt: latestHostData.hostMountAttempt ?? hostData.hostMountAttempt,
    route,
    rendered,
    width: Math.round(Number(rect.width || 0)),
    height: Math.round(Number(rect.height || 0)),
    childElementCount: root?.childElementCount || 0
  }, { force: true })
  readyAttempts += 1
  if ((!delivered || !rendered) && readyAttempts < 12) {
    clearTimeout(readyTimer)
    readyTimer = window.setTimeout(scheduleHostReady, 150)
  }
}
const scheduleHostReady = () => nextTick(() => {
  requestAnimationFrame(() => requestAnimationFrame(notifyHostReady))
})

// runtime-keep-alive 会复用同一个子应用实例。宿主从一个平台页切到另一个页面时，
// 只会更新 microRoute，不会重新执行入口模块。因此必须监听数据变化并替换根组件，
// 否则 URL 已变更但仍显示上一个页面。
const handleHostData = data => {
  const nextRoute = readRoute(data)
  if (!nextRoute || nextRoute === route) return
  route = nextRoute
  readyAttempts = 0
  activeRoute.value = nextRoute
  scheduleHostReady()
}
window.microApp?.addDataListener?.(handleHostData)

scheduleHostReady()
window.addEventListener('mounted', scheduleHostReady, { once: true })
