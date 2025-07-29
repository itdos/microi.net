import Vue from 'vue'
import Router from 'vue-router'
import pluginConfigManager from './plugin-config-manager.js'
import pluginDiscovery from './plugin-discovery.js'
import { importPlugin, isPluginImportable } from './plugin-importer.js'

class PluginManager {
  constructor() {
    this.plugins = new Map()
    this.router = null
  }

  // 设置路由实例
  setRouter(router) {
    this.router = router
  }

  // 设置store实例
  setStore(store) {
    this.$store = store
  }

  // 注册插件
  async registerPlugin(pluginName, pluginConfig) {
    try {
      // 检查插件是否已启用
      if (!pluginConfigManager.isPluginEnabled(pluginName)) {
        console.log(`插件 ${pluginName} 未启用，跳过注册`)
        return
      }

      // 获取插件配置
      const pluginConfig = pluginDiscovery.getPlugin(pluginName)
      if (!pluginConfig) {
        throw new Error(`插件配置未找到: ${pluginName}`)
      }

      // 检查插件是否支持导入
      if (!isPluginImportable(pluginName)) {
        throw new Error(`插件不支持导入: ${pluginName}`)
      }

      // 动态导入插件模块
      let pluginModule
      try {
        pluginModule = await importPlugin(pluginName)
      } catch (importError) {
        console.error(`导入插件模块失败 ${pluginName}:`, importError)
        throw new Error(`导入插件模块失败: ${pluginName}`)
      }

      // 注册路由
      if (pluginModule.routes) {
        this.registerPluginRoutes(pluginName, pluginModule.routes)
      }

      // 注册组件
      if (pluginModule.components) {
        this.registerPluginComponents(pluginName, pluginModule.components)
      }

      // 注册Vuex模块
      if (pluginModule.store) {
        this.registerPluginStore(pluginName, pluginModule.store)
      }

      // 执行插件初始化
      if (pluginModule.init) {
        try {
          await pluginModule.init()
        } catch (initError) {
          console.warn(`插件 ${pluginName} 初始化失败:`, initError)
          // 初始化失败不影响插件注册
        }
      }

      this.plugins.set(pluginName, pluginConfig)
      console.log(`插件 ${pluginName} 注册成功`)

    } catch (error) {
      console.error(`插件 ${pluginName} 注册失败:`, error)
      throw error
    }
  }

  // 注册插件路由
  registerPluginRoutes(pluginName, routes) {
    if (!this.router) {
      console.warn('Router not initialized')
      return
    }

    console.log(`注册插件路由: ${pluginName}`)
    routes.forEach(route => {
      const pluginRoute = {
        ...route,
        path: `/plugin/${pluginName}${route.path}`,
        meta: {
          ...route.meta,
          plugin: pluginName
        }
      }
      console.log(`插件路由配置: ${pluginRoute.path}`)
    })
  }

  // 注册插件组件
  registerPluginComponents(pluginName, components) {
    Object.keys(components).forEach(componentName => {
      const fullComponentName = `${pluginName}-${componentName}`
      Vue.component(fullComponentName, components[componentName])
    })
  }

  // 注册插件Vuex模块
  registerPluginStore(pluginName, storeModule) {
    if (this.$store) {
      this.$store.registerModule(pluginName, storeModule)
    }
  }

  // 卸载插件
  async unregisterPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) {
      console.log(`插件 ${pluginName} 未在插件管理器中注册，跳过卸载`)
      return
    }

    try {
      console.log(`卸载插件路由: ${pluginName}`)

      // 移除Vuex模块
      if (this.$store && this.$store.hasModule(pluginName)) {
        this.$store.unregisterModule(pluginName)
      }

      console.log(`移除插件组件注册: ${pluginName}`)

      this.plugins.delete(pluginName)
      console.log(`插件 ${pluginName} 卸载成功`)
    } catch (error) {
      console.error(`卸载插件 ${pluginName} 时发生错误:`, error)
      throw error
    }
  }

  // 获取已注册的插件列表
  getRegisteredPlugins() {
    return Array.from(this.plugins.keys())
  }

  // 检查插件是否已注册
  isPluginRegistered(pluginName) {
    return this.plugins.has(pluginName)
  }

  // 初始化所有已启用的插件
  async initializeEnabledPlugins() {
    const enabledPlugins = pluginConfigManager.getEnabledPlugins()

    for (const pluginName of enabledPlugins) {
      try {
        await this.registerPlugin(pluginName, { enabled: true })
      } catch (error) {
        console.error(`初始化插件 ${pluginName} 失败:`, error)
      }
    }
  }
}

export default new PluginManager()
