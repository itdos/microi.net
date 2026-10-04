const path = require('node:path')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const assert = require('node:assert/strict')
const { activateProfile, projectRoot } = require('./lib/profile-manager.cjs')

const microiProfile = require(path.join(projectRoot, 'profiles', 'microi', 'profile.cjs'))
assert.equal(microiProfile.tenantModule, 'standard')
assert.equal(microiProfile.config.features.runtimeEndpointSwitch, true)
assert.equal(microiProfile.config.apiBase.startsWith('https://'), true)
assert(!/wxcrm|jima\.pro/i.test(JSON.stringify(microiProfile.config)), '通用 App 不得默认绑定首个验证租户')

function checkOverrides(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      checkOverrides(file)
    } else if (entry.isFile() && /\.(?:js|mjs|vue|scss|css|json)$/.test(entry.name)) {
      const source = fs.readFileSync(file, 'utf8')
      assert(!/wxcrm|api\.jima\.pro|集福鲤|diy_genjinjl|Diy_Kehu/i.test(source), `${file} 包含租户专属实现`)
      assert(!/\b(?:eval|Function)\s*\(/.test(source), `${file} 包含任意前端脚本执行`)
    }
  }
}
checkOverrides(path.join(projectRoot, 'profiles', 'microi', 'overrides', 'src'))

const tests = [
  'test-ai-consent.mjs',
  'test-app-native-dock.mjs',
  'test-auth-entry.mjs',
  'test-home-todo.mjs',
  'test-home-workbench.mjs',
  'test-message-baseline.mjs',
  'test-message-center.mjs',
  'test-mobile-theme.mjs',
  'test-module-engine-key.mjs',
  'test-module-keyword-filter.mjs',
  'test-page-engine.mjs',
  'test-platform-sys-config-route.mjs',
  'test-user-facing-display.mjs',
  'test-user-session-route.mjs'
]

const restore = activateProfile('microi')
let result
try {
  const architecture = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'check-architecture.mjs')], {
    cwd: projectRoot,
    env: { ...process.env, MICROI_PROFILE: 'microi' },
    stdio: 'inherit'
  })
  if (architecture.error) throw architecture.error
  result = architecture.status === 0
    ? spawnSync(process.execPath, ['--test', ...tests.map((file) => path.join(projectRoot, 'scripts', file))], {
      cwd: projectRoot,
      env: { ...process.env, MICROI_PROFILE: 'microi' },
      stdio: 'inherit'
    })
    : architecture
} finally {
  restore()
}
if (result.error) throw result.error
process.exit(result.status === null ? 1 : result.status)
