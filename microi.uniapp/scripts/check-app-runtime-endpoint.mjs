import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function read(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

const loginSource = read('../src/pages/login/index.vue')
const configSource = read('../src/config.js')
const requestSource = read('../src/utils/request.js')
const sdkSource = read('../src/utils/microi.v8.js')
const standardProfileSource = read('../profiles/standard/profile.cjs')
const xjyProfileSource = read('../profiles/xjy/profile.cjs')
const standardInfoPlist = read('../profiles/standard/Info.plist')
const xjyInfoPlist = read('../profiles/xjy/Info.plist')
const standardAndroidManifest = read('../profiles/standard/AndroidManifest.xml')

assert.match(loginSource, /#ifdef APP-PLUS[\s\S]*?class="app-endpoint-card"[\s\S]*?<picker[\s\S]*?:range="apiProtocolOptions"/,
  '平台连接编辑器必须只在 APP-PLUS 中编译，并使用 picker 选择协议')
assert.match(loginSource, /isAppRuntime:\s*getPlatform\(\) === PLATFORMS\.APP && appConfig\.features\?\.runtimeEndpointSwitch === true/,
  '平台连接编辑器还必须受 Profile 功能开关约束')
assert.match(standardProfileSource, /runtimeEndpointSwitch:\s*true/,
  'standard 通用 App Profile 必须开启运行端点切换')
assert.match(xjyProfileSource, /runtimeEndpointSwitch:\s*false/,
  '客户专属 xjy Profile 必须关闭运行端点切换')
assert.match(loginSource, /@input="handleApiHostInput"[\s\S]*?@input="handleRuntimeOsClientInput"/,
  'App 登录页必须分别编辑无协议 API 地址和 OsClient')
assert.match(loginSource, /async handleAccountLogin\(\)[\s\S]*?endpointDirty[\s\S]*?applyPlatformConnection/,
  '账号登录前必须应用尚未生效的运行端点')
assert.match(loginSource, /runtimeEndpointScope[\s\S]*?LOGIN_PREFERENCES_KEY[\s\S]*?records\[this\.currentLoginPreferenceScope\(\)\]/,
  '记住账号和密码必须按 ApiBase + OsClient 分域保存')
assert.match(loginSource, /protocol !== 'http:\/\/'[\s\S]*?HTTP 会以明文传输登录和业务数据/,
  'HTTP 连接必须二次确认并明确提示明文风险')
assert.match(configSource, /APP_RUNTIME_ENDPOINT_STORAGE_KEY[\s\S]*?normalizeStoredAppRuntimeEndpoint/,
  'App 启动时必须从持久化运行端点恢复配置')
assert.match(requestSource, /applyAppRuntimeEndpoint[\s\S]*?removeToken\(\)[\s\S]*?clearPlatformCache\(\)[\s\S]*?V8\.configure/,
  '切换运行端点必须清理旧会话和派生缓存后再更新 SDK')
assert.match(sdkSource, /runtimeEndpointGeneration[\s\S]*?RUNTIME_ENDPOINT_CHANGED/,
  'SDK 必须拒绝平台切换前发出的迟到响应')
assert.match(
  standardInfoPlist,
  /<key>NSAppTransportSecurity<\/key>[\s\S]*?<key>NSAllowsArbitraryLoads<\/key>\s*<true\/>/,
  '通用 standard App 必须通过当前 HBuilderX 的 Info.plist 入口允许用户选择任意 HTTP 地址'
)
assert.doesNotMatch(
  xjyInfoPlist,
  /<key>NSAllowsArbitraryLoads<\/key>\s*<true\/>/,
  '客户专属 xjy 安装包不得因通用 App 需求默认关闭 ATS'
)
assert.match(
  standardAndroidManifest,
  /android:usesCleartextTraffic="true"/,
  '通用 standard Android App 必须显式允许用户选择任意 HTTP 地址'
)
assert.equal(
  existsSync(fileURLToPath(new URL('../profiles/xjy/AndroidManifest.xml', import.meta.url))),
  false,
  '客户专属 xjy Profile 不得继承 Android 明文 HTTP 例外'
)

console.log('app runtime endpoint checks passed')
