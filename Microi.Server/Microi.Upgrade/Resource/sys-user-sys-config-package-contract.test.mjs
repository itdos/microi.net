import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const resourceDir = path.dirname(fileURLToPath(import.meta.url))
const packageNames = fs.readdirSync(resourceDir)
  .filter(name => /^app\.microi\..+\.json$/i.test(name))
  .sort()

function readPackage(name) {
  return JSON.parse(fs.readFileSync(path.join(resourceDir, name), 'utf8'))
}

function normalizeSource(value) {
  return String(value || '').replaceAll('\r\n', '\n').replace(/\s+$/, '')
}

function canonicalSource(key) {
  return normalizeSource(fs.readFileSync(path.join(resourceDir, `${key}.js`), 'utf8'))
}

function hasApiEngineCapability(packageModel, key) {
  const prefix = `ApiEngine:${key}`
  return (packageModel.PackageInfo?.RequiredPlatformCapabilities || [])
    .some(value => value === prefix || String(value).startsWith(`${prefix}@`))
}

function assertOwnedEngine(packageName, key, expectedPolicy, expectedStopHttp) {
  const packageModel = readPackage(packageName)
  const engines = (packageModel.SysApiEngines || [])
    .filter(item => item.ApiEngineKey === key)
  assert.equal(engines.length, 1, `${packageName} must contain exactly one ${key}`)

  const engine = engines[0]
  const policy = packageModel.ResourcePolicies?.ApiEngines?.[key]
  assert.ok(policy, `${packageName}:${key} missing policy`)
  assert.equal(policy.Ownership, expectedPolicy.Ownership, `${packageName}:${key}`)
  assert.equal(policy.UpgradePolicy, expectedPolicy.UpgradePolicy, `${packageName}:${key}`)
  assert.equal(engine.AllowAnonymous, 0, `${packageName}:${key} must require login`)
  assert.equal(engine.StopHttp, expectedStopHttp, `${packageName}:${key} StopHttp`)
  assert.equal(engine.IsEnable, 1, `${packageName}:${key} must be enabled`)
  assert.equal(normalizeSource(engine.ApiV8Code), canonicalSource(key), `${packageName}:${key} source drift`)
  assert.ok(hasApiEngineCapability(packageModel, key),
    `${packageName}:${key} missing RequiredPlatformCapabilities`)
  return engine
}

function assertUniqueOwner(key, expectedPackageName) {
  const owners = []
  for (const packageName of packageNames) {
    const packageModel = readPackage(packageName)
    const count = (packageModel.SysApiEngines || [])
      .filter(item => item.ApiEngineKey === key).length
    for (let index = 0; index < count; index++) owners.push(packageName)
  }
  assert.deepEqual(owners, [expectedPackageName], `${key} must have one official package owner`)
}

test('system-account package exclusively owns admin, preferences, profile and its tenant hook', () => {
  const packageName = 'app.microi.sys_user.json'
  const packageModel = readPackage(packageName)
  assert.equal(packageModel.PackageInfo?.Name, '系统账号')
  assert.equal(packageModel.PackageInfo?.Version, 'v7.6.0')
  assert.ok(packageModel.PackageInfo?.RequiredPlatformCapabilities
    ?.includes('ApiEngine:platform-sys-user-admin@v1.0.2'))

  for (const key of ['platform-user-update-preferences', 'platform-user-update-profile', 'platform-sys-user-admin']) {
    const engine = assertOwnedEngine(packageName, key, {
      Ownership: 'Platform',
      UpgradePolicy: 'Managed',
    }, 0)
    assert.match(engine.ApiV8Code, /所属官方应用：系统账号/)
    assert.match(engine.ApiV8Code, /platform-user-custom-hook/)
    assertUniqueOwner(key, packageName)
  }

  const admin = packageModel.SysApiEngines.find(item => item.ApiEngineKey === 'platform-sys-user-admin')
  assert.equal(admin.Version, 'v1.0.2')
  assert.match(admin.ApiV8Code, /V8\.Method\.ManageSysUserAdmin/)
  const authorizationOffset = admin.ApiV8Code.indexOf('AuthorizeOnly: true')
  const beforeHookOffset = admin.ApiV8Code.indexOf('runHook("Before"')
  const executionOffset = admin.ApiV8Code.lastIndexOf('V8.Method.ManageSysUserAdmin')
  assert.ok(authorizationOffset > 0, 'admin engine must perform trusted authorization preflight')
  assert.ok(beforeHookOffset > authorizationOffset,
    'tenant Before Hook must run only after trusted authorization preflight')
  assert.ok(executionOffset > beforeHookOffset,
    'admin operation must re-authorize and execute after the tenant Before Hook')
  assert.match(admin.ApiV8Code, /changesPassword[\s\S]*!changesPassword[\s\S]*runHook\("Before"/)
  assert.match(admin.ApiV8Code, /authorization\.DataAppend\.ChangesPassword === true/)
  assert.doesNotMatch(admin.ApiV8Code, /PARAM\.(?:Pwd|pwd|NewPwd|newPwd)/)
  assert.ok(admin.ApiV8Code.indexOf('runHook("After"') > executionOffset,
    'password changes may invoke tenant logic only after trusted execution succeeds')
  assert.match(admin.ApiV8Code, /Stage:[\s\S]*Action:[\s\S]*TargetUserId:/)
  assert.doesNotMatch(
    admin.ApiV8Code.slice(admin.ApiV8Code.indexOf('function runHook'), admin.ApiV8Code.indexOf('var action =')),
    /Pwd|Password|Token|Phone|Email|Avatar|RoleIds|DeptIds/,
  )

  const hook = assertOwnedEngine(packageName, 'platform-user-custom-hook', {
    Ownership: 'Tenant',
    UpgradePolicy: 'CreateIfMissing',
  }, 1)
  assert.match(hook.ApiV8Code, /^\/\* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/)
  assert.match(hook.ApiV8Code, /return \{ Code : 1 \};\s*$/)
  assertUniqueOwner('platform-user-custom-hook', packageName)
})

test('system-settings package exclusively owns non-secret tenant settings and its tenant hook', () => {
  const packageName = 'app.microi.sys-config.json'
  const packageModel = readPackage(packageName)
  assert.equal(packageModel.PackageInfo?.Name, '系统设置')

  const engine = assertOwnedEngine(packageName, 'platform-tenant-system-settings', {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  }, 0)
  assert.match(engine.ApiV8Code, /所属官方应用：系统设置/)
  assert.match(engine.ApiV8Code, /platform-system-settings-custom-hook/)
  assert.match(engine.ApiV8Code, /SaveNonSecret/)
  assert.doesNotMatch(engine.ApiV8Code, /UnprotectSecret|ConsumeIdentityVerificationTicket|GetRevealChallenge/)
  assertUniqueOwner('platform-tenant-system-settings', packageName)

  const hook = assertOwnedEngine(packageName, 'platform-system-settings-custom-hook', {
    Ownership: 'Tenant',
    UpgradePolicy: 'CreateIfMissing',
  }, 1)
  assert.match(hook.ApiV8Code, /^\/\* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/)
  assert.match(hook.ApiV8Code, /return \{ Code : 1 \};\s*$/)
  assertUniqueOwner('platform-system-settings-custom-hook', packageName)
})

test('SaaS and Store packages do not retain split ownership of account or tenant-setting engines', () => {
  const movedKeys = [
    'platform-user-update-preferences',
    'platform-user-update-profile',
    'platform-sys-user-admin',
    'platform-user-custom-hook',
    'platform-tenant-system-settings',
    'platform-system-settings-custom-hook',
  ]
  for (const packageName of ['app.microi.saas-engine.json', 'app.microi.store.json']) {
    const packageModel = readPackage(packageName)
    const engineKeys = new Set((packageModel.SysApiEngines || []).map(item => item.ApiEngineKey))
    const policyKeys = new Set(Object.keys(packageModel.ResourcePolicies?.ApiEngines || {}))
    for (const key of movedKeys) {
      assert.equal(engineKeys.has(key), false, `${packageName} retains ${key}`)
      assert.equal(policyKeys.has(key), false, `${packageName} retains ${key} policy`)
      assert.equal(hasApiEngineCapability(packageModel, key), false,
        `${packageName} retains ${key} capability`)
    }
  }
})

test('password, Secret and reveal operations stay inside trusted C# boundaries', () => {
  const sysUserController = fs.readFileSync(
    path.resolve(resourceDir, '../../Microi.net.Api/Controllers/SysUserController.cs'),
    'utf8',
  )
  const settingsController = fs.readFileSync(
    path.resolve(resourceDir, '../../Microi.net.Api/Controllers/TenantSystemSettingsController.cs'),
    'utf8',
  )
  const settingsEngine = canonicalSource('platform-tenant-system-settings')

  assert.match(sysUserController, /SetPassword[\s\S]*?HashPassword/)
  assert.match(sysUserController, /GetSysUserPassword[\s\S]*?DecodeStoredPassword/)
  assert.match(settingsController, /TenantSystemSettingsSecurity\.ProtectSecret/)
  assert.match(settingsController, /GetRevealChallenge/)
  assert.match(settingsController, /public async Task<JsonResult> Reveal/)
  assert.match(settingsController, /ConsumeTicketAsync/)
  assert.doesNotMatch(settingsEngine, /UnprotectSecret|ConsumeTicketAsync|ConsumeIdentityVerificationTicket/)
})
