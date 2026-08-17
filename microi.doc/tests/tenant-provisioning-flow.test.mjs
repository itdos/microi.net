import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const workspace = path.resolve(import.meta.dirname, '../..')
const profilePath = path.join(workspace, 'microi.doc/docs/.vitepress/theme/components/ProfilePage.vue')
const engineRoot = path.join(workspace, 'Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/接口引擎/系统')
const workerPath = path.join(engineRoot, '[官网]创建SaaS租户后台执行(official_create_tenant_worker).js')
const progressPath = path.join(engineRoot, '[官网]创建SaaS租户进度(official_create_tenant_progress).js')
const centerPath = path.join(engineRoot, '[官网]租户个人中心(official_tenant_center).js')
const legacyEntryPath = path.join(engineRoot, '[官网]创建SaaS租户(official_create_tenant).js')
const giteeCallbackPath = path.join(engineRoot, '[官网]Gitee Star OAuth回调(official_gitee_star_oauth_callback).js')
const giteeStatusPath = path.join(engineRoot, '[官网]Gitee Star验证状态(official_gitee_star_status).js')
const giteeBindingTransferPath = path.join(engineRoot, '[官网]Gitee账号绑定迁移(official_gitee_star_binding_transfer).js')
const profileI18nPath = path.join(workspace, 'microi.doc/docs/.vitepress/theme/profile-i18n.ts')
const sysUserLogicPath = path.join(workspace, 'Microi.Server/Microi.Core/Logic/SysUserLogic.cs')
const sysUserControllerPath = path.join(workspace, 'Microi.Server/Microi.net.Api/Controllers/SysUserController.cs')
const tenantProvisioningServicePath = path.join(workspace, 'Microi.Server/Microi.net/Common/TenantProvisioningService.cs')

const read = file => fs.readFileSync(file, 'utf8')

test('profile submits tenant creation to the persistent background queue', () => {
  const source = read(profilePath)
  assert.match(source, /\/api\/BackgroundTask\/RunApiEngine/)
  assert.match(source, /ApiEngineKey:\s*'official_create_tenant'/)
  assert.doesNotMatch(source, /ApiEngineKey:\s*'official_create_tenant_worker'/)
  assert.match(source, /ConcurrencyKey:.*tenantKey\.value\.trim\(\)\.toLowerCase\(\)/)
  assert.doesNotMatch(source, /AdminDefaultPassword\s*\|\|\s*tenant\.OsClient/)
})

test('profile refreshes the authoritative identity before loading tenant actions', () => {
  const source = read(profilePath)
  assert.match(source, /\/api\/SysUser\/RefreshLoginUser/)
  assert.match(source, /await refreshCurrentSessionIdentity\(\)[\s\S]*?const valid = await refreshCenter\(\)/)
})

test('login identity refresh reads roles through trusted logic and preserves cache on failure', () => {
  const source = read(sysUserLogicPath)
  const start = source.indexOf('public async Task<DosResult<dynamic>> RefreshLoginUser')
  const end = source.indexOf('public async Task GetSysUserOtherInfo', start)
  assert.ok(start >= 0 && end > start)
  const refreshSource = source.slice(start, end)

  assert.match(refreshSource, /new SysRoleLogic\(\)\.GetSysRole/)
  assert.match(refreshSource, /new SysRoleLimitLogic\(\)\.GetSysRoleLimit/)
  assert.doesNotMatch(refreshSource, /GetTableDataAsync<SysRole>/)
  assert.doesNotMatch(refreshSource, /GetTableDataAsync<SysRoleLimit>/)
  assert.ok(refreshSource.indexOf('new SysRoleLogic().GetSysRole') < refreshSource.indexOf('LoginTokenSysUser:{userId}', refreshSource.indexOf('SetAsync')))
  assert.match(refreshSource, /刷新用户角色权限失败，原登录缓存未修改/)
})

test('bootstrap admin password is random, short-lived, and owner-scoped', () => {
  const worker = read(workerPath)
  const progress = read(progressPath)
  const center = read(centerPath)

  assert.match(worker, /NewGuid\(\).*NewGuid\(\)/s)
  assert.match(worker, /DESEncode\(adminDefaultPassword\)/)
  assert.match(worker, /AdminCredential.*600/s)
  assert.doesNotMatch(worker, /V8\.Param\.CurrentUserId/)
  assert.doesNotMatch(worker, /V8\.Param\.TenantCreateLockKey/)
  assert.match(worker, /GiteeStarCreateGrant/)
  assert.match(worker, /GiteeStarWorkerProof/)
  assert.match(worker, /V8\.Cache\.Remove\(proofKey\)/)
  assert.match(progress, /progressOwnerUserId\s*!==\s*currentUserId/)
  assert.match(progress, /AdminDefaultPassword\s*=\s*toText\(credential\.AdminDefaultPassword\)/)
  assert.doesNotMatch(center, /AdminDefaultPassword\s*:/)
})

test('owned tenant admin password reveal and reset stay inside the trusted no-store boundary', () => {
  const profile = read(profilePath)
  const controller = read(sysUserControllerPath)
  const service = read(tenantProvisioningServicePath)

  assert.match(profile, /GetOwnedTenantAdminPassword/)
  assert.match(profile, /ResetOwnedTenantAdminPassword/)
  assert.match(profile, /cache:\s*'no-store'/)
  assert.match(profile, /TENANT_ADMIN_CREDENTIAL_TTL_MS\s*=\s*60\s*\*\s*1000/)
  assert.match(profile, /clearAllTenantAdminCredentials\(\)[\s\S]*?onUnmounted/)
  assert.doesNotMatch(profile, /localStorage\.setItem\([^\n]*(?:Password|Credential)/i)

  assert.match(controller, /UserAccessKeySecurity\.IsSession\(currentToken\.CurrentUser\)/)
  assert.match(controller, /SetSensitiveCredentialResponseHeaders/)
  assert.match(controller, /no-store, no-cache, max-age=0/)
  assert.match(controller, /ConfirmReset\s*!=\s*true/)
  assert.match(service, /OwnerUserId\s*=\s*@OwnerUserId/)
  assert.match(service, /LOWER\(OsClient\)\s*=\s*LOWER\(@TenantKey\)/)
  assert.match(service, /TenantAdminCredentialSecurity\.GenerateRandomPassword\(\)/)
  assert.match(service, /PasswordHashSecurity\.HashPassword\(password\)/)
  const resetStart = service.indexOf('ResetOwnedTenantAdminCredentialAsync')
  const resetEnd = service.indexOf('private DosResult ResolveOwnedTenantAdmin', resetStart)
  assert.ok(resetStart >= 0 && resetEnd > resetStart)
  assert.doesNotMatch(service.slice(resetStart, resetEnd), /DESEncode/)
  assert.match(read(sysUserLogicPath), /PasswordHashSecurity\.VerifyPassword\(needEncodePwd, dbEncodedPwd\)/)
  assert.match(service, /RevokeUserSessionsFromTrustedHostAsync/)
})

test('worker uses the account tenant quota instead of a hard-coded first-tenant rule', () => {
  const worker = read(workerPath)
  assert.match(worker, /V8\.Method\.GetUserTenants\(\{\s*UserId:\s*currentUser\.Id\s*\}\)/)
  assert.match(worker, /usedQuota\s*>=\s*tenantDatabaseQuota/)
  assert.doesNotMatch(worker, /已创建过一个免费租户/)
})

test('both persistent and legacy creation paths preserve one-time Gitee Star proof consumption', () => {
  const worker = read(workerPath)
  const legacy = read(legacyEntryPath)
  for (const source of [worker, legacy]) {
    assert.match(source, /GiteeStarCreateGrant/)
    assert.match(source, /V8\.Cache\.Remove\(proofKey\)/)
  }
  assert.doesNotMatch(legacy, /AdminDefaultPassword\s*:\s*tenantKey/)
})

test('persistent wrapper clears terminal task locks and cleans up failed worker ownership', () => {
  const legacy = read(legacyEntryPath)
  assert.match(legacy, /FROM mci_background_task WHERE Id = @p0 AND OsClient = @p1/)
  assert.match(legacy, /persistedStatus === 'succeeded'.*persistedStatus === 'failed'.*persistedStatus === 'canceled'/s)
  assert.match(legacy, /if \(durableResult\.Code !== 1\) \{\s*removeOwnedLock\(tenantLockKey\);\s*removeOwnedLock\(userLockKey\);\s*cleanupGiteeWorkerProof\(\);/s)
})

test('Gitee verification scans the current public Star list in bounded 100-item pages', () => {
  const callback = read(giteeCallbackPath)
  assert.match(callback, /STAR_PAGE_SIZE\s*=\s*100/)
  assert.match(callback, /STAR_PAGE_LIMIT\s*=\s*20/)
  assert.match(callback, /stared_projects\?page=' \+ page \+ '&per_page=' \+ STAR_PAGE_SIZE/)
  assert.match(callback, /giteeUser\.stared \|\| giteeUser\.starred \|\| 0/)
  assert.match(callback, /expectedPages > page[\s\S]*star_page_response_incomplete/)
  assert.doesNotMatch(callback, /api\/v5\/user\/starred/)
})

test('Gitee callback and status preserve the OAuth account without persisting an unverified binding', () => {
  const callback = read(giteeCallbackPath)
  const status = read(giteeStatusPath)
  const bindingTransfer = read(giteeBindingTransferPath)
  const profile = read(profilePath)
  const i18n = read(profileI18nPath)

  assert.match(callback, /GiteeStarAttempt/)
  assert.match(callback, /finish\(returnUrl, false, 'gitee_account_already_bound', giteeLogin\)/)
  assert.match(callback, /finish\(returnUrl, false, 'user_update_failed', giteeLogin\)/)
  assert.match(status, /GiteeStarAttempt/)
  assert.match(status, /LastFailureReason/)
  assert.match(status, /mci_gitee_star_audit/)
  assert.match(status, /BindingTransferAvailable/)
  assert.match(status, /V8\.Method\.GetUserTenants/)
  assert.match(bindingTransfer, /ConfirmBindingTransfer/)
  assert.match(bindingTransfer, /binding_recovery_evidence_expired/)
  assert.match(bindingTransfer, /checkCurrentStarPage/)
  assert.match(bindingTransfer, /VerifyStatus:\s*'processing'/)
  assert.match(bindingTransfer, /V8\.FormEngine\.UptTableData\(\[/)
  assert.doesNotMatch(bindingTransfer, /UPDATE sys_user SET GiteeUserId=NULL/)
  assert.ok(bindingTransfer.indexOf("VerifyStatus: 'processing'") < bindingTransfer.indexOf('V8.FormEngine.UptTableData(['))
  assert.match(bindingTransfer, /GiteeBindingTransferLock/)
  assert.match(bindingTransfer, /GiteeStarCreateGrant/)
  assert.match(bindingTransfer, /binding_transferred/)
  assert.match(profile, /official_gitee_star_binding_transfer/)
  assert.match(profile, /gitee_account_bound_with_tenant/)
  assert.match(profile, /window\.confirm\(t\('giteeBindingTransferConfirm'/)
  assert.match(profile, /identifiedAccount[\s\S]*giteeAccountUnidentified/)
  assert.doesNotMatch(profile, /（未识别）/)
  assert.match(i18n, /giteeAccountUnidentified:/)
  assert.match(i18n, /giteeBindingConflictWithTenant:/)
  assert.match(i18n, /giteeBindingTransferConfirm:/)
})

test('tenant creation and Gitee binding transfer are mutually excluded for the source account', () => {
  const worker = read(workerPath)
  const bindingTransfer = read(giteeBindingTransferPath)

  assert.match(worker, /GiteeBindingTransferLock:User:/)
  assert.match(worker, /getActiveGiteeBindingTransfer\(currentUser\.Id\)/)
  assert.ok(worker.match(/getActiveGiteeBindingTransfer\(currentUser\.Id\)/g).length >= 2)
  assert.match(bindingTransfer, /OfficialCreateTenantLock:User:/)
  assert.match(bindingTransfer, /gitee_binding_source_busy/)
})

test('Gitee binding transfer writes the audit first and moves both user rows in one FormEngine batch', () => {
  const source = read(giteeBindingTransferPath)
  const calls = []
  const cache = new Map()
  const targetUserId = 'target-user'
  const sourceUserId = 'source-user'
  const giteeUserId = '17377057'
  const tenantKey = 'codexgiteefix'
  const repository = 'ITdos/microi.net'
  const v8 = {
    CurrentUser: { Id: targetUserId },
    Param: { TenantKey: tenantKey, ConfirmBindingTransfer: true },
    OsClient: 'iTdos',
    OsClientModel: {
      GiteeStarRequired: 1,
      GiteeRepositoryOwner: 'ITdos',
      GiteeRepositoryName: 'microi.net'
    },
    Cache: {
      Get(key) { return cache.get(key) || '' },
      Set(key, value) { calls.push(['cache-set', key]); cache.set(key, value) },
      Remove(key) { calls.push(['cache-remove', key]); cache.delete(key) }
    },
    Http: {
      GetResponse(param) {
        if (param.Url.includes('/api/v5/users/')) {
          return { StatusCode: 200, Content: JSON.stringify({ stared: 1 }) }
        }
        return {
          StatusCode: 200,
          Content: '<div class="project-list"><a href="/ITdos/microi.net">Microi</a></div><script>"action_name":"stared_projects"</script>'
        }
      }
    },
    Method: {
      NewGuid: () => '11111111-2222-3333-4444-555555555555',
      NewUlid: () => '01MTESTGITEEBINDINGAUDIT',
      AddSysLog(param) { calls.push(['sys-log', param.Title]) },
      GetUserTenants() { return { Code: 1, Data: { UsedQuota: 0, Count: 0 } } }
    },
    FormEngine: {
      GetTableData() {
        return {
          Code: 1,
          Data: [{
            GiteeUserId: giteeUserId,
            GiteeLogin: 'anderson777',
            FailureReason: 'gitee_account_already_bound',
            VerifyTime: '2026-08-17 00:00:00',
            TraceId: 'oauth-trace'
          }]
        }
      },
      GetFormData(_table, param) {
        if (param.Id === targetUserId) {
          return { Code: 1, Data: { Id: targetUserId, Account: 'admin', GiteeUserId: '' } }
        }
        if (param.Id === sourceUserId) {
          return { Code: 1, Data: { Id: sourceUserId, GiteeUserId: giteeUserId } }
        }
        return { Code: 1, Data: { Id: sourceUserId } }
      },
      AddFormData(_table, row) {
        calls.push(['audit-add', row])
        return { Code: 1, Data: row }
      },
      UptFormData(_table, row) {
        calls.push(['audit-update', row])
        return { Code: 1, Data: row }
      },
      UptTableData(rows) {
        calls.push(['binding-batch', rows])
        return { Code: 1 }
      }
    },
    Db: {
      FromSql() { throw new Error('binding transfer must not use split direct SQL updates') }
    }
  }

  new Function('V8', 'DateAdd', 'DateNow', source)(
    v8,
    () => '2026-08-16 22:00:00',
    () => '2026-08-17 00:30:00'
  )

  assert.equal(v8.Result.Code, 1)
  assert.equal(v8.Result.Data.BindingTransferred, true)
  const auditAddIndex = calls.findIndex(item => item[0] === 'audit-add')
  const bindingBatchIndex = calls.findIndex(item => item[0] === 'binding-batch')
  assert.ok(auditAddIndex >= 0 && bindingBatchIndex > auditAddIndex)
  const audit = calls[auditAddIndex][1]
  assert.equal(audit.VerifyStatus, 'processing')
  const rows = calls[bindingBatchIndex][1]
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => row.FormEngineKey), ['sys_user', 'sys_user'])
  assert.equal(rows[0].Id, sourceUserId)
  assert.equal(rows[0].GiteeUserId, '')
  assert.equal(rows[1].Id, targetUserId)
  assert.equal(rows[1].GiteeUserId, giteeUserId)
  assert.ok(calls.some(item => item[0] === 'audit-update' && item[1].VerifyStatus === 'success'))
})

test('all tenant V8 engines remain syntactically valid JavaScript functions', () => {
  for (const file of [workerPath, progressPath, centerPath, legacyEntryPath, giteeCallbackPath, giteeStatusPath, giteeBindingTransferPath]) {
    assert.doesNotThrow(() => new Function(read(file)), path.basename(file))
  }
})
