const path = require('path')
const { spawnSync } = require('child_process')
const { activateProfile, loadProfile, projectRoot } = require('./lib/profile-manager.cjs')

const [, , profileId = 'xjy', action = 'build', platform = 'mp-weixin'] = process.argv
const profile = loadProfile(profileId)
const restore = activateProfile(profileId)
const uniBin = require.resolve('@dcloudio/vite-plugin-uni/bin/uni.js')
const args = action === 'dev' ? ['-p', platform] : ['build', '-p', platform]
const env = {
  ...process.env,
  MICROI_PROFILE: profileId
}

if (profileId !== 'xjy') {
  env.UNI_OUTPUT_DIR = path.join(projectRoot, 'dist', action, `${profileId}-${platform}`)
}

let exitCode = 1
try {
  console.log(`[profile] ${profile.label} (${profileId}) -> ${action}:${platform}`)
  const result = spawnSync(process.execPath, [uniBin, ...args], {
    cwd: projectRoot,
    env,
    stdio: 'inherit'
  })
  exitCode = typeof result.status === 'number' ? result.status : 1
  if (result.error) throw result.error

  if (exitCode === 0 && action === 'build' && platform === 'mp-weixin' && profileId === 'xjy') {
    const finalize = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'finalize-wechat-build.js')], {
      cwd: projectRoot,
      env,
      stdio: 'inherit'
    })
    exitCode = typeof finalize.status === 'number' ? finalize.status : 1
    if (finalize.error) throw finalize.error
  }
} finally {
  restore()
}

process.exit(exitCode)
