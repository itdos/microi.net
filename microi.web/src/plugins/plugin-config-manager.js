class PluginConfigManager {
  constructor() {
    this.configKey = 'microi_plugin_config'
    this.defaultConfig = {
      enabledPlugins: [],
      pluginSettings: {},
      autoUpdate: true
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






}

export default new PluginConfigManager()
