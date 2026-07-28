# Microi 原生动态小程序

`microi.uniapp` 是 Microi AI 低代码平台的原生动态小程序基线，基于 **uni-app + Vue 3 + Vite**。默认 Profile 是已经完成客户交付验收的 **集福鲤版（xjy）**，因此直接执行原有开发、构建命令时，页面、功能、路由和视觉仍以集福鲤版本为准。

> 本项目不再使用 WebView 打开 Microi 后台。通用列表、详情、动态表单、消息、AI 助手和个人中心均原生运行；租户可继续添加商城、资讯、售后任务等独立业务。后台字段、数据源和移动端配置通过动态表单即时生效。

## 架构原则

- `src/platform/`：登录、权限、请求、动态表单、显示兼容、缓存、列表返回、定位、提醒、AI、分享和 UI 边界等平台能力。
- `src/tenants/<tenant>/`：某个客户独有的业务目录。集福鲤的订单、设备、售后、商城和业务表规则位于 `src/tenants/xjy/`。
- `profiles/<profile>/`：品牌、API、OsClient、功能开关、路由、`pages.json` 和 `manifest.json` 的可构建配置。
- `src/generated/`：构建前由 Profile 生成的只读桥接文件。业务代码不得手工判断某个 OsClient 来拼装整套产品。
- 默认 `npm run dev:mp-weixin`、`npm run build:mp-weixin`、`npm run build:h5` 始终使用 `xjy`，保证集福鲤交付状态不变；标准版使用带 `:standard` 的命令。
- 构建脚本只在子进程期间切换 Profile，并在成功、失败或中断后恢复源文件，避免开发工作区残留另一租户配置。

`check:profiles` 会同时检查集福鲤和标准 Profile，并确认仓库默认的 `pages.json`、`manifest.json` 与生成桥接文件仍精确指向集福鲤。

## Microi.UI 与 uni-ui

Microi.UI 是产品设计系统和最终交付标准，负责品牌令牌、布局、安全区、状态、动效、可访问性和统一质感；它不是要求重新制造所有底层控件。项目已引入 `uni-ui` 作为可选的跨端控件能力层，但遵循以下边界：

- 页面和租户业务不得直接导入 `@dcloudio/uni-ui`。
- 第三方控件只能在 `src/platform/ui/adapters/` 内由 `mci-*` 适配器封装。
- 适配器必须使用 Microi.UI 令牌和状态规范，外部不能看到第三方库的默认产品风格。
- 已通过验收的 44 类动态表单控件继续保持现状；只有出现真实能力缺口时才逐项接入，不为换库而重写。
- 未使用的 `uni-ui` 组件不会进入生产包，新增适配器后必须重新执行包体和截图验收。

## 核心能力

- **集福鲤工作台**：客户、联系人、跟进、订单、设备、售后任务、拜访打卡等快捷入口。
- **售后全流程**：接单、转派、到场、打卡、服务记录、案例册、耗材、反馈与任务状态处理。
- **原生业务页**：商城、资讯、即时消息、客户和业务列表不依赖 WebView。
- **动态表单**：运行时读取 Microi 表和字段元数据，在小程序内渲染原生控件并调用 FormEngine API 保存。
- **历史存值兼容**：地区数组、关联对象数组、富文本 HTML、旧字符串图片路径及新旧上传 JSON 都由统一显示层解析。
- **单一完整详情**：客户、订单等业务只保留一个详情入口；核心信息默认展开，次要字段与关联业务按真实表意分组折叠并延迟加载。
- **集福鲤 · AI助手**：由系统设置 `IsShowAiAssistant` 控制是否开放；开启后，Tab 页底部采用“左侧胶囊导航 + 右侧独立固定 AI 槽”，点击 AI 槽打开独立的全屏 AI 路由。模型通道、中转站运行模型和推理强度与 PC 端 AI 引擎保持一致；未登录用户只能看到登录提示，不请求任何业务数据。
- **安全区自适应**：使用实时状态栏、胶囊和底部 safe-area 数据，不依赖固定机型高度。
- **克制的水主题动效**：首页和“我的”顶部播放 CDN 静音循环水面视频，静态水图负责首帧和失败回退；登录页只使用静态水景与低成本 CSS 位移动效，避免微信原生视频层覆盖登录表单。
- **高性能交互**：分包加载、按需注入、骨架屏、请求去重、按用户隔离的短期缓存、错峰标签页预热和消息连接复用。AI 主体只在进入独立分包后加载，前台 Token 续签延迟执行并做一分钟节流，水面视频在首帧后启用且低性能设备自动回退静态图。
- **账号登录记忆**：账号密码登录支持分别记住账号和密码；本地只保存成功登录后的 RSA 密文和掩码，不保存明文密码，账号变更或密文复用失败会自动清除记忆。

## AI 数据权限

小程序 AI 统一调用 Microi 官方接口引擎 `mci_ai_data_assistant`。它不接受客户端自行声明角色、数据范围或可访问表，也不执行模型生成的 SQL；服务端先按当前 Token、角色策略和业务域查询数据，再将限量、脱敏后的结果交给获准模型分析。该能力采用 `mci_` 官方命名，可由不同项目按配置复用，不绑定集福鲤业务表。

AI 总开关位于“系统设置”的 `是否显示AI助手（IsShowAiAssistant）`，默认关闭且仅接受 `1` 为开启值。关闭时不显示右侧 AI 槽，左侧导航胶囊自动占用完整可用宽度；消息列表、通讯录、新建会话弹窗和历史缓存都会过滤旧 AI 会话。直接访问独立助手路由只呈现完整的普通消息中心空状态，访问旧 `id=AI` 会话会返回消息中心，且不会请求模型、会话记录或业务数据。开启时所有生成页面固定显示“内容由人工智能生成，请注意甄别”。只有完成对应小程序服务类目和生成内容标识等合规要求后才能开启。

- 后台动态策略表：`mci_ai_role_policy`，入口为系统管理下的“AI数据权限”。
- 后台动态业务域表：`mci_ai_data_domain`，配置域名称、来源表、日期/状态/指标字段、可读字段、敏感字段、范围规则和推荐问题；集福鲤与 Microi 官网租户使用各自的数据域配置。
- 角色管理页可直接维护启用状态、本人/部门/租户/全部范围、业务域、允许模型、最大行数、敏感字段和原始查询权限。
- 客户、销售、售后工程师等普通角色默认只能查询本人或被授权范围；没有策略时普通角色拒绝访问，不能回退为全量数据。
- 管理员也必须经过服务端策略合并；客户端只接收获准的模型通道和中转站运行模型，不接受前端自行声明模型权限。
- 模型选择严格复用 PC 端规则：启用模型来自 `mic_ai`；选择 `Microi.AI中转站` 时，运行模型来自官方中转模型清单；展示名使用“名称（模型标识）”格式。
- 官方中转模型清单是无 Token 的只读公共发现接口，只允许返回模型标识和展示名，不返回 ApiKey 或上游 Endpoint。发布验收必须同时验证 Bootstrap 得到非空模型清单，以及登录普通账号发起一次真实 Chat；不能只看到推荐问题页面就判定 AI 可用。
- 会话记录写入 `mic_ai_record`，按当前用户和移动端来源隔离；历史读取、重命名、归档与还原均在服务端再次校验当前用户。
- Tab 页的 AI 入口固定在底部导航同一水平线上，并通过间距与左侧导航胶囊形成清晰隔离；非 Tab 详情页保留在右下方、固定于页面操作区上方的轻量入口。两种入口都不再响应拖动，也不保存屏幕坐标。微信小程序使用原生自定义 TabBar，H5 使用同构底部 Dock；两端都读取运行时右侧与底部安全区，点击后只负责进入独立 AI 路由，入口本身不发起 AI 请求。独立路由覆盖完整视口并隐藏底部 TabBar，头部整体位于微信胶囊底边以下，输入区避开底部安全区。关闭按钮、Android 返回键和手机侧滑返回都先关闭内部弹窗/抽屉，再退出 AI 路由并恢复原页面。

相关源码：`src/custom-tab-bar/`、`src/components/mci-ai-launcher/`、`src/pages/ai/components/mci-ai-assistant/`、`src/pages/ai/utils/mci-ai.js`，以及两套租户目录中的 `[AI]数据分析助手(mci_ai_data_assistant).js`。`profiles/<profile>/pages.json` 是底部菜单事实源，构建时生成 `src/generated/active-tabbar.js`；完整助手及客户端协议位于 AI 分包，主包只保留轻量入口。

## 动态表单

`src/components/mci-native-field/` 是表单的统一原生字段入口，`src/config/mci-native-controls.json` 对应 Microi 表单引擎的官方控件清单。当前自动检查覆盖 **44/44** 个官方控件。

### 统一视图协议与自动更新

小程序以 `sys_menu` 作为业务入口与授权上下文，以 `diy_table/diy_field` 作为字段事实源。`sys_menu` 的 `EnableViewSchema`、`ViewSchema`、`ViewSchemaVersion`、`ViewConfigVersion` 物理字段可配置 `List/Card/Detail/Edit` 场景，以及 `PC/Mobile/All` 和角色差异视图。`diy_table/diy_field/sys_menu.DiyConfig` 已废弃，不能用于新配置。

- 后台新增字段，或修改字段名称、顺序、显隐、控件、校验、数据源和 Tabs 分组后，客户端会按版本指纹检查并拉取新定义，无需重新发布小程序。
- 未配置 ViewSchema 时，通用模块自动使用 `sys_menu` 移动列、卡片列和完整表单定义；配置不完整或网络失败时回退最近可用版本，不能白屏。
- ViewSchema 只负责视觉组合。普通字段、关联字段和上传控件仍来自 `diy_field`；MetricStrip 可读取字段或调用 ApiEngine；ActionSchema 仅允许白名单动作。
- 集福鲤客户、合同订单、设备和售后详情保留已交付的 Hero、指标、快捷入口与原生流程，同时把后台新增但未显式编排的字段自动追加到折叠分组，避免定制视觉导致字段丢失。
- 列表、详情、编辑和保存请求尽量携带当前真实 `_SysMenuId`，服务端继续执行最终的菜单、表和数据权限校验。
- 特殊安全域通过 `src/platform/form-record-adapter.js` 解耦动态 UI 与数据授权。普通表单使用 `form-engine`；“个人资料”使用服务端按当前 Token 限定的 `current-user` 接口，不伪造 `_SysMenuId`，也不能修改角色、部门、状态等管理字段。

表单元数据统一通过 `V8.FormEngine.GetDiyTableModel/GetDiyFieldList` 调用当前
FormEngine 缓存入口，并携带真实菜单上下文；页面和控件不得使用普通 CRUD
直接读取受保护的 `diy_table/diy_field`。客户端按 30 秒窗口复核服务端缓存
元数据并计算指纹：指纹未变复用本地定义，变化时写入新版本缓存。新增一种
客户端原生能力、客户专属页面或新 ActionType 才需要发版；普通后台字段和
视图调整不需要。

已实现的原生类型包括：

- 文本、多行文本、代码/JSON、富文本、数字、开关、滑块、评分和进度。
- 单选、复选、多选、下拉、级联、自动完成、部门和关联表选择。
- 日期、时间、日期时间、省市区地址和地图定位。
- 图片/头像、文件、相机拍照、颜色、标签、二维码和静态展示。
- Tabs、CollapseGroup、Divider、HTML 等布局与展示类型。

某些历史表的字段类型配置不准确。原生渲染器会在不修改后台表结构的前提下做语义兼容，例如将名为 `Avatar` 且值为上传 JSON 的 Text 字段渲染为头像拍照/上传控件，而不是文本框。密码、Token、OpenId、密钥等敏感字段在通用原生表单中默认不可见。

`src/platform/display.js` 是列表、详情和动态表单共享的显示兼容层；`src/utils/xjy-display.js` 只保留旧页面兼容导出：

- `['浙江省','宁波市','鄞州区']` 或对应 JSON 字符串显示为连续地区文本。
- 多选、联系人和行业等对象数组优先读取字段 `SelectLabel`，不显示内部 Id、时间和整段 JSON。
- 富文本通过跨端 `rich-text` 渲染，并清理脚本、事件属性和不安全嵌入节点。
- 图片/附件兼容旧路径、JSON 对象、JSON 数组、运行时对象和运行时数组；公共文件直接走 FileServer，私有文件才申请签名 URL。

## 资源策略

公开的大图、视频、音频、字体等资源优先上传到 `xjy` 租户 HDFS 公有桶，并通过 `sys_config.FileServer`/CDN 引用。tabBar、返回/关闭等小型交互图标和离线关键素材保留在主包。

资源压缩以用户可感知质量为边界，不以失真换包体数字；上传后必须验证 CDN 状态码、媒体类型、弱网占位和多尺寸截图。当前水主题 Hero、真实水面循环视频、商品占位图、扫码图和 Logo 已迁移至租户 CDN，统一配置位于 `profiles/xjy/profile.cjs`，运行时由 `src/config.js` 读取。水面视频来源页为 [Pexels - Ripples on the Water Surface](https://www.pexels.com/video/ripples-on-the-water-surface-4975728/)，发布包只保存 CDN 地址，不把视频打入主包。

## 分享安全

`src/utils/share.js` 为全部页面提供统一的小程序分享策略。分享卡片不截取当前页面，不读取客户名、订单号、任务内容、聊天内容或运行时页面标题，也不会直接复制当前页面的全部查询参数。

- 首页、商城、资讯、业务、售后和邀请分别使用固定的 5:4 集福鲤品牌封面，资源存放在 `xjy` 租户 HDFS/CDN。
- 公开商品和资讯详情只允许携带公开 `id`；业务列表只允许携带模块 `key`。
- 客户、订单、任务、聊天、表单等内部详情统一分享安全列表或工作台入口，接收者登录后仍按本人权限读取数据。
- 朋友圈分享只在首页、商城、资讯、关于等公开页面开放；内部页面仅保留好友分享。
- 商家、客户和内部人员邀请使用统一邀请构造器，保留邀请关系，但标题与封面不包含个人或业务数据。

修改页面路由或分享策略后执行 `npm run check:share`，保证 `pages.json` 中每个页面都有明确策略，且不存在局部页面绕过统一规则。

## 列表生命周期

业务列表使用统一的 `src/platform/list-return.js` 规则；旧的 `src/utils/xjy-list-return.js` 仅作兼容入口：

1. 从列表打开详情再返回，保留已加载页数、记录和原滚动位置。
2. 从列表退回上一级后再进入，视为新会话，回到第一页和顶部。
3. 详情返回售后任务列表时，会刷新已加载记录的业务状态，然后恢复位置。
4. 搜索、筛选和刷新使用请求序号，迟到的旧请求不能覆盖新条件。
5. 下拉刷新绕过缓存且只等待主列表；类型、状态和各周期统计在首屏后顺序补齐，避免刷新一直 loading。
6. 时间周期统一为全部、本日、本周、本月、本季、本年、去年、自定义，并显示每个周期的记录数。

## 目录结构

```text
microi.uniapp/
|- profiles/
|  |- xjy/                    # 默认集福鲤交付配置、路由和 manifest
|  `- standard/               # Microi 标准基础配置
|- src/
|  |- custom-tab-bar/          # 微信原生自定义底栏：左侧导航胶囊 + 右侧固定 AI 槽
|  |- components/             # 页面壳、原生字段、媒体上传等共享组件
|  |- config/                 # 原生控件和业务映射配置
|  |- generated/              # Profile 自动生成的运行时桥接
|  |- pages/                  # 工作台、业务、任务、商城、资讯、消息、我的
|  |- platform/               # 平台通用能力与 Microi.UI 适配边界
|  |- styles/                 # Microi 移动端设计令牌与安全区样式
|  |- tenants/                # xjy 等客户独立业务实现
|  |- utils/                  # API、表单、列表状态、预加载、安全区和鉴权
|  |- App.vue
|  |- pages.json              # 主包、五个分包、TabBar 和路由策略
|  `- manifest.json           # 平台配置与 requiredComponents 按需注入
|- scripts/                  # 合规、控件、微信包质量和截图验收脚本
|- dist/build/mp-weixin/     # 微信小程序生产构建产物
`- package.json
```

## 多租户定制与多人协作

标准产品代码、租户定制和构建配置必须分层维护：

- `src/platform/`、`src/components/mci-*`、`src/pages/module/` 不得出现租户表名、字段名、品牌素材或客户文案。
- `src/tenants/<tenant>/` 存放客户专属业务组合、运行时行为、表单钩子和复杂子表规则；扫码、定位、相机、售后流程等可以增加专属原生页面。
- `profiles/<id>/` 是 OsClient、API、品牌、功能开关、路由和真实编译范围的事实源。
- `src/generated/`、`src/pages.json`、`src/manifest.json` 是 Profile 生成物，不手工修改。仓库默认生成物必须始终指向 `xjy`，保证普通构建与当前集福鲤交付版一致。

创建新客户 Profile：

```bash
npm run tenant:create -- demo 示例项目 demo https://api.example.com
npm run profile:run -- demo dev mp-weixin
npm run profile:run -- demo build mp-weixin
```

多人合并时若生成文件冲突，以 `profiles/` 和 `src/tenants/` 为准，然后执行：

```bash
npm run profile:sync -- xjy
```

仓库提供 `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md` 和 `.cursor/rules/`，让常见 AI 编程工具自动加载同一套边界；根仓库还提供 `.github/instructions/microi-uniapp.instructions.md`。提交前的 `check:architecture` 会阻止平台层混入租户标识、任意前端 V8、`eval/new Function`、废弃 DiyConfig、缺失租户合同、错误 Profile 路由和默认生成物漂移。完整协作流程见 `CONTRIBUTING.md` 与 `docs/architecture.md`。

## 本地开发

```bash
npm install
npm run dev:mp-weixin
```

上述默认命令构建集福鲤交付版。微信开发者工具开发目录：

```text
dist/dev/mp-weixin
```

生产构建与导入目录：

```bash
npm run build:mp-weixin
```

```text
dist/build/mp-weixin
```

Microi 标准基础版：

```bash
npm run dev:mp-weixin:standard
npm run build:mp-weixin:standard
npm run build:h5:standard
```

标准微信构建输出到 `dist/build/standard-mp-weixin`，不会覆盖集福鲤产物。环境地址、`OsClient`、品牌、功能开关和接口配置在对应 `profiles/<id>/profile.cjs` 中维护；不要在 README、页面或测试产物中写入真实密码。

## 验收命令

```bash
# 双 Profile + UI 合规 + 44 类官方控件映射
npm run check:ui

# 36 个页面分享策略、参数白名单和 6 张品牌封面审计
npm run check:share

# 旧版 158 路由、迁移矩阵、新版页面/模块和售后闭环审计
npm run audit:legacy

# 新增或替换主包小图标后执行尺寸治理；大资源优先上传租户 HDFS/CDN
npm run optimize:mp-assets

# 构建后检查主包、分包、孤立 JS、完整模块注册、按需注入和媒体总量
npm run check:mp-quality

# 标准 Profile 微信包执行同一套质量检查
npm run check:mp-quality:standard

# H5 多视口截图、DOM 断言和列表返回状态测试
npm run visual:xjy

# 读取式线上冒烟，不执行业务提交
npm run smoke:live:xjy

# 完整本地流水线
npm test
```

`visual:xjy` 对 30 个关键页面/状态使用 3 种移动端视口，共产出 90 张截图，默认写入：

```text
D:/Work/microi.net.all/.tmp/xjy-uniapp-visual/
```

## 2026-07-23 审核可用性修复

- 登录主体首帧直接渲染，不再等待 `GetSysConfig` 返回；配置请求失败时仍可使用授权登录和账号密码登录。
- 登录页移除原生视频层，生产 WXML 不含 `<video>`；静态水景保留品牌视觉，同时避免原生层覆盖造成白屏假象。
- `Sys_Config.IsShowAiAssistant` 为 AI 总开关，集福鲤租户当前值为 `0`；关闭时首页无 AI 入口，消息列表与联系人不显示 AI 会话，直接路由显示正常的“消息中心”空状态且不初始化 AI 组件，旧 AI 会话深链自动返回消息中心。
- 微信开发者工具自动化验证登录完整展示、账号表单可切换、AI 入口关闭、普通消息关闭态和旧会话深链保护，并输出 `review-login-ready.png`、`review-ai-disabled.png`。
- 生产构建未包含 `vConsole`、`setEnableDebug` 等调试钩子；提审前仍应使用正式构建重新上传，并录制从打开小程序到登录页完整可用的操作视频。

## 2026-07-22 验收快照

- Microi UI 规则、所有自定义导航安全区、骨架屏、分包和按需加载检查通过。
- Microi 官方表单控件映射 `44/44` 通过。
- 旧版覆盖审计通过：158/158 路由源码、158/158 迁移映射、36/36 新版页面、50 个业务模块、44/44 控件和 17/17 售后动作。
- H5 自动化覆盖首页真实水流视频、全屏 AI、AI 历史抽屉、商城、资讯、消息、我的和登录等关键状态；AI 四边贴合视口、TabBar 隐藏、输入区安全区、设备级触摸打开，以及水流视频 CDN 地址、尺寸与播放进度均有断言。
- 使用真实账号完成工作台、客户、订单、任务、设备、商家、商家详情、个人资料和“我的”共 9 个鉴权页面只读烟测并保存截图。
- 列表第 38 条详情返回恢复原位置；退出后重新进入恢复第一页。
- 邓总真实账号首页合同订单统计大于 0；真实任务页、客户页的周期点击和刷新均完成且产生新请求。
- 真实任务页在“全部”口径下为 `2` 条，13 个类型合计 `2`、8 个状态合计 `2`、7 个固定时间段均返回统计；严格烟测由优化前 `97.6s` 超时降至 `15.8s` 通过。
- `type-tongji` 在一次请求中同时返回类型及本日、本周、本月、本季、本年、去年统计，`service_statusStatistics` 使用一次状态分组查询；权限受限角色仍保留模块引擎回退。
- 微信生产包构建通过：本地质量扫描主包约 `632.9KB`，业务/动态表单/AI/任务/原生功能五个分包分别约 `129.5KB / 15.1KB / 44.6KB / 139.5KB / 172.6KB`。
- 主包小于 `1.5MB`，启用 `requiredComponents`，`222/302` 个构建文件均可从应用、页面、分包或组件依赖图抵达；本地图片和音频资源合计约 `76.0KB`、小于 `200KB`。
- 微信开发者工具官方 CLI 已对本轮最新产物完成预览编译，AppID `wx0e661a2fc4f52530`，官方口径总包 `1.3MB`、主包 `740.3KB`，AI 分包 `54.8KB`，无预览编译错误；二维码和编译信息写入 `.tmp/xjy-wechat-preview/`。
- 官方 AI 权限表 `mci_ai_role_policy`、业务域表 `mci_ai_data_domain` 和接口引擎 `mci_ai_data_assistant v1.1.2` 已同步到 `xjy` 与 `iTdos` 租户并完成远端回读。两端真实通过 Bootstrap、只读 Chat、明确写操作拒绝、会话改名、归档和历史查询；测试会话已归档。
- 生产构建会自动关闭微信热重载增量编译和未使用文件忽略，并删除本机专用的 `project.private.config.json`，避免共享模块漏注册、私有配置被计为无依赖文件或旧项目名污染验收。

## 发布前检查

- 在微信开发者工具导入 `dist/build/mp-weixin`，点击“编译”。
- 如果开发者工具曾打开旧产物并出现 `module is not defined`，先执行“工具 -> 清除缓存 -> 清除编译缓存”，再重新编译；后续生产构建已自动写入完整模块编译配置。
- 在“详情 -> 本地设置”中确认环境和域名校验策略符合当前发布环境。
- 重新扫描“代码质量”，确认主包、组件按需注入和媒体资源三项通过。
- 发布前在真机覆盖相机、地理位置、文件上传、消息推送和售后状态提交。这些权限或破坏性流程不能由只读自动化代替。

## 技术栈

- uni-app 3 / Vue 3.4 / Vite 5
- Microi.UI 产品设计系统
- uni-ui 可选底层控件能力（仅允许通过 `mci-*` 适配器使用）
- Microi FormEngine / V8 接口引擎
- SignalR 即时消息
- encryptlong RSA 登录传输

## 许可证

与 Microi.net 主项目保持一致。
