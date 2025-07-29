// 插件导入器
// 用于处理插件的动态导入，确保 Webpack 能正确打包

// 插件导入映射表
const pluginImports = {
  'test-plugin': () => import('@/plugins/test-plugin/index.js'),
  'demo-plugin': () => import('@/plugins/demo-plugin/index.js')
}

/**
 * 动态导入插件模块
 * @param {string} pluginName 插件名称
 * @returns {Promise<Object>} 插件模块
 */
export async function importPlugin(pluginName) {
  const importFn = pluginImports[pluginName]

  if (!importFn) {
    throw new Error(`未找到插件导入函数: ${pluginName}`)
  }

  try {
    const pluginModule = await importFn()
    console.log(`插件模块导入成功: ${pluginName}`)
    return pluginModule
  } catch (error) {
    console.error(`插件模块导入失败 ${pluginName}:`, error)
    throw new Error(`插件模块导入失败: ${pluginName}`)
  }
}

/**
 * 检查插件是否支持导入
 * @param {string} pluginName 插件名称
 * @returns {boolean} 是否支持导入
 */
export function isPluginImportable(pluginName) {
  return pluginName in pluginImports
}

/**
 * 获取所有可导入的插件列表
 * @returns {Array<string>} 插件名称列表
 */
export function getImportablePlugins() {
  return Object.keys(pluginImports)
}

/**
 * 注册新的插件导入函数
 * @param {string} pluginName 插件名称
 * @param {Function} importFn 导入函数
 */
export function registerPluginImport(pluginName, importFn) {
  pluginImports[pluginName] = importFn
  console.log(`插件导入函数已注册: ${pluginName}`)
}