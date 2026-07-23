import activeProfile from './generated/active-profile.js'

// 保持 default export 为对象字面量，兼容 uni-app 各小程序编译器。
// 交付配置由 profiles/<id>/profile.cjs 生成；环境变量仅覆盖部署地址和租户。
export default {
  ...activeProfile,
  osClient: import.meta.env.VITE_MICROI_OS_CLIENT || activeProfile.osClient,
  apiBase: import.meta.env.VITE_MICROI_API_BASE || activeProfile.apiBase,
  fileServer: import.meta.env.VITE_MICROI_FILE_SERVER || activeProfile.fileServer
}
