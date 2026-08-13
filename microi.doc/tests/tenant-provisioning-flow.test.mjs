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
const profileI18nPath = path.join(workspace, 'microi.doc/docs/.vitepress/theme/profile-i18n.ts')
const sysUserLogicPath = path.join(workspace, 'Microi.Server/Microi.Core/Logic/SysUserLogic.cs')

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
  const profile = read(profilePath)
  const i18n = read(profileI18nPath)

  assert.match(callback, /GiteeStarAttempt/)
  assert.match(callback, /finish\(returnUrl, false, 'gitee_account_already_bound', giteeLogin\)/)
  assert.match(callback, /finish\(returnUrl, false, 'user_update_failed', giteeLogin\)/)
  assert.match(status, /GiteeStarAttempt/)
  assert.match(status, /LastFailureReason/)
  assert.match(profile, /returnContext\.reason \|\| String\(starData\.LastFailureReason/)
  assert.match(profile, /identifiedAccount[\s\S]*giteeAccountUnidentified/)
  assert.doesNotMatch(profile, /（未识别）/)
  assert.match(i18n, /giteeAccountUnidentified:/)
})

test('all tenant V8 engines remain syntactically valid JavaScript functions', () => {
  for (const file of [workerPath, progressPath, centerPath, legacyEntryPath, giteeCallbackPath, giteeStatusPath]) {
    assert.doesNotThrow(() => new Function(read(file)), path.basename(file))
  }
})
