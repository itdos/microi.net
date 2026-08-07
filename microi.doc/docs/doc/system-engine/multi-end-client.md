# 📱 PC、WebOS、移动 Web、UniApp 与 App 壳

Microi吾码的“移动端”不是单一工程。管理后台的响应式页面、WebOS 桌面、原生动态小程序和 HBuilderX App 壳分别服务不同场景，但共享 DiyToken、OsClient、菜单权限、表单元数据与接口引擎。

## 五种运行形态

| 形态 | 源码 | 适用场景 | 关键特点 |
|---|---|---|---|
| PC 经典界面 | `Microi.Client/` | 管理后台、设计器、复杂表格 | Vue 3 + Element Plus，功能最完整 |
| WebOS 桌面 | `Microi.Client/src/views/webos/` | 桌面化门户、大屏/触控入口 | macOS / Windows 风格桌面、Dock、小组件和应用容器 |
| 移动 Web | `Microi.Client/src/views/mobile/` | 浏览器或 App 壳内的轻量移动工作台 | 首页、工作台、消息、聊天、AI 助手、个人中心 |
| 原生动态端 | `microi.uniapp/` | 微信小程序、H5、App 与客户原生业务 | uni-app 原生页面、动态表单、Profile 与租户业务分层 |
| 5+App 壳 | `microi.app/` | 把完整 Web 管理端包装成 APK/IPA | 在线 WebView 更新，保留 `plus.bluetooth`、扫码、相机等能力 |

## PC 经典界面与 WebOS

`Microi.Client` 的常规路由使用经典 Layout。WebOS 使用独立全屏路由 `/os`，通过 `src/utils/webos-detect.js` 在构建时检测可选目录：

- WebOS 源码存在时，启用桌面风格选择、Dock、桌面分页、小组件与应用容器；
- 目录不存在时，路由与登录流程自动回退经典界面，构建不应失败。

两种界面共用当前用户、菜单、表单与 V8 能力，但桌面布局状态由 WebOS Pinia Store 独立管理。修复 WebOS 时不要破坏经典界面；涉及状态栏、快捷入口或触控布局时要分别测试 macOS 风格、Windows 风格与经典风格。

## `Microi.Client` 移动 Web

同一 Web 工程内置 `/mobile/home`、`/mobile/workspace`、`/mobile/message`、`/mobile/chat`、`/mobile/ai-assistant` 和 `/mobile/profile`。它适合响应式 Web、平板和 App 壳，不等同于 `microi.uniapp` 的原生小程序页面。

PC 与移动入口应共享服务端权限和会话事实。仅把菜单在 CSS 中隐藏不构成权限控制；服务端仍需校验菜单、表、字段和数据范围。

## `microi.uniapp` 原生动态端

`microi.uniapp` 基于 uni-app + Vue 3 + Vite。通用列表、详情、动态表单、消息、AI 助手与个人中心原生运行，不通过 WebView 打开后台。

主要分层：

| 目录 | 责任 |
|---|---|
| `src/platform/` | 登录、权限、请求、缓存、动态表单、列表状态、AI、分享、安全区与 UI 边界 |
| `src/components/mci-*` | 受 Microi.UI 令牌约束的跨端组件 |
| `src/tenants/<tenant>/` | 客户专属业务、页面和表单适配 |
| `profiles/<profile>/` | OsClient、API、品牌、功能、路由、`pages.json` 与 `manifest.json` 事实源 |
| `src/generated/` | Profile 构建生成物，不手工编辑 |

动态表单以 `sys_menu` 作为入口与授权上下文，以 `diy_table` / `diy_field` 作为字段事实源。后台修改字段、显隐、控件、数据源和 Tabs 后，客户端按版本指纹更新；普通元数据变化不应要求重新发布小程序。

新增租户应创建独立 Profile 与 `src/tenants/<tenant>/`，不能在平台层散落 `if (OsClient === ...)`。默认构建指向哪个 Profile 以当前仓库说明为准，发布前必须明确目标租户，避免把客户 A 的品牌、API 或路由打进客户 B 的包。

## `microi.app` HBuilderX 壳

`microi.app` 使用 5+App/Wap2App，把远程 `Microi.Client` 运行在 launcher WebView 中。它不是把 Vue 项目转换成 uni-app，因此适合需要完整后台能力又希望使用原生蓝牙、扫码、相机、文件与状态栏 API 的场景。

核心特征：

- `index.html` 配置远程 `MICROI_SERVER_URL`；Web 更新后通常无需重打 APK；
- `window.plus` 存在时，`V8.ClientType` 根据系统返回 Android 或 iOS；
- 蓝牙打印使用 `plus.bluetooth`，扫码使用 `plus.barcode`；
- 原生权限、图标、签名、状态栏或安全区配置变化仍需重新打包安装。

手机与平板不能使用一条全局状态栏规则。当前壳在窄屏保持手机沉浸式，在宽屏/平板读取真实状态栏与安全区高度，旋转和恢复时重新判断。设备 ROM 返回错误高度时只对平板 PC 布局使用安全保底，不能为了修平板而取消全部手机沉浸效果。

## 如何选择

| 目标 | 选择 |
|---|---|
| 完整后台设计与管理 | PC 经典界面 |
| 桌面化门户或触控桌面 | WebOS |
| 浏览器内快速适配手机 | `Microi.Client` 移动 Web |
| 微信小程序和原生业务体验 | `microi.uniapp` |
| 完整 Web 后台 + 原生蓝牙/扫码 | `microi.app` |
| 单个复杂定制页面独立发布 | [前端微服务](/doc/system-engine/micro-app) |

## 跨端一致性原则

1. 登录成功后都进入 DiyToken 体系，不为某端另建长期权限 Token。
2. 共享业务状态进入服务端或共享 Redis/数据库，不能依赖某个页面实例常驻。
3. PC、移动 Web、UniApp 与 App 壳分别处理布局和安全区，但复用同一业务状态机与权限策略。
4. 上传、蓝牙、相机、定位、分享等原生权限必须在真机验收；浏览器构建通过不能代替硬件成功。
5. 跨端新增字段时先验证动态元数据能否覆盖，只有新增原生交互或客户专属流程才发版。

## 验收矩阵

- PC：经典界面登录、菜单、表格、表单、设计器和退出。
- WebOS：macOS / Windows 桌面、Dock、应用打开、主题、语言、桌面切换。
- 移动 Web：底部导航、消息/聊天、返回栈、横竖屏与软键盘。
- UniApp：微信开发者工具、真机登录、动态表单、上传、定位、分享和消息。
- App 壳：Android 手机、平板横竖屏、旋转、状态栏、返回键、扫码与蓝牙。
- 服务端：普通角色直接访问路由/API 时仍被权限策略正确限制。
