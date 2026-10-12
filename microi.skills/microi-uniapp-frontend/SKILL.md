---
name: microi-uniapp-frontend
description: Microi 吾码 UniApp/H5/App/小程序前端规范。用于创建或维护移动产品，覆盖手机号快捷登录、租户长效会话、统一角色源码、地图接入、资源、安全区、持续动效和真实发布验收。
---

> **Microi吾码基础规范（强制）：** 任何 AI 模型与宿主每次新建或接续吾码任务，先完整读取 `../workspace-conventions/SKILL.md`，必须执行版本播报、`@microi.net/cli` 后台自动升级、Skills/MCP 同步和进度播报。安装与诊断读取 `../microi-codex-installer/SKILL.md`；更新失败延后重试，不阻断当前工作。

# Microi UniApp 前端通用规范

本 Skill 适用于任何 Microi 吾码 UniApp/H5 项目，包括商城、OA、ERP、MES、CRM、互联网项目、预约项目等。不要把规则写成某一个业务应用专属规范。

## 图片上传默认参数（强制）

UniApp/H5/小程序必须通过项目统一 `microi.v8.js` 的 `V8.uploadFile` / `V8.uploadFiles` 上传图片。调用方省略 `options.preview` 时，SDK 必须发送 `Preview=true` 并默认使用 `img` 路径；只有显式 `preview:false` 才允许关闭。服务端仍是最终事实源：即使旧客户端完全不传该字段，也要默认压缩到约 `500 KB`、最长边约 `1920 px`，并在 HDFS 私有桶保留一份 `_origin` 原图。页面不得为了“上传成功”自行改成 `preview:false`，也不得把私有原图或临时签名地址保存进业务字段。

动态表单上传还必须把控件已有的文件访问上下文透传为 `formFieldContext`：至少包含 `FormEngineKey + FieldId + SysMenuId`，编辑时再带 `FormDataId`，TableChild 再带 `_TableChildAuth`。后端回读 `diy_field.Config` 后决定“禁止匿名访问”与真实桶；普通用户不能被一刀切为私有桶，客户端自己传 `Limit=false` 也不能放宽私有字段。没有字段上下文的聊天、打卡、临时业务上传仍按普通私有上传处理。

## 平台方通用 App 登录连接器（明确例外）

登录页默认不得展示 ApiBase、OsClient 或调试配置；但用户明确要求、且安装包由 Microi 平台方作为多租户聚合客户端发布时，允许仅在 `APP-PLUS` 登录页提供通用连接器。协议必须使用固定 `https://` / `http://` 下拉框，地址框禁止重复输入协议，HTTPS 默认，HTTP 显示明文风险并二次确认；H5、小程序和客户专属包不得因此自动开放。候选地址先匿名读取 `GetSysConfig`，验证成功后再持久化。真正切换时必须清除旧 DiyToken、用户、SignalR、菜单/元数据/页面缓存，按 `ApiBase + OsClient` 隔离记住的账号及 RSA 密文，并用端点代次拒绝切换前的迟到响应。支持任意 HTTP 时，最终 IPA 必须显式包含 ATS 例外，Android 安装包必须显式包含 cleartext 例外；不需要任意 HTTP 的正式包应保持平台默认安全策略，iOS ATS 例外还必须在 App Store 审核中说明。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-000 sha256=1920cc0ada5d520baa49ce7f0d7949abd6fac1e410b35a4319b8f18f3e9d872e -->
## 移动端质量门禁必须先读

创建、重构或修复任何 Microi 移动端项目前，必须同时应用 `microi.skills/microi-mobile-app-quality/SKILL.md`，并读取其[首版交付与外部服务验收](../microi-mobile-app-quality/references/mobile-first-delivery.md)。手机号快捷登录、会话续签、导航几何、真实地图、页面动效和公开发布回读从首版纳入需求与测试，不能先交静态占位版，再等待用户逐页指出问题。涉及后台与第三方服务时按实际业务范围执行，既有授权和租户策略优先。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-001 sha256=ce7f36d1d7c3e3c6d10572da2cf29b783a5fcf043dc5568e9caed5e42bff5469 -->
## 标准产品、视图协议与租户扩展

动态表单的组织/树字段优先复用原生 `mci-native-field` 树形下拉与 `native-tree-options.mjs`，无需为小程序把后台 `Department` 改为普通 Select。读取 `Config.<Component>.Multiple/EmitPath`：组织单选叶值保存 Id，多选叶值保存 Id 数组，路径模式保存完整路径/路径数组，数组统一 JSON 序列化。支持祖先展开、搜索、清空、禁用、重试和只读回显；数据源旧模板不能代替当前授权组织树。业务字段联动放租户扩展，不执行任意前端 V8；验收覆盖保存格式、旧数据回显、失败/迟到响应及最近公司祖先联动。

Microi 标准小程序必须采用“平台内核 + 版本化元数据 + Profile + 租户插件”架构，不能把某个交付项目直接写死成平台产品：

- `src/platform/`、通用 `mci-*` 组件、动态模块页和动态表单页只实现平台能力，不得出现租户表名、字段名、品牌文案、素材或客户路由。
- `src/tenants/<tenant>/` 存放客户专属业务组合、首页统计、表单联动、子表规则、扫码/定位/相机和复杂原生流程；`profiles/<id>/` 管理 OsClient、API、品牌、功能开关、路由和真实编译范围。
- `src/generated/`、`pages.json`、`manifest.json` 等 Profile 产物由脚本生成，不能作为人工定制入口。多人合并冲突时以 Profile 与租户源码为准重新生成。
- 普通 CRUD 必须优先使用授权后的 `sys_menu + diy_table + diy_field` 动态渲染；只有原生能力或客户独有的复杂组合才增加租户扩展。

统一视图协议归属 `sys_menu`。使用 `EnableViewSchema`、`ViewSchema`、`ViewSchemaVersion`、`ViewConfigVersion` 等明确物理字段保存 `List/Card/Detail/Edit`、`PC/Mobile/All`、角色视图、Hero、MetricStrip、ActionGrid 和 ResponsiveSection。`diy_table/diy_field/sys_menu.DiyConfig` 已废弃，禁止继续读取或写入。

- 后台新增字段或修改名称、顺序、显隐、组件、校验、数据源和分组后，客户端必须通过版本指纹刷新定义，无需重新发版。
- 表单元数据必须通过 `V8.FormEngine.GetDiyTableModel/GetDiyFieldList` 访问当前 FormEngine 缓存入口，并携带真实菜单授权上下文；页面和控件不得用普通 `GetFormData/GetTableData` 直查受保护的 `diy_table/diy_field`，也不得散落裸元数据接口 URL。
- ViewSchema 未配置、配置不完整或网络暂时失败时，必须回退到菜单移动字段和完整 `diy_field` 定义；定制详情还必须把未显式编排的新字段追加到折叠分组，不能静默丢字段。
- 列表、详情、编辑和保存请求应携带真实授权 `_SysMenuId`；客户端不能自行声明角色、数据范围或表权限，服务端仍是最终权限边界。
- 原生详情进入编辑后，取消丢弃未保存字段并返回同一详情/Tab，保存成功后回读服务端结果并通知来源列表刷新；直接新增/编辑仍返回来源列表。验收覆盖系统返回、保存/子表失败、迟到响应和权限撤销，不能用重复压入详情页替代原实例恢复。
- IoT/关联快照的“记录不存在”应展示业务空状态并隐藏表名/SQL，权限与网络失败仍保留真实错误；未知遥测使用占位值，零值和离线不能被当作缺失。依赖租户 V8 的契约测试从授权同步目录按唯一 ApiEngineKey 定位，测试前核验源码完整性与哈希，不靠旧分类文件夹名定位或跳过缺失依赖。
- 小程序不得下载或执行任意前端 V8，不得使用 `eval/new Function`。字段显隐和联动使用白名单声明式规则，按钮使用 ActionSchema，复杂事务和校验进入 ApiEngine 或后端表单事件。
- ActionSchema 只能描述文字、图标、颜色、确认提示、参数映射、ApiEngineKey、原生 ActionType 和成功后的刷新/跳转；扫码、定位、拍照、拨号、导航等由受控原生适配器执行。

仓库必须提供 AI 与人工协作约束文件、租户脚手架、Profile 构建/同步命令和架构检查。平台层改动至少同时构建标准 Profile 与默认交付 Profile；租户视觉改动还要执行多视口截图回归。这样其他同事使用 Codex、Claude、Copilot、Cursor 等工具继续开发时，会先读取相同规则，而不是依赖某次对话记忆。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-002 sha256=1faa6e553ff61b9043ff7608d02518e815f1dcbe2cc56fefb8adff326c5d1f1f -->
## H5 预览壳与底部导航强制规则

- H5 的底部安全区采用 CSS `env(safe-area-inset-bottom)` 等浏览器权威值，不能使用 `screenHeight - windowHeight` 或 `screen.height - innerHeight` 推算。App/小程序只读取平台权威 inset；零值正常，禁止用 `inset || guessedFallback` 换成猜测值。验收必须覆盖物理屏幕与浏览器视口不同、非最大化桌面、缩放和移动浏览器工具栏收展。

- 桌面浏览器允许使用 `Microi UniApp H5 Preview` 手机壳帮助用户理解移动端比例。
- 面向手机的页面在桌面手机壳内仍保持相同的单列布局和移动字号，不能因外窗变宽把地图、主面板或整页拆成桌面两列；业务明确设计的分类双栏另按其独立滚动规范执行。
- 真机、窄屏浏览器以及 PC DevTools 移动设备仿真必须自动去掉手机壳标题、外边距、圆角、边框和阴影，内容铺满当前可见视口。`767px` 是常用宽度断点，不是手机身份判断；手机横屏/旋转不能因宽度超过它就重新套壳。H5 优先使用动态视口高度并保留旧浏览器兜底，键盘与浏览器栏变化要重新核对可见区域。
- 桌面手机壳必须约束高度，不能只用 `min-height:100vh` 让内容继续撑长。导航底边贴齐手机壳**内屏**底边，不是浏览器窗口底边；头部和导航不收缩，正文及路由中间包装层使用 `flex:1; min-height:0; min-width:0`。
- 普通单列壳只有一个正文滚动 owner；流内底栏已占高度，不再给正文叠加整条 tabBar 占位。覆盖式固定底栏由共享布局预留一次实测总高度，包含真实安全区；禁止根容器、正文、占位元素与导航分别重复累加底部间距。双栏列表仅允许明确设计的两块独立滚动区。
- 桌面宽度限制不能阻止 `rpx` 按外窗宽度放大。把 `rpxCalcMaxDeviceWidth / rpxCalcBaseDeviceWidth` 与壳宽、断点统一，并从实际产物核验导航/图标高度；填满容器使用 `%` 或 flex，不使用 `750rpx`。
- AI 应用预览编译器必须为每个底部菜单渲染真实 SVG/本地图标和文字，不能只输出文字、单汉字、emoji 或空白占位。原生 uni-app `tabBar` 仍使用纳入版本管理的本地 PNG `iconPath / selectedIconPath`。
- 自动化验收不能只断言手机壳或图标节点存在。至少覆盖三个主 Tab 的真实内屏/导航/触摸区矩形、导航下方剩余高度、滚动 owner 和末条内容可达；覆盖桌面矮屏、断点、手机横竖屏、键盘打开与关闭后恢复。使用视口截图，桌面 body 不产生第二条竖向滚动条；真实键盘/安全区另做渠道或真机验收。
- 完整实现与门禁示例见 [H5 手机壳和几何验收](references/progressive-01-移动端分类-双栏列表独立滚动.md#h5-在-pc-浏览器必须自动模拟移动端)。修改共享壳后重跑所有 Tab 与路由，不能只给当前页面补 padding。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-003 sha256=68be2d2ac3b9319cca4119b25b3f268bde8576de0093747ae20544cfc81ff102 -->
## 默认快捷登录、自动注册与长效会话

- H5/App 面向用户的默认登录面为“手机号 + 图形验证码 + 短信验证码”，同一个提交动作由服务端判断：已注册登录，未注册按当前租户开放注册策略自动注册并登录。密码登录是次级折叠/备用入口，不先要求选择“登录/注册”或“员工/客户”。企业封闭账号及用户明确指定的登录模型保留其策略；不得为了展示快捷登录而擅自开放注册、启用短信或授予员工角色。
- 图形验证码先用于服务端校验短信发送，短信码才证明手机号控制权；供应商未配置、余额不足或短信失败时返回可诊断原因，不能以图形码代替短信、使用万能码或返回短信明文。前端倒计时不代替后端限频、过期、用途绑定、一次性消费与重放保护。沿用官网/标准 UniApp 的实际契约，不能照抄界面后猜接口。
- 默认新账号只获得租户定义的最低用户角色；高级身份申请经后台审核后才升级。多角色用同一源码、同一 DiyToken 和集中 capability 切换工作模式；已审核的服务角色可默认进入工作台，同时保留已授权的普通用户能力。前端模式和角色缓存不能授予接口权限。
- 账号密码登录必须先检查项目本地 SDK 实际导出，常见是 `V8.Login(param)` 或 `/api/SysUser/Login`。禁止凭空写 `V8.Login.Login(...)` 这类未验证子对象。
- 登录、接口引擎、FormEngine、上传等所有请求头必须做大小写不敏感去重；`osclient` 只能发送一个运行期值，例如 `demo`，禁止同时传 `OsClient` 与 `osclient` 导致网络面板出现 `demo, demo`。
- 账号密码登录只有在同时拿到成功码、有效 token 和有效用户 `Id` 时才算成功。Microi 登录 token 可能在响应头 `authorization`，用户信息可能在响应体 `Data`；两者任一缺失都要清理 SDK token、本地用户缓存和 session。
- 恢复本地会话时必须重新校验 token 和用户 `Id`，禁止出现页面显示 `admin` 但状态仍是“未登录”的半登录状态。
- DiyToken、用户与稳定 `did` 按 `ApiBase + OsClient` 隔离持久化，使用统一 SDK/session store；存储写入失败不能继续成功导航。移动登录传准确 `_ClientType`，有效期读取子租户 `AccessTokenLifetime`（单位天），实际可能是 20、30 天或其它配置，前端不得硬编码。验收以本次 JWT 的签发/到期时间与服务端配置匹配为准，本地 JWT 解析只作调度，不能代替服务端验签。
- 默认接入 SDK `startTokenMaintenance()`、`resumeAuthSession(false)` 与 `refreshToken()`：按真实到期窗口以旧换新，每个请求接收响应头 `authorization`，同一运行上下文的并发请求 single-flight。有多标签会话需求时，另按 SDK 实际协议验证跨标签 Token/退出同步及竞态，不能把单实例的刷新 Promise 当作已支持跨标签单飞。前台恢复立即检查，退出、切换账号或租户递增会话代次，拒绝旧请求的 Token/用户回写及迟到失效弹窗。已到期、被吊销或管理员撤销的会话不能因本地仍有 Token 无限延长。完整协议见 [SDK Token 与终端协议](../microi-frontend-sdk/references/progressive-01-token-当前登录用户与当前终端登录协议.md)。
- 账号密码登录调用 `/api/SysUser/login`、`/api/SysUser/Login` 或 `V8.Login(param)` 前，必须读取 `/apiengine/platform-sys-config` 或 `V8.GetSysConfig(true)`，并根据 `Sys_Config.EnableCaptcha` 决定是否显示图形验证码。判断函数必须兼容 `1`、`true`、`'1'`、`'true'`，不要直接 `!!cfg.EnableCaptcha`。
- 开启验证码时，页面必须通过 `GET /api/Captcha/GetCaptcha` 获取验证码图片，读取响应头 `captchaid`，提交账号登录时传 `_CaptchaId` 和 `_CaptchaValue`；登录失败后清空输入并刷新验证码。未开启验证码时不显示验证码，不传空验证码字段。
- 微信小程序手机号快捷登录必须使用 `<button open-type="getPhoneNumber">`，通过 `@getphonenumber` 获取 `detail.code`，并重新调用 `uni.login({ provider:'weixin' })` 获取新的 `LoginCode`。前端不能假设能直接拿到手机号明文。
- 微信小程序具备正式授权能力时，手机号授权仍优先走 `Code + LoginCode`；短信输入路径共用同一平台身份与会话，并由实际能力决定备用入口，不能另建平行用户/权限 Token。
- 登录按钮、去登录按钮、手机号授权按钮必须是图标 + 文案按钮，具备 loading、disabled/pressed 反馈，且原生 button 默认边框要清掉。
- 体验版授权登录必须保留可诊断错误：请求层归一化 `uni.request.fail.errMsg`、HTTP 状态和接口 `Msg`，登录页用模态框完整展示“阶段 + 原因 + 追踪号”。后端接口引擎按阶段写脱敏系统日志；不能只在前端 catch 后显示固定“手机号登录失败”。
- 小程序调用手机号快速验证组件的前置页、按钮、弹窗、分享标题和失败提示不得出现“微信”“微信官方”“微信登录”“一键登录”等可能混淆腾讯官方的文案，也不得展示微信官方 Logo、相似绿色气泡图标或仿官方品牌元素。统一使用“手机号快捷登录”“手机号快速验证”等中性业务文案，只展示应用自身品牌 Logo。
- 微信小程序构建后必须扫描登录页源码以及 `dist/build/mp-weixin/pages/login/` 产物，并截图核对手机号快速验证前置页；命中上述混淆文案、官方图形或近似元素时必须阻止上传和提审，不能只检查按钮主文案而漏掉说明文字、错误弹窗或分享标题。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-004 sha256=cc25e3d896e6f7349a7a7e93b8025ee797bf9810e60214eb95e41d75aa083422 -->
## 微信小程序全页面分享

- 创建或维护 UniApp 微信小程序时，默认把好友转发与朋友圈分享视为页面基础能力；按 `pages.json` 全量路由逐页接入，不等待用户额外提出。
- Vue3 `<script setup>` 页面直接导入 `onShareAppMessage`、`onShareTimeline` 并注册处理函数。可以复用项目级 payload 工具，但生命周期导入必须出现在页面源码中，确保 uni-app 编译器注册页面能力。
- `onShareAppMessage` 返回业务标题和完整页面 `path`；`onShareTimeline` 返回业务标题和当前页 `query`。资讯、报告等内容页可返回符合平台尺寸要求的 `imageUrl`。
- 分享参数保留页面定位所需的 Id、分类和公开 ShareToken，统一过滤 Authorization、AccessToken、CustomerToken、手机号授权码、LoginCode、OpenId、验证码等敏感参数。
- 登录页、员工页、管理页等受保护页面同样可分享。接收者打开后由 session/角色守卫展示登录或无权限提示，不得因页面需要登录就调用 `hideShareMenu`。
- 验收不能只看首页右上角。用脚本比较 `pages.json` 路由数量与源码/微信构建产物中的两种分享生命周期数量，并在体验版抽测公开页、登录页和受保护详情页。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-005 sha256=d6f78d95dc0b0b042f0d0c525a9cb5295a0324f1c70d6f480c93f2e03d315cec -->
## 首屏 Hero 与浮动面板验收

- 移动端首屏 Hero 标题必须按真实中文文案调字号和行高，不能为了“震撼”把业务入口标题做得过大，导致一行半、孤字换行或压住按钮。
- Hero 下方如果有浮动快捷入口面板，必须给 Hero 底部预留按钮安全区，并控制面板负 margin；面板只能覆盖装饰留白，不能盖住“立即登录 / 查看报告 / 提交”等主按钮的圆角、阴影或点击区域。
- 交付前至少检查 375px 与 430px 宽度首屏截图，确认标题、主按钮、次按钮、浮动面板、第二块内容没有重叠、裁切或不美观换行。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-006 sha256=a39f7e4fb42c6d290463a9e40eed03235e4afe063d60208b5a3e73a170fbc39f -->
## 资源 URL 必须集中解析

数据库中的图片、附件、头像、Logo、卡面图、单据图片等字段常见保存形式：

- 绝对地址：`https://...`
- API 本地文件路由：`/file/...`
- 对象存储相对路径：`/tenant/module/file.jpg` 或 `tenant/module/file.jpg`
- 上传组件 JSON：`[{"Path":"..."}]`、`{"Path":"..."}`、`{"FilePathName":"..."}`，也可能已经是对象/数组而不是字符串
- 历史脏数据或第三方占位图

页面模板不能直接写 `<image :src="row.Avatar">`、`<image :src="row.MainImg">`。必须在项目的 API/资源工具模块里提供统一解析函数，例如 `resolveAssetUrl`、`sanitizeAssetUrl`、`resolveFileUrl`、`resolveAvatarUrl`，并让页面只绑定已经归一化后的最终 URL。

资源解析函数必须先按 `microi.skills/v8-file-upload/SKILL.md` 的 `normalizeUploadValue` 思路处理 `ImgUpload` / `FileUpload` 字段：空值、`正在上传中...`、旧字符串路径、JSON 字符串对象、JSON 字符串数组、运行时对象、运行时数组都要兼容；取出 `Path` 后再进入 FileServer/API/私有签名 URL 逻辑。

推荐规则：

- `http(s)://`、`data:`、`blob:` 原样返回。
- `/file/...` 走 API 服务。
- `/tenant/...`、`tenant/...` 等对象存储路径走 `V8.SysConfig.FileServer` 对应的文件服务器/CDN。
- 私有文件使用后端签名 URL，例如 `V8.Method.GetPrivateFileUrl({ FilePathName })`，失败时再回退到公开文件服务器路径。
- 第三方占位图、已失效临时地址、空字符串统一清理为空，交给 UI 占位态。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-007 sha256=3894454672b6bde6f4a7b329103c9418804f4594b7e3505617590ebea5f136ab -->
## 移动端大资源优先使用租户 HDFS/CDN

定制 UniApp/H5/小程序中的大图、视频、音频、字体和大型第三方静态文件，默认不要塞进主包。应先确认目标 `OsClient`，通过该租户 MCP/HDFS 上传，再以 `sys_config.FileServer + Path` 的 CDN/公有桶地址引用；合同、证件等敏感资源仍必须使用私有桶和临时签名 URL。

- 首页 Hero、商品占位图、活动 Banner、引导音频、演示视频等公开资源使用 `Limit:false`，上传后必须以匿名请求验证最终 URL 返回 `200`、正确 `Content-Type` 和非空内容。
- tabBar 图标、返回/关闭等小型交互图标、启动阶段必须离线可用的关键素材可以留在主包；不能为了远程化导致断网时连导航和基本操作都不可识别。
- 上传前按场景做适度压缩和尺寸裁剪，同时保存原始素材或可重复生成源；禁止为了通过包体扫描而盲目把图片、音频压到明显失真、文字模糊或播放体验受损。
- 压缩后必须在至少 375px、430px 和目标小程序设备截图中核对清晰度、裁切、首屏加载与失败占位；音视频还要抽听/抽播。质量不合格时优先调整编码、分辨率和缓存策略，而不是继续极端压缩。
- 项目只能通过统一配置或资源解析器保存 CDN 地址，页面不得散落硬编码 FileServer；切换环境或租户时必须能整体替换。
- CDN 资源必须设置加载失败占位或降级路径。构建验收同时检查小程序主包资源总量、单资源大小、远程域名白名单和真实 CDN 可达性，不能只看源码文件大小。
- 小程序发布前必须扫描实际构建目录，而不只扫描 `src`：单个非离线关键资源超过 `256 KB` 时默认迁移 HDFS/CDN；主包静态资源达到 `1.5 MB` 或距离平台硬上限不足 `300 KB` 时必须停止上传，先瘦身或分包。确需本地保留的例外要记录离线必要性、大小和验证证据。
- HDFS 迁移顺序固定为“保留/归档原始素材 -> 按真实展示尺寸压缩 -> 上传当前租户公有 HDFS -> 保存相对 `Path` -> 运行期通过 `SysConfig.FileServer` 解析 -> 匿名 GET 回读”。回读必须断言 `200`、正确 `Content-Type`、非空大小，重要资源再比对 SHA-256；不能把上传接口返回成功当成完成。
- 原始高清图、视频母版、设计源文件不得继续放在会被 UniApp 收集的 `src/static`、分包目录或其它构建入口中；应移到项目资料/设计源目录。主包仅保留小于门禁的轻量失败占位图和离线关键图标。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-008 sha256=d7b2b5c8ffe5c1dd8f51eb7d5e8368dba6813c2fa25d39dd3fb8f6659922b5b9 -->
## 头像必须异步统一解析

头像字段比普通图片更容易混合出现上传 JSON、私有路径、相对路径、历史字段名和脏数据。列表页、详情页、业务记录、审批记录、团队/会员卡片、聊天/消息等头像场景都必须走同一个头像解析入口。

正确模式：

```js
const rawAvatar = row.OwnerAvatar || row.UserAvatar || row.Avatar || member.Avatar || '';
row.OwnerAvatarUrl = await resolveAvatarUrl(rawAvatar);
```

模板只绑定最终字段：

```vue
<image v-if="row.OwnerAvatarUrl" :src="row.OwnerAvatarUrl" mode="aspectFill" />
```

禁止在模板中临时拼接文件服务器，禁止每个页面各写一套头像解析，禁止只在能查到关联用户时才解析接口已经返回的头像字段。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-009 sha256=0270fbc5a2ee0d20a4d1d2f2a9c7fc7304e18402d282e1efcf860bd31db9fcb0 -->
## 移动端富文本图文排版

商品详情、公告详情、活动说明、文章正文、协议说明等富文本在移动端渲染时，图片和文字不能使用同一套留白规则。

- 主图、详情长图、海报图可以 `width:100%` / `display:block` 满宽展示，不额外加左右 padding，避免图片显得缩小或边缘参差。
- 文字内容必须有独立容器，设置 `padding: 16px 18px`（或项目设计体系中的等价间距）、`box-sizing:border-box`、稳定 `line-height`，不能让标题、段落贴着卡片或屏幕边缘。
- 富文本生成器输出 HTML 时，推荐结构是“图片块 + 文本块”：图片块只包图片，文本块包标题、段落、规格说明、温馨提示。
- 段落使用 `margin:0 0 6px` 或相近节奏，最后一段可以去掉底部 margin；不要靠 `<br>` 堆间距。
- 移动端截图验收必须看文字是否贴边、是否横向溢出、是否被底部固定按钮遮挡。

参考结构：

```html
<section class="mci-rich-detail" style="background:#fff;overflow:hidden;">
  <p style="margin:0;text-align:center;">
    <img src="..." style="display:block;width:100%;max-width:100%;height:auto;" />
  </p>
  <div style="padding:16px 18px 18px;box-sizing:border-box;line-height:1.7;color:#1f2937;font-size:15px;">
    <h2 style="margin:0 0 10px;font-size:22px;line-height:1.28;">商品标题</h2>
    <p style="margin:0 0 6px;">所属专区：精选专区</p>
    <p style="margin:0;">商品图片与规格信息以实际维护为准。</p>
  </div>
</section>
```

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-移动端分类-双栏列表独立滚动.md](references/progressive-01-移动端分类-双栏列表独立滚动.md)：移动端分类/双栏列表独立滚动；数据页必须使用骨架屏 Loading；移动端安全区必须兼容 iOS 与 Android；微信自定义组件的点击与拖动事件必须真机链路验收；列表型资料页必须提供完整管理动作；移动端资产/奖励流水展示；H5 在 PC 浏览器必须自动模拟移动端
- [references/progressive-02-关键业务资产不得默认选中.md](references/progressive-02-关键业务资产不得默认选中.md)：关键业务资产不得默认选中；账号角色与会话状态；数字、主题、上传与消息；图片上传必须支持替换与预览；组件复用与页面去重；验收要求；Microi 前端 SDK 必须接入；MCI-UI Mobile 必须优先使用；登录、图标与主题补充规范；UniApp 上传路径与 Header 规则
<!-- microi-progressive:end -->
