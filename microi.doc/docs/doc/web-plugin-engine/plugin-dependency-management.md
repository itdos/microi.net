# 插件独立依赖管理文档

## 概述

插件独立依赖管理系统解决了传统插件系统中依赖包污染主项目 `package.json` 的问题。通过动态加载、依赖注入和智能缓存机制，实现了插件的完全独立依赖管理。

## 核心特性

### ✅ **独立依赖管理**
- 插件可以定义自己的依赖包，无需在主项目中配置
- 支持多种依赖类型：外部依赖、内部依赖、对等依赖、可选依赖
- 自动依赖解析和版本管理

### ✅ **动态加载机制**
- 运行时动态加载插件依赖
- CDN 外部依赖自动加载
- 本地文件内部依赖按需导入
- 智能缓存避免重复加载

### ✅ **依赖注入系统**
- 插件初始化时自动注入依赖
- 支持依赖可用性检查
- 提供依赖注入器接口

### ✅ **降级和容错**
- 可选依赖支持降级方案
- 依赖加载失败不影响插件运行
- 详细的错误日志和状态报告

## 依赖类型说明

### 1. 对等依赖 (Peer Dependencies)

使用主项目已有的依赖包，避免重复加载。

```javascript
export const dependencies = {
  'vue': '^2.6.0',           // 简单字符串配置
  'element-ui': '^2.15.0'    // 使用主项目的 Element UI
}
```

**特点：**
- 不增加包体积
- 版本兼容性由主项目控制
- 加载速度最快

### 2. 外部依赖 (External Dependencies)

从 CDN 动态加载第三方库。

```javascript
export const dependencies = {
  'lodash': {
    type: 'external',
    version: '^4.17.21',
    source: 'https://unpkg.com/lodash@4.17.21/lodash.min.js'
  },
  'moment': {
    type: 'external',
    version: '^2.29.4',
    source: 'https://unpkg.com/moment@2.29.4/moment.min.js',
    fallback: true  // 支持降级方案
  }
}
```

**特点：**
- 按需加载，减少初始包体积
- 支持版本控制
- 网络依赖，需要处理加载失败

### 3. 内部依赖 (Internal Dependencies)

加载插件内部的工具模块。

```javascript
export const dependencies = {
  'chart-utils': {
    type: 'internal',
    version: '^1.0.0',
    path: './utils/chart-utils.js'
  },
  'api-client': {
    type: 'internal',
    version: '^1.0.0',
    path: './services/api-client.js'
  }
}
```

**特点：**
- 插件私有工具模块
- 支持模块化开发
- 加载速度快

### 4. 可选依赖 (Optional Dependencies)

如果不可用也不会影响插件运行。

```javascript
export const dependencies = {
  'echarts': {
    type: 'optional',
    version: '^5.0.0',
    fallback: true
  },
  'three': {
    type: 'optional',
    version: '^0.150.0',
    fallback: true
  }
}
```

**特点：**
- 增强功能，非必需
- 支持降级到简单实现
- 提高插件兼容性

## 使用方法

### 1. 定义插件依赖

在插件的 `index.js` 中定义依赖配置：

```javascript
// 插件依赖配置
export const dependencies = {
  // 对等依赖
  'vue': '^2.6.0',
  'element-ui': '^2.15.0',
  
  // 外部依赖
  'lodash': {
    type: 'external',
    version: '^4.17.21',
    source: 'https://unpkg.com/lodash@4.17.21/lodash.min.js'
  },
  
  // 内部依赖
  'utils': {
    type: 'internal',
    version: '^1.0.0',
    path: './utils/index.js'
  },
  
  // 可选依赖
  'chart': {
    type: 'optional',
    version: '^5.0.0',
    fallback: true
  }
}
```

### 2. 使用依赖注入器

在插件初始化函数中接收依赖注入器：

```javascript
// 插件初始化函数
export async function init(dependencyInjector) {
  console.log('插件初始化开始...')
  
  // 获取依赖
  const lodash = dependencyInjector.get('lodash')
  const utils = dependencyInjector.get('utils')
  const chart = dependencyInjector.get('chart')
  
  // 检查依赖是否可用
  if (dependencyInjector.has('lodash')) {
    console.log('Lodash 可用:', lodash)
    // 使用 lodash
    window._ = lodash
  }
  
  if (dependencyInjector.has('utils')) {
    console.log('Utils 可用:', utils)
    // 使用内部工具
    window.utils = utils
  }
  
  if (dependencyInjector.has('chart')) {
    console.log('Chart 可用:', chart)
    // 使用图表库
    window.chart = chart
  } else {
    console.log('Chart 不可用，使用降级方案')
    // 使用简单的 Canvas 替代
  }
  
  // 批量注入依赖
  dependencyInjector.inject(window, ['lodash', 'utils'])
  
  console.log('插件初始化完成')
}
```

### 3. 插件卸载

在插件卸载函数中清理依赖：

``javascript
// 插件卸载函数
export async function destroy(dependencyInjector) {
  console.log('插件卸载开始...')
  
  // 清理全局变量
  delete window._
  delete window.utils
  delete window.chart
  
  console.log('插件卸载完成')
}
```

## API 参考

### PluginDependencyManager

#### `loadPluginDependencies(pluginName, dependencies)`
加载插件的所有依赖。

**参数：**
- `pluginName` (string): 插件名称
- `dependencies` (Object): 依赖配置

**返回：** Promise<Object> 加载结果

#### `getPluginDependencies(pluginName)`
获取插件的依赖信息。

**参数：**
- `pluginName` (string): 插件名称

**返回：** Object|null 依赖信息

#### `isDependencyLoaded(pluginName, depName)`
检查依赖是否已加载。

**参数：**
- `pluginName` (string): 插件名称
- `depName` (string): 依赖名称

**返回：** boolean 是否已加载

### PluginDependencyLoader

#### `loadPluginDependencies(pluginName, pluginConfig)`
加载插件依赖并处理结果。

**参数：**
- `pluginName` (string): 插件名称
- `pluginConfig` (Object): 插件配置

**返回：** Promise<Object> 处理结果

#### `createDependencyInjector(pluginName)`
创建依赖注入器。

**参数：**
- `pluginName` (string): 插件名称

**返回：** Object 依赖注入器

### DependencyInjector

#### `get(depName)`
获取指定依赖。

**参数：**
- `depName` (string): 依赖名称

**返回：** any 依赖模块

#### `has(depName)`
检查依赖是否可用。

**参数：**
- `depName` (string): 依赖名称

**返回：** boolean 是否可用

#### `inject(target, depNames)`
批量注入依赖到目标对象。

**参数：**
- `target` (Object): 目标对象
- `depNames` (Array): 依赖名称数组

**返回：** Object 目标对象

## 最佳实践

### 1. 依赖类型选择

```javascript
// ✅ 推荐：优先使用对等依赖
export const dependencies = {
  'vue': '^2.6.0',           // 对等依赖
  'element-ui': '^2.15.0'     // 对等依赖
}

// ✅ 推荐：大型库使用外部依赖
export const dependencies = {
  'lodash': {
    type: 'external',
    version: '^4.17.21',
    source: 'https://unpkg.com/lodash@4.17.21/lodash.min.js'
  }
}

// ✅ 推荐：工具函数使用内部依赖
export const dependencies = {
  'utils': {
    type: 'internal',
    version: '^1.0.0',
    path: './utils/index.js'
  }
}

// ✅ 推荐：增强功能使用可选依赖
export const dependencies = {
  'chart': {
    type: 'optional',
    version: '^5.0.0',
    fallback: true
  }
}
```

### 2. 错误处理

```javascript
export async function init(dependencyInjector) {
  try {
    // 检查关键依赖
    if (!dependencyInjector.has('vue')) {
      throw new Error('Vue 依赖不可用')
    }
    
    // 处理可选依赖
    if (dependencyInjector.has('chart')) {
      // 使用图表库
      this.initChart()
    } else {
      // 使用降级方案
      this.initSimpleChart()
    }
    
  } catch (error) {
    console.error('插件初始化失败:', error)
    // 优雅降级
    this.initFallbackMode()
  }
}
```

### 3. 性能优化

```javascript
// ✅ 推荐：预加载常用依赖
await pluginDependencyLoader.preloadCommonDependencies([
  'lodash',
  'moment',
  'axios'
])

// ✅ 推荐：使用缓存
const cacheKey = `${pluginName}:${JSON.stringify(dependencies)}`
if (dependencyCache.has(cacheKey)) {
  return dependencyCache.get(cacheKey)
}

// ✅ 推荐：避免重复加载
if (this.loadingPromises.has(cacheKey)) {
  return this.loadingPromises.get(cacheKey)
}
```

## 故障排除

### 常见问题

#### 1. 外部依赖加载失败

**问题：** CDN 依赖无法加载

**解决方案：**
```javascript
// 使用多个 CDN 源
'lodash': {
  type: 'external',
  version: '^4.17.21',
  source: 'https://unpkg.com/lodash@4.17.21/lodash.min.js',
  fallback: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'
}
```

#### 2. 内部依赖路径错误

**问题：** 内部依赖文件找不到

**解决方案：**
```javascript
// 使用相对路径
'utils': {
  type: 'internal',
  version: '^1.0.0',
  path: './utils/index.js'  // 相对于插件根目录
}
```

#### 3. 对等依赖版本冲突

**问题：** 插件需要的版本与主项目不兼容

**解决方案：**
```javascript
// 使用兼容的版本范围
'vue': '^2.6.0',  // 兼容 2.6.x 版本
```

### 调试技巧

```javascript
// 1. 检查依赖加载状态
console.log('依赖状态:', pluginDependencyManager.getDependencyStats())

// 2. 检查特定插件依赖
console.log('插件依赖:', pluginDependencyLoader.getPluginDependencies('my-plugin'))

// 3. 检查依赖注入器
const injector = pluginDependencyLoader.createDependencyInjector('my-plugin')
console.log('可用依赖:', Object.keys(injector.getAll()))
```

## 总结

插件独立依赖管理系统提供了：

1. **完全独立**：插件依赖不再污染主项目
2. **灵活配置**：支持多种依赖类型和加载方式
3. **智能管理**：自动处理依赖解析、加载和缓存
4. **容错机制**：支持降级方案和错误恢复
5. **性能优化**：按需加载和智能缓存

通过这个系统，你可以：
- ✅ 开发完全独立的插件
- ✅ 避免依赖包污染主项目
- ✅ 支持插件间的依赖隔离
- ✅ 实现插件的热插拔和动态加载
- ✅ 提供更好的用户体验和开发体验

开始使用插件独立依赖管理，让你的插件系统更加模块化和可扩展！
