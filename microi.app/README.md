# Microi吾码 - HBuilderX APK 打包指南

## 概述

Microi.Client 是一个标准的 Vue 3 + Vite 项目（非 uni-app），无法直接使用 HBuilderX 的 uni-app 打包。

本目录提供了 **5+App (Wap2App)** 方案，将 Microi.Client 包装成原生 APK，同时保留 `plus` API 能力（蓝牙打印、摄像头扫码等）。

## 打包模式：在线模式

APK 启动后，通过 WebView 直接导航（`location.replace`）到远程服务器地址，优点：
- ✅ APK 体积小（仅包含壳工程）
- ✅ Web 端更新后 APK 自动生效，无需重新打包
- ✅ 支持所有 `plus` API（蓝牙、扫码、定位等）
- ✅ 远程页面运行在 launcher webview 中，`window.plus` 及返回键事件完全可用

### 手机与平板安全区

`manifest.json` 中的 `plus.statusbar.immersed` 保持为 `supportedDevice`，手机端继续使用沉浸式状态栏。
该 APK 会直接承载远程 Microi.Client，并与其响应式断点保持一致：

- 宽度 `<= 768px`：进入移动布局，WebView `top` 为 `0px`，保留沉浸式视觉效果；
- 宽度 `> 768px`：进入 PC/平板布局，通过 `plus.navigator.getStatusbarHeight()` 获取真实逻辑高度，
  将当前 WebView 动态下移，避免 Android 状态栏覆盖 PC 顶栏、头像和退出入口；
- 横竖屏切换或应用从后台恢复时会重新判断，回到移动布局后恢复 `top: 0px`。

不要写死 `24px` 等状态栏高度，也不要把 `immersed` 全局改为 `none`。底部手势区域继续由
`plus.safearea.bottom.offset = auto` 处理。

修改状态栏配置后需要重新云打包并安装 APK；仅更新远程 Web 页面不会改变已安装 APK 的原生窗口配置。
可先运行配置回归测试：

```bash
node --test tests/tablet-safe-area.spec.mjs
```

真机验收至少覆盖 Android 手机竖屏、平板横屏、平板竖屏以及运行中旋转：手机仍为沉浸式；平板
PC 布局的系统状态栏与页面不重叠，顶部头像可点击、退出登录菜单可正常打开，底部手势区不遮挡操作。

**配置方法**：编辑 `index.html` 顶部的 `MICROI_SERVER_URL`，修改为实际服务器地址：
```javascript
<!-- 【配置项】请修改为你的实际服务器地址 -->
<script>var MICROI_SERVER_URL = 'https://your-domain.com';</script>
```

## 打包步骤

### 第一步：安装 HBuilderX

下载并安装 [HBuilderX](https://www.dcloud.io/hbuilderx.html)（推荐正式版）。

### 第二步：导入项目

1. 打开 HBuilderX
2. 菜单：文件 → 导入 → 从本地目录导入
3. 选择 `microi.app/` 目录
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
microi.app/
├── manifest.json       # HBuilderX 应用配置（权限、图标等）
├── index.html          # 5+App 入口页面（顶部配置 MICROI_SERVER_URL）
└── README.md           # 本文件
```

## 技术说明

### 为什么不直接用 uni-app 打包？

Microi.Client 是 Vue 3 + Vite + Element Plus 项目，使用了大量 Web 端专有库（Monaco Editor、ECharts、FullCalendar 等），无法转换为 uni-app 项目。5+App (Wap2App) 方案直接在 WebView 中运行标准 Web 应用，同时注入 `plus` 原生 API。

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

**Q: 扫一扫时打开了系统相机？**
A: 可能是使用了http地址，而不是https，导致权限问题

**Q: 打包后蓝牙打印不工作？**
A: 检查 manifest.json 是否勾选了 Bluetooth 模块，以及 Android 权限是否包含 BLUETOOTH 相关权限。

**Q: 加载速度慢？**
A: 可启用 HTTPS + HTTP/2 来提升传输效率。

**Q: 白屏或页面不加载？**
A: 确认 `MICROI_SERVER_URL` 地址正确可访问，服务器 CORS 策略允许 WebView 访问。

**Q: 如何调试？**
A: HBuilderX 菜单：运行 → 运行到手机或模拟器，可实时调试。Chrome 也可通过 `chrome://inspect` 调试 WebView。

