# 插件开发指南

## 概述

本框架支持插件化开发，允许开发者在不修改主线代码的情况下，动态添加业务功能。插件系统提供了路由管理、组件注册、状态管理等功能。

## 插件目录结构

```
src/plugins/
├── plugin-manager.js          # 插件管理器
├── loctek/                    # loctek插件
│   ├── index.js              # 插件入口文件
│   ├── package.json          # 插件配置文件
│   ├── components/           # 插件组件
│   │   ├── LoctekCalendar.vue
│   │   ├── LoctekOrderArrange.vue
│   │   └── ...
│   ├── store/                # 插件状态管理
│   │   └── index.js
│   └── assets/               # 插件资源文件
│       ├── images/
│       └── styles/
└── your-plugin/              # 你的插件
    ├── index.js
    ├── package.json
    └── ...
```

## 创建新插件

### 1. 创建插件目录

```bash
mkdir src/plugins/your-plugin
cd src/plugins/your-plugin
```

### 2. 创建插件配置文件

```json
{
  "name": "your-plugin",
  "version": "1.0.0",
  "description": "你的插件描述",
  "main": "index.js",
  "author": "Your Name",
  "license": "MIT",
  "plugin": {
    "name": "your-plugin",
    "displayName": "你的插件显示名称",
    "description": "插件详细描述",
    "version": "1.0.0",
    "author": "Your Name",
    "entry": "index.js",
    "routes": true,
    "components": true,
    "store": true,
    "permissions": [
      "your:permission"
    ]
  }
}
```

### 3. 创建插件入口文件

```javascript
// src/plugins/your-plugin/index.js
import Layout from "@/layout"

// 导入你的组件
import YourComponent from './components/YourComponent.vue'

// 插件路由配置
export const routes = [
  {
    path: "/your-path",
    component: Layout,
    children: [
      {
        path: "/your-path",
        name: "your-component",
        component: YourComponent,
        meta: {
          title: '你的页面标题',
          icon: 'your-icon'
        }
      }
    ]
  }
]

// 插件组件注册
export const components = {
  YourComponent
}

// 插件Vuex模块
export const store = {
  namespaced: true,
  state: {
    // 你的状态
  },
  mutations: {
    // 你的mutations
  },
  actions: {
    // 你的actions
  },
  getters: {
    // 你的getters
  }
}

// 插件初始化函数
export async function init() {
  console.log('你的插件初始化完成')
  // 在这里进行初始化操作
}

// 插件卸载函数
export async function destroy() {
  console.log('你的插件卸载完成')
  // 清理插件资源
}
```

### 4. 创建插件组件

```vue
<!-- src/plugins/your-plugin/components/YourComponent.vue -->
<template>
  <div class="your-component">
    <h1>你的插件组件</h1>
    <!-- 你的组件内容 -->
  </div>
</template>

<script>
export default {
  name: 'YourComponent',
  data() {
    return {
      // 你的数据
    }
  },
  methods: {
    // 你的方法
  }
}
</script>

<style scoped>
.your-component {
  /* 你的样式 */
}
</style>
```

## 插件API

### 插件管理器

```javascript
import pluginManager from '@/plugins/plugin-manager'

// 注册插件
await pluginManager.registerPlugin('your-plugin', config)

// 卸载插件
await pluginManager.unregisterPlugin('your-plugin')

// 获取已注册的插件列表
const plugins = pluginManager.getRegisteredPlugins()
```

### 路由管理

插件路由会自动添加 `/plugin/插件名` 前缀，例如：
- 插件路由：`/your-path`
- 实际路径：`/plugin/your-plugin/your-path`

### 组件注册

插件组件会自动添加插件名前缀，例如：
- 组件名：`YourComponent`
- 注册名：`your-plugin-YourComponent`

### 状态管理

插件状态会注册为Vuex模块，命名空间为插件名：

```javascript
// 在组件中使用
this.$store.dispatch('your-plugin/yourAction')
this.$store.commit('your-plugin/yourMutation')
this.$store.getters['your-plugin/yourGetter']
```

## 插件生命周期

1. **注册阶段**：插件被加载和注册
2. **初始化阶段**：执行插件的 `init()` 函数
3. **运行阶段**：插件正常工作
4. **卸载阶段**：执行插件的 `destroy()` 函数

## 最佳实践

### 1. 命名规范

- 插件名使用小写字母和连字符
- 组件名使用PascalCase
- 路由名使用kebab-case

### 2. 依赖管理

- 插件应该声明自己的依赖
- 避免与主线代码产生冲突
- 使用相对路径导入插件内部资源

### 3. 错误处理

```javascript
export async function init() {
  try {
    // 初始化代码
  } catch (error) {
    console.error('插件初始化失败:', error)
    throw error
  }
}
```

### 4. 资源管理

- 插件卸载时清理所有资源
- 避免内存泄漏
- 正确注销事件监听器

## 示例：完整的插件

参考 `src/plugins/loctek/` 目录，这是一个完整的插件示例，包含了：

- 路由配置
- 组件定义
- 状态管理
- 资源文件
- 配置文件

## 插件管理界面

系统提供了插件管理界面，位于 `/plugin-management`，可以：

- 查看所有插件
- 启用/禁用插件
- 查看插件详情
- 管理插件配置

## 注意事项

1. 插件代码不应该修改主线代码
2. 插件应该独立，不依赖其他插件
3. 插件版本应该与框架版本兼容
4. 插件应该提供完整的文档和示例
5. 插件应该遵循框架的设计规范 