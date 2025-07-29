class PluginDiscovery {
  constructor() {
    this.plugins = new Map()
    this.pluginConfigs = new Map()
  }

  // 扫描插件目录
  async scanPlugins() {
    try {
      // 在浏览器环境中，我们需要手动注册插件配置
      // 这里返回已注册的插件配置
      const plugins = Array.from(this.pluginConfigs.values())

      // 更新插件映射
      this.plugins.clear()
      plugins.forEach(plugin => {
        this.plugins.set(plugin.name, plugin)
      })

      return plugins
    } catch (error) {
      console.error('扫描插件失败:', error)
      return []
    }
  }

  // 注册插件配置
  registerPluginConfig(pluginName, config) {
    // 验证必要的配置字段
    if (!config.name) {
      config.name = pluginName
    }

    // 设置默认值
    config.displayName = config.displayName || config.name
    config.description = config.description || '暂无描述'
    config.version = config.version || '1.0.0'
    config.author = config.author || 'Unknown'
    config.features = config.features || []
    config.permissions = config.permissions || []
    config.entry = config.entry || 'index.js'
    config.entryExists = true // 在浏览器环境中假设入口文件存在

    this.pluginConfigs.set(pluginName, config)
    this.plugins.set(pluginName, config)

    console.log(`插件配置已注册: ${pluginName}`)
  }

  // 获取插件配置
  getPlugin(name) {
    return this.plugins.get(name)
  }

  // 获取所有插件配置
  getAllPlugins() {
    return Array.from(this.plugins.values())
  }

  // 获取指定插件配置
  getPlugin(name) {
    return this.plugins.get(name)
  }

  // 检查插件是否存在
  hasPlugin(name) {
    return this.plugins.has(name)
  }

  // 重新扫描插件
  async refresh() {
    this.plugins.clear()
    return await this.scanPlugins()
  }
}

export default new PluginDiscovery()
