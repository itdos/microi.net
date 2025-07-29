 # 插件开发指南

## 概述

本指南介绍如何为插件系统开发新的插件。

## 插件结构

```
my-plugin/
├── index.js          # 插件入口文件（必需）
├── components/       # 插件组件（可选）
├── assets/          # 插件资源（可选）
└── package.json     # 插件包信息（可选）
```

## 开发步骤

### 1. 创建插件目录

在 `src/plugins/` 目录下创建插件文件夹：

```bash
mkdir src/plugins/my-plugin
```

### 2. 注册插件配置

在 `src/plugins/plugin-registry.js` 中添加插件配置：

```javascript
// 我的插件配置
const myPluginConfig = {
  name: "my-plugin",
  displayName: "我的插件",
  description: "这是一个示例插件",
  version: "1.0.0",
  author: "开发者",
  entry: "index.js",
  routes: true,
  components: true,
  store: false,
  permissions: ["my:read"],
  features: ["示例功能"],
  dependencies: {
    "vue": "^2.6.0"
  }
}

// 在 registerAllPlugins 函数中添加
pluginsToRegister.push({ name: 'my-plugin', config: myPluginConfig })
```

### 3. 添加导入函数

在 `src/plugins/plugin-importer.js` 中添加导入函数：

```javascript
const pluginImports = {
  'test-plugin': () => import('@/plugins/test-plugin/index.js'),
  'demo-plugin': () => import('@/plugins/demo-plugin/index.js'),
  'my-plugin': () => import('@/plugins/my-plugin/index.js')  // 添加这行
}
```

### 4. 创建插件入口文件

创建 `src/plugins/my-plugin/index.js`：

```javascript
// 插件路由配置
export const routes = [
  {
    path: '/my-page',
    name: 'MyPluginPage',
    component: {
      template: `
        <div class="my-plugin-page">
          <h2>我的插件页面</h2>
          <p>这是一个示例页面</p>
        </div>
      `
    }
  }
]

// 插件组件
export const components = {
  MyComponent: {
    template: `
      <div class="my-component">
        <h3>我的组件</h3>
        <p>这是一个示例组件</p>
      </div>
    `
  }
}

// 插件初始化函数
export async function init() {
  console.log('我的插件初始化完成')
}

// 插件卸载函数
export async function destroy() {
  console.log('我的插件卸载完成')
}
```

## 插件接口

### 必需接口

- `routes` - 插件路由配置数组

### 可选接口

- `components` - 插件组件对象
- `store` - Vuex 模块配置
- `init()` - 插件初始化函数
- `destroy()` - 插件卸载函数

## 最佳实践

### 1. 命名规范

- 插件名使用小写字母和连字符：`my-plugin`
- 组件名使用 PascalCase：`MyComponent`
- 路由名使用 kebab-case：`my-page`

### 2. 路由配置

```javascript
export const routes = [
  {
    path: '/my-page',           // 相对路径
    name: 'MyPluginPage',       // 唯一的路由名
    component: { /* 组件定义 */ },
    meta: {
      title: '我的页面',        // 页面标题
      requiresAuth: true        // 是否需要认证
    }
  }
]
```

### 3. 组件注册

```javascript
export const components = {
  MyComponent: {
    template: `...`,
    props: ['value'],
    data() {
      return { /* 组件数据 */ }
    },
    methods: {
      // 组件方法
    }
  }
}
```

### 4. Vuex 模块

```javascript
export const store = {
  namespaced: true,
  state: {
    // 状态
  },
  mutations: {
    // 修改状态
  },
  actions: {
    // 异步操作
  },
  getters: {
    // 计算属性
  }
}
```

### 5. 错误处理

```javascript
export async function init() {
  try {
    // 初始化逻辑
    console.log('插件初始化成功')
  } catch (error) {
    console.error('插件初始化失败:', error)
    throw error
  }
}
```

## 测试插件

### 1. 启用插件

1. 访问插件管理页面
2. 找到你的插件
3. 点击"启用"按钮
4. 刷新页面

### 2. 访问插件

插件启用后，可以通过以下路径访问：

- 路由页面：`/plugin/my-plugin/my-page`
- 组件：`<my-plugin-my-component />`

### 3. 调试技巧

- 查看浏览器控制台的日志信息
- 使用 Vue DevTools 检查组件和状态
- 检查路由是否正确注册

## 常见问题

### Q: 插件启用后无法访问页面？

A: 确保路由在应用路由配置中预定义，或者检查路由路径是否正确。

### Q: 组件无法正常显示？

A: 检查组件是否正确注册，组件名是否正确。

### Q: 插件初始化失败？

A: 检查 `init` 函数中的错误处理，确保所有依赖都正确加载。

## 示例插件

参考 `src/plugins/test-plugin/` 目录，这是一个完整的插件示例，包含了所有功能的实现。