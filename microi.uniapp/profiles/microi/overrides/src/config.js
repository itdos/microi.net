import activeProfile from './generated/active-profile.js'
import {
  APP_RUNTIME_ENDPOINT_STORAGE_KEY,
  isLocalH5RuntimeEndpointPreview,
  normalizeStoredAppRuntimeEndpoint
} from './platform/runtime-endpoint.mjs'

// 保持 default export 为对象字面量，兼容 uni-app 各小程序编译器。
// 交付配置由 profiles/<id>/profile.cjs 生成；环境变量仅覆盖部署地址和租户。
const profileApiBase = import.meta.env.VITE_MICROI_API_BASE || activeProfile.apiBase
const profileOsClient = import.meta.env.VITE_MICROI_OS_CLIENT || activeProfile.osClient
const runtimeEndpointSwitchEnabled = activeProfile.features?.runtimeEndpointSwitch === true
let runtimeEndpointEditorEnabled = false
let runtimeEndpointEditorMode = 'disabled'
let runtimeEndpoint = normalizeStoredAppRuntimeEndpoint(null, {
  apiBase: profileApiBase,
  osClient: profileOsClient
})

// 商店 App 允许用户在登录页切换企业。
// #ifdef APP-PLUS
runtimeEndpointEditorEnabled = runtimeEndpointSwitchEnabled
runtimeEndpointEditorMode = runtimeEndpointEditorEnabled ? 'app' : 'disabled'
// #endif

// H5 只在 localhost/loopback 本地预览时开放连接编辑器，部署域名不会开放。
// #ifdef H5
try {
  const runtimeLocation = typeof window === 'object' ? window.location : null
  runtimeEndpointEditorEnabled = runtimeEndpointSwitchEnabled &&
    activeProfile.features?.h5LocalEndpointPreview === true &&
    isLocalH5RuntimeEndpointPreview(runtimeLocation)
  runtimeEndpointEditorMode = runtimeEndpointEditorEnabled ? 'h5-local' : 'disabled'
} catch (error) {}
// #endif

try {
  if (runtimeEndpointEditorEnabled) {
    runtimeEndpoint = normalizeStoredAppRuntimeEndpoint(
      uni.getStorageSync(APP_RUNTIME_ENDPOINT_STORAGE_KEY),
      { apiBase: profileApiBase, osClient: profileOsClient }
    )
  }
} catch (error) {}

const appConfig = {
  ...activeProfile,
  defaultOsClient: profileOsClient,
  defaultApiBase: profileApiBase,
  runtimeEndpointEditorEnabled,
  runtimeEndpointEditorMode,
  osClient: runtimeEndpoint.osClient,
  apiBase: runtimeEndpoint.apiBase,
  fileServer: runtimeEndpoint.source === 'storage' && runtimeEndpoint.apiBase !== profileApiBase
    ? runtimeEndpoint.apiBase
    : (import.meta.env.VITE_MICROI_FILE_SERVER || activeProfile.fileServer)
}

export default appConfig
