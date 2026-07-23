const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync, spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const oldIconRoot = path.resolve(root, '../xjy-mini-program-2026/static/img/tabbar')
const outputRoot = path.join(root, 'src', 'static')
const size = 96
const colors = {
  inactive: '#80909A',
  active: '#E54625'
}

const icons = {
  workspace: { source: 'home.svg' },
  mall: { source: 'shop.svg' },
  news: { source: 'news.svg' },
  profile: { source: 'my.svg' },
  message: {
    paths: `
      <path d="M160 160h704c70.7 0 128 57.3 128 128v352c0 70.7-57.3 128-128 128H500L278 920c-22.8 15.6-53.8-.8-53.8-28.4V768H160c-70.7 0-128-57.3-128-128V288c0-70.7 57.3-128 128-128z"/>
      <circle cx="304" cy="464" r="58"/>
      <circle cx="512" cy="464" r="58"/>
      <circle cx="720" cy="464" r="58"/>
    `
  }
}

function findBrowser() {
  const candidates = [
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  for (const command of ['msedge', 'chrome']) {
    const result = spawnSync('where.exe', [command], { encoding: 'utf8' })
    if (result.status === 0) {
      const candidate = result.stdout.split(/\r?\n/).find(Boolean)
      if (candidate && fs.existsSync(candidate)) return candidate
    }
  }
  throw new Error('Edge or Chrome is required to build tabbar icons.')
}

function extractPaths(fileName) {
  const source = fs.readFileSync(path.join(oldIconRoot, fileName), 'utf8')
  return (source.match(/<(?:path|circle|rect|polygon)\b[^>]*\/?>/g) || [])
    .map((tag) => tag.endsWith('/>') ? tag : tag.replace(/>$/, '/>'))
    .join('\n')
}

function render(browser, name, paths, color, outputPath) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xjy-tabbar-'))
  const htmlPath = path.join(tempRoot, `${name}.html`)
  const normalized = paths
    .replace(/\sfill="[^"]*"/g, '')
    .replace(/<(path|circle|rect|polygon)\b/g, `<$1 fill="${color}"`)
  const html = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{width:${size}px;height:${size}px;margin:0;overflow:hidden;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>
</head><body><svg xmlns="http://www.w3.org/2000/svg" viewBox="-112 -112 1248 1248">${normalized}</svg></body></html>`
  fs.writeFileSync(htmlPath, html)
  execFileSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--default-background-color=00000000',
    `--window-size=${size},${size}`,
    `--screenshot=${outputPath}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`
  ], { stdio: 'ignore' })
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

function main() {
  const browser = findBrowser()
  fs.mkdirSync(outputRoot, { recursive: true })
  Object.entries(icons).forEach(([name, config]) => {
    const paths = config.paths || extractPaths(config.source)
    render(browser, name, paths, colors.inactive, path.join(outputRoot, `tab-${name}.png`))
    render(browser, name, paths, colors.active, path.join(outputRoot, `tab-${name}-active.png`))
  })
  console.log('集福鲤底栏图标已生成。')
}

main()
