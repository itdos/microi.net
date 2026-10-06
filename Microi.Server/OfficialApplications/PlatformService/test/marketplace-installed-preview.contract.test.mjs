import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const marketplace = await readFile(new URL('../src/Marketplace.vue', import.meta.url), 'utf8')

test('已安装 AI 应用预览只使用当前租户稳定公开入口', () => {
  assert.match(marketplace, /installedApplications=ref\(\[\]\)/)
  assert.match(marketplace, /GetTableData\('sys_microistore'/)
  assert.match(marketplace, /'PreviewUrl','PublicPublishPath'/)
  assert.match(marketplace, /function findInstalledApplication\(app\)/)
  assert.match(marketplace, /const installed=installedVersion\(app\)\?findInstalledApplication\(app\):null/)
  assert.match(marketplace, /if\(installedVersion\(app\)\)\{const installedValue=/)
  assert.match(marketplace, /return resolveRuntimePreviewUrl\(installedValue,context\.fileServer\|\|context\.apiBase\|\|window\.location\.origin\)/)
  assert.doesNotMatch(marketplace, /resolveRuntimePreviewUrl\(installedValue[^\n]+\|\|resolveRuntimePreviewUrl\(sourceValue/)
})

test('运行入口只接受可解析的 http 或 https 地址', () => {
  assert.match(marketplace, /function resolveRuntimePreviewUrl\(value,base\)/)
  assert.match(marketplace, /\^\(\?:data:\|blob:\|javascript:\)/)
  assert.match(marketplace, /\^https\?:\$\/i\.test\(resolved\.protocol\)/)
  assert.match(marketplace, /\['在线预览',runtimePreviewUrl\(app\)\|\|'—'\]/)
})

test('安装状态与本地应用详情任一读取失败时保持失败关闭', () => {
  assert.match(marketplace, /installedVersionsReady\.value=false;installedVersions\.value=\[\];installedApplications\.value=\[\]/)
  assert.match(marketplace, /if\(!applicationResult\|\|Number\(applicationResult\.Code\)!==1\|\|!Array\.isArray\(applicationResult\.Data\)\)throw new Error/)
  assert.match(marketplace, /installedApplications\.value=normalizeInstalledVersions\(applicationResult\.Data\)/)
  assert.match(marketplace, /请检查 sys_microistoreversion 与 sys_microistore 后重试/)
})
