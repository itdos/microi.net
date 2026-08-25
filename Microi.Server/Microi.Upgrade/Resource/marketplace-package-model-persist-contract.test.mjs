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

test('大包后台持久化具备管理员、精确更新日志和强回读门禁', () => {
  assert.match(exporter, /PersistStoreId/)
  assert.match(exporter, /level < 9999/)
  assert.match(exporter, /sys_microistore_changelog/)
  assert.match(exporter, /PersistChangeLog/)
  assert.match(exporter, /精确版本更新日志已存在但内容不一致/)
  assert.match(exporter, /持久化发布回读不一致/)
  assert.match(exporter, /PackageSha256/)
  assert.doesNotMatch(exporter, /PackageInfo:[\s\S]{0,260}OsClient:/)
})

test('商城包正文外置到 HDFS 并以字节数与 SHA-256 回读校验', () => {
  assert.match(storage, /V8\.Method\.UploadText/)
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
