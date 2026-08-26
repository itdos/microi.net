import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'src')

function readSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['dist', 'generated'].includes(entry.name)) return []
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return readSourceFiles(fullPath)
    return /\.(?:js|mjs|vue)$/i.test(entry.name)
      ? [{ path: fullPath, source: readFileSync(fullPath, 'utf8') }]
      : []
  })
}

test('UniApp source isolates the SysConfig legacy fallback and keeps every other platform read on ApiEngine', () => {
  const files = readSourceFiles(sourceRoot)
  const legacyRoutes = /\/api\/(?:Os\/GetOsClientByDomain|(?:FormEngine|DiyTable)\/GetSysConfig|FormEngine\/GetLangBundle|SysUser\/(?:GetCurrentUser|GetSysUserPublicInfo|AddSysUser|UptSysUser|DelSysUser|GetSysUser|RefreshLoginUser)|HDFS\/GetPrivateFileUrl)/i
  files.forEach(file => {
    if (file.path.endsWith('utils\\request.js')
      || file.path.endsWith('utils/request.js')
      || file.path.endsWith('utils\\microi.v8.js')
      || file.path.endsWith('utils/microi.v8.js')) {
      assert.match(file.source, /\/api\/FormEngine\/GetSysConfig/)
      assert.doesNotMatch(file.source.replaceAll('/api/FormEngine/GetSysConfig', ''), legacyRoutes, file.path)
      return
    }
    assert.doesNotMatch(file.source, legacyRoutes, file.path)
  })
  const source = files.map(file => file.source).join('\n')

  for (const [key, pattern] of [
    ['platform-os-client-by-domain', /\/apiengine\/platform-os-client-by-domain/],
    ['platform-sys-config', /\/apiengine\/platform-sys-config/],
    ['platform-current-user', /\/apiengine\/platform-current-user/],
    ['platform-private-file-url', /apiEngineRun\('platform-private-file-url'/],
    ['platform-sys-user-public-info', /\/apiengine\/platform-sys-user-public-info/],
    ['platform-sys-user-admin update', /\/apiengine\/platform-sys-user-admin\?Action=UptSysUser/],
    ['platform-sys-user-admin refresh', /\/apiengine\/platform-sys-user-admin\?Action=RefreshLoginUser/]
  ]) {
    assert.match(source, pattern, key)
  }

  const requestSource = readFileSync(path.join(sourceRoot, 'utils', 'request.js'), 'utf8')
  const sdkSource = readFileSync(path.join(sourceRoot, 'utils', 'microi.v8.js'), 'utf8')
  assert.match(requestSource, /shouldFallbackPlatformSysConfig/)
  assert.match(requestSource, /statusCode[\s\S]{0,500}\/api\/FormEngine\/GetSysConfig/)
  assert.match(sdkSource, /sys_apiengine[\s\S]{0,300}platform-sys-config/)
  assert.match(sdkSource, /\[404, 405, 501\]/)
})

test('UniApp bootstrap configuration calls are anonymous ApiEngine requests', () => {
  const requestSource = readFileSync(path.join(sourceRoot, 'utils', 'request.js'), 'utf8')
  const sysConfigSource = readFileSync(path.join(sourceRoot, 'utils', 'sysconfig.js'), 'utf8')
  const loginSource = readFileSync(path.join(sourceRoot, 'pages', 'login', 'index.vue'), 'utf8')
  const sdkSource = readFileSync(path.join(sourceRoot, 'utils', 'microi.v8.js'), 'utf8')

  assert.match(requestSource, /platform-sys-config[\s\S]{0,400}apiengine:\s*'1'/)
  assert.match(requestSource, /getPlatformSysConfigResult[\s\S]{0,250}post\('\/apiengine\/platform-sys-config',[\s\S]{0,120},\s*false\)/)
  assert.match(requestSource, /getPlatformSysConfigResult[\s\S]{0,500}post\('\/api\/FormEngine\/GetSysConfig',[\s\S]{0,120},\s*false\)/)
  assert.match(sysConfigSource, /getPlatformSysConfigResult\(/)
  assert.match(loginSource, /getPlatformSysConfigResult\(/)
  assert.match(sdkSource, /legacyApi\.GetOsClientByDomain[\s\S]{0,250}Auth:\s*false[\s\S]{0,100}IsApiEngine:\s*true/)
  assert.match(sdkSource, /legacyApi\.GetSysConfig[\s\S]{0,300}Auth:\s*false[\s\S]{0,100}IsApiEngine:\s*true/)
})

test('private file resolver has one fail-closed ApiEngine path', () => {
  const sdkSource = readFileSync(path.join(sourceRoot, 'utils', 'microi.v8.js'), 'utf8')
  assert.match(sdkSource, /apiEngineRun\('platform-private-file-url'/)
  assert.match(sdkSource, /if \(!hasPrivateFileAccessContext\(options\)\) return ''/)
  assert.doesNotMatch(sdkSource, /MallFileUrl/)
})

test('persisted private media binds to authoritative form metadata or stays explicitly fail closed', () => {
  const casebook = readFileSync(path.join(sourceRoot, 'pages', 'native', 'casebook.vue'), 'utf8')
  const feedback = readFileSync(path.join(sourceRoot, 'pages', 'native', 'task-feedback.vue'), 'utf8')
  const followUp = readFileSync(path.join(sourceRoot, 'pages', 'native', 'task-follow-up.vue'), 'utf8')
  const repair = readFileSync(path.join(sourceRoot, 'pages', 'native', 'repair.vue'), 'utf8')
  const merchant = readFileSync(path.join(sourceRoot, 'pages', 'native', 'merchant-apply.vue'), 'utf8')
  const profile = readFileSync(path.join(sourceRoot, 'pages', 'profile', 'index.vue'), 'utf8')

  assert.match(casebook, /findMenu\(\['案例册', '客户案例'\], CASE_CHILD_TABLE\)/)
  assert.match(casebook, /loadNativeFormDefinition\(CASE_CHILD_TABLE[\s\S]{0,500}fieldId:[\s\S]{0,120}sysMenuId:/)
  assert.match(casebook, /V8\.resolveFileUrl\(path, context\)\.catch\(\(\) => ''\)/)
  assert.doesNotMatch(casebook, /resolveFileUrl\(path\)\.catch\(\(\) => V8\.assetUrl/)

  assert.match(feedback, /:file-context="taskFileContext\('JieguoTP'\)"/)
  assert.match(feedback, /:file-context="taskFileContext\('ShipinSC'\)"/)
  assert.match(feedback, /loadNativeFormDefinition\(TASK_TABLE[\s\S]{0,700}formDataId:this\.taskId[\s\S]{0,160}fieldId:field\.Id[\s\S]{0,80}sysMenuId:menu\.Id/)
  assert.match(followUp, /:file-context="photoFileContext"/)
  assert.match(followUp, /formDataId: this\.id[\s\S]{0,100}fieldId: field\.Id[\s\S]{0,80}sysMenuId: menu\.Id/)

  assert.match(repair, /:file-context="uncommittedFileContext"/)
  assert.match(merchant, /:file-context="uncommittedFileContext"/)
  assert.match(repair, /UNCOMMITTED_PRIVATE_FILE_CONTEXT = Object\.freeze\(\{ private: true, failClosed: true \}\)/)
  assert.match(merchant, /UNCOMMITTED_PRIVATE_FILE_CONTEXT = Object\.freeze\(\{ private: true, failClosed: true \}\)/)

  assert.match(profile, /resourceKind: 'UserAvatar'[\s\S]{0,80}resourceId: this\.currentUser\.Id/)
})
