export function resolveModuleEngineKey(moduleConfig = {}) {
  return String(
    moduleConfig.moduleEngineKey ||
    moduleConfig.ModuleEngineKey ||
    moduleConfig.key ||
    moduleConfig.table ||
    ''
  ).trim()
}

export default { resolveModuleEngineKey }
