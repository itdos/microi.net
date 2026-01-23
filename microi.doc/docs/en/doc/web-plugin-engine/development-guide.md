# Plug-in Development Guide

## Overview

This guide details how to develop new plug-ins for the plug-in system, including the plug-in structure, development process, best practices, and sample code.

## Plug-in structure

### Standard plug-in structure
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

### Simplify plug-in structure
```
simple-plugin/
├── index.js          # 插件配置
└── index.vue         # 主组件（既是页面也是组件）
```

## Development steps

### 1. Create a plug-in directory

In`src/views/plugins/`Create a plug-in folder under the directory:

```bash
mkdir src/views/plugins/my-plugin
cd src/views/plugins/my-plugin
```

### 2. Create a plug-in configuration file

Create`src/views/plugins/my-plugin/index.js`:

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

### 3. Create the main component

Create`src/views/plugins/my-plugin/index.vue`:

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

### 4. Register plug-in configuration

In`src/views/plugins/plugin-registry.js`Add a plug-in configuration:

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

### 5. Add Import Mapping

In`src/views/plugins/plugin-importer.js`To add an import mapping:

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

## Plug-in Interface Specification

### Required Interface

#### routes-route configuration
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

#### components-Component Configuration
```javascript
export const components = {
  MyComponent: MyComponent,     // 组件引用
  AnotherComponent: () => import('./AnotherComponent.vue')  // 动态导入
}
```

### Optional Interface

#### N_Plugin init()
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

#### destroy() -Plugin Uninstall
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

## Best Practices

### 1. Naming specification

- **Plug-in name**：Use lowercase letters and hyphens, such as my-plugin'
- **Component Name**：Use PascalCase such as 'MyComponent'
- **Route Name**：Use kebab-case, such as 'my-page'
- **File Name**：Use PascalCase such as 'MyComponent.vue'

### 2. Component Design

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

### 3. Error Handling

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

### 4. Performance optimization

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

## Testing and Commissioning

### 1. Enable the plug-in

1. Visit the plug-in management page
2. Find your plugin
3. Click the "Enable" button
4. Refresh the page

### 2. Access the plug-in

- **Routing Page**：'/plugin/my-plugin/my-page'
- **Component Rendering**：Configure plug-in component fields in the selected area

### 3. Debugging skills

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

## Publish and distribute

### 1. Version management

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

### 2. Documentation Description

- Create`README.md`Describe plug-in functionality
- Provides usage examples and configuration instructions
- Explain dependencies and compatibility

### 3. Test verification

- Functional Test: Verify that all functions are working properly
- Compatibility testing: to ensure compatibility with the system
- Performance Test: Check Performance Impact

## FAQ

### Q: Unable to access the page after the plugin is enabled?

A: Check whether the routing configuration is correct and confirm that the component import path is correct.

### Q: The components are not displayed properly?

A: Verify the component configuration format and check whether the component file exists.

### Q: Plug-in initialization failed?

A: Inspection`init`Error handling in the function to ensure that all dependencies are loaded correctly.

### Q: How do I add a new component type?

A: In`plugin-component-adapter.js`Add new component type support in.

## Summary

By following this guide, you can:

1.✅Quickly create fully functional plug-ins
2.✅Follow best practices and design principles
3.✅Ensure plug-in quality and maintainability
4.✅Easy integration into existing systems

Start developing your first plugin!