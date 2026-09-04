import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const publisher = await readFile(new URL('./ai-app-publish-store.js', import.meta.url), 'utf8')
const exporter = await readFile(
  new URL('../../../Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/接口引擎/系统/[系统]应用商城导出数据包(export-microi-store-package).js', import.meta.url),
  'utf8',
)
const storage = await readFile(new URL('./microi-store-package-storage.js', import.meta.url), 'utf8')
const compactor = await readFile(new URL('./compact-microi-store-packages.js', import.meta.url), 'utf8')
const packageModel = JSON.parse(await readFile(new URL('./app.microi.store.json', import.meta.url), 'utf8'))

test('组合应用包只返回包模型，避免 Base64 与对象双份内存', () => {
  assert.match(publisher, /PackageModelOnly/)
  assert.match(publisher, /if \(packageModelOnly\)/)
  assert.match(exporter, /PackageModelOnly:\s*true/)
})

test('应用发布器补齐稳定商城标识并在写入后强回读', () => {
  assert.match(publisher, /Version: v1\.9\.24/)
  assert.match(publisher, /MARKETPLACE_STABLE_APPLICATION_IDENTITY_V1/)
  assert.match(publisher, /marketplaceIdentityReadbackMatches/)
  assert.match(publisher, /发布到应用商城后的 AppId\/AppKey 强回读不一致/)
})

test('大包后台持久化具备管理员、精确更新日志和强回读门禁', () => {
  assert.match(exporter, /Version: v1\.2\.9/)
  assert.match(exporter, /PersistStoreId/)
  assert.match(exporter, /level < 9999/)
  assert.match(exporter, /sys_microistore_changelog/)
  assert.match(exporter, /PersistChangeLog/)
  assert.match(exporter, /精确版本更新日志已存在但内容不一致/)
  assert.match(exporter, /持久化发布回读不一致/)
  assert.match(exporter, /PackageSha256/)
  assert.doesNotMatch(exporter, /PackageInfo:[\s\S]{0,260}OsClient:/)
})

test('商城持久发布按旧版本与旧摘要执行事务内 CAS，并支持幂等回读', () => {
  assert.match(exporter, /ExpectedPersistAppVersion/)
  assert.match(exporter, /ExpectedPersistPackageSha256/)
  assert.match(exporter, /MARKETPLACE_STORE_PUBLISH_CAS_V2/)
  assert.match(exporter, /publishFence = 'Publishing:' \+ String\(V8\.Method\.NewUlid\(\)\)/)
  assert.match(exporter, /UptFormDataByWhere\('sys_microistore'/)
  assert.match(exporter, /String\(casReadRow\.BuildStatus \|\| ''\) != publishFence/)
  assert.match(exporter, /CAS_CONFLICT/)
  assert.match(exporter, /UptFormData\('sys_microistore',[\s\S]{0,1200}V8\.DbTrans\)/)
  assert.match(exporter, /hasExactPinnedSnapshot/)
  assert.match(exporter, /Reused: true/)
  assert.match(exporter, /Reused: false/)
  assert.match(exporter, /SnapshotPending: true/)
  assert.match(exporter, /ServerMinVersion: String\(packageData\.PackageInfo\.ServerMinVersion \|\| ''\)/)
  assert.match(exporter, /ClientMinVersion: String\(packageData\.PackageInfo\.ClientMinVersion \|\| ''\)/)
  const casStart = exporter.indexOf('MARKETPLACE_STORE_PUBLISH_CAS_V2')
  const casEnd = exporter.indexOf('var exactChangeLogReadback', casStart)
  assert.ok(casStart >= 0 && casEnd > casStart)
  assert.doesNotMatch(exporter.slice(casStart, casEnd), /V8\.Db\./)
})

test('经审计的最小平台包仅通过 UTF-8 Base64 预制包入口发布并严格校验', () => {
  assert.match(exporter, /MARKETPLACE_PREPARED_PACKAGE_BASE64_V1/)
  assert.match(exporter, /PreparedPersistPackageByteBase64/)
  assert.match(exporter, /System\.Convert\.FromBase64String\(PreparedPersistPackageByteBase64\)/)
  assert.match(exporter, /preparedRoundTrip != PreparedPersistPackageByteBase64/)
  assert.match(exporter, /预制包 AppKey 或精确版本与商城记录不一致/)
  assert.match(exporter, /预制包资源计数与正文不一致/)
})

test('发布提交后由独立收口动作触发并强回读当前不可变快照', () => {
  assert.match(exporter, /PersistFinalizeSnapshot/)
  assert.match(exporter, /MARKETPLACE_ASYNC_SNAPSHOT_FINALIZE_V1/)
  assert.match(exporter, /get-microi-store-model PinCurrentVersion/)
  assert.match(exporter, /VersionId: finalizeHistoryRows\[finalizeHistoryIndex\]\.Id, Reused: true/)
  assert.match(exporter, /SnapshotPending: true/)
  assert.ok(exporter.indexOf('PersistFinalizeSnapshot') < exporter.indexOf('参数校验：模块、流程、接口引擎'))
})

test('商城包正文外置到 HDFS 并以字节数与 SHA-256 回读校验', () => {
  assert.match(publisher, /MARKETPLACE_PACKAGE_UTF8_BASE64_TRANSPORT_V1/)
  assert.match(publisher, /System\.Convert\.ToBase64String\(System\.Text\.Encoding\.UTF8\.GetBytes\(packageJson\)\)/)
  assert.match(publisher, /PackageByteBase64:\s*packageByteBase64/)
  assert.doesNotMatch(publisher, /Package:\s*packageJson/)
  assert.match(storage, /Version: v1\.2\.1/)
  assert.match(storage, /V8\.Param\.PackageByteBase64/)
  assert.match(storage, /System\.Convert\.FromBase64String\(packageByteBase64\)/)
  assert.match(storage, /roundTripBase64 !== packageByteBase64/)
  assert.match(storage, /uploadFiles\[fileName\] = packageByteBase64 \|\| V8\.Base64\.StringToBase64\(packageText\)/)
  assert.match(storage, /MARKETPLACE_PACKAGE_UPLOAD_BASE64_SINGLE_ATTEMPT_V1/)
  assert.match(storage, /V8\.Method\.Upload\(/)
  assert.match(storage, /Base64SingleAttempt/)
  assert.doesNotMatch(storage, /V8\.Method\.UploadText\(/)
  assert.match(storage, /verifyStoredText/)
  assert.match(storage, /PackageStorageMode/)
  assert.match(storage, /HdfsPublic/)
  assert.match(storage, /HdfsPrivate/)
  assert.match(storage, /application\/json; charset=utf-8/)
  assert.match(storage, /TrustContentAddressedCache/)
  assert.match(storage, /AllowLegacyVersion/)
  assert.match(storage, /isLegacyVersion/)
  assert.match(storage, /安装端仍会独立校验下载字节/)
  assert.doesNotMatch(storage, /AppPakcet\s*:/)
})

test('官方资源、导出器和历史治理均使用 UTF-8 Base64 跨接口传输', async () => {
  const officialResource = await readFile(new URL('./official-resource-api.js', import.meta.url), 'utf8')
  assert.match(officialResource, /PackageByteBase64:\s*String\(System\.Convert\.ToBase64String/)
  assert.doesNotMatch(officialResource, /Package:\s*content/)
  assert.match(exporter, /PackageByteBase64:\s*packageByteBase64/)
  assert.doesNotMatch(exporter, /Package:\s*packageJson/)
  assert.match(compactor, /PackageByteBase64:\s*packageByteBase64/)
  assert.doesNotMatch(compactor, /Package:\s*packageText/)
})

test('历史容量治理使用有界 Id 游标，不扫描 5GB Data 大字段做 LIKE 计数', () => {
  assert.match(compactor, /Version: v1\.1\.2/)
  assert.match(compactor, /AllowLegacyVersion: true/)
  assert.match(compactor, /Action: 'EnsureSchema'/)
  assert.match(compactor, /HistoryAfterId/)
  assert.match(compactor, /Id>@p1/)
  assert.match(compactor, /HistoryCandidateCount/)
  assert.match(compactor, /HistoryScanComplete/)
  assert.match(compactor, /Math\.min\(100, parseInt\(checkpoint\.ScanSize/)
  assert.match(compactor, /BackgroundTask/)
  assert.match(compactor, /ProcessedCandidates/)
  assert.doesNotMatch(compactor, /\['AND', 'Data', 'Like'/)
  assert.doesNotMatch(compactor, /Data\s+LIKE/i)
  const embedded = packageModel.SysApiEngines.find(item => item.ApiEngineKey === 'compact-microi-store-packages')
  assert.equal(embedded?.Version, 'v1.1.2')
})
