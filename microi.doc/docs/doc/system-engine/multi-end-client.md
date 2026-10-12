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

从原生详情进入编辑时，保存和取消都返回原来的详情页并保留当前 Tab。取消丢弃未保存字段；保存成功后详情重新读取服务端结果，并通知来源列表刷新。直接从列表打开新增或编辑时，返回来源列表。导航参数继续携带真实菜单授权上下文，手工修改 URL 不能获得编辑权限。

IoT 快照不存在时，原生表单展示可读的业务空状态，不向用户暴露原始表名或 SQL 条件；权限拒绝和网络错误仍显示失败原因。关联设备尚无遥测时，快照接口可返回完整指标结构，未知值显示 `--`，真实的零值、离线状态及数据权限保持原义。

新增租户应创建独立 Profile 与 `src/tenants/<tenant>/`，不能在平台层散落 `if (OsClient === ...)`。默认构建指向哪个 Profile 以当前仓库说明为准，发布前必须明确目标租户，避免把客户 A 的品牌、API 或路由打进客户 B 的包。

### 登录引导与返回栈

业务入口、分享接收和接口鉴权失败共用一次登录导航；登录页到达前不重复压栈，导航失败后允许重试。登录成功必须同时取得 DiyToken 和用户 `Id`，迟到的失效提示不能把新会话重新带回登录页。

登录后优先恢复原业务页实例和查询状态。存量连续登录页一次移出；若旧登录页夹在业务历史中，则清栈进入目标，避免再次返回登录页。升级需重新构建客户端，无须修改服务端元数据。执行 `npm run check:auth-session`，并在开发者工具与真机验证冷启动、并发失效、分享入口及登录后的返回行为。

业务页应在鉴权前保存入口参数；`onLoad` 因未登录暂停时，登录返回的 `onShow` 必须继续一次初始化，并合并两个生命周期的并发加载。案例册、服务档案、设备报修等原生页不能在返回后永久停留在骨架屏。

### 手机号统一登录与长效会话

面向用户的 H5/App 默认使用“手机号 → 图形验证码 → 短信验证码 → 登录或自动注册”
的一条流程，密码为次级备用入口。已注册手机号直接登录；新手机号只有在当前租户
开放注册时才创建最低权限用户。企业封闭账号保留其策略，前端入口不能放开员工注册。
小程序具备正式手机号授权能力时可优先授权，仍共用平台 DiyToken。

| 环节 | 实际要求 |
|---|---|
| 验证码 | 图形码校验短信发送，短信码证明手机号控制权；服务端限频、过期、用途绑定和一次性消费 |
| 登录结果 | 同时取得成功码、DiyToken 与用户 `Id`，注册/已有账号不分成两套长期身份系统 |
| 本地恢复 | Token、用户与稳定 `did` 按 `ApiBase + OsClient` 隔离；写入失败不继续成功导航 |
| 移动有效期 | 读取子租户 `AccessTokenLifetime`（单位天），默认 30 天；租户可设 20 天或其它值，不能在页面写死 |
| 旧换新 | SDK 按 JWT 到期窗口续签并接收每次响应的 `authorization`；前台恢复立即检查，多个请求共用一次续签 |
| 退出/切换 | 拒绝旧身份的迟到响应；被吊销、已失效或跨租户 Token 不能靠本地持久化继续使用 |

多角色用户保持同一源码与同一会话，工作模式由服务端已审核角色决定。申请/审核
尚未通过时保留最低权限；切换页面不能代替后台授权。会话细节见
[安全与 Token 会话](../more/security.md)。

### 地图、短信和收款服务

服务配置统一进入目标租户系统设置的安全项，前端只消费当前端必要的白名单运行配置。
跨租户复用须经过授权、产品与域名核验，由可信后端按最小键集合在目标租户重新加密；
不能复制整条 SaaS 配置、盲拷租户密文或把密钥放进源码和应用包。

高德 JS API 与 Web 服务 REST Key 对应不同产品：H5 明确采用 `js` 或 `server-static`
模式；前者用官方浏览器 SDK，后者用官方 REST 静态地图图片并配合服务端 POI 与路线。
静态地图不提供交互瓦片的拖动/缩放体验，也不能绕过供应商授权；原生端另走对应适配。
核对对应产品、安全码/代理、域名与商业权限。JS 模式检查真实瓦片/要素；静态模式检查
供应商成功响应、真实图片类型、像素尺寸与可见显示，两者都验证定位、搜索和路线。
地图失败保留供应商阶段与追踪号，并提供拒绝定位、超时和空结果的降级路径。

一家公司运营时通常只需一组支付宝、一组微信支付配置；多通道按明确业务需求设计。
客户账号尚未开通时先完成模板、后台入口与失败路径，正式短信到达、支付回调、退款
对账和电子开票另做业务验收，不能把沙箱或测试桩写成已真实收款/出票。

### 通用 App 登录平台切换

`microi.uniapp` 的 `standard` Profile 可构建一个通用原生 App。该能力只在 `APP-PLUS` 登录页出现，H5 和小程序仍使用构建时固定配置：

1. 协议只能从 `https://`、`http://` 下拉框选择，API 输入框不接收重复协议；`OsClient` 单独填写。
2. 客户端先匿名读取候选租户的 `GetSysConfig`，连接和租户有效后才保存设置。
3. 平台切换会断开旧消息连接，清除旧 DiyToken、用户、菜单、表元数据、页面会话和业务缓存；切换前发出的迟到响应不能写回新会话。
4. 系统标题、Logo、FileServer、验证码、隐私协议及登录 RSA 公钥从目标平台重新加载。记住的账号和 RSA 密文以 `ApiBase + OsClient` 为隔离边界，不能跨平台复用。
5. 通用 App 使用 `npm run build:app:standard` 构建；默认客户交付命令仍保持原 Profile，不会因通用模式改变客户品牌与路由。

HTTPS 是默认值。`http://` 只建议连接确实无法升级的可信内网或旧设备。iOS 的 App Transport Security 与 Android 9+ 默认策略都会拒绝不安全连接；允许用户填写任意 HTTP 地址需要分别声明全局 ATS 与 Android cleartext 例外。Apple 要求 ATS 例外在审核中提供理由，并明确建议优先修复服务端或使用更窄的域名例外。`standard` Profile 为这项明确需求声明例外，客户专属 Profile 不默认继承；发布前必须从最终 IPA/APK 回读原生清单并做真机验证。参见 [Apple：防止不安全的网络连接](https://developer.apple.com/documentation/security/preventing-insecure-network-connections)、[Android：Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)、[DCloud：iOS 原生配置文件](https://uniapp.dcloud.net.cn/tutorial/app-nativeresource-ios.html) 与 [DCloud：Android 原生清单](https://uniapp.dcloud.net.cn/tutorial/app-nativeresource-android.html)。

`build:app:standard` 的输出是 App 编译资源，不是已签名安装包。DCloud 云打包前执行 `npm run profile:sync -- standard`，让 `src/manifest.json`、`src/Info.plist`、`src/AndroidManifest.xml` 和运行配置处于同一 Profile；云打包及安装包回读结束后执行 `npm run profile:sync -- xjy && npm run check:profiles` 恢复仓库默认交付态。不要使用默认 `xjy` 源码配置打通用包。

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
| 面向多个吾码平台/租户的通用原生 App | `microi.uniapp` 的 `standard` App 构建 |
| 完整 Web 后台 + 原生蓝牙/扫码 | `microi.app` |
| 单个复杂定制页面独立发布 | [前端微服务](/doc/system-engine/micro-app) |

## App Store 选型与审核边界

若目标是上架面向手机用户的正式 App，`microi.uniapp` 通常比 `microi.app` 更合适：前者有原生页面、动态表单、消息、AI、个人中心和设备能力；后者的核心仍是把远程管理后台放进 WebView。Apple 4.2 要求 App 的功能、内容和界面不能只是重新包装网站，所以纯套壳的 4.2 风险更高。不过，使用 uni-app 不等于自动过审，最终仍取决于安装包实际体验、业务完整性、隐私和审核材料。参见 [Apple App Review Guidelines 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)。

通用单一安装包并非天然违规。Apple 4.2.6 明确把承载多个客户内容的聚合/选择器模型列为模板服务的一种可接受方案；吾码通用 App 应由平台方直接提交，登录后提供真实原生业务价值，而不是帮助各客户批量提交大量近似 App。审核至少还需满足：

- 提供长期有效的审核账号或完整演示模式，并确保审核期间后端可访问；在 App Review Notes 写明平台地址、`OsClient` 和非显而易见的切换方式。
- 完成真机稳定性、IPv6 网络、弱网、上传、隐私协议、权限说明和所有外链检查。
- 若 App 内支持创建账号，必须提供可在 App 内发起的账号删除流程。
- 任意 HTTP 会降低传输安全并触发额外 ATS 说明；以“更容易过审”为目标的正式公共环境应优先全部升级 HTTPS。

审核要求以提交时的 [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) 和 [App 内账号删除要求](https://developer.apple.com/support/offering-account-deletion-in-your-app/) 为准。

## 跨端一致性原则

1. 登录成功后都进入 DiyToken 体系，不为某端另建长期权限 Token。
2. 共享业务状态进入服务端或共享 Redis/数据库，不能依赖某个页面实例常驻。
3. PC、移动 Web、UniApp 与 App 壳分别处理布局和安全区，但复用同一业务状态机与权限策略。
4. 上传、蓝牙、相机、定位、分享等原生权限必须在真机验收；浏览器构建通过不能代替硬件成功。
5. 跨端新增字段时先验证动态元数据能否覆盖，只有新增原生交互或客户专属流程才发版。

## H5 手机预览与底部导航

H5 使用浏览器提供的 `env(safe-area-inset-bottom)`，不能把 `screenHeight - windowHeight` 或 `screen.height - innerHeight` 当作安全区；非最大化窗口或缩放时，这些差值可能造成数百像素的错误底部空白。App/小程序读取各平台权威 inset，零值必须保留，禁止用 `inset || guessedFallback` 换成猜测值。验收包括物理屏幕与视口不同、桌面缩放和手机地址栏收展。

移动业务 H5 在桌面可用居中手机壳展示，手机与移动设备仿真则去掉壳标题、留边、圆角和边框，铺满当前可见区域。手机横屏不能仅因宽度超过桌面断点就重新套壳。

桌面手机壳内部仍按移动单列排列，不能因外窗变宽就把地图与主要操作区拆成两列。
桌面外窗、手机内屏和正文滚动区分别测量，装饰背景与持续动画也必须限制在内屏。

壳的高度、滚动和导航须由同一个布局负责：

| 布局部分 | 要求 |
|---|---|
| 内屏 | 有明确高度上限；H5 动态可见高度有旧端兜底，不靠最小高度让整页越撑越长 |
| 头部与导航 | 不收缩；导航外框贴内屏底边，菜单下方只有真实安全区与设计间距 |
| 正文与包装层 | `flex:1; min-height:0; min-width:0`；普通单列页只有一个正文滚动区 |
| 安全区 | 统一运行时变量、消费一次；流内导航不再给正文预留整栏，覆盖式导航只预留一次实测总高度 |

桌面壳限定为 430px 并不代表 `rpx` 也按 430px 换算。配置 `pages.json.globalStyle` 的 `rpxCalcMaxDeviceWidth / rpxCalcBaseDeviceWidth` 时要与预览断点和设计基准一致；全宽使用百分比或 flex，避免导航高度随 4K 外窗放大。具体参数见 [DCloud 宽屏适配](https://uniapp.dcloud.io/tutorial/adapt.html)。

验收至少切换三个主 Tab，覆盖短内容、空态、长内容到底、桌面矮屏、手机横竖屏与键盘关闭后恢复。真实测量内屏、导航外框和菜单触摸区：例如导航底边与内屏底边相差不超过 2 CSS px；导航内部高度也应符合事先确定的设计值。图标存在或外框贴底都不能替代整栏几何验收。

使用视口截图观察首屏；长页 `fullPage` 截图不能证明导航贴底。键盘可能只缩小 visual viewport，动态高度单位也不能代替所有设备实测；浏览器 resize、开发者工具与真机键盘证据分别记录。参考 [W3C Viewport 交互部件规则](https://www.w3.org/TR/css-viewport-1/#interactive-widget-section)。

## 精致动效与首版交付

首版同时提供统一图标、按钮按下/加载、入场和骨架屏反馈。品牌展示或要求持续动效时，
可增加轻量流光、光晕、呼吸和装饰漂浮，主要使用 `transform/opacity`；正文、输入框与
关键按钮保持稳定。支持减少动态效果，隐藏/后台暂停，恢复与路由切换不累积监听。

动态效果须在实际运行页面的多个时间点可见；只找到 `@keyframes` 或一张静态截图
不能证明效果。装饰不夺取触摸，不触发业务请求，不伪造车辆、交易或报表数据。

完整产品包含管理需求时，交付后台父子菜单、权限、明细/审核及可追溯报表；测试运营
数据按授权生成、保留来源标识并与真实资金隔离。正式可编辑源码和测试维护在唯一
`AI应用/{appKey}`，临时目录不是发布源。

发布证据分层记录：本次源码/构建 → MCP 私有源码与运行产物终态 → CDN 文件回读 →
官网推荐/试用卡片 → 公开 H5 真实业务。公开入口再测当前租户、登录、地图、角色、
动效和手机/桌面多视口；小程序/App 构建不能代替渠道上传、安装包或真机验收。

## 验收矩阵

- PC：经典界面登录、菜单、表格、表单、设计器和退出。
- WebOS：macOS / Windows 桌面、Dock、应用打开、主题、语言、桌面切换。
- 移动 Web：底部导航、消息/聊天、返回栈、横竖屏与软键盘。
- UniApp 小程序：微信开发者工具、真机登录、动态表单、上传、定位、分享和消息。
- UniApp App：候选平台探测、HTTPS/HTTP、跨平台会话清理、冷启动恢复、Android/iOS 真机与最终安装包配置回读。
- App 壳：Android 手机、平板横竖屏、旋转、状态栏、返回键、扫码与蓝牙。
- 服务端：普通角色直接访问路由/API 时仍被权限策略正确限制。
