const fs = require('fs')
const path = require('path')
const { loadProfile } = require('./lib/profile-manager.cjs')

const root = path.resolve(__dirname, '..')
const profileId = process.argv[2] || 'xjy'
const profile = loadProfile(profileId)
const output = profileId === 'xjy'
  ? path.join(root, 'dist/build/mp-weixin')
  : path.join(root, 'dist/build', `${profileId}-mp-weixin`)
const expectedPages = JSON.parse(fs.readFileSync(path.join(root, 'profiles', profileId, 'pages.json'), 'utf8'))
const expectedManifest = JSON.parse(fs.readFileSync(path.join(root, 'profiles', profileId, 'manifest.json'), 'utf8'))
const maxMainBytes = Math.floor(1.5 * 1024 * 1024)
const maxMediaBytes = 200000
const mediaExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico', '.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg', '.opus', '.amr'])
const failures = []

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

function relative(file) {
  return path.relative(output, file).replace(/\\/g, '/')
}

function normalizeRelative(file) {
  return path.relative(output, path.resolve(file)).replace(/\\/g, '/')
}

function resolveDependency(fromFile, request, extensions = ['']) {
  if (!request || /^(plugin|dynamicLib):\/\//.test(request)) return []
  const cleanRequest = String(request).split(/[?#]/)[0]
  const base = cleanRequest.startsWith('/')
    ? path.join(output, cleanRequest.replace(/^\/+/, ''))
    : path.resolve(path.dirname(fromFile), cleanRequest)
  const candidates = []
  for (const extension of extensions) {
    const candidate = `${base}${extension}`
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) candidates.push(normalizeRelative(candidate))
  }
  for (const extension of extensions) {
    const candidate = path.join(base, `index${extension}`)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) candidates.push(normalizeRelative(candidate))
  }
  return [...new Set(candidates)]
}

function parseDependencies(file) {
  const extension = path.extname(file).toLowerCase()
  const content = fs.readFileSync(file, 'utf8')
  const dependencies = new Set()
  const add = (request, extensions) => resolveDependency(file, request, extensions).forEach((item) => dependencies.add(item))

  if (extension === '.js') {
    const requirePattern = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g
    let match
    while ((match = requirePattern.exec(content))) add(match[1], ['', '.js', '.json'])
  } else if (extension === '.json') {
    let json
    try { json = JSON.parse(content) } catch (error) { return dependencies }
    Object.values(json.usingComponents || {}).forEach((request) => {
      resolveDependency(file, request, ['.js', '.json', '.wxml', '.wxss']).forEach((item) => dependencies.add(item))
    })
  } else if (extension === '.wxml') {
    const referencePattern = /<(?:import|include|wxs)\b[^>]*\bsrc=['"]([^'"]+)['"][^>]*>/g
    let match
    while ((match = referencePattern.exec(content))) add(match[1], ['', '.wxml', '.wxs'])
  } else if (extension === '.wxss') {
    const importPattern = /@import\s+['"]([^'"]+)['"]/g
    let match
    while ((match = importPattern.exec(content))) add(match[1], ['', '.wxss'])
  }
  return dependencies
}

function buildReachableFiles(appConfig, files) {
  const fileMap = new Map(files.map((file) => [relative(file), file]))
  const roots = new Set(['app.js', 'app.json', 'app.wxml', 'app.wxss'])
  const addPageRoots = (pagePath) => ['.js', '.json', '.wxml', '.wxss'].forEach((extension) => roots.add(`${pagePath}${extension}`))
  ;(appConfig.pages || []).forEach(addPageRoots)
  ;(appConfig.subPackages || appConfig.subpackages || []).forEach((pkg) => {
    const root = String(pkg.root || '').replace(/^\/+|\/+$/g, '')
    ;(pkg.pages || []).forEach((page) => addPageRoots(`${root}/${typeof page === 'string' ? page : page.path}`))
  })
  if (fs.existsSync(path.join(output, 'custom-tab-bar'))) {
    files.filter((file) => relative(file).startsWith('custom-tab-bar/')).forEach((file) => roots.add(relative(file)))
  }
  if (appConfig.workers) {
    const workerRoot = String(appConfig.workers).replace(/^\/+|\/+$/g, '')
    files.filter((file) => relative(file).startsWith(`${workerRoot}/`)).forEach((file) => roots.add(relative(file)))
  }

  const reachable = new Set()
  const queue = [...roots].filter((item) => fileMap.has(item))
  while (queue.length) {
    const current = queue.shift()
    if (reachable.has(current)) continue
    reachable.add(current)
    const absolute = fileMap.get(current)
    if (!absolute || !['.js', '.json', '.wxml', '.wxss'].includes(path.extname(absolute).toLowerCase())) continue
    parseDependencies(absolute).forEach((dependency) => {
      if (fileMap.has(dependency) && !reachable.has(dependency)) queue.push(dependency)
    })
  }
  return reachable
}

if (!fs.existsSync(path.join(output, 'app.json'))) {
  console.error('WeChat quality check failed: run npm run build:mp-weixin first.')
  process.exit(1)
}

const app = JSON.parse(fs.readFileSync(path.join(output, 'app.json'), 'utf8'))
const project = JSON.parse(fs.readFileSync(path.join(output, 'project.config.json'), 'utf8'))
const privateProjectFile = path.join(output, 'project.private.config.json')
const subPackages = app.subPackages || app.subpackages || []
const subRoots = subPackages.map((item) => String(item.root || '').replace(/^\/+|\/+$/g, '')).filter(Boolean)
const allFiles = walk(output)
const mainFiles = allFiles.filter((file) => {
  const rel = relative(file)
  return !subRoots.some((rootPath) => rel === rootPath || rel.startsWith(`${rootPath}/`))
})
const mainBytes = mainFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0)

if (app.lazyCodeLoading !== 'requiredComponents') {
  failures.push('app.json must enable lazyCodeLoading=requiredComponents')
}
if (project.setting?.ignoreDevUnusedFiles !== false || project.setting?.compileHotReLoad !== false) {
  failures.push('project.config.json must use full module compilation for production output')
}
if (fs.existsSync(privateProjectFile)) failures.push('project.private.config.json is a local IDE file and must not be included in the production output')
if (project.projectname !== expectedManifest.name) {
  failures.push(`project.config.json must use the ${expectedManifest.name} project name`)
}
if (subRoots.length !== (expectedPages.subPackages || []).length) {
  failures.push(`expected ${(expectedPages.subPackages || []).length} subpackages, found ${subRoots.length}`)
}
if (mainBytes >= maxMainBytes) {
  failures.push(`main package ${(mainBytes / 1024).toFixed(1)}KB exceeds 1.5MB`)
}

const mediaFiles = allFiles.filter((file) => mediaExtensions.has(path.extname(file).toLowerCase()))
const mediaBytes = mediaFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0)
if (mediaBytes > maxMediaBytes) {
  failures.push(`image/audio resources total ${(mediaBytes / 1000).toFixed(1)}KB exceeds 200KB`)
}

const reachableFiles = buildReachableFiles(app, allFiles)
const unreachableCodeFiles = allFiles
  .map(relative)
  .filter((file) => path.extname(file).toLowerCase() === '.js' && !reachableFiles.has(file))
  .sort()
if (unreachableCodeFiles.length) {
  failures.push(`unused or dependency-free code files: ${unreachableCodeFiles.join(', ')}`)
}

if (failures.length) {
  console.error('\nWeChat quality check failed:\n')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

const packageSizes = subRoots.map((rootPath) => {
  const bytes = allFiles.filter((file) => relative(file).startsWith(`${rootPath}/`)).reduce((sum, file) => sum + fs.statSync(file).size, 0)
  return `${rootPath}=${(bytes / 1024).toFixed(1)}KB`
})
console.log(`WeChat quality check passed (${profileId}): main=${(mainBytes / 1024).toFixed(1)}KB; ${packageSizes.join('; ')}; media=${(mediaBytes / 1000).toFixed(1)}KB; reachable=${reachableFiles.size}/${allFiles.length}.`)
