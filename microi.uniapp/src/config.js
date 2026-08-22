import activeProfile from './generated/active-profile.js'
import {
  APP_RUNTIME_ENDPOINT_STORAGE_KEY,
  normalizeStoredAppRuntimeEndpoint
} from './platform/runtime-endpoint.mjs'

// 保持 default export 为对象字面量，兼容 uni-app 各小程序编译器。
// 交付配置由 profiles/<id>/profile.cjs 生成；环境变量仅覆盖部署地址和租户。
const profileApiBase = import.meta.env.VITE_MICROI_API_BASE || activeProfile.apiBase
const profileOsClient = import.meta.env.VITE_MICROI_OS_CLIENT || activeProfile.osClient
const runtimeEndpointSwitchEnabled = activeProfile.features?.runtimeEndpointSwitch === true
let runtimeEndpoint = normalizeStoredAppRuntimeEndpoint(null, {
  apiBase: profileApiBase,
  osClient: profileOsClient
})

// 通用 App 允许用户在登录页切换平台；H5 和各小程序仍只使用构建 Profile。
// #ifdef APP-PLUS
try {
  if (runtimeEndpointSwitchEnabled) {
    runtimeEndpoint = normalizeStoredAppRuntimeEndpoint(
      uni.getStorageSync(APP_RUNTIME_ENDPOINT_STORAGE_KEY),
      { apiBase: profileApiBase, osClient: profileOsClient }
    )
  }
} catch (error) {}
// #endif

const appConfig = {
  ...activeProfile,
  defaultOsClient: profileOsClient,
  defaultApiBase: profileApiBase,
  osClient: runtimeEndpoint.osClient,
  apiBase: runtimeEndpoint.apiBase,
  fileServer: runtimeEndpoint.source === 'storage' && runtimeEndpoint.apiBase !== profileApiBase
    ? runtimeEndpoint.apiBase
    : (import.meta.env.VITE_MICROI_FILE_SERVER || activeProfile.fileServer)
}

export default appConfig
