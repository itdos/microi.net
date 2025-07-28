import Vue from 'vue'
import Router from 'vue-router'

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
      // 动态导入插件模块
      let pluginModule

      // 根据插件名动态导入
      switch (pluginName) {
        case 'test-plugin':
          pluginModule = await import('@/plugins/test-plugin/index.js')
          break
        default:
          throw new Error(`未知的插件: ${pluginName}`)
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
        await pluginModule.init()
      }

      this.plugins.set(pluginName, pluginConfig)
      console.log(`插件 ${pluginName} 注册成功`)

    } catch (error) {
      console.error(`插件 ${pluginName} 注册失败:`, error)
    }
  }

  // 注册插件路由
  registerPluginRoutes(pluginName, routes) {
    if (!this.router) {
      console.warn('Router not initialized')
      return
    }

    console.log(`注册插件路由: ${pluginName}`)

    // 对于Vue Router 3.0.2，我们暂时跳过动态路由添加
    // 插件路由需要在路由配置中预定义
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

    console.log('注意: 由于Vue Router版本限制，插件路由需要在路由配置中预定义')
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
      console.warn(`插件 ${pluginName} 不存在`)
      return
    }

    // 移除路由（对于Vue Router 3.0.2，路由是预定义的，这里只是记录）
    console.log(`卸载插件路由: ${pluginName}`)

    // 移除Vuex模块
    if (this.$store && this.$store.hasModule(pluginName)) {
      this.$store.unregisterModule(pluginName)
    }

    this.plugins.delete(pluginName)
    console.log(`插件 ${pluginName} 卸载成功`)
  }

  // 获取已注册的插件列表
  getRegisteredPlugins() {
    return Array.from(this.plugins.keys())
  }
}

export default new PluginManager()
