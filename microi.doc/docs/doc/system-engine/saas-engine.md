# 🌐 SaaS 引擎

> **承载所有租户的核心独立开发配置，一套程序驱动 N 个租户**

---

## 📌 介绍

- SaaS 引擎作为平台的亮点之一，承载所有租户的核心独立开发配置
- 平台默认是 SaaS 模式，部署时必须指定 `OsClient`、`OsClientType`、`OsClientNetwork`
- 每个租户一个独立数据库，可在主库 `sys_osclients` 表中配置独立的数据库连接、MongoDB、Redis、MQ、阿里云、MinIO 等
>* 一套程序驱动N个租户数据库，而不必每个租户再部署一套docker程序
>* 本地二次开发`一键切换租户数据库`、`环境`
>* `主库`即部署平台时`环境变量`或`appsettings.json`中配置的`数据库连接字符串[OsClientDbConn]`
>* 所有的 **SaaS 路由与部署控制面配置** 以主库 `sys_osclients` 为准，租户库不维护第二份 `sys_osclients` 数据；当前租户自己的业务设置则保存在其租户库的 `sys_config` / `mci_system_setting`，不要与控制面混为一谈

## 官方应用职责边界

SaaS 引擎官方应用继续负责租户发现、公开启动配置、语言包、私有文件授权和租户开通。旧版 UniApp 使用的 `microi-init` 也由该应用以 Managed 策略继续交付：匿名请求只能获得公开系统设置；只有原始 DiyToken 在后端重新验证、用户与请求租户一致后，才返回当前用户和其角色允许的菜单。菜单通过仅绑定该固定 ApiEngineKey 的 `GetLegacyInitMenuTree` 可信原子复用 `SysMenuLogic` 权威角色过滤，不能借匿名 FormEngine 直读 `sys_menu`。域名解析到其它租户时只返回目标 `OsClient` 提示客户端重新初始化，不能在当前匿名 V8 上下文中跨租户读取配置。

其中 `platform-create-tenant` 属于 `app.microi.saas-engine`：接口引擎先调用 `platform-runtime-custom-hook` 的 Before 阶段，再由绑定固定 ApiEngineKey 的可信原子从当前 DiyToken 派生所有者、手机号、姓名和密码材料。租户创建成功后，即使 After Hook 或审计暂时失败，也返回成功和告警，避免客户端重复创建。

系统账号与系统设置已经采用独立单一所有权：

| 官方应用 | 唯一拥有的接口引擎 |
| --- | --- |
| `app.microi.sys_user`（系统账号） | `platform-user-update-preferences`、`platform-user-update-profile`、`platform-user-custom-hook` |
| `app.microi.sys-config`（系统设置） | `platform-tenant-system-settings`、`platform-system-settings-custom-hook` |
| `app.microi.saas-engine`（SaaS引擎） | `microi-init`、`platform-create-tenant`、`platform-runtime-custom-hook` 及 SaaS 启动/租户运行时能力 |

基础 SaaS 空库包与独立应用可以同时交付同一能力所需的表、字段或初始化模板，以分别覆盖新租户和存量租户；同一个 Managed ApiEngineKey 则只能有一个官方包所有者。SaaS、应用商城和独立应用之间不得复制这些 Key，否则更新顺序会造成官方代码互相覆盖。旧 Controller 路由只承担旧客户端兼容转发，不再承载业务编排。

## `OsClient`
>* OsClient 值即为 `SaaS引擎Key`，用于确定租户，值可自定义，建议使用全小写字母，例如 `tenant_a`、`tenant_demo`、`demo01`。

## `OsClientType`
>* OsClientType值为`SaaS引擎环境类型`，值自定义，如`正式环境`、`测试环境`、`外帐环境`等
>* 如填写`Product`，代表`正式环境`，那么此条数据的`数据库连接字符串`、`MongoDB`、`Redis`均应填写`正式环境`的配置
>* 如填写`Dev`，代表`测试环境`，那么此条数据的`数据库连接字符串`、`MongoDB`、`Redis`均应填写`测试环境`的配置

## `OsClientNetwork`
>* OsClientNetwork值为`SaaS引擎网络类型`，值自定义，如`内网`、`外网`等
>* 如填写`Internal`，代表`内网环境`，那么此条数据的`数据库连接字符串`、`MongoDB`、`Redis`中的IP均应填写`内网环境`的IP
>* 如填写`Internet`，代表`公网环境`，那么此条数据的`数据库连接字符串`、`MongoDB`、`Redis`中的IP均应填写`公网环境`的IP

## 程序必须指定以上3个参数
>* 本地二次开发修改`OsClient` `OsClientType` `OsClientNetwork`三个值轻松切换`不同租户`的`不同环境`
>* 在主库`sys_osclients`表中，`OsClient` + `OsClientType` + `OsClientNetwork`三个字段同时唯一，如同时存在以下3条数据是支持的：
>* 当`OsClient`="microi"，`OsClientType`="Product"，`OsClientNetwork`="Internal，`DbConn`="Data Source=192.168.1.11;Database=microi"时，代表使用了`内网IP`+`正式环境数据库`
>* 当`OsClient`="microi"，`OsClientType`="Dev"，`OsClientNetwork`="Internal"，`DbConn=`"Data Source=192.168.1.11;Database=microi_dev"时，代表使用了`内网IP`+`测试环境数据库`
>* 当`OsClient`="microi"，`OsClientType`="Dev"，`OsClientNetwork`="Internet"，`DbConn`="Data Source=59.110.139.95;Database=microi_dev"时，代表使用了`公网IP`+`测试环境数据库`

### 租户未找到、缓存恢复与运行登记

“未找到 OsClient”应先核对 API 部署的三个参数与主库登记是否一致。例如，租户只有 `Product / Internet` 登记时，`Product / Internal` 节点不能直接使用它。新版运行时在本节点和共享缓存都未找到租户时，会按当前环境、当前网络从主库重新加载一次；同一节点上的并发加载会合并，加载期间的递归调用也会被阻止。该恢复过程不切换网络，也不会启用已禁用或已删除的租户。

对于历史自助开通租户缺少部署网络登记的情况，更新包含该能力的后端平台，并安装 SaaS 引擎应用 v8.1.3 或更高版本后，主租户超级管理员可调用 Managed 接口 `platform-tenant-runtime-registration`。先检查计划：

```js
{ TenantKey: 'tenant_demo', TargetNetwork: 'Internal', Apply: false }
```

确认目标节点能够连接原租户数据库后，再提交：

```js
{ TenantKey: 'tenant_demo', TargetNetwork: 'Internal', Apply: true,
  Confirm: 'REGISTER:tenant_demo:Internal' }
```

目标网络必须已有唯一、启用的主租户登记，来源必须是同环境下唯一、启用且有所有者的自助租户。后端用分布式租约、确定的记录 Id 和写入后回读保证重复请求不重复创建；已有目标登记（包括禁用或删除记录）不会被覆盖。原数据库和数据库凭据保持不变，共享 Redis、对象存储等基础设施由目标网络主租户继承。完成后调用 `clear-saas-engine-cache` 刷新目标租户，并从实际访问域名验证系统配置与登录页面。

个人中心按租户 Key 合并不同网络登记，额度也按独立租户计数。查看管理员密码仍先核验当前 DiyToken 与租户所有者关系，再解析目标租户；现代单向密码哈希不能还原原文，不能通过补登记或缓存恢复绕过这一限制。

历史空库还可能带有 `admin.PwdEncode=V8`，而开通器只更新了实际为 DES 的密码密文。新版开通器会同步写入可验证的密码编码；未知自定义编码保持原规则。对于这类存量错标记录，SaaS 应用 v8.1.4 提供 `platform-tenant-admin-credential-repair`：先传 `{ TenantKey: 'tenant_demo', Apply: false }` 预检，确认 `CanRepair=true` 后再传 `Apply:true` 与 `Confirm:'REPAIR-ENCODING:tenant_demo'`。可信后端验证 DES 解密再加密的结果完全一致，并以原密文和原编码作条件，只把编码标记改为 DES；密码内容不会变化，也不会返回给修复接口。该操作仍要求主租户超级管理员与支持该能力的新版后端。真正的自定义算法、单向哈希以及并发改密后的记录不会被误修复。

## 安全、脱敏与平台级配置

`sys_osclients` 包含数据库、认证、Redis、对象存储、MQ/MQTT、搜索等基础设施机密，不能通过普通 FormEngine、前端 V8 或接口返回整行数据。

- `V8.OsClientModel` / `V8.ClientModel` 是当前租户的独立脱敏副本，不包含数据库连接、`AuthSecret`、Redis、对象存储、MQ/MQTT、搜索凭据。
- 浏览器 `V8.SysConfig` 是 `sys_config` 的脱敏副本，不包含 `ClientSecrets`、`PwdV8`、`GlobalServerV8Code`、`ServerPrivateSettings` 和疑似 Password/Secret/Token/Key/Connection 字段。
- 存量项目可能在 `sys_osclients` 扩展微信、支付、ERP 等业务密钥；新增配置应迁移到当前租户库的 `mci_system_setting`，由受控后端使用，禁止把整个配置对象或具体密钥返回前端。
- 普通帐号即使拥有 Token 或错误配置了菜单/高级表权限，也不能通过通用 FormEngine 访问 SaaS 配置、接口引擎、菜单角色、任务、数据源等管理员专用平台表。相关控制面管理接口会用当前租户主库复核活动用户及有效管理员角色，要求 `Level >= 9999`；请求体自报管理员身份无效。
- 主租户由运行环境中的 `OsClient` 或 `AppSettings:OsClient` 决定，不应在业务代码中写死为 `master`、`iTdos` 或其它固定值。

数据库、Redis、主租户标识等启动基础设施仍由安装编排中的少量基础参数提供；普通业务和运行参数统一由 SaaS 引擎主租户或系统设置管理，未填写时使用代码安全默认值。子租户只能在平台允许的字段上配置自身额度，不能抬高节点级硬边界。文件上传业务值按当前租户 `sys_osclients` → 代码默认值解析，最终仍受 API 固定接收硬顶和反向代理边界保护。配置保存后应走 SaaS 引擎的共享缓存刷新流程并回读验证，不依赖逐节点重启。

### 为全部子租户维护平台应用

主租户 `Level >= 9999` 的超级管理员可在 SaaS 引擎页面点击【一键为所有子租户安装/更新所有平台应用】。按钮只在当前后端运行环境的主租户显示；服务端还会再次核验主租户身份、当前持久任务租约和管理员快照，不能通过伪造 `OsClient`、目标租户或用户等级调用。

系统按 `OsClientType + OsClientNetwork` 当前运行环境读取主库 `sys_osclients`，选择已启用、未删除的租户并排除主租户。平台会先创建一个编排任务，再为每个子租户创建一个独立的【安装/更新全部平台应用】持久后台任务。子任务的进度、成功或失败结果都保存在主租户任务表，并实时显示在主租户右上角通知中心。父任务按全部子任务的真实平均进度汇总，`Current/Total` 固定使用百分比口径；只有全部子任务成功后父任务才成功，不能以“任务已入队”冒充 99% 或 100%。

同一套平台可能同时部署 `Product/Internal`、`Product/Internet` 等多个运行分区。一次父任务只覆盖发起节点当前的 `OsClientType + OsClientNetwork` 分区，不能把某个分区的“全部成功”当成整个平台已经收敛。事故恢复和正式验收必须先回读每个活跃分区的目标租户清单与精确数量，再从该分区对应的主租户节点分别执行，等待父任务及全部子任务进入成功终态；随后每个分区都要使用新的幂等键立即复跑一次，并确认零安装／零更新。禁止通过临时修改租户 `OsClientNetwork`、借用另一分区任务或只检查公开首页来绕过分区控制面。

当新版前端已上线、历史租户缺少 `platform-sys-menu` 或 `platform-sys-config` 等启动接口时，受信控制面可使用 `MaintenanceScope=StartupDependencies`，并把目标严格限定为应用商城与 SaaS 引擎两个唯一官方资源所有者。大范围事故可再启用 `StartupDependencyBootstrapOnly=true`：子任务必须仍由持久后台任务、有效 fencing token 和权威租户目录发起，入队后在 `Pending` 状态原子写入并强回读精确范围；工作器从官方不可变 HDFS 包补齐一项菜单接口与六项 SaaS 运行门面，逐项物理回读 Key、地址、版本、启用/匿名/HTTP 标志和官方源码标记，七项一致后立即成功。只自举不会写入应用安装版本，也不会替代后续正常应用更新；租户改码、软删除、稳定 Id 或地址冲突一律失败关闭。普通“一键维护全部平台应用”、未携带该受信标志的既有任务以及客户自有接口源码均保持原流程。

上述七项是跨大量历史子租户时使用的最小事故恢复范围，不是 API 服务的完整就绪定义。新版后端在接收流量前，会从随服务端自动安装的九个内置官方基础应用包读取全部接口引擎，校验唯一 Key、稳定 Id、地址和 `Managed / CreateIfMissing` 所有权后补缺并逐项物理回读；当前基线为 106 项（98 个 Managed、8 个租户 Hook），数量由包声明计算而不是写死。登录后的服务健康、部门/角色、菜单角标、当前用户 Hook、私有文件、消息、SSO、AI 和应用商城工作器因此会与登录页接口同时就绪。租户已经存在的 `CreateIfMissing` 记录（包括禁用、软删除或大小写变体）仍由租户维护，启动过程不会覆盖。

所有子租户任务会立即创建，便于主租户查看完整队列；实际安装器通过配置租户 Redis 的跨租户并发租约串行执行，避免多个共享物理库的子租户同时修改表结构而互相死锁。安装分片和应用检查点均幂等，单个子任务使用 8 次连续失败重试预算以覆盖短时数据库死锁和 API 滚动重启；任一分片成功写入检查点后，重试次数和陈旧错误会清零，避免长任务把相隔很久的瞬时错误累计为失败。连续失败超过上限仍会失败关闭并在通知中心保留原始错误，不会无限重试。分片队列按“下一次可运行时间，再按创建时间”轮转，尚未执行的子租户会先获得首个分片，不会被较早创建的长任务长期饥饿。商城权威包读取使用完整 HTTP 响应，并对空响应做只读、有界、退避重试；安装写入不会自动重放。

每个子任务只安装未安装的平台应用并更新有新版本的平台应用，已是最新版的应用会幂等跳过。任务标题包含目标租户名称与 `OsClient`，便于定位。投递前平台会幂等补齐旧空库缺失的生成实体物理列，并对 `import-microi-store-package`、`bulk-import-microi-store-packages` 两个固定核心工作器做受控刷新：仅当目标版本严格落后且源码可识别为官方谱系时更新；同版本异构、较新版本或无法识别的租户代码会拒绝覆盖并在父任务中直接显示租户、阶段和原因。历史记录的物理 `Version` 为空时只允许从标准源码头 `Version: vX.Y.Z` 回退比较。

### 主库控制面与租户业务设置的分工

子租户运行时不是“所有配置都从主租户数据库读取”。平台先用主库 `sys_osclients` 找到目标租户的数据库、Redis、MongoDB、MinIO、MQ 等部署路由；建立租户上下文以后，`sys_config` 与 `mci_system_setting` 都从目标租户自己的数据库读取。

| 配置类型 | 事实源 | 子租户能否自行维护 |
|---|---|---|
| 数据库连接、Redis、MongoDB、MinIO、MQ/MQTT、搜索、签名与部署信任链 | 主库 `sys_osclients` | 否，只能由平台控制面维护 |
| 系统标题、主题、公开地址、登录入口显示等浏览器公开配置 | 子租户库 `sys_config` 实体字段 | 按系统设置权限维护 |
| 登录/OAuth 等能力与显示开关 | 子租户库 `sys_config` 实体字段 | 按系统设置权限维护 |
| OAuth ClientId/ClientSecret、RP/Origin/Issuer、供应商地址与第三方私密参数 | 子租户库 `mci_system_setting` | 是，仅租户超级管理员维护 |

`mci_system_setting` 只属于后端私密执行面，历史 `IsPublic` 字段已停用，普通值与 Secret 都不会下发浏览器。是否启用、是否显示等公开开关不得放入该表；历史开关仅作新版 `sys_config` 字段缺失时的兼容回退。后端接口引擎/后端 V8 事件通过 `V8.SysConfig.ServerPrivateSettings[ConfigKey]` 按当前租户读取私密参数，Secret 由可信后端解密；该独立节点避免动态 Key 覆盖 `sys_config` 实体字段。后端使用私密值时禁止整体返回节点，Secret 还禁止写入日志、审计或前端可读字段。

Secret 的列表接口只返回“已配置”状态；显示原文需要租户超级管理员先完成 Passkey、Authenticator 或严格人脸二次验证，原文响应禁止缓存并在前端 30 秒后清除，审计只记录 Key/记录 Id/结果，不记录明文。登录方式的完整配置见 [登录方式、Passkey、Authenticator、第三方登录与严格人脸验证](../more/identity-verification)。

### 存量协议网关的租户绑定配置

畅捷通消息回调与旧微信公众号 OAuth 属于仍需 C# 完成解密、验签、一次性 State 和重定向校验的协议边界。为兼容已经存在于 SaaS 引擎【后端运行配置】Tab 的字段，它们继续按**请求对应的 `sys_osclients` 租户行**读取，不使用主租户通用 `AppSettings` / RuntimeConfigurationReader，也不会回退其它租户：

| 网关 | `sys_osclients` 字段 |
|---|---|
| 微信 OAuth 重定向策略 | `OAuthReturnUrlOrigins` |
| 畅捷通 OAuth / 消息回调 | `ChanjetOAuthState`、`ChanjetAesKey`、`ChanjetAppKey` |
| 历史微信模板消息配置 | `WeChatTemplateAppId`、`WeChatTemplateAppSecret`、`WeChatTemplateId`、`WeChatMiniProgramAppId` |

新登记的畅捷通回调地址应使用 `?OsClient=租户Key`；历史未带参数的单租户回调只兼容当前部署主租户。微信公众号绑定入口以 DiyToken 中的租户为权威，回调以 Redis 一次性票据内的租户为权威，参数中的 `OsClient` / `o` 不能覆盖该可信上下文。绝对返回地址必须精确命中当前租户配置的 HTTPS Origin，站内相对路由继续支持。

`OAuthReturnUrlOrigins` 和 AppId/TemplateId 属于非秘密策略/标识；`OAuthState`、AES Key、AppKey、AppSecret 不会进入 `V8.OsClientModel` 或前端配置，并按 Secret 规则在审计中掩码。整组字段都按租户独立配置且不会复制给新租户。修改 SaaS 租户行后须使用平台保存/刷新链路更新共享 Redis 与本节点租户快照，协议网关每次请求读取最新快照，不保留第二份静态缓存。新的 OAuth/第三方业务集成仍应优先使用当前租户库 `mci_system_setting` 与 Managed 接口引擎，不再扩展这组兼容字段。

### 微信小程序内容安全配置

在 SaaS 引擎当前租户的【微信】Tab 配置以下字段：

| 字段 | 用途 |
|---|---|
| `WeChatMiniProgramAppId` | 小程序 AppId |
| `WeChatMiniProgramAppSecret` | 小程序 AppSecret |
| `WeChatMiniProgramMessageToken` | 微信消息推送 Token（令牌） |
| `WeChatMiniProgramAESKey` | 微信消息推送 EncodingAESKey（消息加密密钥，43 位） |

Token 与 AESKey 必须和微信公众平台填写的值完全一致。推荐在微信后台使用不含 QueryString 的地址：

```text
https://你的API域名/api/WeChatContentSecurity/Callback--OsClient--你的OsClient--
```

服务端也支持 `/api/WeChatContentSecurity/Callback?OsClient=你的OsClient`，但不使用历史缩写 `?o=`。C# 只读取上述敏感配置完成协议验签/解密，解密后的脱敏事件交给应用商城“微信小程序内容安全”中的官方核心接口；租户业务写入和附加日志维护在 `mci-wechat-content-callback-extension`，保存即生效。

### CORS 兼容规则

主租户 `sys_osclients.CorsAllowOrigins` 为空时，平台默认允许任意来源跨域，兼容本地开发、独立前端、H5 和存量租户；只有配置来源后才按精确来源或 `https://*.example.com` 这类通配符收紧。SaaS 引擎主租户字段 `CorsAllowAnyWhenUnconfigured` 可调整未配置时的兼容开关，默认值为允许。

CORS 不是鉴权边界。即使默认允许跨域，服务端仍会校验 Token、`OsClient`、菜单/表权限、数据范围和保护表基线。平台会暴露 `authorization`、`osclient`、`did` 等续签所需响应 Header。

### 租户文件上传配置

Upgrade16/Upgrade35 会在 `sys_osclients` 增加以下可空字段，并将容易误解的旧正向开关迁移为负向开关：

| 字段 | 说明 |
|---|---|
| `DisableFileUpload` | 关闭文件上传；默认关闭即允许，只有开启才禁止 |
| `FileUploadMaxFileMB` | 单文件上限 MB |
| `FileUploadMaxRequestMB` | 单次全部文件上限 MB |
| `FileUploadMaxCount` | 单次文件数 |
| `FileUploadDailyUserQuotaMB` | 单帐号 UTC 日额度 MB |
| `FileUploadDailyTenantQuotaMB` | 单租户 UTC 日额度 MB |

这些字段未填写时使用平台代码默认值，可以按租户提高或降低；旧 `FileUploadEnabled` 在新版表单隐藏，只供尚未创建 `DisableFileUpload` 物理字段的滚动升级节点兼容。平台固定灾难保护、API HTTP/Multipart 接收硬顶以及反向代理上限不接受租户覆盖。帐号与租户日额度由共享 Redis 原子统计，Redis 不可用时上传失败关闭。完整说明见 [分布式存储与文件安全](../more/hdfs)。

## 基础配置
>* 支持数据库读写分离，支持指定存储介质

![SaaS 引擎基础配置](https://static.itdos.com/upload/img/csdn/de7982df51cc41afa7e0dbc2c5389c89.png#pic_center)

## 阿里云配置
>* 如果未使用MinIO，即可使用阿里云的OSS+CDN

![SaaS 引擎阿里云 OSS 配置](https://static.itdos.com/upload/img/csdn/0e4da43b35394de7867cfa5425697476.png#pic_center)

## MinIO配置
>* 如果未使用阿里云OSS，则可以使用MinIO
>* 值得注意的是，MinIO在做反向代理的时候，必须要设置【proxy_set_header Host $http_host】，而阿里云OSS、CDN、负载均衡默认配置情况下均不会有问题。
>* 比如说博主的反向代理配置文件
::: details 展开查看 Shell 命令（88 行）
```shell
proxy_cache_path /www/wwwroot/static.example.com/proxy_cache_dir levels=1:2 keys_zone=static_example_com_cache:20m inactive=1d max_size=5g;
server {
    listen 80;
    listen 443 quic;
    listen 443 ssl;
    http2 on;
    server_name static.example.com;
    index index.php index.html index.htm default.php default.htm default.html;
    root /www/wwwroot/static.example.com;
    #CERT-APPLY-CHECK--START
    # 用于SSL证书申请时的文件验证相关配置 -- 请勿删除
    include /www/server/panel/vhost/nginx/well-known/static.example.com.conf;
    #CERT-APPLY-CHECK--END
    #SSL-START SSL相关配置，请勿删除或修改下一行带注释的404规则
    #error_page 404/404.html;
    ssl_certificate    /www/server/panel/vhost/cert/static.example.com/fullchain.pem;
    ssl_certificate_key    /www/server/panel/vhost/cert/static.example.com/privkey.pem;
    ssl_protocols TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_ciphers EECDH+CHACHA20:EECDH+CHACHA20-draft:EECDH+AES128:RSA+AES128:EECDH+AES256:RSA+AES256:EECDH+3DES:RSA+3DES:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    add_header Strict-Transport-Security "max-age=31536000";
    error_page 497  https://$host$request_uri;
    #SSL-END
    #REDIRECT START
    #REDIRECT END
    #ERROR-PAGE-START  错误页配置，可以注释、删除或修改
    #error_page 404 /404.html;
    #error_page 502 /502.html;
    #ERROR-PAGE-END
    #PHP-INFO-START  PHP引用配置，可以注释或修改
    include enable-php-00.conf;
    #PHP-INFO-END
    #IP-RESTRICT-START 限制访问ip的配置，IP黑白名单
    #IP-RESTRICT-END
    #BASICAUTH START
    #BASICAUTH END
    #SUB_FILTER START
    #SUB_FILTER END
    #GZIP START
    #GZIP END
    #GLOBAL-CACHE START
    #GLOBAL-CACHE END
    #WEBSOCKET-SUPPORT START
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
    #WEBSOCKET-SUPPORT END
    #PROXY-CONF-START
    location ^~ / {
      proxy_pass http://localhost:1010;
      proxy_set_header Host $http_host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Real-Port $remote_port;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header X-Forwarded-Host $host;
      proxy_set_header X-Forwarded-Port $server_port;
      proxy_set_header REMOTE-HOST $remote_addr;
      proxy_connect_timeout 60s;
      proxy_send_timeout 600s;
      proxy_read_timeout 600s;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
    }
    #PROXY-CONF-END
    #SERVER-BLOCK START
    #SERVER-BLOCK END
    #禁止访问的文件或目录
    location ~ ^/(\.user.ini|\.htaccess|\.git|\.env|\.svn|\.project|LICENSE|README.md)
    {
        return 404;
    }
    #一键申请SSL证书验证目录相关设置
    location /.well-known{
        allow all;
    }
    #禁止在证书验证目录放入敏感文件
    if ( $uri ~ "^/\.well-known/.*\.(php|jsp|py|js|css|lua|ts|go|zip|tar\.gz|rar|7z|sql|bak)$" ) {
        return 403;
    }
    #LOG START
    access_log  /www/wwwlogs/static.example.com.log;
    error_log  /www/wwwlogs/static.example.com.error.log;
    #LOG END
}
```
:::


![SaaS 引擎 MinIO 配置](https://static.itdos.com/upload/img/csdn/1efac36d0af04dd58b79723e2c850070.png#pic_center)

## Redis配置
>* 支持哨兵模式

![SaaS 引擎 Redis 配置](https://static.itdos.com/upload/img/csdn/d67c8649dc444e508238410c36b746ee.png#pic_center)

### SaaS 运行缓存刷新与扩展库加载

`sys_osclients` 配置只应在平台启动、管理员保存 SaaS 配置或显式调用租户刷新能力时同步到进程内存与共享 Redis。普通表单查询、V8 执行、字段设计器保存不代表 SaaS 配置发生变化，不应持续输出“更新 OsClient / 缓存 OsClient 配置到 Redis”。

- `microi_database` 的扩展库列表使用三态处理：尚未加载、已加载且为空、已加载且有数据。空列表是有效结果，不会在每次 V8 执行时重复查询或发布租户配置。
- 扩展库会话按 Key 延迟初始化：列出目录或执行主库 CRUD 不会连接全部扩展库。一条未配置完成的扩展库不会阻断其它数据库；真正访问该 Key 时仍校验其类型与连接，并返回带当前租户和 Key 的错误，不会回退到主库或其它租户。
- 创建数据库会话、初始化 `V8.Dbs` 等运行态动作只更新当前节点的可丢失本地对象，不向 Redis 发布配置变更；真正的配置更新才发布共享缓存通知。
- 多节点收到共享缓存失效通知后只清理本节点缓存并按需回源，不能把收到的通知再次发布。配置更新仍须在数据库事务完成后发布，并按 `OsClient` 精确失效。
- 表单设计器批量保存字段会在外层完成一次平台管理员授权，在同一事务内更新字段元数据，结束后只清理一次字段/授权缓存。字段数量较多但没有物理列改名或改类型时，不应出现按字段数重复的 SaaS 刷新日志。

若终端连续出现成百上千条上述日志，先检查是否把“已加载但无扩展库”误判为未加载，或是否在循环内逐条调用完整 FormEngine 更新管线；不要通过关闭 Redis Pub/Sub 掩盖问题。

### Redis 管理器

平台内置 Redis 管理页面：`#/mci-redis-manager`。页面采用连接/数据库树、Key 空间树、SCAN 列表和内容编辑器三栏布局，可查看服务器与内存统计，并维护 String、Hash、List、Set、Sorted Set；Stream 支持分页只读。Hash、集合等内容统一使用吾码代码编辑器展示和格式化 JSON。

- Redis 管理属于平台控制面，只允许 `Level >= 9999` 的平台超级管理员。未登录或普通角色即使知道路由也不能读取统计、扫描 Key 或执行写操作。
- 支持当前租户连接和后端已经保存的连接。额外连接保存于主租户 `mci_redis_connection`，按 `TenantOsClient` 隔离；密码由后端保护且不会返回前端。
- `temporary` 临时连接以及匿名输入任意 Host、用户名、密码直接管理 Redis 的旧模式已经禁止。登录系统不可用时应通过服务器受控运维通道排障，不能重新开放匿名 Redis 管理。
- Key 查询使用非阻塞 `SCAN` 游标分页，支持按模式搜索、类型/TTL/内存查看、单个与批量删除、重命名、TTL 设置和 JSON 内容覆盖；不支持任意命令、Lua、`FLUSHALL` 或 `FLUSHDB`。
- 修改集合内容时，后端会先完整校验 JSON，再替换原 Key；删除和覆盖操作会显示确认提示。生产环境仍应优先按 `Microi:{OsClient}:...` 前缀缩小检索范围。

Microi MCP 同步提供 `microi_redis_statistics`、`microi_redis_list_keys`、`microi_redis_get_key`、`microi_redis_delete_keys`、`microi_redis_replace_value`、`microi_redis_rename_key`、`microi_redis_set_ttl`。MCP 默认操作当前 `OsClient` 的租户 Redis；额外连接只传管理页保存后的 `connectionId`，不得把 Redis 密码写入 MCP 参数或日志。所有写操作都要求 `confirmExecution` 明确确认。

## MQ消息队列配置
>* 支持集群模式

![SaaS 引擎 MQ 集群配置](https://static.itdos.com/upload/img/csdn/c171c8510a2b452980c3f020048b9d53.png#pic_center)

## 搜索引擎配置
>* 目前仅支持ES搜索引擎，支持分词搜索，将来可能扩展其它搜索引擎

![SaaS 引擎 Elasticsearch 配置](https://static.itdos.com/upload/img/csdn/637ce005054d43c2b6177f3b00693fc3.png#pic_center)

## 接口引擎区分saas租户
>* 用户访问一个接口引擎的自定义接口地址，如：(https://api.itdos.com/apiengine/test1)[https://api.itdos.com/apiengine/test1]，默认是走主库的接口引擎
>* 假设租户A和租户B均有一个【/apiengine/test1】接口，则有多种方式来区分访问：
>* 1、在访问【/apiengine/test1】接口时，传入对应用户的token，平台会根据token识别到OsClient值以访问对应的saas租户数据库
>* 2、在访问【/apiengine/test1】接口时，没有token就是匿名访问，则通过增加Url参数来区别，如：/apiengine/test1?OsClient=tenant_demo
>* 3、某些特殊情况可能无法使用Url参数，如微信支付回调，则可以通过特殊格式来实现传入OsClient值以区分saas租户数据库，如：/apiengine/test1--OsClient--tenant_demo--

::: warning Token 不能跨租户继承身份
当 URL 指定的目标 `OsClient` 与 Token 所属租户不一致时，平台不会把原登录身份带到目标租户。目标接口只有明确开启匿名调用时才能按匿名边界执行；不能通过修改 QueryString 或特殊 URL 格式，把租户 A 的管理员身份带入租户 B。
:::

```js
//示例代码
var appid = V8.OsClientModel.MiniProgramAppId;//小程序 appid
var privateKey = V8.OsClientModel.WxPayPrivateKey;//私书私有key
var notify_url = V8.SysConfig.ApiBase + `/apiengine/wxpay-notify--OsClient--${V8.OsClient}--`;//用户支付成功后回调地址，由接口引擎实现
var jsapiUrl = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';//腾讯官方下单地址，固定url
var jsapiUrlSimple = '/v3/pay/transactions/jsapi';//腾讯官方下单地址，固定url
var currentUser = V8.CurrentUser;
```

示例中的租户业务密钥只允许在后端 V8 中使用，禁止返回前端、写入日志或把整个 `V8.OsClientModel` 作为接口结果。

## 添加SaaS租户、SaaS数据库开库

开库属于高权限、跨数据库操作，建议通过平台受控租户开通流程或接口引擎编排的原子能力完成，并保留操作人、目标 `OsClient`、数据库、执行结果和回读记录。不要在普通业务接口中直接拼接建库 SQL。

### 1、规划租户身份与数据库

- 提前确定唯一的 `OsClient`、`OsClientType`、`OsClientNetwork`，不要复用已有租户 Key。
- 使用官方支持的 empty/demo 模板或受控开库能力创建数据库。目标数据库使用独立最小权限帐号，只授权当前租户库。
- 数据库连接、用户名、密码、`AuthSecret`、Redis、对象存储、MQ/MQTT、搜索等凭据不要写入文档、日志、截图或前端。
- 初始化后暂停模板中的业务 Job，并按新租户实际需要逐个启用；不要让复制来的任务立即影响生产业务。

### 2、在主库 SaaS 引擎创建独立记录

::: danger 不要复制整条主租户配置
主租户记录包含身份、数据库、认证、Redis、对象存储、MQ/MQTT、搜索等机密。直接使用“复制”并只修改 `OsClient`，容易让新租户继承主租户数据库或管理员凭据，造成跨租户访问。
:::

- 优先使用【新增】或受控租户开通流程，显式填写新租户的身份、数据库和域名。
- 即使界面复制仅作为草稿，也必须在保存前清空并重新生成租户身份、数据库、认证、Redis、对象存储、MQ/MQTT、搜索等敏感字段；共享基础设施的管理密钥不能持久化到子租户记录。
- RabbitMQ 使用独立 user/vhost/ACL，MQTT 使用独立帐号，Search 使用只允许 `{osClient}_*` 的 API Key。外部资源尚未创建时保持不可用并失败关闭，不能回退主租户管理员凭据。
- 保存后刷新 SaaS 引擎共享缓存，分别回读 `OsClient`、域名、数据库类型、启用状态和脱敏后的运行配置。不要以“保存成功”或“重启容器”代替回读。
- 通过新租户 `admin` 登录，验证 Token 只属于新租户、基础菜单可见、FormEngine 不会访问主租户数据、文件/缓存/队列/Topic/索引均使用新租户命名空间。

### 3、上传 ZIP、观察还原进度与判断任务状态

自定义数据库包分为“文件上传”和“数据库还原”两个阶段，两个百分比不能混为一谈：

| 阶段 | 页面会显示什么 | 完成标志 |
|---|---|---|
| ZIP 上传 | 已上传字节、文件总量、上传百分比和分片会话；默认按 16MB 分片，暂停后再次提交可断点续传 | 私有文件路径已经生成，并成功提交后台任务 |
| 数据库还原与租户初始化 | 固定 13 步总进度、当前步骤、总百分比、已用时、预计剩余时间、服务端心跳和执行记录 | 后台任务进入 `Succeeded`，且租户、数据库、管理员与运行配置均已回读 |

进入第 2 步时，页面最初可能显示 `2 / 13`（约 16%）。这只是“正在校验并还原数据库 ZIP”阶段的起点，不代表任务卡死。大库导入期间，总百分比会根据真实 SQL 读取量在该阶段内继续推进；状态文字会显示 ZIP/SQL 已读取字节、总字节、SQL 百分比、已执行语句数、当前批次、语句类型、平均吞吐和动态预计剩余时间。

执行记录采用有界输出：数据库导入只在阶段变化和 SQL 每跨过约 5% 时追加一条记录，不会为几十万条语句逐条写日志；页面最多渲染最近 200 条，其余记录折叠提示，避免大数据导入拖慢浏览器。状态仅在距上次更新约 2 秒或新增约 16MB 数据时刷新，短时间内百分比不变并不能单独证明任务停止。

判断任务是否仍在执行时，应综合查看服务端心跳、已读取字节、已执行语句数、批次和当前消息。不要因为第 2 步耗时较长就刷新后重复创建同一租户。任务失败、取消或中断时，页面会保留最后真实进度、执行记录和错误原因；只有后台任务成功终态才能按创建成功处理。

#### 长任务分布式锁与续租边界

租户开通由平台可信持久后台任务执行。接口引擎的 `Timeout` 仍作为单次 Redis 租期，任务正常运行时由持有者令牌持续续租；当前 SaaS 数据库开库最长保护边界为 12 小时，因此历史默认 20 分钟租期不会再把仍在导入的大数据库误判为失败。浏览器或普通 HTTP 请求即使伪造 `_BackgroundTaskId`，也不能取得可信后台身份或开启自动续租。

自动续租不是无限运行，也不会掩盖真实故障。出现持有者令牌不匹配、锁已过期、Redis 所有权/续租确认失败，或到达最长租约时，任务会失败关闭并停止继续推进；业务写入仍须使用幂等键、状态机、检查点和 fencing token，不能只依赖锁保证“只执行一次”。详细开发规则见 [接口引擎的分布式锁](../v8-engine/api-engine#分布式锁)，上传大小、反向代理和断点续传配置见 [Docker 安装](../getting-started/docker-run)。

### 4、自定义域名绑定与 ESA 两阶段就绪

通过阿里云 ESA 为租户自动创建 CNAME 时，必须把“控制面记录已创建”和“数据面 HTTPS 已可用”作为两个独立结果展示、记录和验收：

| 阶段 | 通过条件 | 不能证明的事项 |
|---|---|---|
| ESA 控制面记录已创建 | 创建/更新调用成功，并强回读记录名、记录类型、目标值、代理状态和源站配置与请求一致 | 不能证明 ESA 节点能连到源站，也不能证明证书、Host/SNI 或租户页面正确 |
| 数据面 HTTPS 已可用 | 从公网实际请求租户域名，DNS 已进入 ESA，ESA 回源成功，TLS 链有效，并得到真实的非 5xx HTTP 响应 | 仅有 CNAME、控制台“已启用”、TCP 可连接或源站本机访问成功都不算 Ready |

因此，域名创建接口即使返回“记录已创建”，前端也只能显示控制面阶段成功；必须继续轮询有上限的数据面检查。只有真实 HTTPS GET 返回非 5xx，且页面/公开配置解析出的 `OsClient`、系统标题和 API 地址属于目标租户，才能标记域名就绪。不要把 DNS 查询成功、ESA 记录存在或单次端口探测直接折算成 Ready。

#### ESA 522 的含义与回源白名单

`HTTP 522` 表示 ESA 节点在规定时间内无法与源站建立连接，通常是 ESA 回源 IP 被拦截、源站 80/443 未监听、网络路由异常或源站过载；它不是“CNAME 创建失败”。排查时按以下顺序处理：

1. 在 ESA 控制台目标站点的【安全防护 → 源站防护】同时复制**当前生效**回源 CIDR 清单和**最新待启用**清单，规范化 IPv4/IPv6 CIDR 后计算 `最新 - 当前` 差集。先把差集补入全部防护层，并在切换窗口保留 `当前 ∪ 最新`；确认最新清单已启用且访问稳定后，才可按需移除不再使用的旧段。不得把易变化的 ESA IP 段硬编码到吾码源码或应用包。
2. 对实际使用的源站 TCP 端口放行上述 CIDR。源站同时提供 HTTP 跳转和 HTTPS 回源时，80、443 都要放行；只开放其中一项时，ESA 回源协议和端口必须与其一致。逐层检查 ECS 安全组入方向、阿里云云防火墙、宝塔/安全狗等面板或安全软件、主机 `firewalld` / `nftables` / `iptables` / `ufw`，任何一层拦截都会产生 522。使用阿里云云防火墙联动时应开启 ESA 的“自动启用最新回源 IP 列表”，但仍要核对宝塔和主机防火墙等非联动层。
3. 在源站确认 nginx/Ingress 和 Docker 端口映射确实监听 80/443，并绕过 ESA 使用正确的源站域名、Host 与 SNI 做一次直连检查；不要把另一个 ESA 加速域名配置成源站，避免回源循环。
4. HTTPS 回源时，源站 nginx 的 `ssl_certificate` 必须使用站点证书加中间证书组成的 `fullchain.pem`，不能只发送叶子证书。边缘证书正常不代表源站证书链正常；应使用 `openssl s_client -servername` 检查源站实际发送的证书链。
5. 最后从源站网络之外重新访问租户域名并检查 ESA/源站日志。只有真实请求不再返回 5xx，且内容属于目标租户，才能完成数据面验收。阿里云的动态清单与处理步骤以 [ESA 源站防护](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/origin-protection) 和 [522 源站连接超时](https://help.aliyun.com/zh/edge-security-acceleration/esa/support/522-error-origin-connection-timeout) 的当前说明为准。

域名链路失败不等于租户创建失败。若租户数据库已经正确导入、主库 `sys_osclients` 唯一记录正确，并且绕过自定义域名后能按目标 `OsClient` 登录和回读系统设置，应保留租户、数据库、后台任务与审计记录，只修复 DNS、ESA、网络、反向代理或证书链后重试数据面验收。不得仅因 522、证书错误或域名尚未传播就删除并重新导入数百 MB/GB 的数据库；只有权威回读证明租户或数据库本身错误且无法幂等恢复时，才进入明确的清理流程。

完整的一键安装反向代理、证书链和命令级检查见 [Docker 安装](../getting-started/docker-run)。

### 5、做反向代理
>* 假设主库的访问地址是【192.168.1.11:1001】，此时需要nginx新增一个反向代理【192.168.1.11:1002】到1001端口，此时则可以直接访问【192.168.1.11:1002】saas库
>* 类似的例子【https://os.itdos.com】就是主库，而【web.microi.net】就是其中saas库之一

完整平台授权、CORS、SSRF、登录 RSA、Token 和升级兼容规则见 [平台安全与兼容基线](../more/security)。
