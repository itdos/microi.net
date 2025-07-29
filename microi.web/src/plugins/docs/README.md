# 插件系统文档

## 概述

这是一个基于 Vue.js 的插件系统，支持动态加载和管理插件。系统采用模块化设计，提供完整的插件生命周期管理。

## 系统架构

```
src/plugins/
├── index.js                 # 插件系统统一入口
├── plugin-manager.js        # 插件管理器（核心）
├── plugin-config-manager.js # 配置管理器
├── plugin-discovery.js      # 插件发现器
├── plugin-registry.js       # 插件注册器
├── plugin-importer.js       # 插件导入器
├── plugin-initializer.js    # 插件初始化器
├── plugin-config.js         # 系统配置文件
├── test-plugin/             # 测试插件
└── docs/                    # 文档目录
```

## 核心模块

### 1. 插件管理器 (plugin-manager.js)
- 负责插件的注册和卸载
- 管理插件的生命周期
- 处理路由、组件、Vuex模块的注册

### 2. 配置管理器 (plugin-config-manager.js)
- 管理插件的启用/禁用状态
- 处理插件设置的存储和读取
- 管理用户配置的持久化

### 3. 插件发现器 (plugin-discovery.js)
- 管理已注册的插件配置
- 提供插件配置的查询接口
- 支持插件配置的刷新

### 4. 插件注册器 (plugin-registry.js)
- 集中管理所有插件的配置信息
- 提供插件注册功能
- 导出插件配置供其他模块使用

### 5. 插件导入器 (plugin-importer.js)
- 处理插件的动态导入
- 确保 Webpack 能正确打包
- 提供统一的导入接口

## 快速开始

### 1. 初始化插件系统

```javascript
import { initializePluginSystem } from '@/plugins'

// 在应用启动时初始化
await initializePluginSystem({
  router: this.$router,
  store: this.$store
})
```

### 2. 使用插件管理功能

```javascript
import { pluginManager, pluginConfigManager } from '@/plugins'

// 启用插件
pluginConfigManager.enablePlugin('test-plugin')
await pluginManager.registerPlugin('test-plugin', { enabled: true })

// 禁用插件
pluginConfigManager.disablePlugin('test-plugin')
await pluginManager.unregisterPlugin('test-plugin')
```

### 3. 开发新插件

1. 在 `src/plugins/` 目录下创建插件文件夹
2. 在 `plugin-registry.js` 中注册插件配置
3. 在 `plugin-importer.js` 中添加导入函数
4. 创建插件的 `index.js` 入口文件

## 插件开发指南

### 插件结构

```
my-plugin/
├── index.js          # 插件入口文件
├── components/       # 插件组件
└── package.json      # 插件包信息
```

### 插件入口文件示例

```javascript
// 插件路由配置
export const routes = [
  {
    path: '/my-plugin',
    name: 'MyPlugin',
    component: { /* 组件定义 */ }
  }
]

// 插件组件
export const components = {
  MyComponent: { /* 组件定义 */ }
}

// 插件初始化函数
export async function init() {
  console.log('插件初始化完成')
}
```

## API 参考

### 插件管理器 API

- `registerPlugin(pluginName, config)` - 注册插件
- `unregisterPlugin(pluginName)` - 卸载插件
- `getRegisteredPlugins()` - 获取已注册插件列表
- `isPluginRegistered(pluginName)` - 检查插件是否已注册

### 配置管理器 API

- `enablePlugin(pluginName)` - 启用插件
- `disablePlugin(pluginName)` - 禁用插件
- `isPluginEnabled(pluginName)` - 检查插件是否启用
- `getEnabledPlugins()` - 获取启用的插件列表
- `setPluginSetting(pluginName, setting, value)` - 设置插件配置
- `getPluginSetting(pluginName, setting, defaultValue)` - 获取插件配置

### 插件发现器 API

- `scanPlugins()` - 扫描插件
- `getAllPlugins()` - 获取所有插件
- `getPlugin(name)` - 获取指定插件
- `hasPlugin(name)` - 检查插件是否存在

## 注意事项

1. **Webpack 兼容性**: 插件导入使用静态路径，确保 Webpack 能正确打包
2. **Vue Router**: 插件路由需要在路由配置中预定义
3. **Vuex**: 插件可以注册自己的 Vuex 模块
4. **组件注册**: Vue 2.x 不支持动态移除组件，卸载时只记录日志

## 故障排除

### 常见问题

1. **插件导入失败**: 检查插件是否在 `plugin-importer.js` 中正确注册
2. **插件配置未找到**: 确保插件在 `plugin-registry.js` 中已注册
3. **路由不生效**: 检查路由是否在应用路由配置中预定义

### 调试技巧

- 查看浏览器控制台的日志信息
- 使用 `pluginManager.getRegisteredPlugins()` 检查插件注册状态
- 使用 `pluginConfigManager.getEnabledPlugins()` 检查插件启用状态 