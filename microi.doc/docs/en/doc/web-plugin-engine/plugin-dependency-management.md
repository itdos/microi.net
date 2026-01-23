# Plug-in Independent Dependency Management Document

## Overview

The plug-in independent dependency management system solves the problem of dependency package pollution in the traditional plug-in system.`package.json`of the problem. Through dynamic loading, dependency injection and intelligent caching mechanism, completely independent dependency management of plug-ins is realized.

## Core Features

### ✅**Independent dependency management**
- Plugins can define their own dependency packages without the need to configure them in the main project.
- Supports multiple dependency types: external dependencies, internal dependencies, peer-to-peer dependencies, and optional dependencies.
- Automatic dependency resolution and version management

### ✅**Dynamic loading mechanism**
- Dynamic loading of plug-in dependencies at runtime
- CDN external dependency automatic loading
- Local file internal dependency import on demand
- Intelligent cache to avoid repeated loading

### ✅**Dependency Injection System**
- Automatically inject dependencies during plug-in initialization
- Support dependency availability check
- Provides a dependency injector interface

### ✅**Degradation and Fault Tolerance**
- Optional Dependency Support Downgrade Scenario
- Dependency loading failure does not affect plug-in operation
- Detailed error logs and status reports

## Dependency type description

### 1. Peer-to-peer dependence (Peer Dependencies)

Use the existing dependency packages of the main project to avoid repeated loading.

```javascript
export const dependencies = {
  'vue': '^2.6.0',           // 简单字符串配置
  'element-ui': '^2.15.0'    // 使用主项目的 Element UI
}
```

**Features:**
- No increase in package volume
- Version compatibility is controlled by the master project
- Fastest loading speed

### 2. External dependencies (External Dependencies)

Dynamically load third-party libraries from the CDN.

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

**Features:**
- Load on demand to reduce initial package volume
- Support version control
- Network dependency, need to handle loading failure

### 3. Internal dependencies (Internal Dependencies)

Load the tool module inside the plug-in.

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

**Features:**
- Plugin Private Tools Module
- Support modular development
- Fast loading speed

### 4. Optional Dependency (Optional Dependencies)

If not available, it will not affect the plug-in operation.

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

**Features:**
- Enhancements, not required
- Support for downgrading to simple implementation
- Improve plug-in compatibility

## Method of use

### 1. Define plug-in dependencies

In the plug-in's`index.js`Define the dependency configuration in:

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

### 2. Use the dependency injector.

Receive the dependency injector in the plugin initialization function:

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

### 3. Uninstall the plug-in

Clean up dependencies in the plugin unload function:

'''javascript
// Plug-in unload function
export async function destroy(dependencyInjector) {
console.log ('Plugin uninstall started... ')
  
// Clean up global variables
delete window ._
delete window.utils
delete window.chart
  
console.log ('Plugin Uninstall Completed')
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
//✅Recommendation: Use peer dependencies first
export const dependencies = {
'vue': '^ 2.6.0', // peer dependency
element-ui ': '^ 2.15.0 '// peer dependency
}

//✅Recommendation: Large libraries use external dependencies
export const dependencies = {
'lodash ': {
type: 'external ',
version: '^4.17.21 ',
source: 'https://unpkg.com/lodash@4.17.21/lodash.min.js'
}
}

//✅Recommendation: Tool functions use internal dependencies
export const dependencies = {
'utils ': {
type: 'internal ',
version: '^1.0.0 ',
path: './utils/index.js'
}
}

//✅Recommendation: Enhancement using optional dependencies
export const dependencies = {
'chart ': {
type: 'optional ',
version: '^5.0.0 ',
fallback: true
}
}
```

### 2. 错误处理

```javascript
export async function init(dependencyInjector) {
try {
// Check key dependencies
if (! dependencyInjector.has('vue')) {
throw new Error('Vue Dependency Unavailable')
}
    
// Handle optional dependencies
if (dependencyInjector.has('chart')) {
// Use the chart library
this.initChart()
} else {
// Use the downgrade scheme
this.initSimpleChart()
}
    
} catch (error) {
console.error ('plugin initialization failed: ', error)
// graceful degradation
this.initFallbackMode()
}
}
```

### 3. 性能优化

```javascript
//✅Recommendation: Preload common dependencies
await pluginDependencyLoader.preloadCommonDependencies ([
'lodash ',
'Moment ',
'axios'
])

//✅Recommended: Use the cache
const cacheKey =`${pluginName}:${JSON.stringify(dependencies)}`
if (dependencyCache.has(cacheKey)) {
return dependencyCache.get(cacheKey)
}

//✅Recommended: Avoid duplicate loading
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
// Use multiple CDN sources
'lodash ': {
type: 'external ',
version: '^4.17.21 ',
source: 'https://unpkg.com/lodash@4.17.21/lodash.min.js ',
fallback: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'
}
```

#### 2. 内部依赖路径错误

**问题：** 内部依赖文件找不到

**解决方案：**
```javascript
// Use relative path
'utils ': {
type: 'internal ',
version: '^1.0.0 ',
path: './utils/index.js' // relative to the plug-in root
}
```

#### 3. 对等依赖版本冲突

**问题：** 插件需要的版本与主项目不兼容

**解决方案：**
```javascript
// Use a compatible version range
'vue': '^ 2.6.0', // compatible with version 2.6.x
```

### 调试技巧

```javascript
// 1. Check the dependency loading status
console.log ('dependent state: ', pluginDependencyManager.getDependencyStats())

// 2. Check specific plug-in dependencies
console.log ('plugin dependency: ', pluginDependencyLoader.getPluginDependencies (my-plugin))

// 3. Check the dependency injector
const injector = pluginDependencyLoader.createDependencyInjector('my-plugin')
console.log ('Available dependencies: ', Object.keys(injector.getAll()))
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
