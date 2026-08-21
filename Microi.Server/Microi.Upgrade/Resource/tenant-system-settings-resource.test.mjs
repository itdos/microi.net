import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = url => readFile(url, 'utf8')
const packageModel = JSON.parse(await read(new URL('./app.microi.saas-engine.json', import.meta.url)))
const microserviceSource = await read(new URL('../../../AI-Project/microi/AI应用/microi-platform-service/src/SystemSettings.vue', import.meta.url))
const tenantSettingsSource = await read(new URL('../../Microi.Core/SaaSEngine/TenantSystemSettingsSecurity.cs', import.meta.url))
const controllerSource = await read(new URL('../../Microi.net.Api/Controllers/TenantSystemSettingsController.cs', import.meta.url))
const identitySource = await read(new URL('../../Microi.Core/Security/IdentityVerificationSecurity.cs', import.meta.url))
const externalLoginSource = await read(new URL('../../Microi.Core/Security/ExternalLoginProviderOptions.cs', import.meta.url))
const smsCanonicalSource = await read(new URL('../../../Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/接口引擎/未分类/[系统]发送阿里云短信(send_sms_reg).js', import.meta.url))
const smsEngine = packageModel.SysApiEngines.find(item => item.ApiEngineKey === 'send_sms_reg')
const smsSource = smsEngine?.ApiV8Code || ''

const dataSet = packageModel.DataSets.find(item => item.TableName === 'mci_system_setting')
const rows = new Map(dataSet.Rows.map(row => [row.ConfigKey, row]))

test('system settings drawer fills its viewport and uses the security/service-access name', () => {
  assert.match(microserviceSource, /context\.hostViewport\?\.height/)
  assert.match(microserviceSource, /\.system-settings\{[^}]*display:flex[^}]*min-height:var\(--system-settings-host-height,var\(--micro-app-available-height,100vh\)\)[^}]*flex-direction:column/)
  assert.match(microserviceSource, /\.workspace\{flex:1 0 auto;align-items:stretch\}/)
  assert.match(microserviceSource, /安全与服务接入/)
  assert.match(microserviceSource, /Sms\\\./)
  const menu = packageModel.SysMenus.find(item => item.Id === 'ea6b79e8-2c6b-4d0f-9b6a-44d01a3479bf')
  const button = JSON.parse(menu.PageBtns).find(item => item.Id === 'mci-system-settings-identity-center')
  assert.equal(button.Name, '安全与服务接入')
  assert.match(button.V8Code, /租户系统设置 · 安全与服务接入/)
  assert.match(button.V8Code, /Version:\s*'v1\.6\.9'/)
})

test('official package refreshes metadata but never overwrites tenant setting values', () => {
  assert.equal(dataSet.ConflictPolicy, 'InsertIfMissing')
  assert.deepEqual(dataSet.ConflictFields, ['ConfigKey'])
  assert.deepEqual(dataSet.MetadataFieldsIfExists, ['Category', 'Description'])
  for (const row of dataSet.Rows) assert.equal(row.Category, '安全与服务接入')
})

test('tenant-owned identity, OAuth and SMS templates are complete and fail closed', () => {
  const requiredKeys = [
    'Login.Authenticator.Issuer', 'Login.Passkey.RpId', 'Login.Passkey.Origins',
    'Login.Face.Provider', 'Login.Face.ApiBase', 'Login.Face.ApiKey',
    'Login.Gitee.ClientId', 'Login.Gitee.ClientSecret', 'Login.Gitee.Scope',
    'Login.WeChat.ClientId', 'Login.WeChat.ClientSecret', 'Login.WeChat.Scope',
    'Login.GitHub.ClientId', 'Login.GitHub.ClientSecret', 'Login.GitHub.Scope',
    'Sms.Aliyun.AccessKeyId', 'Sms.Aliyun.AccessKeySecret',
    'Sms.Aliyun.SignName', 'Sms.Aliyun.TemplateCode',
  ]
  for (const key of requiredKeys) {
    assert.ok(rows.has(key), `missing ${key}`)
    assert.equal(rows.get(key).IsEnabled, 0, `${key} must not override legacy values before tenant opt-in`)
    assert.equal(rows.get(key).IsPublic, 0, `${key} must remain backend-private`)
  }
  for (const key of [
    'Login.Face.ApiKey', 'Login.Gitee.ClientSecret', 'Login.WeChat.ClientSecret',
    'Login.GitHub.ClientSecret', 'Sms.Aliyun.AccessKeyId', 'Sms.Aliyun.AccessKeySecret',
  ]) {
    const row = rows.get(key)
    assert.equal(row.IsSecret, 1)
    assert.equal(row.ConfigValue, '')
    assert.equal(row.SecretCipher, '')
  }
  const forbiddenInfrastructure = /(?:Database|DbConn|Redis|Mongo|MinIO|MQHost|Rabbit|ObjectStorage)/i
  assert.equal([...rows.keys()].filter(key => forbiddenInfrastructure.test(key)).length, 0)
})

test('disabled templates remain manageable but cannot reach runtime or public projections', () => {
  const query = tenantSettingsSource.match(/SELECT Id,ConfigKey[\s\S]*?ORDER BY Sort ASC, ConfigKey ASC/)?.[0] || ''
  assert.ok(query)
  assert.doesNotMatch(query, /IsEnabled\s*=\s*1/)
  assert.match(tenantSettingsSource, /if \(item == null \|\| !item\.IsEnabled\) continue/)
  assert.match(tenantSettingsSource, /if \(settings == null \|\| !settings\.TryGetValue\(key, out var item\) \|\| !item\.IsEnabled\)/)
  assert.match(tenantSettingsSource, /CreatePublicProjection[\s\S]*?return new JObject\(\)/)
  assert.match(controllerSource, /ConfigValue = item\.IsSecret \? "" : item\.Value/)
  const auditBody = controllerSource.match(/private static void QueueAudit[\s\S]*?\n        }/)?.[0] || ''
  assert.doesNotMatch(auditBody, /SecretCipher|request\.Value|plainText/)
})

test('new private settings take priority while legacy SaaS fields remain a safe compatibility fallback', () => {
  assert.match(identitySource, /Login\.Passkey\.RpId[\s\S]*?PasskeyRpId/)
  assert.match(identitySource, /Login\.Face\.ApiKey[\s\S]*?legacyFaceApiKey/)
  assert.match(externalLoginSource, /Login\." \+ key \+ "\./)
  assert.match(externalLoginSource, /GiteeOAuthClientId[\s\S]*?GiteeOAuthClientSecret/)
  assert.match(externalLoginSource, /WeChatAppId[\s\S]*?WeChatAppSecret/)
  assert.match(smsSource, /ServerPrivateSettings[\s\S]*?Sms\.Aliyun\.AccessKeyId[\s\S]*?AliSmsAccessKeyId/)
  assert.match(smsSource, /Sms\.Aliyun\.AccessKeySecret[\s\S]*?AliSmsAccessKeySecret/)
  assert.match(smsSource, /usingTenantSmsSettings = !!tenantAccessKeyId && !!tenantAccessKeySecret/)
  const dataAppend = smsSource.match(/result\.DataAppend\s*=\s*\{[\s\S]*?\};/)?.[0] || ''
  assert.ok(dataAppend)
  assert.doesNotMatch(dataAppend, /AccessKeyId|AccessKeySecret/)
})

test('tenant-safe SMS compatibility is delivered by the managed SaaS package', () => {
  assert.ok(smsEngine)
  assert.equal(smsEngine.AllowAnonymous, 1)
  assert.equal(smsEngine.StopHttp, 0)
  assert.equal(smsEngine.IsEnable, 1)
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines.send_sms_reg, {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  })
  const normalizedCanonical = smsCanonicalSource.replace(/\r\n?/g, '\n').replace(/\n*$/g, '\n')
  assert.equal(smsSource, normalizedCanonical)
})
