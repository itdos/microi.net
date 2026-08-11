import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(packageRoot)
const appManifestPath = resolve(sourceRoot, '.microi-micro-app.json')

if (!existsSync(appManifestPath)) {
  throw new Error(`未找到 AI 平台治理微应用源码：${appManifestPath}`)
}

const appManifest = JSON.parse(readFileSync(appManifestPath, 'utf8'))
if (appManifest.appKey !== 'ai-platform-studio') {
  throw new Error(`微应用 AppKey 不匹配：${appManifest.appKey || '空'}`)
}
if (appManifest.osClient !== 'iTdos' || new URL(appManifest.apiBaseUrl).hostname !== 'api.itdos.com') {
  throw new Error('微应用源码不属于 api.itdos.com 的 iTdos 租户，已停止构建')
}

const npmCliPath = process.env.npm_execpath
if (!npmCliPath || !existsSync(npmCliPath)) {
  throw new Error('当前进程不是由 npm 启动，无法安全定位 npm CLI')
}

console.log(`使用 AI应用 唯一源码目录构建：${sourceRoot}`)
const result = spawnSync(process.execPath, [npmCliPath, 'run', 'build:ui'], {
  cwd: sourceRoot,
  stdio: 'inherit',
  shell: false
})

if (result.error) {
  throw result.error
}
if (result.status !== 0) {
  process.exitCode = result.status ?? 1
}
