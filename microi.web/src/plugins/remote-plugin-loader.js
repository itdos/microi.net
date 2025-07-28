import pluginManager from './plugin-manager'

class RemotePluginLoader {
  constructor() {
    this.pluginRegistry = new Map()
    this.loadedPlugins = new Set()
  }

  // 从远程服务器加载插件
  async loadRemotePlugin(pluginUrl, pluginName) {
    try {
      console.log(`开始加载远程插件: ${pluginName} from ${pluginUrl}`)

      // 动态加载远程插件脚本
      const script = document.createElement('script')
      script.src = pluginUrl
      script.type = 'module'

      // 创建全局变量来接收插件模块
      window.__remotePluginModule = null

      return new Promise((resolve, reject) => {
        script.onload = async () => {
          try {
            // 获取插件模块
            const pluginModule = window.__remotePluginModule

            if (!pluginModule) {
              throw new Error('插件模块未正确导出')
            }

            // 注册插件
            await this.registerRemotePlugin(pluginName, pluginModule)

            this.loadedPlugins.add(pluginName)
            console.log(`远程插件 ${pluginName} 加载成功`)
            resolve(pluginModule)

          } catch (error) {
            console.error(`远程插件 ${pluginName} 加载失败:`, error)
            reject(error)
          } finally {
            // 清理
            document.head.removeChild(script)
            delete window.__remotePluginModule
          }
        }

        script.onerror = () => {
          const error = new Error(`无法加载插件脚本: ${pluginUrl}`)
          console.error(error)
          reject(error)
        }

        document.head.appendChild(script)
      })

    } catch (error) {
      console.error(`加载远程插件失败:`, error)
      throw error
    }
  }

  // 注册远程插件
  async registerRemotePlugin(pluginName, pluginModule) {
    try {
      // 验证插件模块
      this.validatePluginModule(pluginModule)

      // 注册到插件管理器
      await pluginManager.registerPlugin(pluginName, {
        type: 'remote',
        module: pluginModule
      })

      this.pluginRegistry.set(pluginName, {
        type: 'remote',
        module: pluginModule,
        loadedAt: new Date()
      })

    } catch (error) {
      console.error(`注册远程插件失败:`, error)
      throw error
    }
  }

  // 验证插件模块
  validatePluginModule(pluginModule) {
    const requiredExports = ['routes', 'components', 'store']
    const missingExports = requiredExports.filter(exportName => !pluginModule[exportName])

    if (missingExports.length > 0) {
      throw new Error(`插件模块缺少必要的导出: ${missingExports.join(', ')}`)
    }
  }

  // 从插件仓库加载插件
  async loadFromRegistry(registryUrl) {
    try {
      console.log(`从插件仓库加载插件列表: ${registryUrl}`)

      const response = await fetch(registryUrl)
      if (!response.ok) {
        throw new Error(`获取插件仓库失败: ${response.status}`)
      }

      const registry = await response.json()

      // 加载启用的插件
      for (const plugin of registry.plugins) {
        if (plugin.enabled) {
          await this.loadRemotePlugin(plugin.url, plugin.name)
        }
      }

      console.log('插件仓库加载完成')

    } catch (error) {
      console.error('从插件仓库加载失败:', error)
      throw error
    }
  }

  // 获取已加载的插件列表
  getLoadedPlugins() {
    return Array.from(this.loadedPlugins)
  }

  // 获取插件信息
  getPluginInfo(pluginName) {
    return this.pluginRegistry.get(pluginName)
  }

  // 卸载远程插件
  async unloadRemotePlugin(pluginName) {
    try {
      const pluginInfo = this.pluginRegistry.get(pluginName)
      if (!pluginInfo) {
        throw new Error(`插件 ${pluginName} 未找到`)
      }

      // 从插件管理器卸载
      await pluginManager.unregisterPlugin(pluginName)

      // 清理资源
      this.loadedPlugins.delete(pluginName)
      this.pluginRegistry.delete(pluginName)

      console.log(`远程插件 ${pluginName} 卸载成功`)

    } catch (error) {
      console.error(`卸载远程插件失败:`, error)
      throw error
    }
  }

  // 检查插件更新
  async checkForUpdates(registryUrl) {
    try {
      const response = await fetch(registryUrl)
      const registry = await response.json()

      const updates = []

      for (const plugin of registry.plugins) {
        const currentPlugin = this.pluginRegistry.get(plugin.name)
        if (currentPlugin && currentPlugin.module.version !== plugin.version) {
          updates.push({
            name: plugin.name,
            currentVersion: currentPlugin.module.version,
            newVersion: plugin.version,
            changelog: plugin.changelog
          })
        }
      }

      return updates

    } catch (error) {
      console.error('检查插件更新失败:', error)
      throw error
    }
  }

  // 更新插件
  async updatePlugin(pluginName, newPluginUrl) {
    try {
      // 先卸载旧插件
      await this.unloadRemotePlugin(pluginName)

      // 加载新插件
      await this.loadRemotePlugin(newPluginUrl, pluginName)

      console.log(`插件 ${pluginName} 更新成功`)

    } catch (error) {
      console.error(`更新插件失败:`, error)
      throw error
    }
  }
}

export default new RemotePluginLoader()
