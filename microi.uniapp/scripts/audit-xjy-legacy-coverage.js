const fs = require('fs')
const path = require('path')
const { findWorkspaceRoot, findXjyDeliveryRoot } = require('./lib/workspace-paths')

const projectRoot = path.resolve(__dirname, '..')
const workspaceRoot = findWorkspaceRoot(projectRoot)
const deliveryRoot = findXjyDeliveryRoot(projectRoot, workspaceRoot)
const legacyRoot = path.join(deliveryRoot, 'xjy-mini-program-2026')
const factsPath = path.join(deliveryRoot, '集福鲤旧版原生能力事实清单.md')
const matrixPath = path.join(deliveryRoot, '集福鲤旧版小程序功能迁移矩阵.md')
const outputRoot = path.join(workspaceRoot, '.tmp', 'xjy-legacy-audit')

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function walkFiles(root, predicate, output = []) {
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, item.name)
    if (item.isDirectory()) walkFiles(fullPath, predicate, output)
    else if (!predicate || predicate(fullPath)) output.push(fullPath)
  }
  return output
}

function unique(values) {
  return [...new Set(values)]
}

function parseFactRows(markdown) {
  return markdown.split(/\r?\n/).map((line) => {
    const match = line.match(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|/)
    return match ? { index: Number(match[1]), route: match[2], line } : null
  }).filter(Boolean)
}

function parseMatrixRows(markdown) {
  return markdown.split(/\r?\n/).map((line) => {
    const match = line.match(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|/)
    return match ? { index: Number(match[1]), route: match[2], line } : null
  }).filter(Boolean)
}

function parseCurrentRoutes() {
  const manifest = JSON.parse(read(path.join(projectRoot, 'src/pages.json')))
  const routes = (manifest.pages || []).map((item) => item.path)
  for (const pack of manifest.subPackages || []) {
    for (const item of pack.pages || []) routes.push(`${pack.root}/${item.path}`)
  }
  return routes
}

function duplicates(values) {
  const counts = new Map()
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1))
  return [...counts.entries()].filter((item) => item[1] > 1).map((item) => item[0])
}

function main() {
  const facts = read(factsPath)
  const matrix = read(matrixPath)
  const factRows = parseFactRows(facts)
  const matrixRows = parseMatrixRows(matrix)
  const factRoutes = factRows.map((item) => item.route)
  const matrixRoutes = matrixRows.map((item) => item.route)
  const currentRoutes = parseCurrentRoutes()
  const currentSourceFiles = walkFiles(path.join(projectRoot, 'src'), (file) => /\.(vue|js|json)$/.test(file))
  const currentSource = currentSourceFiles.map(read).join('\n').toLowerCase()
  const businessSource = read(path.join(projectRoot, 'src/tenants/xjy/business.js'))
  const moduleBlock = (businessSource.match(/export const businessModules = \{([\s\S]*?)\n\}\n\nexport const quickActions/) || [])[1] || ''
  const moduleKeys = unique([...moduleBlock.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9_]*):/gm)].map((item) => item[1]))

  const oldSourceMissing = factRoutes.filter((route) => !fs.existsSync(path.join(legacyRoot, `${route}.vue`)))
  const matrixMissing = factRoutes.filter((route) => !matrixRoutes.includes(route))
  const matrixExtra = matrixRoutes.filter((route) => !factRoutes.includes(route))
  const currentSourceMissing = currentRoutes.filter((route) => !fs.existsSync(path.join(projectRoot, 'src', `${route}.vue`)))
  const targetRoutes = unique([...matrix.matchAll(/\/pages\/[A-Za-z0-9_?=&./-]+/g)].map((item) => item[0].split('?')[0].replace(/^\//, '')))
  const targetRouteMissing = targetRoutes.filter((route) => !currentRoutes.includes(route))
  const targetKeys = unique([...matrix.matchAll(/[?&]key=([A-Za-z0-9_]+)/g)].map((item) => item[1]))
  const targetKeyMissing = targetKeys.filter((key) => !moduleKeys.includes(key))
  const legacyTables = unique([...facts.matchAll(/\b(?:diy|sys)_[A-Za-z0-9_]+\b/gi)].map((item) => item[0])).sort((a, b) => a.localeCompare(b))
  const tableReferencesMissing = legacyTables.filter((table) => !currentSource.includes(table.toLowerCase()))

  const taskSource = [
    'src/utils/xjy-task.js', 'src/pages/task/list.vue', 'src/pages/task/detail.vue',
    'src/pages/task/device.vue', 'src/pages/task/consumable.vue', 'src/pages/task/add-devices.vue',
    'src/pages/task/scan.vue', 'src/pages/native/checkin.vue', 'src/pages/native/task-feedback.vue',
    'src/pages/native/task-follow-up.vue', 'src/pages/native/watermark-camera.vue'
  ].map((file) => read(path.join(projectRoot, file))).join('\n')
  const taskCapabilities = {
    claim: /shouhoudd_lingqu/.test(taskSource),
    assign: /shouhoudd_zhipai/.test(taskSource),
    workTime: /updateTask\(/.test(taskSource),
    checkin: /pages\/native\/checkin/.test(taskSource),
    perDevice: /pages\/task\/device/.test(taskSource),
    consumables: /pages\/task\/consumable/.test(taskSource),
    categorizedPhotos: /TASK_PHOTO_FIELDS|photo-category/.test(taskSource),
    video: /media-type="video"/.test(taskSource),
    draft: /writeTaskDraft/.test(taskSource),
    photoSync: /DevicePic/.test(taskSource) && /Synchronize_photos/.test(taskSource),
    addDevices: /add_shouhoudd_shebei/.test(taskSource),
    finish: /shouhoudd_finish/.test(taskSource),
    cancel: /shouhoudd_chexiao/.test(taskSource),
    acceptance: /task_acceptance/.test(taskSource),
    followUp: /task-follow-up/.test(taskSource),
    scan: /uni\.scanCode/.test(taskSource),
    watermark: /createCanvasContext\('watermarkCanvas'/.test(taskSource)
  }
  const taskCapabilitiesMissing = Object.keys(taskCapabilities).filter((key) => !taskCapabilities[key])
  const nativeControlMap = JSON.parse(read(path.join(projectRoot, 'src/config/mci-native-controls.json')))
  const placeholders = unique([...facts.matchAll(/请输入[^；|]+|请选择[^；|]+/g)].map((item) => item[0].trim()))

  const failures = {
    legacyRouteCount: factRoutes.length === 158 ? [] : [`expected 158, got ${factRoutes.length}`],
    matrixRouteCount: matrixRoutes.length === 158 ? [] : [`expected 158, got ${matrixRoutes.length}`],
    oldSourceMissing,
    matrixMissing,
    matrixExtra,
    factDuplicates: duplicates(factRoutes),
    matrixDuplicates: duplicates(matrixRoutes),
    currentSourceMissing,
    targetRouteMissing,
    targetKeyMissing,
    taskCapabilitiesMissing
  }
  const failedChecks = Object.entries(failures).filter(([, items]) => items.length).map(([name]) => name)
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      legacyRoutes: factRoutes.length,
      matrixRoutes: matrixRoutes.length,
      currentRoutes: currentRoutes.length,
      currentBusinessModules: moduleKeys.length,
      legacyTables: legacyTables.length,
      legacyPlaceholders: placeholders.length,
      nativeControlMappings: Array.isArray(nativeControlMap) ? nativeControlMap.length : Object.values(nativeControlMap).reduce((count, items) => count + (Array.isArray(items) ? items.length : 0), 0),
      taskCapabilities: Object.keys(taskCapabilities).length,
      failedChecks: failedChecks.length
    },
    failures,
    warnings: { tableReferencesMissing },
    taskCapabilities,
    currentRoutes,
    moduleKeys
  }
  fs.mkdirSync(outputRoot, { recursive: true })
  fs.writeFileSync(path.join(outputRoot, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.summary, null, 2))
  if (tableReferencesMissing.length) console.log(`WARN legacy tables without explicit source reference: ${tableReferencesMissing.join(', ')}`)
  if (failedChecks.length) {
    console.error(`Legacy coverage audit failed: ${failedChecks.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log('Legacy coverage audit passed.')
  }
}

main()
