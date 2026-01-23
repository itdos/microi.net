# Plug-in Component Configuration Example

## Correct configuration format

### 1. Test plug-in component configuration

#### TestHome components
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

#### TestCounter components
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

#### TestForm components
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

### 2. Demo plug-in component configuration

#### DemoComponent components
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

## Important Configuration Notes

### 1. DevComponentName naming rules

- **Format**：'Plug-in name-component nela'
- **Example**："test-plugin-TestHome", "demo-plugin-DemoComponent'
- **Attention**：Cannot use Chinese, must use English and hyphen

### 2. DevComponentPath path rules

#### For Vue single-file components (.vue)
```javascript
"DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
```

#### For inline definition components (.js)
```javascript
"DevComponentPath": "/plugins/demo-plugin/index.js"
```

### 3. Component Type Description

#### Vue Single File Component
- File extension:`.vue`
- Location:`src/views/plugins/插件名/components/组件名.vue`
- Example:`test-plugin`All components

#### Inline Definition Component
- File extension:`.js`
- Location:`src/views/plugins/插件名/index.js`
- Example:`demo-plugin`Components

## Common Errors and Solutions

### 1. Component name error
```javascript
// ❌ 错误：使用中文
"DevComponentName": "测试插件"

// ✅ 正确：使用英文和连字符
"DevComponentName": "test-plugin-TestHome"
```

### 2. Path Error
```javascript
// ❌ 错误：路径不正确
"DevComponentPath": "/views/plugin/test-plugin/home"

// ✅ 正确：使用正确的插件路径
"DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
```

### 3. Component does not exist
```javascript
// ❌ 错误：组件文件不存在
"DevComponentPath": "/plugins/test-plugin/components/NonExistent.vue"

// ✅ 正确：确保组件文件存在
"DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
```

## Test steps

### 1. Configure fields
Add a plug-in component field in the form field configuration

### 2. Enable the plug-in
Ensure the plug-in is enabled in the plug-in management page

### 3. Refresh the page
Reload the page to apply the configuration

### 4. Check the components
Check whether the component is rendering correctly

## Debugging skills

### 1. Check the browser console
- Check for component import errors
- Check component registration status

### 2. Verify the configuration
- Confirm`DevComponentName`Correct format
- Confirm`DevComponentPath`Path Existence

### 3. Check plug-in status
- Confirm that the plug-in is enabled
- Confirm that the plug-in file structure is correct

## Summary

Proper plug-in component configuration requires:

1.✅**Correct component name**: Use English and hyphens
2.✅**Correct component path**: Points to the actual file
3.✅**Correct component type**: Distinguish between. vue and. js files
4.✅**Plugin Enabled**: Ensure that the plugin system is working properly

According to these rules, your plug-in components will be able to render normally in the selected area!