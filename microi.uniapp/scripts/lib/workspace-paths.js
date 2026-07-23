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

module.exports = {
  findWorkspaceRoot,
  findXjyDeliveryRoot
}
