---
name: microi-mobile-app-quality
description: Microi 移动端质量门禁，适用于 UniApp/H5/微信小程序。用于创建、重设计、修复、测试或交付任何 Microi 移动端项目，覆盖登录、底部导航、快捷入口、按钮、动效、菜单层级与移动端视觉验收。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi 移动端质量门禁

每次交付 Microi UniApp/H5/微信小程序时都必须应用本 skill。这里记录的是移动端项目反复出现、必须避免的问题。

自动触发：只要任务涉及 Microi 移动端应用、H5、微信小程序、App 构建、uni-app 项目、登录页、tabbar、首页、我的页、工作台、报告页、视觉重设计或移动端验收，即使用户没有明确点名，也要应用本 skill。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=microi-mobile-app-quality-000 sha256=9f83607349ba6e305c3d2993de8eeceab70c344557e5dfa2a5be964492ef4685 -->
## 1. 导航和快捷入口必须使用真实图标

底部导航、首页快捷入口、会员中心快捷项、九宫格操作和悬浮操作，必须在文字上方或旁边显示可识别的图标。

要求：
- 使用 Microi.UI 图标、项目 `mci-icon-*` CSS 图标、iconfont 或稳定的本地图标组件。
- 首页、订单、报告、报修、我的等底部导航项必须显示图标，不能用 `首` / `单` / `报` / `我` 这类单字代替。
- 首页入口宫格和我的/个人中心快捷项同样适用。
- 主题、租户、版本、账号、关于、客户绑定、服务入口等个人中心/设置/信息块必须使用真实图标，不能用 `租` / `版` / `客` 这类单字代替。
- 图标必须是真实视觉符号，不能依赖远程占位图。
- tabBar、返回、关闭等小型交互图标若使用 SVG 或图片，必须本地化、纳入版本管理并检查小程序打包结果；Hero、Banner、音视频、字体等大资源遵守 `microi-uniapp-frontend` 的租户 HDFS/CDN 规则，不得为“本地化”无边界增大主包。
- 彩色圆形、胶囊、浮动快捷入口必须同时定义图标底色和内部图标色，不能只依赖继承。红、绿、灰等深色背景优先白色图标；黄色、浅色背景必须使用深色图标。
- 如果基础样式里存在 `.entry:nth-child(n)`、`.mci-bubble:nth-child(n)` 等颜色规则，主题覆盖必须同时覆盖 `background` 和 `color`，避免只换圆底但图标仍沿用旧主题色。
- 主题图标色覆盖必须具备不低于基础规则的 CSS 优先级；构建压缩后仍要检查产物。如果压缩器移除了同值 `color`，可对图标对比度兜底规则使用 `!important`，但只限这类可读性护栏。

禁止：
- 纯文字导航图标。
- 用单个汉字冒充图标。
- 缺失图标占位、404 远程图标或只靠 emoji 的图标体系。

验收：
- 截图检查每个底部导航、首页快捷入口和会员快捷入口。
- 确认 H5、微信小程序和 App 构建目标中，图标加文字可见、对齐且可点击。
- 主题切换后重新截图底部导航、首页快捷入口和个人中心快捷入口；任何一个图标在圆底上看不清，都算验收失败。
- UniApp H5 桌面预览可以显示手机壳；真机和浏览器移动设备仿真必须自动去壳并铺满视口。自动化测试要分别断言桌面手机壳存在、移动端手机壳标题隐藏，同时检查所有底部菜单包含真实图标节点。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-mobile-app-quality-001 sha256=4e1b247852aa9f235a26f756d415ebb9fb922f2fea0569bda1bdc8e0b91c4d1c -->
## 1.1 包体资源必须按用途分层

- 构建前扫描图片、音频、视频、字体和第三方资源；公开的大资源优先上传到当前租户 HDFS 公有桶并通过 `sys_config.FileServer`/CDN 引用，敏感资源使用私有桶。
- 只保留小型交互图标和离线关键资源在主包。任何远程迁移都必须同步检查小程序下载域名、失败占位、缓存策略和弱网首屏。
- 压缩以用户可感知质量为边界：图片检查文字与主体细节，音频抽听，视频抽播；禁止仅为满足扫描数字而过度压缩。
- 验收必须同时给出包体扫描、CDN 匿名 `200`、正确媒体类型和多尺寸截图证据。缺任一层都不能宣称资源问题已通过。
- 微信小程序上传前增加硬门禁：扫描 `dist/build/mp-weixin` 的真实文件；单个非关键静态资源超过 `256 KB`、主包静态资源达到 `1.5 MB`，或主包距微信当前硬上限不足 `300 KB` 时，发布步骤必须失败并列出最大文件，不能等开发者工具上传后才发现超限。
- 迁移到 HDFS/CDN 后必须从构建产物确认原大文件已经消失，并从业务记录/配置回读相对 `Path`；页面要先加载当前租户 `SysConfig.FileServer`，不得以源码硬编码 CDN 域名替代运行期配置。远程资源加载失败时只能回退到轻量本地占位，不得把原大图重新塞回主包。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-mobile-app-quality-002 sha256=99bbb22068bb61d61a3fd20b1a21f421804857ce8da85a92390f64641e3f43fc -->
## 2. 不要猜测 Microi 前端 SDK 登录接口

编写登录代码前，先检查本地项目 SDK 封装，例如 `src/utils/microi.v8.js`、`src/utils/api.js`，或标准 `microi.uniapp` 登录实现。

要求：
- 使用实际导出的接口。如果 SDK 暴露的是 `V8.Login(param)`，不要写 `V8.Login.Login(...)`。
- 员工/账号登录应通过项目 SDK 封装调用平台登录端点，通常是 `/api/SysUser/Login` 或 `V8.Login(param)`。
- Token 提取必须同时支持响应头和响应体兜底。
- 登录成功必须同时满足 `Code=1`、已获取有效 token、已获取有效用户对象且存在 `Id`。任一条件缺失都必须清理 token、用户缓存和本地会话，并以失败处理；不能只因为接口返回成功或缓存了账号名就显示为半登录。
- 会话恢复必须重新校验 token 和用户 `Id`。如果本地只有 `staffUser.Account/Name` 但没有 token，必须清空缓存，不能出现“姓名是 admin、状态是未登录”的矛盾界面。
- 登录后所有页面的 `isLogin`、头像姓名、角色文本、未登录提示和可见按钮必须来自同一个 session store，不要让单页自己读取旧缓存。
- 登录实现后的第一个测试必须包含真实点击登录按钮，并检查控制台和网络请求。
- 登录必须传移动端 `_ClientType` 和稳定 `did`，并在 `App.onShow` 调用标准 SDK 的 `resumeAuthSession(false)`。系统休眠后不能只等定时器恢复。
- 登录失效提示必须原样展示后端 `Msg`；如果 Token 已过期，显示过期分钟/小时/天，如果 Token 属于其它租户，显示 Token 租户与当前租户。详细协议读取 `microi-frontend-sdk/SKILL.md`。

禁止：
- 凭空编造 SDK 子对象。
- 把接口引擎登录和 `SysUser` 账号登录当作同一个契约。
- 未测试真实按钮路径就交付登录页。

验收：
- H5 路由 `/pages/login/login` 或项目登录路由打开时无控制台错误。
- 点击账号登录不会抛出 `V8.Login.Login is not a function`。
- 使用真实系统账号登录后，必须验证“我的”页显示已登录角色，首页/工单/报告不再出现未登录提示，刷新页面或切换底部导航后仍保持一致。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-mobile-app-quality-003 sha256=0a9274750cb6f507b87c417eb66e5f9aa60918c6ead87c7eb2855e209aa30e61 -->
## 2.1 登录验证码必须跟随 Sys_Config.EnableCaptcha

PC 端、H5、App、微信小程序或任何自定义前端只要调用 `/api/SysUser/login`、`/api/SysUser/Login` 或 `V8.Login(param)`，都必须先读取 `Sys_Config` 的 `EnableCaptcha` 配置，并按配置决定是否展示和提交图形验证码。

要求：
- 启动登录页时调用 `/api/DiyTable/GetSysConfig` 或项目 SDK 的 `V8.GetSysConfig(true)`，读取当前租户启用状态。
- `EnableCaptcha` 可能是 `1`、`true`、`'1'`、`'true'`，也可能是大小写不同的字符串。必须使用统一的 `isEnabledFlag(value)` 或等价函数判断，不能直接 `!!value`，否则字符串 `'0'` 会被误判为开启。
- 开启验证码时，登录表单必须显示验证码输入框和验证码图片；验证码图片通过 `GET /api/Captcha/GetCaptcha` 获取，读取响应头 `captchaid`，提交登录时附加 `_CaptchaId` 和 `_CaptchaValue`。
- 登录失败、验证码错误、网络错误后必须刷新验证码并清空验证码输入；验证码未填写时前端直接阻止提交并提示用户。
- 未开启验证码时不得显示验证码输入，也不得提交空 `_CaptchaId/_CaptchaValue` 影响正常登录。
- 微信小程序默认手机号授权登录仍是主路径；账号/手机号 + 密码兜底入口如果调用 `SysUser/login`，同样要遵守验证码规则。

禁止：
- 不读取 `Sys_Config.EnableCaptcha` 就直接调用账号登录。
- 只在 PC 端做验证码，移动端缺失验证码。
- 直接写 `if (SysConfig.EnableCaptcha)` 或 `!!cfg.EnableCaptcha`，没有兼容 `'0'`、`'1'`、`'true'` 等字符串。
- 登录失败后继续使用旧 `captchaid` 和旧验证码值。

验收：
- 人工或自动化把 `EnableCaptcha` 分别模拟为 `1`、`true`、`'1'`、`'true'`，确认验证码出现并随登录提交。
- 模拟 `EnableCaptcha` 为 `0`、`false`、`'0'`、空值，确认验证码不出现且登录请求不带空验证码字段。
- 检查网络请求：`/api/Captcha/GetCaptcha` 返回后已保存 `captchaid`；登录请求体包含 `_CaptchaId/_CaptchaValue`。
- 参考标准实现：`microi.uniapp/src/pages/login/index.vue`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-mobile-app-quality-004 sha256=22bdaf38588f251016e115f1ad15a433e827fb2191041d55ecad42cda94253d1 -->
## 3. OsClient 请求头不得重复

Microi 请求只能发送一个不区分大小写的 OsClient 请求头。浏览器、代理或服务端运行时可能把 `OsClient` 和 `osclient` 这类大小写重复键合并成 `demo, demo`，导致租户识别失败。

要求：
- 通过统一工具构建请求头，设置 `osclient` 前先删除已有的不区分大小写匹配项。标准 SDK 的 `buildHeaders` 必须使用单值写入函数，不得直接写 `headers.OsClient = ...`。
- 优先使用一个标准键，通常是小写 `osclient`，并且只传一个运行期值，例如 `demo`。
- `Authorization` / `authorization` 以及其它单值鉴权头也要做同样的大小写去重。
- 当 Microi 端点契约需要时，请求体或查询参数可以包含 `OsClient`，但请求头仍只能包含一个 `osclient` 值。

禁止：
- 同时设置 `headers.OsClient` 和 `headers.osclient`。
- 同时设置 `headers.Authorization` 和 `headers.authorization`。
- 网络面板里已经看到 `demo, demo` 仍然交付。

验收：
- 在网络面板或请求适配器日志里检查登录请求。
- 确认目标租户请求头正好是一个运行期值（例如 `osclient: demo`），没有被逗号合并。
- 微信/支付宝/飞书/抖音等小程序授权登录接口也必须检查，例如 `/apiengine/miniprogram-login`，不得出现 `osclient: demo, demo` 这类合并值。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-mobile-app-quality-005 sha256=1394c7fb8e59b25553e2f9b71ab7f8cf03290b6930c8d8436123bc6048ad2435 -->
## 3.1 小程序授权登录必须可追踪、可读错误

微信开发者工具的模拟授权与体验版真机调用不是同一条真实链路。手机号授权登录接口必须按阶段诊断，不能只返回“手机号登录失败”。

要求：
- 接口入口生成短追踪号，并在微信身份交换、AccessToken、手机号交换、账号匹配、用户更新/注册、兼容映射、系统 Token 签发前更新阶段名。
- 每个失败出口和顶层 `catch` 都调用统一 `fail(stage, message, detail)`：写 `V8.Method.AddSysLog`，同时返回包含“阶段 + 原因 + 追踪号”的 `Msg`。系统日志使用独立 MongoDB 日志，不依赖业务事务提交。
- 日志只记录 OsClient、AppId、阶段、微信 `errcode/errmsg`、是否收到授权码、脱敏手机号和必要业务 Id；严禁记录小程序 Secret、AccessToken、完整手机号、`detail.code`、`LoginCode`、OpenId 或请求头 Token。
- 微信 `jscode2session`、AccessToken、`getuserphonenumber` 必须分别捕获 HTTP 异常与微信业务错误，保留官方 `errmsg`，不要用一个大 `catch` 抹掉失败位置。
- 前端请求适配器必须把 `uni.request.fail.errMsg`、HTTP 状态、后端 `Msg` 归一化；手机号登录失败使用可完整阅读的模态框展示，不用会截断长文本的短 Toast。
- 用户拒绝授权可以使用简短提示；非拒绝类授权错误、网络错误、后端错误必须显示真实原因和追踪号。

验收：
- 用无效 `LoginCode` 和无效手机号授权码分别烟测，响应包含不同阶段和追踪号，并能在系统日志按追踪号查到对应记录。
- 模拟 `uni.request` 域名未配置、超时、HTTP 500、接口 `Code=0`，前端均显示具体原因，loading 在 `finally` 中恢复。
- 体验版真机复测授权登录；不能只以开发者工具模拟成功作为上线依据。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-mobile-app-quality-006 sha256=feb9ba3267bdf1f6394c425b45dd71e19ac4382ae05549d6e1b6b664c6517a19 -->
## 3.1.1 手机号快速验证前置页不得混淆腾讯官方

- 调用手机号快速验证组件前展示的登录页、弹窗、按钮、说明、分享标题和失败提示中，禁止出现“微信”“微信官方”“微信登录”“一键登录”等可能让用户误认为腾讯官方功能或官方产品的文案。
- 前置页不得使用微信官方 Logo、相似绿色气泡图标、仿官方按钮或其它腾讯官方视觉元素；只允许展示小程序自身主体名称、品牌 Logo 和通用手机/验证图标。
- 推荐统一使用“手机号快捷登录”“手机号快速验证”“验证中”等中性文案。底层仍按平台要求保留 `open-type="getPhoneNumber"`、`provider:'weixin'` 等技术实现，不能为改文案破坏真实授权链路。
- `build:mp-weixin` 后必须扫描登录页源码和 `dist/build/mp-weixin/pages/login/` 产物中的可见文案，并对手机号快速验证前置页截图；发现混淆词、官方 Logo 或近似元素时阻止上传和提审。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-mobile-app-quality-007 sha256=7598db1fdabfe127c2be7593b83dc3a246b1db852d9c0d4001f849d3e97aa273 -->
## 3.2 微信小程序每个页面默认支持分享

小程序项目必须默认支持转发给朋友和分享到朋友圈，不能只给首页或公开页添加分享。登录和权限控制属于访问阶段，不得用来隐藏分享能力。

要求：
- 以 `pages.json` 为路由清单逐页接入 `onShareAppMessage` 与 `onShareTimeline`；Vue3 组合式 API 页面必须从 `@dcloudio/uni-app` 直接导入并注册两个生命周期，不能只写一个全局工具后假设编译器会自动发现。
- 页面显示时确保微信分享菜单包含 `shareAppMessage`、`shareTimeline`；分享标题使用业务标题或稳定页面标题，资讯/报告等内容页优先带预览图。
- 好友转发返回以 `/` 开头的完整 `path`；朋友圈返回当前页面业务 `query`。保留 `id`、分类、公开报告 ShareToken 等定位参数，剔除 Authorization、AccessToken、CustomerToken、手机号授权码、LoginCode、OpenId、验证码等敏感或一次性参数。
- 需要登录或角色权限的页面仍允许分享原页面。接收者打开后再由页面鉴权提示登录/无权限，不能把所有受保护页面的分享地址强制改成首页。
- 登录页本身也必须支持分享，避免接收者被鉴权重定向后失去转发入口。

验收：
- 静态扫描 `pages.json` 与页面源码，页面总数必须等于同时注册两种分享生命周期的页面数。
- 执行 `build:mp-weixin`，逐页检查编译后的页面 JS 存在 `onShareAppMessage`、`onShareTimeline`，不能只检查源码或只确认构建成功。
- 在微信开发者工具和体验版各抽测公开页、登录页、一个需登录详情页：朋友转发和朋友圈入口都存在，接收者路径参数正确；未登录接收者看到登录提示而不是白屏或 404。

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-4-重要按钮必须带图标.md](references/progressive-01-4-重要按钮必须带图标.md)：4. 重要按钮必须带图标；4.1 模块列表优先使用声明式业务卡片；5. 首屏文字和浮层不得重叠；5.1 未登录/授权提示必须在可用内容区居中；5.2 自定义导航页面必须通过安全区与微信胶囊门禁；5.3 全屏工具页必须遵守返回状态栈；5.4 微信浮动入口必须通过真实事件桥门禁；6. 后台菜单必须规划为至少两级；7. 移动端页面需要动效，但动效必须有用；8. 登录页必须是直接登录界面
- [references/progressive-02-9-主题切换必须真实且全局生效.md](references/progressive-02-9-主题切换必须真实且全局生效.md)：9. 主题切换必须真实且全局生效；10. 报告/列表详情必须保留用户身份；11. 角色与权限必须基于 sys_user.RoleIds 建模；最终交付清单
<!-- microi-progressive:end -->
