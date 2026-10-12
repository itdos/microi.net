const fs = require('fs')
const path = require('path')
const { loadProfile } = require('./lib/profile-manager.cjs')

const profileId = process.argv[2] || 'xjy'
loadProfile(profileId)
const output = path.resolve(__dirname, '../dist/build', profileId === 'xjy' ? 'mp-weixin' : `${profileId}-mp-weixin`)
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../profiles', profileId, 'manifest.json'), 'utf8'))
const projectFile = path.join(output, 'project.config.json')
const privateFile = path.join(output, 'project.private.config.json')

function readJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

if (!fs.existsSync(projectFile)) {
  console.error('WeChat build finalization failed: project.config.json was not generated.')
  process.exit(1)
}

const project = readJson(projectFile)
project.projectname = manifest.name
project.setting = {
  ...(project.setting || {}),
  ignoreDevUnusedFiles: false,
  compileHotReLoad: false
}
writeJson(projectFile, project)

if (fs.existsSync(privateFile)) fs.rmSync(privateFile)

// 这些资源仅由 App 原生清单引用；uni-app 会复制整个 static，不能带进小程序主包。
const appOnlyPaths = ['static/app-icons', 'static/privacy.html', 'static/service.html']
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}
const runtimeFiles = walk(output).filter((file) => /\.(?:js|json|wxml|wxss)$/.test(file))
for (const relative of appOnlyPaths) {
  const target = path.resolve(output, relative)
  if (!target.startsWith(`${output}${path.sep}`)) throw new Error(`Unsafe output asset path: ${relative}`)
  const reference = runtimeFiles.find((file) => fs.readFileSync(file, 'utf8').includes(relative))
  if (reference) throw new Error(`App-only resource is referenced by mini-program runtime: ${path.relative(output, reference)} -> ${relative}`)
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true })
}

// 标准 Profile 会将跨租户 helper 摇树为空模块；只删除无逻辑且无运行时引用的输出。
if (profileId !== 'xjy') {
  const emptyTenantModules = ['task-assignee-query', 'task-device-reference', 'task-responsibility']
  for (const name of emptyTenantModules) {
    const target = path.resolve(output, 'tenants/xjy', `${name}.js`)
    if (!target.startsWith(`${output}${path.sep}`)) throw new Error(`Unsafe output module path: ${name}`)
    if (!fs.existsSync(target)) continue
    if (!/^\s*['"]use strict['"];?\s*$/.test(fs.readFileSync(target, 'utf8'))) {
      throw new Error(`Tenant module is not empty in ${profileId} output: ${name}`)
    }
    const reference = runtimeFiles.find((file) => file !== target && fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(name))
    if (reference) throw new Error(`Empty tenant module is referenced: ${path.relative(output, reference)} -> ${name}`)
    fs.rmSync(target)
  }
}

console.log(`WeChat build finalized (${profileId}): full module compilation enabled; private IDE settings and App-only resources excluded.`)
