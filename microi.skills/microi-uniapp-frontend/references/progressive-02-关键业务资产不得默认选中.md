# microi-uniapp-frontend 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=microi-uniapp-frontend-017 sha256=00ea6a7366491ea10138bd298a5dd727c6a9bb66b6f9ab4f294b8a3fb89bd900 -->
## 关键业务资产不得默认选中

凡是会扣减、消耗、转移、提交审批或触发财务后果的业务资产，都不能默认选中第一条。例如资产卡、余额账户、积分账户、优惠券、库存批次、付款账户、审批对象、设备工单等。

必须满足：

- 页面清楚提示需要手动选择。
- 用户主动点选后，提交按钮才可用。
- 已选资产刷新后失效时清空选择，不能自动换成第一条。
- 规则同时写在 UI 状态和提交前校验中。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-018 sha256=35f9826cc82000f9cedd3ccaffd8e7718b0efbec75cf12665145f1de4f8a6d23 -->
## 账号角色与会话状态

- Microi 企业移动端默认要从 `sys_user.RoleIds`、`_Roles`、`Roles`、`RoleName`、`Level` 解析内部账号角色，不要只用“是否登录”控制界面。
- 角色能力必须集中在 Pinia/session store 中计算，例如 `isTechnician`、`isServiceAgent`、`isCustomerAccount`、`canAcceptOrders`、`canManageCustomers`、`canViewReports`。多角色账号取能力并集；只有服务端已确认的 `Level>=9999` 才属于平台超级管理员。前端“超级管理员”角色名只用于展示，不能授予接口权限。
- 客户账号判断要精确，只把“客户”“客户账号”“客户用户”或明确包含“客户账号”的角色当作客户侧账号；不要把“客户管理”等后台角色误判为客户。
- 所有页面、底部导航、按钮、未登录提示、头像姓名和角色文本都必须读同一个 session store。页面不能直接读取旧 storage 展示用户名。
- 客户小程序手机号登录得到的是业务 `CustomerToken`，与员工 `sys_user` token 是两条会话；客户数据必须通过绑定关系过滤，不要把客户账号塞进员工接口绕过权限。
- 登出、登录失败、token 缺失、用户 `Id` 缺失时要统一清理 `Token`、`staffUser/customerUser`、绑定信息和本地 session。
- 接口引擎登录失败时要把 `Msg` 原样传到统一错误展示层，禁止在 store 或业务 API 包装中覆盖成固定文案；网络错误优先读取 `errMsg/message`，HTTP 错误同时保留状态码。
- 员工账号登录必须传准确 `_ClientType`；H5、App、微信/支付宝/飞书/抖音小程序均属于移动长效终端，默认读取 SaaS 引擎 `AccessTokenLifetime`（单位天，默认 30 天）。完整 Token 协议以 `microi-frontend-sdk/SKILL.md` 为准。
- 项目统一持久化稳定 `did` 并通过请求头发送；同一安装不得每次请求生成新 `did`。
- `App.onShow` 必须调用 `V8.resumeAuthSession(false)`。只使用后台 `setInterval` 不可靠，因为系统休眠、WebView 后台化和浏览器节流都会暂停定时器。
- 收到 `Code=1001/1002` 时用可完整阅读的模态框展示后端 `Msg`，包括过期分钟/小时/天或租户不匹配信息，确认后再跳登录；不能先覆盖成固定 Toast。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-019 sha256=72621b385229c3308cbe98dbfa0fb29de95e88d675dad31d9fbe4543b441fdbb -->
## 数字、主题、上传与消息

- 资产金额、积分、余额、库存值、累计充值、收益等数字要按空间自适应格式化。金额很大时显示为 `1.23万`、`123万`、`1.2亿` 等，不能撑破卡片。
- 主题切换必须全局生效：`html/body/page/uni-page-body` 与每个页面根节点都要能继承主题变量，不能只在“我的”一个页面生效。
- 自定义底部导航、固定提交栏、悬浮操作条等 fixed 组件在 H5 中优先使用 `--mci-*` 主题变量并继承 `html/body` 的主题状态，不要为了换主题让 fixed 组件自己订阅 theme store 后动态切换根 class。小程序端可以绑定稳定主题 class，但 H5 路由切换期间不要改 Vue/uni 托管根节点结构。
- H5 主题服务只允许修改 `html`、`body` 的 `data-*` 属性、主题 class 和 CSS 变量。不要用 `querySelectorAll('.mci-page')`、`MutationObserver`、定时扫描或手动补 class 去改 `.mci-page`、`uni-page-body`、`uni-page`、`RouterView` 下的节点；否则切主题后点击导航容易出现 `Cannot assign to read only property '_'`、`Cannot read properties of null (reading 'type')`、`parentNode`、`scheduler flush` 等错误。
- 彩色圆形快捷入口必须显式设置内部图标色。主题切换时要同时覆盖 `background` 与 `color`，尤其要检查 `.mci-bubble:nth-child(n)`、`.entry:nth-child(n)` 等高优先级基础样式，避免绿色圆底配绿色图标、灰色圆底配低对比图标。
- 如果项目有 H5 自动翻译/MutationObserver 兜底，中文模式下不得把文本节点或属性恢复为旧的 `originalText`；中文模式只刷新原文缓存并退出，英文模式才写入翻译文本。否则异步接口把状态从“未认证”改为“认证已通过”后，自动翻译可能把 DOM 又改回旧状态。
- iOS Safari 上传图片后必须验证表单其它字段不丢失；上传组件只更新文件字段，不得重置整张表单对象。
- 消息、待办、审批、约单、审核类入口必须支持未读角标；已读后角标消失。
- 会员头像、买家/卖家头像、审批人头像、团队成员头像都走 `resolveAvatarUrl`，列表页和详情页必须显示一致。
- 私有图片、身份证照片、支付凭证等禁止匿名访问的文件，前端必须先换取临时 URL；不能直接把私有路径给 `<image>`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-020 sha256=6f5c05a725b3325feb889fbb4c97621e247ca9d6eb89970bf9f8602a81177524 -->
## 图片上传必须支持替换与预览

头像、支付凭证、实名认证、收款码、证照、商品图、富文本图片等移动端图片上传场景，选择图片后不能把入口锁死。所有上传入口必须统一做到：

- 已选择或已上传图片点击后可全屏预览，并能关闭返回原页面。
- 提交前可重新选择图片并替换上一张；替换时只更新当前图片字段，不重置整张表单。
- 图片卡片要有清晰操作层，例如“预览 / 重新上传”或图标按钮；预览点击与重新上传点击不能互相冒泡。
- 上传中、上传失败、可重试、已上传、本地待上传状态要分开；失败必须 toast 并恢复按钮。
- 所有上传入口使用项目统一 `uploadFile` / `V8.uploadFile`，保留 H5 `File/Blob` 对象，遵守上传路径与 Header 规范。
- 修改一个上传入口时，必须用 `rg "chooseImage|uploadFile|uni.uploadFile|previewImage|preview"` 扫描全项目同类入口，统一补齐替换与预览。
- 自动化或手工验收至少覆盖支付凭证、头像/实名认证/收款码中一个私有图场景，确认可替换、可预览、不会丢表单字段。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-021 sha256=ad8b543f8e0cd7a20464adb88d456bc21e0451e3f216b1419fa572631543cd49 -->
## 组件复用与页面去重

同一类 UniApp/H5 UI 在两个及以上页面出现时，必须抽成 `Mci*` 或项目级 `mci-*` 组件，不要复制模板和 scoped 样式到多个业务页面。常见必须复用的结构包括：未登录/授权提示、空态、错误态、骨架屏、列表卡片、商品卡、消息卡、筛选栏、Tab、底部操作栏、按钮组、头像/角标。

- 组件通过 props/slots/events 配置标题、说明、图标、按钮文案、按钮动作、路由、loading/empty/error 状态和少量视觉变体。
- 业务页只保留业务数据和事件处理；按钮居中、圆角、阴影、主题 token、安全区、按压态、暗色模式等视觉规则必须收口在组件内。
- 未登录/授权提示组件必须在页面可用内容区上下左右居中。若页面有 header/hero 和底部 tabBar，业务页要给组件外层加 `flex:1` 居中 wrapper，不能让组件贴在 header 下方。
- 如果修复一个页面的重复 UI 问题，必须搜索同类页面并一起替换，避免 message 修了、workspace 仍保留旧实现。
- 新增页面前先用 `rg` 搜索现有组件和相邻页面；发现相似代码块时优先复用或抽取组件，而不是继续复制。
- 对复用组件补充自动化检查：静态检查至少确认业务页使用同一个组件；视觉检查至少覆盖两个不同业务页实例。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-022 sha256=79b92cb4a1e0b37d786b148a98848fbae3f4424b4d07febc96adbf62ef389431 -->
## 验收要求

每次改动 UniApp/H5 前端后，至少做以下验证：

- 运行项目可用的窄范围诊断或构建命令。
- 用户要求“全自动化测试”“自动化验收”“跑完整测试”等时，若涉及 UI/前端改动，必须把截图验证或视觉断言接入自动化链路。仅运行构建、lint、静态检查不能代表 UI 已通过全自动化测试。
- 动态数据页面首屏必须截图确认显示骨架屏；接口结束后再显示数据或空态，不能闪现“暂无数据”。
- 至少用 iOS 刘海/灵动岛尺寸、Android 状态栏/虚拟导航栏尺寸、PC H5 手机壳尺寸检查安全区。
- PC 宽屏访问 H5，截图确认页面在手机壳内、底部 tabBar 可见、固定底栏没有铺满桌面。
- 对关键图片和头像页面截图，确认显示真实图片而不是空白、首字母占位或失效图。
- 对每个主题至少截图首页快捷入口和底部导航，确认选中态、未选中态、图标圆底和内部图标都已经随主题变化，并且对比度清晰。
- 对关键业务资产选择流程，验证首次进入不自动选中，刷新后无效选择会被清空。
- 截图复核 PC 手机壳、顶部安全区、底部安全区、底部 tabBar、主题背景、关键头像、私有图片、金额显示、未读角标、空态/未登录态和关键按钮文字上下左右居中。按钮文字偏上、偏下、偏左、偏右都算验收失败。
- 未登录/未授权态必须额外截图确认：提示卡片位于 header 与 tabBar/底栏之间的可用区域中心，不能只横向居中但纵向贴顶。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-023 sha256=a9b83516949b57786e8b88bfb13c513af967867a0052d8e6d5475da10da34621 -->
## Microi 前端 SDK 必须接入

任何 Microi UniApp/H5 Vue3 项目都必须优先使用 `microi.skills/microi.v8.js` 作为统一前端 SDK，并参考 `microi.skills/microi-frontend-sdk/SKILL.md`。新项目不得再手写分散的 `uni.request`、Token 存储、上传、私有文件 URL、头像解析、`ApiEngine` 或 `FormEngine` 包装。

- 项目内落地位置默认是 `src/utils/microi.v8.js`。
- 项目请求层只创建一个已配置的 `V8 = createMicroiV8({...})` 实例，并导出稳定的业务包装函数，例如 `callEngine`、`formEngineGet`、`uploadFile`、`sanitizeAssetUrl`。
- 项目请求层不得手写重复租户请求头；统一委托 SDK。最终网络请求头只允许一个小写 `osclient` 值，不能同时出现 `OsClient` / `osclient` 或 `Authorization` / `authorization` 大小写重复。
- `main.js` / `main.ts` 必须执行 `V8.install(app)`，让组件可通过 `$V8` / `$Microi` 使用统一 SDK。
- 已有页面导出的老函数名可以保留，但内部必须委托 SDK，不能继续复制请求、Token、上传和资源解析逻辑。
- SDK 不绑定任何 UI 库；页面 UI 仍遵守本 Skill 的骨架屏、安全区、移动端富文本和资源展示规范。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-024 sha256=b2b9b1ea707ab4bd114db5838eda185b7b7e375435cdca21effd7be24f996a27 -->
## MCI-UI Mobile 必须优先使用

新的 Microi UniApp/H5 Vue3 项目必须默认基于 `Microi.UI/src/uniapp` 建立页面基础组件，至少包括页面壳、导航栏、按钮、卡片、分段标签、指标卡、底部安全区操作栏、头像、商品卡、骨架屏、数据状态、富文本。用户未主动指定 UI 风格时，AI 必须自动采用 Microi吾码UI。项目可以使用 `uni-ui`、`uView`、`FirstUI` 等第三方组件，但应封装在 MCI-UI 或项目级 `mci-*` 组件后面，不要让业务页面直接散落多套视觉风格。

推荐接入顺序：

1. 拷贝或 alias `Microi.UI/src/theme` 与 `Microi.UI/src/uniapp` 到项目内。
2. 在 `main.js` 中 `app.use(MciUI)`，全局注册基础组件。
3. 分类、资产、订单、表单、筛选、上传、流程、时间线、商城、会员中心等常见页面优先使用 `MciTabs`、`MciMetricCard`、`MciAssetCard`、`MciActionBar`、`MciAvatar`、`MciProductCard`、`MciFormField`、`MciFilterBar`、`MciOrderCard`、`MciModal`、`MciUploader`、`MciTimeline`、`MciSteps`，避免重复写局部风格。
4. 动态数据页使用 `MciDataState`，首屏 loading 必须渲染 `MciSkeleton`。
5. 商品详情、公告、协议等富文本使用 `MciRichText` 或遵循同等结构。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-025 sha256=c472359f2f16b287398c0781cb66cbfb98fea99accddbfa078e9f1e9356aa30d -->
## 登录、图标与主题补充规范

- 登录页不要同时铺开两套完整登录系统。H5/App 默认只做一个“账号/手机号 + 密码”表单；微信小程序默认展示 `<button open-type="getPhoneNumber">` 手机号授权登录，账号密码只能作为次级折叠/备用入口。
- 微信小程序手机号授权登录必须使用 `@getphonenumber` 的 `detail.code`，并重新调用 `uni.login({ provider:'weixin' })` 获取新的 `LoginCode`；不要假设前端能拿到手机号明文。
- 账号密码兜底入口必须跟随 `Sys_Config.EnableCaptcha`：开启时显示验证码图片和输入框，提交 `_CaptchaId/_CaptchaValue`；关闭时完全隐藏且不提交空字段。
- 登录页、我的页、设置页不要向终端用户展示“当前租户 / OsClient / 移动端版本 / API 地址 / 调试版本”等内部实现块。
- “当前租户、移动端版本、主题、账号、关于、绑定客户”等信息项如果确实要展示，图标必须是真实图标或 `mci-icon-*` 图形；禁止用 `租`、`版`、`客` 这类单字当图标。
- 客户要求新增视觉风格时，优先把已验收风格保留为命名主题，再新增客户偏好主题；除非用户明确要求删除旧主题。
- 产品有指定默认主题时，theme store 的 `DEFAULT_THEME` 必须与该主题一致；但用户切换过主题后，本地持久化选择优先生效，不能每次启动又强制回默认。
- 主题切换必须能在未登录状态使用，并持久化到本地存储；切换后要覆盖每个页面根节点、底部导航、按钮、卡片、空态、骨架屏、表单、H5 PC 手机壳背景。
- “我的/设置”页不要把所有主题选项直接铺在主页面。默认展示当前主题和“切换主题”按钮，点击后用底部弹层或模态层选择主题。
- 小程序端不能只依赖 `document.documentElement` 切主题；每个页面根节点必须有主题 class、主题变量或项目级主题 store，确保跨页面和重启后生效。
- H5 端主题切换后必须继续验证底部导航。若切换主题后点击导航出现 `parentNode`、`scheduler flush`、`updateSlots`、`read only property '_'`、`null (reading 'type')` 等 Vue/uni-app 路由补丁错误，不能交付；改用稳定页面 class + `html/body` 主题属性/变量驱动，停止 DOM 观察或延迟补 class，并给底部导航加当前页 no-op、重复点击防抖和短延迟跳转。
- scoped CSS 中的硬编码颜色必须补主题覆盖，或改为 `--mci-*` 变量。验收时至少切换主题后检查首页、登录页、列表页、详情页、表单页和我的页。
- 主题验收必须遍历 `pages.json` 的所有页面，在每个主题下做截图或视觉断言，重点检查“我的”快捷入口、报告卡片、报告详情、骨架屏、加载过渡、空态、按钮、底部导航、弹层文字是否高对比可读。报告详情要单独检查封面英文标识（如 `INSPECTION REPORT`）、状态胶囊、印章/水印、摘要卡和正文。
- 列表进入详情必须保持身份路径：员工列表点报告详情走员工 token/FormEngine 权限，客户列表点报告详情走 CustomerToken，分享链接走 ShareToken；禁止员工点击可见报告后因为传空 CustomerToken 被跳回登录。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-026 sha256=67c8816c77d24e6aef77f1706a72330c7a103b58c623178c056a71203e2b43d3 -->
## UniApp 上传路径与 Header 规则

任何移动端图片、头像、身份认证、付款凭证、富文本图片、收款码上传，都必须走项目统一的 `uploadFile` 包装，并最终委托 `microi.v8.js` 的 `V8.uploadFile`。页面里不得直接调用 `/api/HDFS/UniappUpload`，不得临时手写 `uni.uploadFile`。

- `uni.uploadFile` / `fetch(FormData)` 必须使用上传专用 header，严禁携带 `Content-Type: application/json`。multipart 的 boundary 应由运行时自动生成。
- 上传 `Path` 必须是后端允许的安全相对路径，例如 `mall/pay-proof`、`mall/member/avatar`、`module/business-scene`。
- 禁止上传路径写成 `/mall/pay-proof`、`https://...`、`C:\...`、`../x`、`mall//x`、`~xxx`，也不要把本地临时文件路径当作 HDFS `Path`。
- SDK 必须统一归一化 `options.path`、`formData.Path`、`formData.path`，并且不允许业务页通过 `formData` 把 `Path` 覆盖成非法值。
- 项目级 `uploadFile(filePath, options)` 只能做默认路径和业务语义包装，必须透传 `{ ...options }`，不能丢掉 `headers`、`action`、`anonymous`、`file`、`formData`、`silentError` 等 SDK 选项。
- H5 页面从 `uni.chooseImage` 得到 `tempFiles[0].file` 时必须保留下来；如果只拿到 `tempFiles[0]` 或 `blob:` / `data:` 临时路径，也要传给 SDK，不得只保存字符串后丢弃文件对象。上传时传 `file` 并设置 `preferFetch:true`，让线上浏览器优先走标准 `fetch + FormData`。SDK 必须识别 `File` / `Blob`、`file/raw/blob/originFileObj` 等嵌套字段以及 `blob:` / `data:` 临时路径，不能只依赖 `uni.uploadFile`，否则生产 H5 可能出现 `未找到 MicroiV8 上传适配器。`。
- 上传、提交、支付、凭证、认证等关键按钮严禁空 `catch`。失败必须 `toast` 展示 `Msg/message`，同时 `console.error` 记录，并在 `finally` 还原 loading/uploading 状态，不能让用户感觉点击后没有任何反应。
- 修改上传相关逻辑后，必须用 `rg "uploadFile\\(|uni.uploadFile|UniappUpload"` 检查所有上传入口，至少验证付款凭证、头像/证件/收款码等一个私有图场景。

如果接口返回“移动端文件上传路径不合法！”，优先检查实际 multipart formData 里是否存在合法 `Path`，以及请求 header 是否错误设置了 JSON Content-Type；不要只看页面代码里传入的 `path` 字面量。
<!-- /microi-progressive:chunk -->
