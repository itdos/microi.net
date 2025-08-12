# 插件开发指南

## 概述

本指南详细介绍如何为插件系统开发新的插件，包括插件结构、开发流程、最佳实践和示例代码。

## 插件结构

### 标准插件结构
```
my-plugin/
├── index.js          # 插件入口文件（必需）
├── index.vue         # 主组件（可选，用于路由页面）
├── components/       # 插件组件目录（可选）
│   ├── MyComponent.vue
│   └── AnotherComponent.vue
├── assets/           # 插件资源目录（可选）
│   ├── images/
│   └── styles/
├── package.json      # 插件包信息（可选）
└── README.md         # 插件说明文档（可选）
```

### 简化插件结构
```
simple-plugin/
├── index.js          # 插件配置
└── index.vue         # 主组件（既是页面也是组件）
```

## 开发步骤

### 1. 创建插件目录

在 `src/views/plugins/` 目录下创建插件文件夹：

```bash
mkdir src/views/plugins/my-plugin
cd src/views/plugins/my-plugin
```

### 2. 创建插件配置文件

创建 `src/views/plugins/my-plugin/index.js`：

```javascript
// 我的插件配置文件
export const routes = [
  {
    path: '/my-page',
    name: 'MyPluginPage',
    component: () => import('./index.vue')
  }
]

// 插件组件（用于在选中区域中渲染）
export const components = {
  MyComponent: () => import('./index.vue')
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

### 3. 创建主组件

创建 `src/views/plugins/my-plugin/index.vue`：

```vue
<template>
  <div class="my-plugin">
    <el-card>
      <div slot="header">
        <span>我的插件</span>
      </div>
      
      <div class="plugin-content">
        <h3>我的插件</h3>
        <p>这是一个示例插件，展示了基本的插件结构。</p>
        
        <el-form-item label="输入框：">
          <el-input
            v-model="inputValue"
            placeholder="请输入内容"
            clearable
            style="width: 300px;"
          />
        </el-form-item>
        
        <div class="info-panel">
          <p><strong>当前值：</strong>{{ inputValue || '暂无输入' }}</p>
          <p><strong>字符长度：</strong>{{ inputValue ? inputValue.length : 0 }}</p>
        </div>
        
        <el-button type="primary" @click="handleClick">测试按钮</el-button>
      </div>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'MyPlugin',
  props: {
    // 支持外部传入值
    value: {
      type: String,
      default: ''
    },
    // 字段配置
    field: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      inputValue: this.value || ''
    }
  },
  watch: {
    // 双向绑定支持
    value(newVal) {
      this.inputValue = newVal || ''
    },
    inputValue(newVal) {
      this.$emit('input', newVal)
      this.$emit('change', newVal)
    }
  },
  methods: {
    handleClick() {
      this.$message.success('插件功能正常！当前值：' + (this.inputValue || '空'))
    }
  }
}
</script>

<style scoped>
.my-plugin {
  padding: 20px;
}

.plugin-content {
  text-align: center;
}

.plugin-content h3 {
  color: #303133;
  margin-bottom: 15px;
}

.plugin-content p {
  color: #606266;
  margin-bottom: 20px;
  line-height: 1.5;
}

.info-panel {
  margin: 15px 0;
  padding: 10px;
  background-color: #f0f9ff;
  border-left: 4px solid #409eff;
  border-radius: 4px;
  text-align: left;
}

.info-panel p {
  margin: 5px 0;
  color: #606266;
}

.info-panel strong {
  color: #303133;
}

.el-form-item {
  margin-bottom: 20px;
}

.el-button {
  margin-top: 10px;
}
</style>
```

### 4. 注册插件配置

在 `src/views/plugins/plugin-registry.js` 中添加插件配置：

```javascript
// 我的插件配置
const myPluginConfig = {
  name: "my-plugin",
  displayName: "我的插件",
  description: "这是一个示例插件，展示了基本的插件结构。",
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

### 5. 添加导入映射

在 `src/views/plugins/plugin-importer.js` 中添加导入映射：

```javascript
const pluginComponentImports = {
  'test-plugin': {
    'TestHome': () => import('@/views/plugins/test-plugin/components/TestHome.vue'),
    'TestCounter': () => import('@/views/plugins/test-plugin/components/TestCounter.vue'),
    'TestForm': () => import('@/views/plugins/test-plugin/components/TestForm.vue')
  },
  'demo-plugin': {
    'DemoComponent': () => import('@/views/plugins/demo-plugin/index.vue')
  },
  'my-plugin': {
    'MyComponent': () => import('@/views/plugins/my-plugin/index.vue')
  }
}
```

## 插件接口规范

### 必需接口

#### routes - 路由配置
```javascript
export const routes = [
  {
    path: '/my-page',           // 相对路径
    name: 'MyPluginPage',       // 唯一的路由名
    component: MyComponent,      // 组件引用或导入函数
    meta: {
      title: '我的页面',        // 页面标题
      requiresAuth: true        // 是否需要认证
    }
  }
]
```

#### components - 组件配置
```javascript
export const components = {
  MyComponent: MyComponent,     // 组件引用
  AnotherComponent: () => import('./AnotherComponent.vue')  // 动态导入
}
```

### 可选接口

#### init() - 插件初始化
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

#### destroy() - 插件卸载
```javascript
export async function destroy() {
  try {
    // 清理逻辑
    console.log('插件卸载完成')
  } catch (error) {
    console.error('插件卸载失败:', error)
  }
}
```

## 最佳实践

### 1. 命名规范

- **插件名**：使用小写字母和连字符，如 `my-plugin`
- **组件名**：使用 PascalCase，如 `MyComponent`
- **路由名**：使用 kebab-case，如 `my-page`
- **文件名**：使用 PascalCase，如 `MyComponent.vue`

### 2. 组件设计

```javascript
// 支持双向绑定
props: {
  value: {
    type: String,
    default: ''
  }
},
watch: {
  value(newVal) {
    // 处理外部值变化
  },
  inputValue(newVal) {
    // 向外部发送值变化
    this.$emit('input', newVal)
  }
}
```

### 3. 错误处理

```javascript
export async function init() {
  try {
    // 初始化逻辑
    await this.loadDependencies()
    await this.initializeComponents()
    console.log('插件初始化成功')
  } catch (error) {
    console.error('插件初始化失败:', error)
    // 优雅降级
    this.showErrorMessage('插件初始化失败，部分功能可能不可用')
  }
}
```

### 4. 性能优化

```javascript
// 使用懒加载
component: () => import('./MyComponent.vue')

// 避免不必要的重渲染
computed: {
  processedData() {
    return this.expensiveOperation(this.data)
  }
}

// 及时清理资源
beforeDestroy() {
  this.clearTimers()
  this.removeEventListeners()
}
```

## 测试和调试

### 1. 启用插件

1. 访问插件管理页面
2. 找到你的插件
3. 点击"启用"按钮
4. 刷新页面

### 2. 访问插件

- **路由页面**：`/plugin/my-plugin/my-page`
- **组件渲染**：在选中区域中配置插件组件字段

### 3. 调试技巧

```javascript
// 在组件中添加调试信息
mounted() {
  console.log('组件已挂载:', this.$options.name)
  console.log('组件属性:', this.$props)
  console.log('组件数据:', this.$data)
}

// 使用 Vue DevTools 检查组件状态
// 查看浏览器控制台的日志信息
// 检查网络请求和错误
```

## 发布和分发

### 1. 版本管理

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "我的插件描述",
  "author": "开发者姓名",
  "license": "MIT",
  "repository": "https://github.com/username/my-plugin"
}
```

### 2. 文档说明

- 创建 `README.md` 说明插件功能
- 提供使用示例和配置说明
- 说明依赖关系和兼容性

### 3. 测试验证

- 功能测试：验证所有功能正常工作
- 兼容性测试：确保与系统兼容
- 性能测试：检查性能影响

## 常见问题

### Q: 插件启用后无法访问页面？

A: 检查路由配置是否正确，确认组件导入路径正确。

### Q: 组件无法正常显示？

A: 验证组件配置格式，检查组件文件是否存在。

### Q: 插件初始化失败？

A: 检查 `init` 函数中的错误处理，确保所有依赖都正确加载。

### Q: 如何添加新的组件类型？

A: 在 `plugin-component-adapter.js` 中添加新的组件类型支持。

## 总结

通过遵循本指南，你可以：

1. ✅ 快速创建功能完整的插件
2. ✅ 遵循最佳实践和设计原则
3. ✅ 确保插件的质量和可维护性
4. ✅ 轻松集成到现有系统中

开始开发你的第一个插件吧！