class PluginConfigManager {
  constructor() {
    this.configKey = 'microi_plugin_config'
    this.defaultConfig = {
      enabledPlugins: [],
      pluginSettings: {},
      autoUpdate: true,
      pluginRegistry: 'https://your-registry.com/plugins.json'
    }
  }

  // 获取插件配置
  getConfig() {
    try {
      const config = localStorage.getItem(this.configKey)
      return config ? { ...this.defaultConfig, ...JSON.parse(config) } : this.defaultConfig
    } catch (error) {
      console.error('读取插件配置失败:', error)
      return this.defaultConfig
    }
  }

  // 保存插件配置
  saveConfig(config) {
    try {
      localStorage.setItem(this.configKey, JSON.stringify(config))
      console.log('插件配置保存成功')
    } catch (error) {
      console.error('保存插件配置失败:', error)
      throw error
    }
  }

  // 更新插件配置
  updateConfig(updates) {
    const config = this.getConfig()
    const newConfig = { ...config, ...updates }
    this.saveConfig(newConfig)
    return newConfig
  }

  // 启用插件
  enablePlugin(pluginName) {
    const config = this.getConfig()
    if (!config.enabledPlugins.includes(pluginName)) {
      config.enabledPlugins.push(pluginName)
      this.saveConfig(config)
    }
  }

  // 禁用插件
  disablePlugin(pluginName) {
    const config = this.getConfig()
    const index = config.enabledPlugins.indexOf(pluginName)
    if (index > -1) {
      config.enabledPlugins.splice(index, 1)
      this.saveConfig(config)
    }
  }

  // 检查插件是否启用
  isPluginEnabled(pluginName) {
    const config = this.getConfig()
    return config.enabledPlugins.includes(pluginName)
  }

  // 获取启用的插件列表
  getEnabledPlugins() {
    const config = this.getConfig()
    return config.enabledPlugins
  }

  // 设置插件特定配置
  setPluginSetting(pluginName, setting, value) {
    const config = this.getConfig()
    if (!config.pluginSettings[pluginName]) {
      config.pluginSettings[pluginName] = {}
    }
    config.pluginSettings[pluginName][setting] = value
    this.saveConfig(config)
  }

  // 获取插件特定配置
  getPluginSetting(pluginName, setting, defaultValue = null) {
    const config = this.getConfig()
    return config.pluginSettings[pluginName]?.[setting] ?? defaultValue
  }

  // 获取插件所有配置
  getPluginSettings(pluginName) {
    const config = this.getConfig()
    return config.pluginSettings[pluginName] || {}
  }

  // 设置自动更新
  setAutoUpdate(enabled) {
    this.updateConfig({ autoUpdate: enabled })
  }

  // 获取自动更新状态
  getAutoUpdate() {
    const config = this.getConfig()
    return config.autoUpdate
  }

  // 设置插件仓库地址
  setPluginRegistry(url) {
    this.updateConfig({ pluginRegistry: url })
  }

  // 获取插件仓库地址
  getPluginRegistry() {
    const config = this.getConfig()
    return config.pluginRegistry
  }

  // 重置配置
  resetConfig() {
    this.saveConfig(this.defaultConfig)
  }

  // 导出配置
  exportConfig() {
    const config = this.getConfig()
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'plugin-config.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 导入配置
  async importConfig(file) {
    try {
      const text = await file.text()
      const config = JSON.parse(text)

      // 验证配置格式
      this.validateConfig(config)

      this.saveConfig(config)
      console.log('插件配置导入成功')
      return config

    } catch (error) {
      console.error('导入插件配置失败:', error)
      throw error
    }
  }

  // 验证配置格式
  validateConfig(config) {
    const requiredFields = ['enabledPlugins', 'pluginSettings', 'autoUpdate', 'pluginRegistry']
    const missingFields = requiredFields.filter(field => !(field in config))

    if (missingFields.length > 0) {
      throw new Error(`配置缺少必要字段: ${missingFields.join(', ')}`)
    }

    if (!Array.isArray(config.enabledPlugins)) {
      throw new Error('enabledPlugins 必须是数组')
    }

    if (typeof config.pluginSettings !== 'object') {
      throw new Error('pluginSettings 必须是对象')
    }

    if (typeof config.autoUpdate !== 'boolean') {
      throw new Error('autoUpdate 必须是布尔值')
    }

    if (typeof config.pluginRegistry !== 'string') {
      throw new Error('pluginRegistry 必须是字符串')
    }
  }

  // 获取配置统计信息
  getConfigStats() {
    const config = this.getConfig()
    return {
      totalEnabledPlugins: config.enabledPlugins.length,
      totalPluginSettings: Object.keys(config.pluginSettings).length,
      autoUpdateEnabled: config.autoUpdate,
      lastModified: new Date().toISOString()
    }
  }

  // 清理未使用的插件配置
  cleanupUnusedSettings() {
    const config = this.getConfig()
    const enabledPlugins = new Set(config.enabledPlugins)

    // 移除未启用插件的配置
    Object.keys(config.pluginSettings).forEach(pluginName => {
      if (!enabledPlugins.has(pluginName)) {
        delete config.pluginSettings[pluginName]
      }
    })

    this.saveConfig(config)
    console.log('清理未使用的插件配置完成')
  }
}

export default new PluginConfigManager()
