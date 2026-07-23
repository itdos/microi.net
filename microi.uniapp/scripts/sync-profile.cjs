const fs = require('fs')
const path = require('path')
const { getProfileArtifacts, loadProfile } = require('./lib/profile-manager.cjs')

const profileId = process.argv[2] || 'xjy'
const profile = loadProfile(profileId)
const artifacts = getProfileArtifacts(profileId)

artifacts.forEach(({ target, content }) => {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
})

console.log(`[profile] 已同步 ${profile.label} (${profileId}) 到 src/pages.json、manifest.json 和 generated 桥接。`)
console.log('[profile] 仅提交默认 xjy 生成物；其他 Profile 的生成物不应进入合并请求。')
