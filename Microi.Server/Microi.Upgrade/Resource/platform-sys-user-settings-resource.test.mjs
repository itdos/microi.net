import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const resourceDir = path.dirname(fileURLToPath(import.meta.url))

function loadEngine(key) {
  const source = fs.readFileSync(path.join(resourceDir, `${key}.js`), 'utf8').replaceAll('\r\n', '\n')
  assert.match(source, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/)
  const hookByKey = {
    'platform-create-tenant': 'platform-runtime-custom-hook',
    'platform-user-update-profile': 'platform-user-custom-hook',
    'platform-tenant-system-settings': 'platform-system-settings-custom-hook',
  }
  const appByKey = {
    'platform-create-tenant': 'SaaS引擎',
    'platform-user-update-profile': '系统账号',
    'platform-tenant-system-settings': '系统设置',
  }
  assert.match(source, new RegExp(hookByKey[key]))
  assert.match(source, new RegExp(`所属官方应用：${appByKey[key]}`))
  return { source, execute: new Function('V8', source) }
}

test('application-specific hooks are CreateIfMissing no-op resources', () => {
  for (const [key, appName] of [
    ['platform-user-custom-hook', '系统账号'],
    ['platform-system-settings-custom-hook', '系统设置'],
  ]) {
    const source = fs.readFileSync(path.join(resourceDir, `${key}.js`), 'utf8').replaceAll('\r\n', '\n')
    assert.match(source, /^\/\* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/)
    assert.match(source, new RegExp(`所属官方应用：${appName}`))
    assert.match(source, /return \{ Code : 1 \};/)
  }
})

test('tenant creation derives identity only inside the trusted atom and keeps success after an after-hook warning', () => {
  const { execute } = loadEngine('platform-create-tenant')
  let atomParam
  const audit = []
  let hookIndex = 0
  const result = execute({
    Param: {
      TenantKey: 'tenant_a',
      SystemName: '租户 A',
      UserId: 'attacker',
      Phone: 'attacker-phone',
      Pwd: 'plaintext',
      AiApiKey: 'must-not-forward',
    },
    CurrentUser: { Id: 'trusted-user' },
    OsClient: 'itdos',
    ApiEngine: {
      Run(key, param) {
        assert.equal(key, 'platform-runtime-custom-hook')
        hookIndex++
        return hookIndex === 1 ? { Code: 1 } : { Code: 0, Msg: 'tenant hook failed' }
      },
    },
    Method: {
      AuthorizeCurrentUserTenantProvisioning() { return { Code: 1 } },
      ProvisionCurrentUserTenant(param) {
        atomParam = param
        return { Code: 1, Data: { OsClient: 'tenant_a' }, Msg: '租户创建成功。' }
      },
      AddSysLog(param) { audit.push(param); return { Code: 1 } },
    },
  })

  assert.deepEqual(atomParam, { TenantKey: 'tenant_a', SystemName: '租户 A' })
  assert.equal(result.Code, 1)
  assert.equal(result.Data.OsClient, 'tenant_a')
  assert.equal(result.DataAppend.HookWarning, 'tenant hook failed')
  assert.equal(audit.length, 1)
  assert.doesNotMatch(JSON.stringify(atomParam) + JSON.stringify(audit), /plaintext|must-not-forward|attacker-phone/)
})

test('profile engine updates only the trusted current user and uses atom-normalized avatar paths', () => {
  const { execute } = loadEngine('platform-user-update-profile')
  let updateModel
  const hooks = []
  const result = execute({
    Param: {
      Id: 'attacker',
      OsClient: 'other-tenant',
      Account: 'attacker',
      Level: 9999,
      Name: '新昵称',
      Email: 'user@example.test',
      Sex: '保密',
      Lang: 'zh-CN',
      Avatar: '/other-tenant/member/avatar/a.png',
      PublicAvatar: '/other-tenant/member/public-avatar/a.png',
    },
    CurrentUser: { Id: 'trusted-user', Name: '旧昵称' },
    OsClient: 'tenant-a',
    ApiEngine: {
      Run(key, param) { hooks.push({ key, param }); return { Code: 1 } },
    },
    FormEngine: {
      UptFormData(table, model) {
        assert.equal(table, 'sys_user')
        updateModel = model
        return { Code: 1 }
      },
    },
    Method: {
      PrepareCurrentUserProfileUpdate() {
        return {
          Code: 1,
          Data: {
            UserId: 'trusted-user',
            OsClient: 'tenant-a',
            HasAvatar: true,
            HasPublicAvatar: true,
            Avatar: '/tenant-a/member/avatar/safe.png',
            PublicAvatar: '/tenant-a/member/public-avatar/safe.png',
            CurrentProfile: { Name: '旧昵称' },
          },
        }
      },
      RefreshLoginUser(userId, osClient) {
        assert.equal(userId, 'trusted-user')
        assert.equal(osClient, 'tenant-a')
        return { Code: 1, Data: { Id: userId, ...updateModel } }
      },
      AddSysLog() { return { Code: 1 } },
    },
  })

  assert.equal(result.Code, 1)
  assert.deepEqual(updateModel, {
    Id: 'trusted-user',
    Name: '新昵称',
    Email: 'user@example.test',
    Sex: '保密',
    Lang: 'zh-CN',
    Avatar: '/tenant-a/member/avatar/safe.png',
    PublicAvatar: '/tenant-a/member/public-avatar/safe.png',
  })
  assert.equal(hooks.length, 2)
  assert.ok(hooks.every(item => item.key === 'platform-user-custom-hook'))
  for (const forbidden of ['Account', 'Level', 'OsClient']) assert.ok(!(forbidden in updateModel))
})

test('profile engine does not reverse a committed update when its after hook fails', () => {
  const { execute } = loadEngine('platform-user-update-profile')
  let hookIndex = 0
  const result = execute({
    Param: { Name: '新昵称' },
    CurrentUser: { Id: 'trusted-user', Name: '旧昵称' },
    OsClient: 'tenant-a',
    ApiEngine: { Run() { return ++hookIndex === 1 ? { Code: 1 } : { Code: 0, Msg: 'after failed' } } },
    FormEngine: { UptFormData() { return { Code: 1 } } },
    Method: {
      PrepareCurrentUserProfileUpdate() {
        return { Code: 1, Data: { UserId: 'trusted-user', OsClient: 'tenant-a', CurrentProfile: { Name: '旧昵称' } } }
      },
      RefreshLoginUser() { return { Code: 1, Data: { Id: 'trusted-user', Name: '新昵称' } } },
      AddSysLog() { return { Code: 1 } },
    },
  })
  assert.equal(result.Code, 1)
  assert.equal(result.DataAppend.HookWarning, 'after failed')
})

test('profile engine does not reverse a committed update when login projection refresh fails', () => {
  const { execute } = loadEngine('platform-user-update-profile')
  const audits = []
  const result = execute({
    Param: { Name: '新昵称' },
    CurrentUser: { Id: 'trusted-user', Name: '旧昵称' },
    OsClient: 'tenant-a',
    ApiEngine: { Run() { return { Code: 1 } } },
    FormEngine: { UptFormData() { return { Code: 1 } } },
    Method: {
      PrepareCurrentUserProfileUpdate() {
        return { Code: 1, Data: { UserId: 'trusted-user', OsClient: 'tenant-a', CurrentProfile: { Name: '旧昵称' } } }
      },
      RefreshLoginUser() { throw new Error('cache unavailable') },
      AddSysLog(param) { audits.push(param); return { Code: 1 } },
    },
  })
  assert.equal(result.Code, 1)
  assert.match(result.DataAppend.RefreshWarning, /刷新发生异常/)
  assert.equal(audits.length, 1)
  assert.equal(audits[0].Action, 'RefreshCurrentProfileProjectionWarning')
})

test('tenant creation keeps success when its after hook and warning audit throw', () => {
  const { execute } = loadEngine('platform-create-tenant')
  let hookIndex = 0
  const result = execute({
    Param: { TenantKey: 'tenant_a', SystemName: '租户 A' },
    CurrentUser: { Id: 'trusted-user' },
    OsClient: 'itdos',
    ApiEngine: {
      Run() {
        if (++hookIndex === 1) return { Code: 1 }
        throw new Error('after hook exploded')
      },
    },
    Method: {
      AuthorizeCurrentUserTenantProvisioning() { return { Code: 1 } },
      ProvisionCurrentUserTenant() { return { Code: 1, Data: { OsClient: 'tenant_a' } } },
      AddSysLog() { throw new Error('audit unavailable') },
    },
  })
  assert.equal(result.Code, 1)
  assert.match(result.DataAppend.HookWarning, /执行异常/)
})

test('settings save keeps success when its after hook and warning audit throw', () => {
  const { execute } = loadEngine('platform-tenant-system-settings')
  let hookIndex = 0
  const result = execute({
    Param: { Action: 'SaveNonSecret', ConfigKey: 'Feature.Mode', Value: 'strict' },
    CurrentUser: { Id: 'admin' },
    OsClient: 'tenant-a',
    ApiEngine: {
      Run() {
        if (++hookIndex === 1) return { Code: 1 }
        throw new Error('after hook exploded')
      },
    },
    FormEngine: {
      GetFormData() { return { Code: 2 } },
      AddFormData() { return { Code: 1 } },
    },
    Method: {
      ValidateTenantSystemSettingsOperation(param) {
        return { Code: 1, Data: { ConfigKey: String(param.ConfigKey) } }
      },
      NewGuid() { return 'new-id' },
      AddSysLog() { throw new Error('audit unavailable') },
    },
  })
  assert.equal(result.Code, 1)
  assert.match(result.DataAppend.HookWarning, /执行异常/)
})

test('tenant settings engine lists a safe projection without selecting SecretCipher', () => {
  const { execute } = loadEngine('platform-tenant-system-settings')
  let listParam
  const result = execute({
    Param: { Action: 'List' },
    CurrentUser: { Id: 'admin', Name: '管理员' },
    OsClient: 'tenant-a',
    ApiEngine: { Run() { return { Code: 1 } } },
    FormEngine: {
      GetTableData(table, param) {
        assert.equal(table, 'mci_system_setting')
        listParam = param
        return { Code: 1, Data: [
          { Id: 'plain', ConfigKey: 'Feature.Mode', ConfigValue: 'on', IsSecret: 0, IsEnabled: 1 },
          { Id: 'secret', ConfigKey: 'Login.GitHub.ClientSecret', ConfigValue: 'must-mask', IsSecret: 1 },
          { Id: 'migrated', ConfigKey: 'Login.Passkey.Enabled', ConfigValue: '1', IsSecret: 0 },
        ] }
      },
    },
    Method: {
      ValidateTenantSystemSettingsOperation() { return { Code: 1, Data: {} } },
      GetTenantSystemSettingsSecurityProjection() {
        return {
          Code: 1,
          Data: {
            SecretStateById: { secret: true },
            MigratedKeys: ['Login.Passkey.Enabled'],
          },
        }
      },
      AddSysLog() { return { Code: 1 } },
    },
  })

  assert.equal(result.Code, 1)
  assert.equal(result.Data.length, 2)
  assert.equal(result.Data[1].ConfigValue, '')
  assert.equal(result.Data[1].HasSecret, true)
  assert.ok(!listParam._SelectFields.includes('SecretCipher'))
  assert.doesNotMatch(JSON.stringify(result), /must-mask/)
})

test('tenant settings engine sends only non-secret values to FormEngine and keeps success on hook warning', () => {
  const { execute } = loadEngine('platform-tenant-system-settings')
  let savedForm
  let hookIndex = 0
  const validations = []
  const result = execute({
    Param: {
      Action: 'SaveNonSecret',
      ConfigKey: 'Feature.Mode',
      Value: 'strict',
      ValueType: 'String',
      IsSecret: false,
      IsPublic: true,
      IsEnabled: true,
      Sort: 'not-a-number',
    },
    CurrentUser: { Id: 'admin', Name: '管理员' },
    OsClient: 'tenant-a',
    ApiEngine: { Run() { return ++hookIndex === 1 ? { Code: 1 } : { Code: 0, Msg: 'after failed' } } },
    FormEngine: {
      GetFormData() { return { Code: 2 } },
      AddFormData(table, form) { assert.equal(table, 'mci_system_setting'); savedForm = form; return { Code: 1 } },
      UptFormData() { throw new Error('unexpected update') },
    },
    Method: {
      ValidateTenantSystemSettingsOperation(param) {
        validations.push(param)
        if (param.IsSecret) return { Code: 0, Msg: 'secret denied' }
        return { Code: 1, Data: { ConfigKey: String(param.ConfigKey) } }
      },
      NewGuid() { return 'new-id' },
      AddSysLog() { return { Code: 1 } },
    },
  })

  assert.equal(result.Code, 1)
  assert.equal(result.DataAppend.HookWarning, 'after failed')
  assert.equal(savedForm.Id, 'new-id')
  assert.equal(savedForm.ConfigValue, 'strict')
  assert.equal(savedForm.SecretCipher, '')
  assert.equal(savedForm.IsSecret, 0)
  assert.equal(savedForm.IsPublic, 0)
  assert.equal(savedForm.Sort, 0)
  assert.equal(validations[0].Action, 'SaveNonSecret')
})

test('tenant settings engine never treats a query or authorization error as an absent row', () => {
  const { execute } = loadEngine('platform-tenant-system-settings')
  let mutationCalls = 0
  const result = execute({
    Param: { Action: 'SaveNonSecret', ConfigKey: 'Feature.Mode', Value: 'strict' },
    CurrentUser: { Id: 'admin' },
    OsClient: 'tenant-a',
    ApiEngine: { Run() { return { Code: 1 } } },
    FormEngine: {
      GetFormData() { return { Code: 0, Msg: 'database unavailable' } },
      AddFormData() { mutationCalls++; return { Code: 1 } },
      UptFormData() { mutationCalls++; return { Code: 1 } },
    },
    Method: {
      ValidateTenantSystemSettingsOperation(param) {
        return { Code: 1, Data: { ConfigKey: String(param.ConfigKey) } }
      },
      AddSysLog() { return { Code: 1 } },
    },
  })
  assert.equal(result.Code, 0)
  assert.equal(result.Msg, 'database unavailable')
  assert.equal(mutationCalls, 0)
})

test('tenant settings engine does not create a row for a stale caller-supplied Id', () => {
  const { execute } = loadEngine('platform-tenant-system-settings')
  let mutationCalls = 0
  const result = execute({
    Param: { Action: 'SaveNonSecret', Id: 'stale-id', ConfigKey: 'Feature.Mode', Value: 'strict' },
    CurrentUser: { Id: 'admin' },
    OsClient: 'tenant-a',
    ApiEngine: { Run() { return { Code: 1 } } },
    FormEngine: {
      GetFormData() { return { Code: 2 } },
      AddFormData() { mutationCalls++; return { Code: 1 } },
      UptFormData() { mutationCalls++; return { Code: 1 } },
    },
    Method: {
      ValidateTenantSystemSettingsOperation(param) {
        return { Code: 1, Data: { ConfigKey: String(param.ConfigKey) } }
      },
      AddSysLog() { return { Code: 1 } },
    },
  })
  assert.equal(result.Code, 0)
  assert.match(result.Msg, /失效 Id/)
  assert.equal(mutationCalls, 0)
})

test('tenant settings engine fails closed before CRUD for Secret requests', () => {
  const { execute } = loadEngine('platform-tenant-system-settings')
  let formCalls = 0
  const result = execute({
    Param: { Action: 'SaveNonSecret', ConfigKey: 'Feature.Secret', Value: 'plaintext', IsSecret: true },
    CurrentUser: { Id: 'admin' },
    OsClient: 'tenant-a',
    ApiEngine: { Run() { return { Code: 1 } } },
    FormEngine: { GetFormData() { formCalls++; return { Code: 2 } } },
    Method: {
      ValidateTenantSystemSettingsOperation() { return { Code: 0, Msg: 'Secret denied' } },
      AddSysLog() { return { Code: 1 } },
    },
  })
  assert.equal(result.Code, 0)
  assert.equal(formCalls, 0)
})

test('migrated routes live in Managed engines while credential atoms stay in feature runtimes', () => {
  for (const deleted of [
    'SysUserController.cs',
    'TenantSystemSettingsController.cs',
  ]) {
    assert.equal(fs.existsSync(path.resolve(resourceDir, '../../Microi.net.Api/Controllers', deleted)), false)
  }

  const sysUser = fs.readFileSync(
    path.resolve(resourceDir, '../../Microi.net/Identity/SysUserSessionRuntime.cs'),
    'utf8',
  )
  const tenantSettings = fs.readFileSync(
    path.resolve(resourceDir, '../../Microi.net/SystemSettings/TenantSystemSettingsRuntime.cs'),
    'utf8',
  )
  assert.match(loadEngine('platform-create-tenant').source, /platform-runtime-custom-hook/)
  assert.match(loadEngine('platform-user-update-profile').source, /platform-user-custom-hook/)
  assert.match(loadEngine('platform-tenant-system-settings').source, /platform-system-settings-custom-hook/)
  assert.match(sysUser, /GetOwnedTenantAdminPassword[\s\S]*?SetSensitiveCredentialResponseHeaders/)
  assert.match(sysUser, /GetSysUserPassword[\s\S]*?DecodeStoredPassword/)
  assert.match(tenantSettings, /ProtectSecret/)
  assert.match(tenantSettings, /ConsumeTicketAsync/)
})
