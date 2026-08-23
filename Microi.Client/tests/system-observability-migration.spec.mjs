import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.resolve(clientRoot, '..')
const read = file => fs.readFileSync(file, 'utf8')

test('legacy custom log and monitor pages are removed in favor of the built-in microservice', () => {
  assert.equal(fs.existsSync(path.join(clientRoot, 'src/views/system/sys-log.vue')), false)
  assert.equal(fs.existsSync(path.join(clientRoot, 'src/views/system/sys-monitor.vue')), false)

  const permission = read(path.join(clientRoot, 'src/pinia/modules/permission.js'))
  assert.doesNotMatch(permission, /\/itdos\/system\/sys-(?:log|monitor)/)

  const aiEngine = read(path.join(clientRoot, 'src/views/ai-engine/index.vue'))
  assert.match(aiEngine, /\/apiengine\/mci-system-observability-query/)
  assert.doesNotMatch(aiEngine, /\/api\/systemmonitor\//i)
})

test('legacy monitor controller is deleted and SysLog only keeps the compatibility writer', () => {
  const apiRoot = path.join(workspaceRoot, 'Microi.Server/Microi.net.Api')
  assert.equal(fs.existsSync(path.join(apiRoot, 'Controllers/SystemMonitorController.cs')), false)

  const sysLog = read(path.join(apiRoot, 'Controllers/SysLogController.cs'))
  assert.match(sysLog, /AddSysLog\s*\(/)
  for (const removed of ['GetSysLog', 'GetLogTypes', 'GetSysLogStats', 'GetQueueHealth', 'GetDockerLogs']) {
    assert.doesNotMatch(sysLog, new RegExp(`${removed}\\s*\\(`))
  }

  const catalog = read(path.join(apiRoot, 'api-ownership-catalog.json'))
  assert.doesNotMatch(catalog, /SystemMonitorController/)
})
