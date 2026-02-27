# Microi吾码 - HBuilderX APK 打包指南

## 概述

microi.web 是一个标准的 Vue 3 + Vite 项目（非 uni-app），无法直接使用 HBuilderX 的 uni-app 打包。

本目录提供了 **5+App (Wap2App)** 方案，将 microi.web 包装成原生 APK，同时保留 `plus` API 能力（蓝牙打印、摄像头扫码等）。

## 两种打包模式

### 模式A：在线模式（推荐）

APK 启动后通过 WebView 加载远程服务器地址，优点：
- ✅ APK 体积小（仅包含壳工程）
- ✅ Web 端更新后 APK 自动生效，无需重新打包
- ✅ 支持所有 `plus` API（蓝牙、扫码、定位等）

**配置方法**：编辑 `index.html`，修改 `APP_CONFIG.serverUrl` 为实际地址：
```javascript
var APP_CONFIG = {
    serverUrl: 'https://your-domain.com',  // 改为你的服务器地址
    useLocalMode: false  // 在线模式
};
```

### 模式B：离线模式

将构建产物打包进 APK，优点：
- ✅ 首次加载快，无需网络即可打开页面框架
- ❌ 更新需重新打包 APK

**配置方法**：
1. 运行 `./build-apk.sh` 自动构建并复制文件
2. 或手动操作：
   ```bash
   # 在 microi.web 目录下
   npm run build
   # 复制构建产物
   cp -r bin/Release/dist hbuilder-app/dist
   ```
3. 编辑 `index.html`，设置本地模式：
   ```javascript
   var APP_CONFIG = {
       serverUrl: '',
       useLocalMode: true  // 离线模式
   };
   ```

## 打包步骤

### 第一步：安装 HBuilderX

下载并安装 [HBuilderX](https://www.dcloud.io/hbuilderx.html)（推荐正式版）。

### 第二步：导入项目

1. 打开 HBuilderX
2. 菜单：文件 → 导入 → 从本地目录导入
3. 选择 `microi.web/hbuilder-app/` 目录
4. 项目类型选择 **5+App**

### 第三步：配置应用信息

双击 `manifest.json` 打开可视化配置：

1. **基础配置**
   - 应用名称：`Microi吾码`（或自定义）
   - AppID：点击"重新获取"生成 DCloud AppID
   - 版本号：`4.7.7`

2. **App 图标**
   - 准备一张 1024×1024 的图标
   - 点击"自动生成所有图标并替换"

3. **App 模块配置**（重要！）
   勾选以下模块：
   - ☑ Bluetooth（蓝牙）
   - ☑ Barcode（扫码）
   - ☑ Camera（摄像头）
   - ☑ Geolocation（定位）- 如需要

4. **App 权限配置**
   确认已添加以下 Android 权限：
   - `android.permission.BLUETOOTH`
   - `android.permission.BLUETOOTH_ADMIN`
   - `android.permission.BLUETOOTH_CONNECT`
   - `android.permission.BLUETOOTH_SCAN`
   - `android.permission.CAMERA`
   - `android.permission.INTERNET`
   - `android.permission.ACCESS_FINE_LOCATION`

### 第四步：云打包生成 APK

1. 菜单：发行 → 原生App-云打包
2. 选择 Android 平台
3. 选择"使用公共测试证书"（测试阶段）或上传自己的签名证书
4. 点击"打包"
5. 等待云端打包完成（通常 3-10 分钟）
6. 下载生成的 APK 文件

### 第五步：安装测试

将 APK 安装到 Android 手机上测试：
- 蓝牙打印功能（`V8.ClientType` 应返回 `Android`）
- 摄像头扫码功能（使用 `plus.barcode` 原生扫码）
- 页面加载和功能是否正常

## 目录结构

```
hbuilder-app/
├── manifest.json       # HBuilderX 应用配置（权限、图标等）
├── index.html          # 5+App 入口页面
├── build-apk.sh        # 离线模式构建脚本
├── dist/               # 离线模式：构建产物（build-apk.sh 自动生成）
└── README.md           # 本文件
```

## 技术说明

### 为什么不直接用 uni-app 打包？

microi.web 是 Vue 3 + Vite + Element Plus 项目，使用了大量 Web 端专有库（Monaco Editor、ECharts、FullCalendar 等），无法转换为 uni-app 项目。5+App (Wap2App) 方案直接在 WebView 中运行标准 Web 应用，同时注入 `plus` 原生 API。

### plus API 可用性

在 APK 环境中，以下 API 自动可用：
- `window.plus` - 5+App 全局对象
- `plus.bluetooth` - 蓝牙 API（蓝牙打印）
- `plus.barcode` - 条码扫描
- `plus.camera` - 摄像头
- `plus.os` - 系统信息
- `plus.io` - 文件系统
- `plus.navigator` - 导航和状态栏
- `plus.nativeUI` - 原生 UI（Toast、Alert 等）

### ClientType 检测

已在 `diy.common.js` 中实现 `GetClientType()` 方法，APK 环境会检测到 `window.plus` 并通过 `plus.os.name` 返回 `Android` 或 `IOS`，从而正确走蓝牙打印分支。

## 常见问题

**Q: 打包后蓝牙打印不工作？**
A: 检查 manifest.json 是否勾选了 Bluetooth 模块，以及 Android 权限是否包含 BLUETOOTH 相关权限。

**Q: 在线模式加载慢？**
A: 可启用 HTTPS + HTTP/2，或考虑使用离线模式在本地加载核心资源。

**Q: 白屏或页面不加载？**
A: 确认 `APP_CONFIG.serverUrl` 地址正确可访问，服务器 CORS 策略允许 WebView 访问。

**Q: 如何调试？**
A: HBuilderX 菜单：运行 → 运行到手机或模拟器，可实时调试。Chrome 也可通过 `chrome://inspect` 调试 WebView。
