const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { activateProfile, getProfileArtifacts, projectRoot } = require('./lib/profile-manager.cjs')

const profileId = 'microi'
const artifacts = getProfileArtifacts(profileId)
const overrides = artifacts.filter(({ target }) => {
  const relative = path.relative(projectRoot, target)
  return relative.startsWith(`src${path.sep}`) && ![
    'src/pages.json', 'src/manifest.json', 'src/Info.plist',
    'src/AndroidManifest.xml', 'src/androidPrivacy.json'
  ].includes(relative) && !relative.startsWith(`src${path.sep}generated${path.sep}`)
})
assert(overrides.length > 0, 'Microi Profile 缺少源码差异层')

const original = artifacts.map(({ target }) => ({
  target,
  existed: fs.existsSync(target),
  content: fs.existsSync(target) ? fs.readFileSync(target) : null
}))
const restore = activateProfile(profileId)
try {
  for (const artifact of artifacts) {
    if (artifact.content === null) {
      assert(!fs.existsSync(artifact.target), `${artifact.target} 应被临时移除`)
    } else {
      assert(fs.readFileSync(artifact.target).equals(artifact.content), `${artifact.target} 未激活`)
    }
  }
  assert(
    fs.readFileSync(path.join(projectRoot, 'src', 'generated', 'active-profile.js'), 'utf8').includes('"profileId": "microi"'),
    'Microi Profile 未激活'
  )
} finally {
  restore()
}
for (const item of original) {
  assert.equal(fs.existsSync(item.target), item.existed, `${item.target} 未恢复存在状态`)
  if (item.existed) assert(fs.readFileSync(item.target).equals(item.content), `${item.target} 未恢复原始内容`)
}
console.log(`[profile] PASS: ${overrides.length} Microi 源码差异临时激活并完整恢复`)
