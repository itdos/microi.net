#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

const packageUrl = new URL('./app.microi.saas-engine.json', import.meta.url)
const storePackageUrl = new URL('./app.microi.store.json', import.meta.url)
const importerUrl = new URL('./import-package.js', import.meta.url)
const packageModel = JSON.parse(await readFile(packageUrl, 'utf8'))
const storePackageModel = JSON.parse(await readFile(storePackageUrl, 'utf8'))
const importerSource = (await readFile(importerUrl, 'utf8')).replace(/\r\n/g, '\n')
const category = '安全与服务接入'
const platformServiceVersion = 'v1.6.9'
const createTime = '2026-08-21 00:00:00'

const template = (id, key, value, valueType, description, sort, isSecret = false) => ({
  Id: id,
  CreateTime: createTime,
  IsDeleted: 0,
  ConfigKey: key,
  ConfigValue: isSecret ? '' : value,
  ...(isSecret ? { SecretCipher: '' } : {}),
  ValueType: isSecret ? 'String' : valueType,
  Category: category,
  Description: description,
  IsPublic: 0,
  IsSecret: isSecret ? 1 : 0,
  // 模板默认停用：升级后继续回退 sys_osclients 历史值；管理员通过可信
  // TenantSystemSettingsController 填写并启用后才进入后端 V8 私有投影。
  IsEnabled: 0,
  Sort: sort,
  ValueSource: 'OfficialDefault',
})

const templates = [
  template('4df93e43-f6bb-4bf0-b3b7-51d724921001', 'Login.Authenticator.Issuer', 'Microi', 'String', 'TOTP Authenticator 的租户签发者名称', 200),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921002', 'Login.Passkey.RpId', '', 'String', 'Passkey RP ID，仅填写当前登录域名', 210),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921003', 'Login.Passkey.Origins', '[]', 'Json', '允许使用 Passkey 的完整 HTTPS Origin 列表', 220),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921004', 'Login.Face.Provider', 'MicroiFaceGatewayV1', 'String', '严格人脸与活体核验供应商', 230),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921005', 'Login.Face.ApiBase', '', 'String', '当前租户严格人脸网关地址', 240),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921006', 'Login.Face.ApiKey', '', 'String', '当前租户严格人脸网关凭据', 250, true),

  template('4df93e43-f6bb-4bf0-b3b7-51d724921011', 'Login.Gitee.ClientId', '', 'String', '当前租户 Gitee OAuth Client ID', 310),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921012', 'Login.Gitee.ClientSecret', '', 'String', '当前租户 Gitee OAuth Client Secret', 311, true),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921013', 'Login.Gitee.Scope', 'user_info', 'String', 'Gitee OAuth 授权范围', 312),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921014', 'Login.Gitee.Name', 'Gitee 登录', 'String', 'Gitee 登录入口显示名称', 313),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921015', 'Login.Gitee.Description', '使用已绑定的 Gitee 身份安全登录', 'String', 'Gitee 登录入口说明', 314),

  template('4df93e43-f6bb-4bf0-b3b7-51d724921021', 'Login.WeChat.ClientId', '', 'String', '当前租户微信开放平台 App ID', 320),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921022', 'Login.WeChat.ClientSecret', '', 'String', '当前租户微信开放平台 App Secret', 321, true),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921023', 'Login.WeChat.Scope', 'snsapi_login', 'String', '微信开放平台扫码登录授权范围', 322),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921024', 'Login.WeChat.Name', '微信扫码登录', 'String', '微信扫码登录入口显示名称', 323),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921025', 'Login.WeChat.Description', '使用微信开放平台扫码并登录已绑定账号', 'String', '微信扫码登录入口说明', 324),

  template('4df93e43-f6bb-4bf0-b3b7-51d724921031', 'Login.GitHub.ClientId', '', 'String', '当前租户 GitHub OAuth Client ID', 330),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921032', 'Login.GitHub.ClientSecret', '', 'String', '当前租户 GitHub OAuth Client Secret', 331, true),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921033', 'Login.GitHub.Scope', 'read:user user:email', 'String', 'GitHub OAuth 授权范围', 332),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921034', 'Login.GitHub.Name', 'GitHub 登录', 'String', 'GitHub 登录入口显示名称', 333),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921035', 'Login.GitHub.Description', '使用已绑定的 GitHub 身份安全登录', 'String', 'GitHub 登录入口说明', 334),

  template('4df93e43-f6bb-4bf0-b3b7-51d724921041', 'Sms.Aliyun.AccessKeyId', '', 'String', '当前租户阿里云短信 AccessKey ID', 410, true),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921042', 'Sms.Aliyun.AccessKeySecret', '', 'String', '当前租户阿里云短信 AccessKey Secret', 411, true),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921043', 'Sms.Aliyun.SignName', '', 'String', '当前租户阿里云短信签名', 412),
  template('4df93e43-f6bb-4bf0-b3b7-51d724921044', 'Sms.Aliyun.TemplateCode', '', 'String', '当前租户阿里云验证码模板编码', 413),
]

const menu = (packageModel.SysMenus || []).find(item => item.Id === 'ea6b79e8-2c6b-4d0f-9b6a-44d01a3479bf')
if (!menu) throw new Error('SaaS 引擎包缺少系统设置菜单')
const buttons = typeof menu.PageBtns === 'string' ? JSON.parse(menu.PageBtns || '[]') : menu.PageBtns
const button = (buttons || []).find(item => item.Id === 'mci-system-settings-identity-center')
if (!button) throw new Error('系统设置菜单缺少租户安全设置按钮')
button.Name = category
button._RawName = category
button.V8Code = String(button.V8Code || '').replace(
  /Title:\s*'租户系统设置 · [^']*'/,
  `Title: '租户系统设置 · ${category}'`,
)
if (/\n\s*Version:\s*'[^']*',/.test(button.V8Code)) {
  button.V8Code = button.V8Code.replace(
    /\n(\s*)Version:\s*'[^']*',/,
    `\n$1Version: '${platformServiceVersion}',`,
  )
} else {
  button.V8Code = button.V8Code.replace(
    /(\n\s*AppKey:\s*'microi-platform-service',)/,
    `$1\n  Version: '${platformServiceVersion}',`,
  )
}
menu.PageBtns = typeof menu.PageBtns === 'string' ? JSON.stringify(buttons) : buttons

const dataSet = (packageModel.DataSets || []).find(item => String(item.TableName).toLowerCase() === 'mci_system_setting')
if (!dataSet) throw new Error('SaaS 引擎包缺少 mci_system_setting 数据集')
if (dataSet.ConflictPolicy !== 'InsertIfMissing') throw new Error('mci_system_setting 必须使用 InsertIfMissing')
dataSet.ConflictFields = ['ConfigKey']
dataSet.MetadataFieldsIfExists = ['Category', 'Description']

const existingRows = Array.isArray(dataSet.Rows) ? dataSet.Rows : []
const rowsByKey = new Map(existingRows.map(row => [String(row.ConfigKey || '').toLowerCase(), row]))
for (const row of existingRows) {
  row.Category = category
}
for (const row of templates) {
  const key = row.ConfigKey.toLowerCase()
  if (!rowsByKey.has(key)) {
    existingRows.push(row)
    rowsByKey.set(key, row)
  }
}
dataSet.Rows = existingRows

const info = packageModel.PackageInfo || (packageModel.PackageInfo = {})
info.Version = 'v7.5.7'
const changeLines = [
  '2026-08-21 v7.5.7 内嵌 microi-platform-service 升级至 v1.6.9，统一交付满高系统设置、清爽应用商城与主题化明暗模式。',
  '2026-08-21 v7.5.6 内嵌 microi-platform-service 升级至 v1.6.8，并固化“安全与服务接入”满高弹层及租户私有配置交付。',
  '2026-08-21 v7.5.5 将 send_sms_reg 作为 Managed/Platform 资源纳入 SaaS 基础包，保留匿名 HTTP 契约并优先读取租户后端私有短信配置。',
  '2026-08-21 v7.5.4 系统设置“登录与身份”升级为“安全与服务接入”，新增租户自有 Passkey、OAuth、短信私有配置模板；Secret 仅由可信端点加密，DB/Redis/Mongo/MinIO/MQ 等基础设施仍归主租户。',
]
const historyLines = String(info.ChangeHistory || '').split('\n').filter(Boolean)
for (const line of [...changeLines].reverse()) {
  if (!historyLines.includes(line)) historyLines.unshift(line)
}
info.ChangeHistory = `${historyLines.join('\n')}\n`
info.DataSetCount = (packageModel.DataSets || []).length
info.DataRowCount = (packageModel.DataSets || []).reduce(
  (total, item) => total + (Array.isArray(item.Rows) ? item.Rows.length : 0),
  0,
)

await writeFile(packageUrl, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8')

const importer = (storePackageModel.SysApiEngines || []).find(
  item => item.ApiEngineKey === 'import-microi-store-package',
)
if (!importer) throw new Error('应用商城包缺少 import-microi-store-package')
const importerVersion = importerSource.match(/Version:\s*(v?\d+\.\d+\.\d+)/i)?.[1]
if (!importerVersion) throw new Error('应用商城导入器版本无效')
importer.ApiV8Code = importerSource
importer.Version = importerVersion.startsWith('v') ? importerVersion : `v${importerVersion}`
importer.LimitMemory = 8192
const storeInfo = storePackageModel.PackageInfo || (storePackageModel.PackageInfo = {})
storeInfo.Version = 'v7.5.7'
const storeChangeLines = [
  '2026-08-21 v7.5.7 内嵌 microi-platform-service 升级至 v1.6.9，应用商城压缩首屏层级并完成主题色、亮色与深色适配。',
  '2026-08-21 v7.5.3 内嵌 microi-platform-service 升级至 v1.6.8，正式交付“安全与服务接入”满高弹层与租户私有配置界面。',
  '2026-08-21 v7.5.2 内嵌 microi-platform-service 升级至 v1.6.7，系统设置“安全与服务接入”弹层使用宿主可用高度并携带最新租户私有配置界面。',
  '2026-08-21 v7.5.1 InsertIfMissing 支持仅更新 Category/Description/Sort 展示元数据，租户 ConfigValue 与 SecretCipher 永不被应用升级覆盖。',
]
const storeHistoryLines = String(storeInfo.ChangeHistory || '').split('\n').filter(Boolean)
for (const line of [...storeChangeLines].reverse()) {
  if (!storeHistoryLines.includes(line)) storeHistoryLines.unshift(line)
}
storeInfo.ChangeHistory = `${storeHistoryLines.join('\n')}\n`
await writeFile(storePackageUrl, `${JSON.stringify(storePackageModel, null, 2)}\n`, 'utf8')

console.log(`updated ${info.Version}: ${dataSet.Rows.length} tenant system-setting rows; store ${storeInfo.Version}/${importer.Version}`)
