const fs = require('fs')
const path = require('path')

const output = path.resolve(__dirname, '../dist/build/mp-weixin')
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
project.projectname = '集福鲤'
project.setting = {
  ...(project.setting || {}),
  ignoreDevUnusedFiles: false,
  compileHotReLoad: false
}
writeJson(projectFile, project)

if (fs.existsSync(privateFile)) fs.rmSync(privateFile)

console.log('WeChat build finalized: full module compilation is enabled and private IDE settings are excluded.')
