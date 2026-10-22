const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { activateProfileArtifacts, getProfileArtifacts, projectRoot } = require('./lib/profile-manager.cjs')
const { findWorkspaceRoot } = require('./lib/workspace-paths.js')

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
  content: fs.existsSync(target) ? fs.readFileSync(target) : null,
  mtimeMs: fs.existsSync(target) ? fs.statSync(target).mtimeMs : null
}))
const temporaryRoot = path.join(findWorkspaceRoot(projectRoot), '.tmp')
fs.mkdirSync(temporaryRoot, { recursive: true })
const fixtureRoot = fs.mkdtempSync(path.join(temporaryRoot, 'profile-overrides-'))
const fixtureTarget = target => {
  const relative = path.relative(projectRoot, target)
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), '夹具必须来自当前项目')
  return path.join(fixtureRoot, relative)
}
const fixtureArtifacts = artifacts.map(item => ({ ...item, target: fixtureTarget(item.target) }))
let restore = null
try {
  // 只复制待测文件的旧字节，不复制工作区、依赖或编译树；真实 src 连 mtime 都不能改变。
  for (const item of original.filter(item => item.existed)) {
    const target = fixtureTarget(item.target)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, item.content)
  }
  restore = activateProfileArtifacts(fixtureArtifacts)
  for (const artifact of fixtureArtifacts) {
    if (artifact.content === null) {
      assert(!fs.existsSync(artifact.target), `${artifact.target} 应被临时移除`)
    } else {
      assert(fs.readFileSync(artifact.target).equals(artifact.content), `${artifact.target} 未激活`)
    }
  }
  assert(
    fs.readFileSync(path.join(fixtureRoot, 'src', 'generated', 'active-profile.js'), 'utf8').includes('"profileId": "microi"'),
    'Microi Profile 未激活'
  )
  restore()
  restore = null
  for (const item of original) {
    const target = fixtureTarget(item.target)
    assert.equal(fs.existsSync(target), item.existed, `${target} 未恢复存在状态`)
    if (item.existed) assert(fs.readFileSync(target).equals(item.content), `${target} 未恢复原始内容`)
  }
  // 失败路径同样应恢复夹具；此错误不会写到真实开发源文件。
  const blockedParent = path.join(fixtureRoot, 'blocked-parent')
  fs.writeFileSync(blockedParent, '普通文件不能作为目录')
  assert.throws(() => activateProfileArtifacts([
    fixtureArtifacts.find(item => item.content !== null),
    { target: path.join(blockedParent, 'child.txt'), content: Buffer.from('拒绝写入目录') }
  ]))
  for (const item of original) {
    const target = fixtureTarget(item.target)
    assert.equal(fs.existsSync(target), item.existed, `${target} 失败后存在状态未恢复`)
    if (item.existed) assert(fs.readFileSync(target).equals(item.content), `${target} 失败后字节未恢复`)
    assert.equal(fs.existsSync(item.target), item.existed, `${item.target} 真实源码存在状态改变`)
    if (item.existed) {
      assert(fs.readFileSync(item.target).equals(item.content), `${item.target} 真实源码被修改`)
      assert.equal(fs.statSync(item.target).mtimeMs, item.mtimeMs, `${item.target} 触发了真实源码监听`)
    }
  }
  console.log(`[profile] PASS: ${overrides.length} 项差异在独占夹具激活/恢复；真实源码内容与 mtime 均未改变`)
} finally {
  try { if (restore) restore() } finally {
    const relative = path.relative(temporaryRoot, fs.realpathSync(fixtureRoot))
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), '拒绝清理夹具外目录')
    const verify = directory => {
      assert(!fs.lstatSync(directory).isSymbolicLink(), '拒绝跟随夹具符号链接')
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name)
        assert(!entry.isSymbolicLink(), '拒绝跟随夹具符号链接')
        if (entry.isDirectory()) verify(target)
      }
    }
    verify(fixtureRoot)
    if (process.platform === 'win32') {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        'Remove-Item -LiteralPath $env:MICROI_PROFILE_TEST_CLEANUP -Recurse -ErrorAction Stop'],
      { env: { ...process.env, MICROI_PROFILE_TEST_CLEANUP: fixtureRoot }, stdio: 'pipe' })
    } else fs.rmSync(fixtureRoot, { recursive: true })
    assert(!fs.existsSync(fixtureRoot), '夹具未回收')
  }
}
