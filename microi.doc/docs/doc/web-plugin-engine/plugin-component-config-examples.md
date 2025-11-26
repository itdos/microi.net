# 插件组件配置示例

## 正确的配置格式

### 1. 测试插件组件配置

#### TestHome 组件
```javascript
{
  "Name": "testHome",
  "Label": "测试首页",
  "Component": "DevComponent",
  "Config": {
    "DevComponentName": "test-plugin-TestHome",
    "DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
  }
}
```

#### TestCounter 组件
```javascript
{
  "Name": "testCounter",
  "Label": "测试计数器",
  "Component": "DevComponent",
  "Config": {
    "DevComponentName": "test-plugin-TestCounter",
    "DevComponentPath": "/plugins/test-plugin/components/TestCounter.vue"
  }
}
```

#### TestForm 组件
```javascript
{
  "Name": "testForm",
  "Label": "测试表单",
  "Component": "DevComponent",
  "Config": {
    "DevComponentName": "test-plugin-TestForm",
    "DevComponentPath": "/plugins/test-plugin/components/TestForm.vue"
  }
}
```

### 2. 演示插件组件配置

#### DemoComponent 组件
```javascript
{
  "Name": "demoComponent",
  "Label": "演示组件",
  "Component": "DevComponent",
  "Config": {
    "DevComponentName": "demo-plugin-DemoComponent",
    "DevComponentPath": "/plugins/demo-plugin/index.vue"
  }
}
```

## 重要配置说明

### 1. DevComponentName 命名规则

- **格式**：`插件名-组件名`
- **示例**：`test-plugin-TestHome`、`demo-plugin-DemoComponent`
- **注意**：不能使用中文，必须使用英文和连字符

### 2. DevComponentPath 路径规则

#### 对于 Vue 单文件组件（.vue）
```javascript
"DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
```

#### 对于内联定义组件（.js）
```javascript
"DevComponentPath": "/plugins/demo-plugin/index.js"
```

### 3. 组件类型说明

#### Vue 单文件组件
- 文件扩展名：`.vue`
- 位置：`src/views/plugins/插件名/components/组件名.vue`
- 示例：`test-plugin` 的所有组件

#### 内联定义组件
- 文件扩展名：`.js`
- 位置：`src/views/plugins/插件名/index.js`
- 示例：`demo-plugin` 的组件

## 常见错误及解决方案

### 1. 组件名称错误
```javascript
// ❌ 错误：使用中文
"DevComponentName": "测试插件"

// ✅ 正确：使用英文和连字符
"DevComponentName": "test-plugin-TestHome"
```

### 2. 路径错误
```javascript
// ❌ 错误：路径不正确
"DevComponentPath": "/views/plugin/test-plugin/home"

// ✅ 正确：使用正确的插件路径
"DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
```

### 3. 组件不存在
```javascript
// ❌ 错误：组件文件不存在
"DevComponentPath": "/plugins/test-plugin/components/NonExistent.vue"

// ✅ 正确：确保组件文件存在
"DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
```

## 测试步骤

### 1. 配置字段
在表单字段配置中添加插件组件字段

### 2. 启用插件
确保插件在插件管理页面中已启用

### 3. 刷新页面
重新加载页面以应用配置

### 4. 检查组件
查看组件是否正确渲染

## 调试技巧

### 1. 检查浏览器控制台
- 查看是否有组件导入错误
- 检查组件注册状态

### 2. 验证配置
- 确认 `DevComponentName` 格式正确
- 确认 `DevComponentPath` 路径存在

### 3. 检查插件状态
- 确认插件已启用
- 确认插件文件结构正确

## 总结

正确的插件组件配置需要：

1. ✅ **正确的组件名称**：使用英文和连字符
2. ✅ **正确的组件路径**：指向实际存在的文件
3. ✅ **正确的组件类型**：区分 .vue 和 .js 文件
4. ✅ **插件已启用**：确保插件系统正常工作

按照这些规则配置，你的插件组件就能在选中区域中正常渲染了！ 