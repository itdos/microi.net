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

test('legacy monitor and SysLog controllers are deleted in favor of Managed ApiEngines', () => {
  const apiRoot = path.join(workspaceRoot, 'Microi.Server/Microi.net.Api')
  assert.equal(fs.existsSync(path.join(apiRoot, 'Controllers/SystemMonitorController.cs')), false)
  assert.equal(fs.existsSync(path.join(apiRoot, 'Controllers/SysLogController.cs')), false)

  const catalog = read(path.join(apiRoot, 'api-ownership-catalog.json'))
  assert.doesNotMatch(catalog, /SystemMonitorController/)

  const packageText = read(path.join(workspaceRoot, 'Microi.Server/Microi.Upgrade/Resource/app.microi.saas-engine.json'))
  assert.match(packageText, /platform-client-log/)
})
