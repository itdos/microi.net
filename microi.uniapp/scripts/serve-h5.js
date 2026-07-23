const http = require('http')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../dist/build/h5')
const portArgIndex = process.argv.indexOf('--port')
const port = Number(portArgIndex >= 0 ? process.argv[portArgIndex + 1] : process.env.PORT || 5198)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp'
}

if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('H5 build not found. Run npm run build:h5 first.')
}

function resolveFile(urlPath) {
  const requestPath = decodeURIComponent(String(urlPath || '/').split('?')[0])
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
  const candidate = path.resolve(root, relativePath)
  if (!candidate.startsWith(root)) return null
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  return path.join(root, 'index.html')
}

const server = http.createServer((request, response) => {
  const filePath = resolveFile(request.url)
  if (!filePath) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
  })
  fs.createReadStream(filePath).pipe(response)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`XJY H5 preview: http://localhost:${port}/#/pages/workspace/index`)
})
