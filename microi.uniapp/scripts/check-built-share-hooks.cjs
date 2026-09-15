const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pagesJson = JSON.parse(fs.readFileSync(path.join(root, 'src/pages.json'), 'utf8'))
const routes = [
  ...pagesJson.pages.map((page) => page.path),
  ...pagesJson.subPackages.flatMap((pkg) => pkg.pages.map((page) => `${pkg.root}/${page.path}`))
]
const outputMode = process.argv[2] === 'dev' ? 'dev' : 'build'
const buildRoot = path.join(root, `dist/${outputMode}/mp-weixin`)

for (const route of routes) {
  const pageFile = path.join(buildRoot, `${route}.js`)
  if (!fs.existsSync(pageFile)) throw new Error(`Missing compiled page: ${route}`)
  const content = fs.readFileSync(pageFile, 'utf8')
  if (!content.includes('onShareAppMessage(')) throw new Error(`Friend callback omitted from compiled page: ${route}`)
  if (!content.includes('onShareTimeline(')) throw new Error(`Timeline callback omitted from compiled page: ${route}`)
}

process.stdout.write(`Compiled ${outputMode} share hooks present in ${routes.length}/${routes.length} pages.\n`)
