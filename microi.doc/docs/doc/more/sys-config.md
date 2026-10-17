# ⚙️ 系统设置

> **系统设置非常重要，开好数据库后第一件事就是配置系统设置**

---

## 📸 系统设置预览

<div class="mci-doc-screenshot-grid">
  <figure>
    <img src="https://file.microi.net/itdos/official-docs/images/10ec8ca0bbc527de835041461e516fd7648360f47e0ce27f970acb2fb691f74a/202610/system-settings-light.jpg" alt="Microi吾码系统设置亮色主题，展示系统信息、界面风格、开发配置、密码强度与移动端配置分组" data-fancybox="sys-config-preview">
    <figcaption>亮色主题：系统配置、上传资源、修改日志和分组导航在同一工作台集中维护。</figcaption>
  </figure>
  <figure>
    <img src="https://file.microi.net/itdos/official-docs/images/7fcca5cd2c35d2f177d59ba2630b26207ce8a2b4e139234fd3470b3903847f3d/202610/system-settings-dark.jpg" alt="Microi吾码系统设置暗色主题，展示界面风格、主题导航、登录入口与 AI 水印配置" data-fancybox="sys-config-preview">
    <figcaption>暗色主题：界面风格、登录入口、AI 助手与框架水印等配置按业务域清晰分组。</figcaption>
  </figure>
</div>

<span id="边角风格与导航布局"></span>

## 全局主题与个人设置

在【界面风格 → 主题与导航】配置租户默认外观：

| 字段 | 选项 | 空值行为 |
|---|---|---|
| `ThemeColor`（主题色） | 预设或有效自定义颜色 | 平台默认主题色 |
| `ThemeMode`（显示模式） | `light` 浅色、`dark` 暗色 | 浅色 |
| `CornerStyle`（边角风格） | `round` 圆角、`square` 直角 | 圆角 |
| `NavigationLayout`（导航菜单位置） | `Side` 侧边导航、`Top` 顶部导航、`TopSide` 顶部 + 侧边导航 | 侧边导航 |
| `MenuChildExpandMode`（菜单子级展开方式） | `Down` 向下展开、`Right` 向右展开 | 向下展开 |
| `UiDensityScale`（界面密度） | `90 / 95 / 100 / 105 / 110` | `100` |
| `DisableGradient`（关闭渐变） | 开启使用纯色表面 | 关闭 |
| `DisableShadow`（关闭阴影） | 开启移除装饰阴影 | 关闭 |
| `DisableButtonIcon`（关闭按钮图标） | 开启隐藏文字按钮左侧图标 | 关闭 |
| `LoginStyle`（登录界面风格） | `Original / Minimal / Split / Console` | `Original` |

右上角【主题设置】的全部外观选项都可在这里设置全局默认值。生效顺序是：**当前用户显式选择 → 当前租户 `sys_config` → 平台默认值**。未手动选择的用户跟随全局设置；修改全局值不会覆盖已有个人选择。个人偏好通过当前 DiyToken 用户的 `sys_user` 同名字段保存，更换设备后恢复。

个人枚举的 `System` 或空值表示继承；密度与三个关闭开关的个人 `null` 表示继承，开关 `0` 是明确选择“保持开启装饰”，能覆盖全局 `1`。不要把个人空值提前补成平台默认值，否则会阻断全局配置。

切换导航位置或关闭主题面板时，尚未发送的个人偏好仍会保存；连续切换只保存最后一次选择。保存失败时，重新打开主题面板仍显示失败状态，可点击重试。保存队列按当前租户、账号和登录会话隔离，避免切换账号后把上一位用户的选择写入新账号。

选择【顶部 + 侧边导航】后，一级菜单放在顶部，当前一级下的二级菜单放在左侧。
侧栏沿用【菜单子级展开方式】的向下或向右展开设置，也可以收起；没有可见二级菜单时自动隐藏侧栏。
顶部导航的整行背景、功能图标及登录姓名使用同一主题表面，浅色、深色和自定义主题都会同步切换。

### 个人面板宽度与收起状态

侧栏菜单和【角色管理】左侧组织树均可拖动右边缘调整宽度，也可通过边缘按钮收起、展开。聚焦分隔条后，方向键每次调整 16px，按住 Shift 调整 40px；Home/End 移至当前允许的最小/最大宽度。保存范围为 160–600px，窄视口会暂时压缩以保留主内容区，放大窗口后恢复原偏好，不把临时压缩写回账号。

安装新版“系统账号”应用后，`sys_user.SidebarWidth/RoleTreeWidth` 保存宽度，`SidebarCollapsed/RoleTreeCollapsed` 保存收起状态，刷新与换设备登录均可恢复。拖拽仅在松开时保存，取消拖拽不写服务器。侧栏宽度空值读取原全局 `sys_config.MenuWidth`，未配置时为 240px；角色树默认 240px，收起状态空值默认展开。低代码“树形+表格”角色页与旧角色页共用这一账号偏好；低代码入口依据服务端菜单表名 `sys_role` 识别，其他业务左右模块仍保留各自配置比例。旧租户未安装字段时仅使用按服务器、租户和账号隔离的设备回退。

顶部主导航使用短底线明确标识当前一级菜单，悬停文字与弹出菜单保持当前主题的可读前景。长子菜单在弹出面板内部滚动；顶部菜单标题与品牌不显示 title 或 Tooltip 气泡，完整名称通过 aria-label 保留。顶栏色带横向铺满所在视口或壳层，内容区仍可保留独立留白。该底线只属于框架主导航，不改变工作区、表单与数据列表的 Tabs 样式。

### 恢复默认与界面密度

主题面板右上角的【恢复默认】清除当前用户的主题覆盖和旧设备回退值，恢复**系统设置的全局配置**；只有全局也未配置时才恢复平台默认值。该操作不修改租户设置，也不修改其他用户。安装了新版用户字段后，恢复继承状态也会自动保存到账号。

【界面密度】支持 90%–110%、每档 5% 的字体、控件与间距同步调整。它覆盖系统设置等普通表单、字段标签、输入选择控件、侧栏菜单、表格、Tab 和弹层，不只影响工具栏按钮。地图、富文本、代码编辑器和子表保留各自的内容高度；手机触控按钮保持至少 44px。

紧凑模式同时缩小父菜单图标底圈、菜单行间距与普通单行表格的行高和内边距；多行复合列、图片等按真实内容自然撑高。直角模式也覆盖退出登录等挂载到页面根部的确认框。

新版密度保存在 `sys_user.UiDensityScale`，未设置时读取全局 `sys_config.UiDensityScale`；旧租户未安装个人字段时才使用当前设备的兼容回退。已有租户需一起更新 PC 前端及“系统设置”“系统账号”官方应用；基础空库字段由“SaaS引擎”应用交付。

### 渐变、阴影与按钮图标

- 【关闭渐变】让按钮、导航与登录内容等原渐变背景采用对应的纯主题色；上传背景图片仍按原配置展示。
- 【关闭阴影】移除按钮、弹窗、卡片和登录区域的装饰阴影，同时保留输入边界和键盘焦点。
- 【关闭按钮图标】隐藏文字按钮左侧的装饰图标，加载指示、输入前缀和关闭、全屏等纯图标操作继续可用。

三个选项既支持系统全局默认，也支持主题面板个人覆盖；【恢复默认】把个人值清为空以重新继承。

### 登录界面风格

| 值 | 风格 |
|---|---|
| `Original` | 品牌经典，保留原登录外观 |
| `Minimal` | 极简留白，集中展示登录表单 |
| `Split` | 分栏画廊，品牌内容与登录表单分栏 |
| `Console` | 深色控制台，使用紧凑深色表面 |

这些模板共用同一套登录业务与表单，账号密码、验证码、历史账号、协议、注册、找回密码、Passkey、TOTP、人脸、第三方登录和登录回跳等原有功能保持一致。主题面板可保存个人风格；匿名登录页默认读取当前租户全局值，有效的当前设备预览仅用于即时查看，不能读取上一账号的个人选择。未知风格回退 `Original`。

顶部导航适用于经典界面的桌面端，复用当前账号有权访问的菜单、徽标、外链与多级子菜单；空间不足时收纳到更多菜单。移动端继续采用底部导航。直角风格统一作用于按钮、页面、卡片、Tab 和弹窗。

桌面三种导航布局均由内容区承担纵向滚动，顶栏和 Tab 保持可见；页面宽度应随导航位置、侧栏收缩和窗口宽度调整，不应出现整个框架的横向滚动条。

已有租户需更新 PC 前端以及“系统设置”“系统账号”应用；新租户由“SaaS引擎”应用交付字段与默认值。

## 隐藏框架功能

【界面风格】中的【隐藏框架功能】保存到 `sys_config.HideFrameworkFunctions`，是租户级复选框。勾选后隐藏对应的右上角入口，留空显示原有入口；最右侧账号头像、姓名与账号菜单始终保留。

| Key | 入口 |
|---|---|
| `Chat` | 聊天 |
| `BackgroundTasks` | 后台任务 |
| `Search` | 搜索 |
| `Language` | 语言切换 |
| `Theme` | 主题设置 |
| `AI` | PC AI 助手入口 |
| `Bluetooth` | 蓝牙打印机 |
| `SystemStyle` | 框架风格切换 |
| `FullScreen` | 浏览器全屏 |

MCP 更新该实体字段时使用固定 Key 数组，例如 `['Chat', 'AI', 'FullScreen']`，写后回读字段并刷新当前租户的系统配置。隐藏 `AI` 只控制 PC 顶栏入口；原有“关闭 AI 助手”设置还控制移动端，两个设置独立。隐藏入口不会赋予或撤销后端权限，也不会替代原功能开关。

## 系统授权版本标签

【界面风格 → 主题与导航】中的“不显示系统授权版本”（`HideSystemLicenseVersion`）默认关闭。
<!-- 暂停个人版销售，保留原文以便恢复
右上角显示开源版、个人版或企业版，点击进入 `/#/license`；开启此设置只隐藏授权版本标签，
-->
右上角显示当前授权版本，点击进入 `/#/license`；开启此设置只隐藏授权版本标签，
Api/Web 版本和开发工具连接入口继续显示。授权类型来自后端实时启动配置 `PlatformEdition`，不由可编辑配置决定。
需更新前后端镜像及“系统设置”应用；旧库缺少开关时仍默认显示。

## 侧栏 Logo 的比例与高度

`SysLogoType=图形` 表示只显示图片，展开侧栏时图片使用可用宽度，不再限制为方形图标。`SysLogoHeight` 支持数值或像素字符串，例如 `80`、`80px`；侧栏顶部会随高度调整，菜单滚动区域使用剩余高度。收起侧栏时保留最大 40px 的紧凑图标。

图片始终等比例完整显示。超宽横版 Logo 即使配置高度 80px，也会受侧栏宽度约束，实际图形高度小于 80px；这是正常的等比例适配，不应拉伸图片。建议裁掉原图中多余的透明留白。无效高度回退 40px，图片失败时继续使用当前租户标题首字，不回退成其它租户的品牌。

## 启动加载页 Logo

启动时尚未读取到有效的 `SysLogo`，默认显示红色吾码矢量 Logo 与品牌脉冲圆环，在高分屏和不同窗口尺寸下都保持清晰。
设置了系统 Logo 后，缓存配置和本次新读取的系统设置均可更新启动图标；图片成功加载后才切换，
空值、无效格式或图片加载失败时保留默认图标，避免出现破图。

例如在系统设置上传公司 Logo，后续启动会优先显示该图片，无需另配 Loading 图标。
默认图标随新版 PC 前端静态资源交付，部署时需一起更新 `index.html` 与 `static` 目录；
无需新增数据库字段或安装新的系统设置应用包。此规则仅用于启动页，侧栏 Logo 继续按上节处理。

## 公开配置与服务端私密配置

系统设置采用明确的双表边界：

- `sys_config` 保存需要向浏览器公开的租户配置。新增公开项必须创建真实物理字段和 `diy_field` 元数据；前端 `V8.SysConfig` 读取它的安全投影。
- `mci_system_setting` 只保存敏感配置或仅供后端使用的普通值。历史 `IsPublic` 字段已停用，任何记录都不会进入匿名 `GetSysConfig` 或浏览器。
- 后端接口引擎和后端 V8 事件仍可读取 `sys_config` 全部字段；私密值统一从 `V8.SysConfig.ServerPrivateSettings[ConfigKey]` 读取。禁止返回、记录或复制整个 `ServerPrivateSettings`。
- `mci_system_setting` 的 Secret 使用租户绑定认证加密，列表默认掩码；临时显示原文要求 Passkey、Authenticator 或严格人脸的一次性步进验证，并使用 `no-store`。

“是否启用、是否显示、采用哪种公开交互方式”这类浏览器和管理员都需要判断的能力开关，必须建成 `sys_config` 实体字段，不能因为它与登录、OAuth 或安全功能有关就塞进“安全与服务接入”。“安全与服务接入”只维护 API Key、ClientSecret、RP ID、Origin、Issuer、供应商地址、Scope 等不能公开或仅供后端执行的参数。两边禁止维护同一个新配置；存量 `mci_system_setting` 开关只作升级兼容回退，保存入口和列表均不再展示。

## 系统设置官方应用与 Secret 边界

AI 接入畅捷通等第三方服务时，应先使用 `microi_manage_server_private_secret` 列出已配置的 Key，再把 App Secret 保存到“安全与服务接入”，并按 Key 回读 `HasSecret/IsSecret/IsEnabled` 确认。工具复用平台已有私密配置，不返回明文或密文；写入确认格式为 `SAVE:<Key>`。服务端接口引擎按受限私密配置能力读取，浏览器、表单代码和公开配置不得取得 Secret。不要因凭据尚未配置就让用户新增生产环境变量、硬编码到源码或另建凭据库。

独立官方应用 `app.microi.sys-config` 唯一交付以下接口引擎：

- `platform-tenant-system-settings` 是 Managed 核心，只编排管理员列表、删除和非 Secret 保存；
- `platform-system-settings-custom-hook` 是 CreateIfMissing 租户扩展，默认直接返回 `{ Code: 1 }`，官方升级不覆盖；
- Hook 只接收阶段、设置 Id、ConfigKey 和结果数量，不接收 `ConfigValue`、`SecretCipher` 或 Secret 原文。

安装、更新或重新安装“系统设置”会恢复 Managed 核心源码，因此租户逻辑必须写入 Hook。旧 `/api/TenantSystemSettings/List`、`Delete` 与非 Secret `Save` 只保留兼容转发。Secret/Sensitive Key 保存仍由可信 C# 立即转换为租户绑定认证密文；`GetRevealChallenge + Reveal` 仍要求超级管理员的普通 DiyToken 会话和一次性 Passkey/TOTP/严格人脸票据。访问密钥、匿名 V8、普通 FormEngine HTTP 和租户 Hook 都不能获得通用加解密或 Reveal 能力。

基础 SaaS 空库包仍可携带新租户初始化所需的表、字段和默认模板，但上述两个接口引擎只允许“系统设置”包拥有；SaaS 与应用商城包不得复制同 Key Managed 资源，避免多个官方包相互覆盖。

## 系统全局函数

更新后端及“系统设置”应用 v6.4.0 后，可在系统设置的“全局函数”子表维护 `mci_global_function`：每行一个函数，选择前端 `Client` 或后端 `Server`，配置函数名、源码、启用状态和顺序。仅平台管理员可维护；源码必须是一个与函数名一致的 `function` 声明，不允许顶层执行语句。

系统默认提供两个运行端各一套 `DateNow`、`DateFormat`、`DateAdd`。安装按当前唯一启用的系统设置绑定父记录，只补不存在的种子，不覆盖用户修改过的函数，也不替换 `GlobalV8Code`、`GlobalServerV8Code`。

执行顺序为基础日期函数、当前设置且匹配运行端的启用函数、原有全局 V8。原有同名自定义函数优先，建议同一名称只在一个位置维护。后端引擎还会在加载租户设置前提供日期基础函数，因此缺表、首次升级、安装器自举不再依赖用户手工补写 DateNow。

函数列表和合并代码使用租户隔离的 L1/Redis 缓存；新增、修改、删除和系统设置变更在真实事务提交后更新缓存版本，回滚不发布新版本。其它节点通过现有缓存失效通知读取新版本；旧快照有有限 TTL。前端已打开页面需刷新，获取新的全局代码。不要直接用 SQL 修改函数表而绕过表单引擎缓存失效流程。

## 登录与身份能力开关

登录与身份能力的公开正向开关如下：

| `sys_config` 字段 | 默认值 | 说明 |
|---|---:|---|
| `IdentityVerificationEnabled` | `1` | 统一强身份验证与多登录方式总开关 |
| `PasskeyEnabled` | `1` | Passkey / Windows Hello / Face ID / Touch ID 能力 |
| `AuthenticatorTotpEnabled` | `1` | 标准 TOTP Authenticator 能力 |
| `RequirePasswordChangeStepUp` | `1` | 已登记强因子的用户修改密码时要求二次验证 |
| `ExternalLoginEnabled` | `1` | 内置第三方登录总开关 |
| `FaceVerificationEnabled` | `0` | 独立 Face Gateway 严格人脸与活体能力 |
| `GiteeLoginEnabled` / `WeChatLoginEnabled` / `GitHubLoginEnabled` | `0` | 对应内置外部登录能力 |
| `MicroiLoginEnabled` | `0` | 使用 `microi.net` 注册的官方账号登录已绑定本地账号；每部署独立公共 ClientId + PKCE，无需 Secret |

新字段显式值优先；字段尚未安装或值为空时，运行时才读取旧 `mci_system_setting` Key，再回退到存量 `sys_osclients` / 安全默认值。这样旧租户升级后不会被突然改值，但升级完成后的唯一配置入口始终是公开系统设置。

运行时只读取 `IsEnable=1` 且未删除的系统配置；历史停用或软删除记录不会覆盖登录开关。若存在多条有效配置，按修改时间从新到旧、Id 从小到大读取第一条。开启 Gitee、微信或 GitHub 登录后，还需要在“安全与服务接入”保存并启用对应 ClientId/AppID 和 Secret，用户须先绑定第三方身份。

### Microi 官方账号接入

Microi 登录使用固定的官方 OIDC 身份服务。每个部署先单独登记公共客户端（`ClientAuthMethod=none`、PKCE S256、nonce）
和精确回调，再启用 `Login.Microi.ClientId`，Scope 使用 `openid profile email`；不配置或共享 ClientSecret。
官方应用包仅提供默认停用的 ClientId、Scope、Name、Description 模板，不包含客户实例或用户绑定。
用户先在个人中心绑定本人官方账号，之后才能登录；完整步骤见[Microi 官方账号登录](./identity-verification#microi-login)。

### 回调与存量升级

外部登录回调优先使用当前有效 `sys_config.ApiBase` 的公网 HTTPS 地址，保留其中的路径前缀，再追加 `/api/ExternalLogin/Callback?OsClient=<租户>&Provider=<供应商>`。反向代理在外部终止 TLS、后端接收 HTTP 时，仍使用该 HTTPS 地址；供应商控制台登记的回调须与它一致。`ApiBase` 不得包含账号密码、查询参数或片段。未配置 `ApiBase` 的旧租户可回退直接 HTTPS 或本机 HTTP 请求地址，其它无效地址会拒绝发起授权。此行为需更新后端，应用包中的配置字段无需新增。

旧数据库启用 Passkey / Authenticator 时，需要同时更新平台前端、后端与官方“系统设置”“SaaS引擎”应用包；仅安装应用包不会替换正在运行的后端 DLL 或已部署的前端静态资源。完成更新后在 `sys_config` 打开公开能力与登录入口开关，存量用户仍须在个人中心分别登记自己的 Passkey 或 TOTP，系统不会替用户自动生成认证因子。Passkey 还要求可信 HTTPS 前端 Origin（`localhost` 仅限开发），HTTP 站点即使开关已打开也不能完成 WebAuthn 登记或登录。

## 开发配置与服务接入

### 停用任务调度

【开发配置 → 接口、文件与运行环境】的【停用任务调度】对应 `sys_config.DisableTaskScheduling`，默认关闭。更新后端与“系统设置”应用 v6.4.2 后，开启可让新版后端停止领取本租户的 Quartz 定时任务，保留仍连接同一数据库的旧版调度，不修改共享任务启停状态。

保存成功后下一次调度检查读取更新后的系统设置缓存，无需重启；已开始的业务不会被强行中断。新版将跳过原因写入任务日志，并按任务及计划时间跨节点去重。普通接口与应用安装等持久后台任务不受影响。交接步骤及日志边界见[任务调度与后台任务](../system-engine/job#新旧版本共库时停用新版任务调度)。

### 开发配置的表单布局

“开发配置”Tab 默认使用四个展开的 `CollapseGroup`：访问与运行地址、V8 执行治理、全局脚本、模板与页面代码。分组作用域使用“直到下一个分组”，避免后续新增字段被错误吞入末尾分组。

该 Tab 的 `CodeEditor` 字段统一设置 `Config.CodeEditor.DisplayMode = "Dialog"`。表单默认只显示 `编辑代码（N字）` 按钮，点击后使用平台统一大圆角弹层编辑；确实需要在表单内常驻编辑器的字段可以在【表单设计 → 控件配置 → 默认显示方式】改回 `Inline`。字符数按 Unicode 字符计算，空值也显示 `0字`。

### 表单地图服务接入

表单 `Map / MapArea` 的高德、百度、腾讯凭据统一放在 `mci_system_setting`，并归类到“系统设置 → 安全与服务接入”：

| Key | 类型 | 默认状态 | 用途 |
|---|---|---|---|
| `Map.Provider` | 普通私有 | 停用 | 默认地图供应商：`AMap`、`Baidu` 或 `Tencent` |
| `Map.AMap.JsApiKey` | Secret | 停用 | 高德 Web JS API Key |
| `Map.AMap.SecurityJsCode` | Secret | 停用 | 高德 JS API 2.0 安全密钥 |
| `Map.AMap.ServiceHost` | 普通私有 | 停用 | 高德安全代理地址；优先于直接下发安全密钥 |
| `Map.Baidu.JsApiKey` | Secret | 停用 | 百度 JavaScript API AK |
| `Map.Tencent.JsApiKey` | Secret | 停用 | 腾讯 JavaScript API GL Key |

官方模板全部默认停用，升级不会覆盖现有租户选择；旧 `sys_config.AMapKey / AMapSecret / BaiduAK` 在新设置未启用时继续兼容。地图运行时端点只接受当前登录用户，从 DiyToken 确定租户，只返回字段实际选择的一家供应商，并设置 `Cache-Control: no-store`；访问密钥会话被拒绝，响应中不存在其它 Secret。

浏览器地图 SDK 必须拿到客户端 Key，所以 Key 在浏览器开发者工具中仍可见。必须在高德、百度、腾讯控制台配置当前生产域名白名单和所需 JavaScript API 产品；Secret 的作用是防止明文落库、列表泄露和一次性返回全部供应商凭据。高德配置 `Map.AMap.ServiceHost` 后，后端不会再返回 `Map.AMap.SecurityJsCode`。

```js
// 前端或后端均可读取公开实体字段
var title = V8.SysConfig.SysTitle;

// 仅后端接口引擎、SubmitBeforeServerV8、SubmitAfterServerV8 等可信后端事件可用
var privateSettings = V8.SysConfig.ServerPrivateSettings || {};
var clientSecret = privateSettings['Login.Gitee.ClientSecret'];
// clientSecret 只能参与当前后端调用，禁止 return 或 console.log。
```

`FormMaskBlur` 是全局正向开关：缺失、空值或 `0/false` 默认关闭遮罩毛玻璃，只有显式 `1/true` 才开启。平台统一 Dialog、图片裁剪、字段配置、业务弹窗和 Element Plus MessageBox 都必须从同一运行时读取该值，页面不得再用静态 CSS 默认开启毛玻璃。表级 `diy_table.DisableFormMaskBlur` 仍是负向开关；全局开启后，某张表显式配置 `1/true` 可单独关闭。旧 `sys_config.DisableFormMaskBlur` 只用于未升级租户的前端兼容回退，字段元数据必须在 PC 与移动端隐藏。

登录页入口统一使用 `DisableLoginPasskey`、`DisableLoginAuthenticator`、`DisableLoginMicroi`、`DisableLoginGitee`、`DisableLoginWeChat`、`DisableLoginGitHub` 六个负向开关，字段标签分别为“关闭生物登录入口”“关闭Authenticator登录入口”“关闭Microi登录入口”“关闭Gitee登录入口”“关闭微信登录入口”“关闭GitHub登录入口”。它们缺失、空值或 `0/false` 时默认显示入口，只有显式 `1/true` 才关闭；旧 `Login*Display` 字段仅作兼容回退并隐藏。Microi 能力默认关闭，入口可见不代表已启用或已配置。`DisableAiAssistant` 同样保持负向开关语义。

AI 助手只保留“关闭AI助手图标”一个设置项：`DisableAiAssistant=1/true` 表示隐藏图标，`0/false` 表示显示。旧版“显示AI助手图标”（`IsShowAiAssistant`）已从官方母版字段元数据和新版系统设置安装包移除，不再作为新项目配置入口。已有数据库的旧物理列可保留供尚未升级的定制客户端兼容；字段 Id 可能曾被新开关复用，维护旧租户时须先按表名与字段名定位，不能直接套用旧 Id 删除。

## 界面风格：框架来源标识与水印

微服务和定制组件的来源标识由吾码宿主统一渲染，子应用不需要自行实现，也不存在租户级显示开关。`RenderSourceBadgeMode` 已停用并从系统设置移除：来源标识始终可发现，避免用户在不知道内容来源的情况下误改宿主或子应用。

菜单微服务显示在框架内容区右上角并提供独立关闭按钮，用户认为它遮挡子应用控件时可仅关闭当前页面实例的标识；切换到另一个微服务页面后会重新显示，不会记住为全局关闭。`V8.OpenAppDialog` 打开的微服务或定制弹层把标识放在标准标题栏，因为它不会覆盖弹层正文和右上角操作区，所以始终显示且不提供关闭按钮。表单 `DevComponent` 显示在字段宿主，表格中的 `DevComponent` 只在列头显示一次，避免每行重复。

来源标识本身是可点击按钮。点击后由框架打开统一的大圆角详情弹层，展示应用标识、页面标识、应用内路由、框架路由、版本、源码定位、运行入口、发布/挂载状态和租户坐标，并生成一段可复制的 Microi MCP 修改指令。详情中的运行信息只显示公开定位数据，不展示 Token、访问密钥或私有配置值。

框架水印使用以下公开 `sys_config` 字段，覆盖整个 `100vw × 100vh`，包括路由内容和 Element Plus 弹层；水印层固定 `pointer-events:none`，不会阻止点击、滚动、拖拽、触摸或键盘操作，并自动适配亮色/深色主题。

| 字段 | 默认值 | 说明 |
|---|---|---|
| `FrameworkWatermarkEnabled` | `0` | 显式设为 `1/true` 才开启，保证旧租户升级后视觉不变 |
| `FrameworkWatermarkContent` | `$SysTitle$ - $UserName$` | 留空时显示“系统标题 - 用户名”；用户名为空自动回退 `$Account$`，两者均为空时只显示系统标题，不会输出 `undefined/null`。支持 `$SysTitle$`、`$SysShortTitle$`、`$UserName$`、`$Account$`、`$Date$`、`$DateTime$`，也支持 `{{UserName}}` 写法 |
| `FrameworkWatermarkDirection` | `DiagonalUp` | `DiagonalUp`（斜向上）、`DiagonalDown`（斜向下）、`Horizontal`（水平） |
| `FrameworkWatermarkOpacity` | `30` | 百分比；未设置、非法或为 `0` 时按 `30` 处理，运行时限制在 `1–100` |
| `FrameworkWatermarkDensity` | `Comfortable` | `Compact`、`Comfortable`、`Sparse` 三档重复间距 |
| `FrameworkWatermarkFontSize` | `14` | 像素；未设置、非法或为 `0` 时按 `14` 处理，运行时限制在 `8–72` |

水印内容只应使用系统标题、用户显示名、账号、日期等公开展示信息，不要填写 Token、密码、Secret、手机号等敏感值。保存系统设置后会沿用现有 `sys_config` 缓存失效机制；刷新页面即可按最新配置重建框架水印。

“界面风格”是一级 Tab，内部继续使用“主题与导航 / 登录界面与入口 / AI 与框架水印”等 `CollapseGroup` 归类设置。新增界面配置时应放入相应折叠组，不能继续把大量开关直接平铺在 Tab 中。

---

## 🔐 验证码

### 获取验证码图片
::: details 展开查看 JavaScript 代码（24 行）
```js
//通过浏览器测试：
https://api.microios.com/api/Captcha/getCaptcha?OsClient=micrios
//通过查看元素，可在Response Headers中看到返回了captchaid，在提交验证码时，此值必须传入到后端。
//在PC前端或Uni-App移动端的处理方式大致为：
<img id="CaptchaImg" src="" @click="GetCaptcha()" />
GetCaptcha(){
    $axios.get(self.DiyCommon.GetApiBase() + '/api/Captcha/getCaptcha', {
        params: {
            OsClient : self.OsClient//一定要传入OsClient值
        },
        responseType: 'arraybuffer'
    })
    .then(response => {
        if(response && response.headers && response.headers.captchaid){
            self.CaptchaId = response.headers.captchaid;//一定要将返回的captchaid存储起来
        }
        return 'data:image/png;base64,' + btoa(
            new Uint8Array(response.data)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
    }).then(data => {
          $('#CaptchaImg').attr('src', data);//显示验证码图片
    });
}
```
:::
---

### 提交验证码
```js
//参数传入_CaptchaId、_CaptchaValue
```
---

### 验证码配置
::: details 展开查看 JSON 配置（24 行）
```json
{
    "CaptchaType": 11, // 验证码类型，值为0-11，具体效果见平台文档
    "CodeLength": 1, // 验证码长度, 要放在CaptchaType设置后。当类型为算术表达式时（CaptchaType=10-11），长度代表操作的个数, 建议1。当CaptchaType=0-9时建议填4。
    "ExpirySeconds": 300, // 验证码过期秒数
    "IgnoreCase": true, // 比较时是否忽略大小写
    //"StoreageKeyPrefix": "", // 存储键前缀
    "ImageOption": {
        "Animation": true, // 是否启用动画
        "FontSize": 32, // 字体大小
        "Width": 150, // 验证码宽度
        "Height": 50, // 验证码高度
        "BubbleMinRadius": 5, // 气泡最小半径
        "BubbleMaxRadius": 10, // 气泡最大半径
        "BubbleCount": 3, // 气泡数量
        "BubbleThickness": 1.0, // 气泡边沿厚度
        "InterferenceLineCount": 2, // 干扰线数量
        //"FontFamily": "kaiti", //【暂不支持】 包含actionj,epilog,fresnel,headache,lexo,prefix,progbot,ransom,robot,scandal,kaiti
        "FrameDelay": 300, // 每帧延迟,Animation=true时有效, 默认30，建议300左右
        //"BackgroundColor": "#ffffff", //【暂不支持】  格式: rgb, rgba, rrggbb, or rrggbbaa format to match web syntax, 默认#fff
        "ForegroundColors": "", //  颜色格式同BackgroundColor,多个颜色逗号分割，随机选取。不填，空值，则使用默认颜色集
        "Quality": 100, // 图片质量（质量越高图片越大，gif调整无效可能会更大）
        "TextBold": false // 粗体
    }
}
```
:::
|CaptchaType|字体|静态图|动图|
|:--:|:--:|:--:|:--:|
| DEFAULT (0) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987335545209958389942.gif/20230909/1.gif" data-fancybox="gallery" alt="DEFAULT 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987336384782028080986.gif/20230909/2.gif" data-fancybox="gallery" alt="DEFAULT 动态验证码示例" width=130> |
| CHINESE (1) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987348140208461391418.gif/20230909/2-1.gif" data-fancybox="gallery" alt="CHINESE 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987348878749178882619.gif/20230909/2-2.gif" data-fancybox="gallery" alt="CHINESE 动态验证码示例" width=130> |
| NUMBER (2) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987351081492956070489.gif/20230909/3-1.gif" data-fancybox="gallery" alt="NUMBER 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987351833418265739934.gif/20230909/3-2.gif" data-fancybox="gallery" alt="NUMBER 动态验证码示例" width=130> |
| NUMBER_ZH_CN (3) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987352637251001802115.gif/20230909/4-1.gif" data-fancybox="gallery" alt="NUMBER_ZH_CN 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987353340272558580529.gif/20230909/4-2.gif" data-fancybox="gallery" alt="NUMBER_ZH_CN 动态验证码示例" width=130> |
| NUMBER_ZH_HK (4) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987354240120153944859.gif/20230909/5-1.gif" data-fancybox="gallery" alt="NUMBER_ZH_HK 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987355024308308067930.gif/20230909/5-2.gif" data-fancybox="gallery" alt="NUMBER_ZH_HK 动态验证码示例" width=130> |
| WORD (5) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987356231940556741541.gif/20230909/6-1.gif" data-fancybox="gallery" alt="WORD 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987356971159357182120.gif/20230909/6-2.gif" data-fancybox="gallery" alt="WORD 动态验证码示例" width=130> |
| WORD_LOWER (6) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987357903149398401416.gif/20230909/7-1.gif" data-fancybox="gallery" alt="WORD_LOWER 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987358559208156725035.gif/20230909/7-2.gif" data-fancybox="gallery" alt="WORD_LOWER 动态验证码示例" width=130> |
| WORD_UPPER (7) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987359347923562585116.gif/20230909/8-1.gif" data-fancybox="gallery" alt="WORD_UPPER 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987368351564882713778.gif/20230909/8-2.gif" data-fancybox="gallery" alt="WORD_UPPER 动态验证码示例" width=130> |
| WORD_NUMBER_LOWER (8) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987369066747495961267.gif/20230909/9-1.gif" data-fancybox="gallery" alt="WORD_NUMBER_LOWER 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987369777462003187163.gif/20230909/9-2.gif" data-fancybox="gallery" alt="WORD_NUMBER_LOWER 动态验证码示例" width=130> |
| WORD_NUMBER_UPPER (9) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987375136845773128473.gif/20230909/10-1.gif" data-fancybox="gallery" alt="WORD_NUMBER_UPPER 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987375867861808167519.gif/20230909/10-2.gif" data-fancybox="gallery" alt="WORD_NUMBER_UPPER 动态验证码示例" width=130> |
| ARITHMETIC (10) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987376677516548099905.gif/20230909/11-1.gif" data-fancybox="gallery" alt="ARITHMETIC 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987377367742808615156.gif/20230909/11-2.gif" data-fancybox="gallery" alt="ARITHMETIC 动态验证码示例" width=130> |
| ARITHMETIC_ZH (11) |   | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987378101506678680095.gif/20230909/12-1.gif" data-fancybox="gallery" alt="ARITHMETIC_ZH 静态验证码示例" width=130> | <img src="https://file.microi.net/itdos/itdos/upload/editor/image/202309/6382987378730926385837508.gif/20230909/12-2.gif" data-fancybox="gallery" alt="ARITHMETIC_ZH 动态验证码示例" width=130> |
