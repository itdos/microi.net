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

const read = file => fs.readFileSync(file, 'utf8')

test('profile submits tenant creation to the persistent background queue', () => {
  const source = read(profilePath)
  assert.match(source, /\/api\/BackgroundTask\/RunApiEngine/)
  assert.match(source, /ApiEngineKey:\s*'official_create_tenant'/)
  assert.doesNotMatch(source, /ApiEngineKey:\s*'official_create_tenant_worker'/)
  assert.match(source, /ConcurrencyKey:.*tenantKey\.value\.trim\(\)\.toLowerCase\(\)/)
  assert.doesNotMatch(source, /AdminDefaultPassword\s*\|\|\s*tenant\.OsClient/)
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

test('all tenant V8 engines remain syntactically valid JavaScript functions', () => {
  for (const file of [workerPath, progressPath, centerPath, legacyEntryPath]) {
    assert.doesNotThrow(() => new Function(read(file)), path.basename(file))
  }
})
