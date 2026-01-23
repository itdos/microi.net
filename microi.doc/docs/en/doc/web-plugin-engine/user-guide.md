# Plug-in System Usage Guide

## Overview

This guide is intended for end users and describes how to use the plug-in system, including plug-in enablement, component configuration, common problem resolution, and more.

## Quick Start

### 1. Visit the plug-in management page

1. Find the "Plug-in Management" menu in the app
2. Click to enter the plug-in management page
3. View a list of all available plugins

### 2. Enable the plug-in

1. Find the plug-in that needs to be enabled in the plug-in list.
2. Click the "Enable" button
3. Confirm the enable operation
4. Refresh the page to apply the routing changes

### 3. Access plug-in functionality

- **Routing Page**：Access plug-in routing via menu or directly
- **Component function**：Use a plug-in component in a form or page

## Plug-in Management

### Plug-in Status Description

- **Enabled**：Plug-in activated, feature available
- **Disabled**：Plug-in not activated, feature not available

### Plug-in operation

#### Enable Plugin
```javascript
// 系统会自动：
// 1. 注册插件路由
// 2. 加载插件组件
// 3. 初始化插件功能
```

#### Disable plug-ins
```javascript
// 系统会自动：
// 1. 卸载插件路由
// 2. 清理插件资源
// 3. 停止插件服务
```

#### Refresh plug-in
- Click the "Refresh" button to re-scan the plugin
- Applicable to the situation after the plug-in file is updated

#### Reset default configuration
- Click the "Reset Default" button to restore the system default configuration
- clears all user-defined settings

## Use plug-in components in the selected area

### 1. Configure form fields

Set in form field configuration:

```javascript
{
  "Component": "DevComponent",
  "Config": {
    "DevComponentName": "插件名-组件名",
    "DevComponentPath": "/plugins/插件名/组件路径"
  }
}
```

### 2. Supported plug-in components

#### Test plug-in components
- **TestHome**：'test-plugin-TestHome'
- **TestCounter**：'test-plugin-TestCounter'
- **TestForm**：'test-plugin-TestForm'

#### Demo plug-in components
- **DemoComponent**：'demo-plugin-DemoComponent'

### 3. Component configuration example

#### Use the counter component of the test plug-in
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

#### Components that use the demo plug-in
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

## Use of plug-in features

### 1. Test the plug-in function

#### Visit the test plug-in page
- Routing:`/plugin/test-plugin/home`
- Function: counter, form, list and other test functions

#### Using Test Components
- **Counter**：Click the button to increase/decrease the value
- **Form**：Fill out the form and submit
- **List**：View and manage test data

### 2. Demo plug-in function

#### Visit the demo plug-in page
- Routing:`/plugin/demo-plugin/demo`
- Function: Simple Text Box Demo

#### Using the Presentation Component
- Enter content in text box
- View real-time feedback information
- Test button function

## Common Problem Solving

### 1. Plug-in cannot be enabled

#### Problem Description
No change in plug-in status after clicking "Enable" button

#### Solution
1. Check the browser console for error messages
2. Confirm that the plug-in file exists and has correct syntax
3. Try to refresh the page and re-enable it.
4. Check whether the plug-in configuration is correct

#### Debugging steps
```javascript
// 在浏览器控制台中检查
console.log('插件状态:', pluginConfigManager.getEnabledPlugins())
console.log('插件配置:', pluginConfigManager.getConfig())
```

### 2. The plug-in page cannot be accessed.

#### Problem Description
Plugin is enabled, but 404 or blank page appears when accessing routes

#### Solution
1. Confirm that the plug-in routing configuration is correct
2. Check whether the component import path is correct
3. View the browser console error message
4. Try re-enabling the plug-in

#### Debugging steps
```javascript
// 检查路由是否正确注册
console.log('当前路由:', this.$route)
console.log('路由配置:', this.$router.getRoutes())
```

### 3. The component cannot be rendered

#### Problem Description
A plug-in component is configured in the selected area, but the component does not display

#### Solution
1. Verify that the component configuration format is correct
2. Confirm whether the component path exists
3. Check that the component syntax is correct
4. View the browser console error message

#### Debugging steps
```javascript
// 检查组件是否正确注册
console.log('已注册组件:', pluginComponentAdapter.getAllPluginComponents())
```

### 4. The plug-in function is abnormal

#### Problem Description
The plug-in can be accessed, but the function is abnormal or an error is reported.

#### Solution
1. Check the plug-in code for syntax errors
2. Confirm whether the plug-in dependency is loaded correctly
3. View the browser console error message
4. Try to disable and re-enable the plug-in.

## Performance optimization recommendations

### 1. Rational use of plug-ins

- Enable only required plugins
- Avoid enabling too many plug-ins at the same time
- Disable unused plug-ins in time

### 2. Component usage optimization

- Avoid using too many plug-in components in the same page
- Rational use of the lazy loading function of the component
- Timely clean up unneeded component instances

### 3. Caching Strategy

- Using the browser's caching mechanism
- Avoid frequent refresh of plug-in configuration
- Rational use of the cache function of the plug-in

## Safety Precautions

### 1. Plug-in Source

- Use only plug-ins from trusted sources
- Verify code security for the plug-in
- Avoid using unverified third-party plugins

### 2. Authority control

- Understanding Permission Requirements for Plug-ins
- Avoid granting unnecessary permissions
- Periodically review the permission settings for the plug-in

### 3. Data security

- Pay attention to plug-in access to data
- Avoid disclosure of sensitive information
- Regular backup of important data

## Troubleshooting Process

### 1. Problem diagnosis

1. * * Collect information * *: Record the problem phenomenon, error information and operation steps
2. **Environment Check**: Confirm the browser version, plug-in version, and system environment
3. **Log Analysis**: View the browser console, network requests, and error logs

### 2. Problem solving

1. Basic Check: Verify the basic configuration, file existence, and syntax correctness.
2. **Functional Test**: Step-by-step test of each functional module
3. **Environment Recovery**: Try to reset configuration, clear cache, reinstall

### 3. Problem prevention

1. **Regular maintenance**: Regularly check the status of the plug-in and update the plug-in version.
2. **Backup Configuration**: Back up important plug-in configurations and custom settings
3. **Monitoring System**: Focus on system performance, error logs, and user feedback

## Get help

### 1. Self-help solution

- View the FAQ section of this document
- Check the documentation for the plug-in
- Search for related technical information

### 2. Technical support

- Contact System Administrator
- Submit Problem Report
- Participate in technical discussions

### 3. Feedback suggestions

- Report functional issues
- put forward suggestions for improvement
- Share use experience

## Summary

With this guide, you can:

1.✅Quick start plug-in system
2.✅Proper configuration and use of plug-ins
3.✅Solve common problems
4.✅Optimize the use experience
5.✅Ensure system security

Start using the plug-in system and enjoy richer application features!