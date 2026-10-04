const fs = require('fs')
const path = require('path')

function findWorkspaceRoot(startPath) {
  let current = path.resolve(startPath)

  while (true) {
    const hasClient = fs.existsSync(path.join(current, 'Microi.Client'))
    const hasUi = fs.existsSync(path.join(current, 'Microi.UI'))
    if (hasClient && hasUi) return current

    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  throw new Error(`Microi workspace root not found from ${startPath}`)
}

function findXjyDeliveryRoot(projectRoot, workspaceRoot = findWorkspaceRoot(projectRoot)) {
  const candidates = [
    path.resolve(projectRoot, '..'),
    path.join(workspaceRoot, 'AI-Project', '新纪源')
  ]

  const matched = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'xjy-mini-program-2026'))
  )

  if (!matched) {
    throw new Error(`Jifuli delivery root not found from ${projectRoot}`)
  }

  return matched
}

function findSyncedXjyEngine(projectRoot, apiEngineKey, workspaceRoot = findWorkspaceRoot(projectRoot)) {
  if (typeof apiEngineKey !== 'string' || !apiEngineKey.trim() || /[\\/\0]/.test(apiEngineKey)) {
    throw new Error('A non-empty ApiEngineKey without path separators is required')
  }

  const engineRoot = path.join(workspaceRoot, 'Microi-V8-Engine', '集福鲤平台 (api.jifulii.com)', 'xjy.Product.Internal', '接口引擎')
  if (!fs.existsSync(engineRoot)) {
    throw new Error(`Synced xjy API engines not found: ${engineRoot}; run the official microi pull api first`)
  }

  // 分类和显示名称由服务端同步决定；测试只绑定精确 Key，重复快照必须显式报错。
  const suffix = `(${apiEngineKey}).js`
  const matches = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (entry.isFile() && entry.name.endsWith(suffix)) matches.push(entryPath)
    }
  }
  visit(engineRoot)
  if (matches.length !== 1) {
    const detail = matches.map((file) => path.relative(engineRoot, file)).sort().join(', ')
    throw new Error(matches.length
      ? `Ambiguous synced xjy ApiEngineKey ${apiEngineKey}: ${detail}`
      : `Synced xjy ApiEngineKey ${apiEngineKey} not found under ${engineRoot}; run the official microi pull api first`)
  }
  return matches[0]
}

module.exports = {
  findWorkspaceRoot,
  findXjyDeliveryRoot,
  findSyncedXjyEngine
}
