# 🔐 平台安全与兼容基线

> 本文说明 Microi 吾码平台在 FormEngine、接口引擎、SaaS、多租户、文件、登录会话和外部 HTTP 访问中的服务端安全边界。安全能力必须在服务端生效；隐藏按钮、前端路由和“用户已经登录”都不能代替授权。

---

## 一、先区分身份、授权与可信执行

| 层次 | 解决的问题 | 不能代表 |
|---|---|---|
| Token / 登录态 | 当前请求是谁、属于哪个 `OsClient`、来自哪个终端 | 可以访问任意表、记录、文件或管理 API |
| 菜单与表权限 | 当前角色可对目标业务资源执行哪些操作 | 可以越过菜单数据范围或访问平台控制面 |
| 数据范围 | 当前菜单列表、计数、导出可返回哪些记录 | 可以绕过独立的详情/写入权限，或把客户端请求伪装成服务端 V8 |
| 服务端可信调用 | 接口引擎、后端表单 V8、平台内部代码发起的调用 | 可以把管理入口开放给普通用户 |

来自浏览器、UniApp、第三方 SDK 或任意 HTTP 客户端的字段均不可信。`_TrustedServerInvocation` 只能由后端创建，客户端在 JSON、QueryString 或 Header 中伪造不会变成可信调用。`_InvokeType:'Server'` / `'Client'` 只控制表单事件调用语义，也不是授权开关。

后端接口引擎、后端表单 V8 和平台内部调用由服务端建立可信上下文，因此调用 `V8.FormEngine` 时不要求传 `_SysMenuId`。但是，能够创建接口引擎、保存 V8、配置任务或数据源的管理入口本身必须限制为平台超级管理员，否则普通用户仍可能借受信任代码获得任意数据执行能力。

---

## 二、FormEngine 混合授权模型

### 1. 有菜单上下文：默认严格精确校验

标准表单引擎页面应携带真实 `_SysMenuId`（兼容 `ModuleEngineKey`）。服务端会校验：

1. 菜单真实存在且绑定目标 `diy_table`。
2. 当前用户的有效角色拥有该菜单。
3. 当前操作拥有对应权限，例如 `Read`、`Add`、`Edit`、`Del`。
4. 列表、计数和导出应用菜单 `SqlWhere`、`SqlJoin` / `JoinTables`；详情和写入不应用模块列表过滤。

列表、写入、导入和导出显式传入错误、伪造或绑定其它表的菜单 Id 时直接失败关闭，不会自动退回其它菜单或表权限。为兼容已经发布的旧版 PC/UniApp，普通业务表的单行详情只要当前用户真实拥有至少一个直接绑定同表的菜单（或精确表级 `Read` 权限）即可读取，不应用该菜单的 `SqlWhere` / `SqlJoin`。该兼容不会放宽列表、导入、导出或写操作的菜单动作权限。

### 2. 历史前端 V8 未传菜单：从后端授权快照推断

吾码已有大量客户在前端 V8 中直接调用 `V8.FormEngine`，历史代码没有 `_SysMenuId`。升级不要求这些项目一次性重写：

- 登录用户未传菜单时，后端从该用户真正拥有的 `sys_menu` 中查找绑定目标表且允许当前操作的候选菜单。
- 候选菜单及角色信息来自服务端授权快照，不相信客户端提交的角色 Id、菜单列表或权限 JSON。
- 多个候选菜单的数据范围只有在能够安全合并时才用于列表等集合查询。任一候选菜单没有查询范围时可读取整表；不同 Join 上下文无法安全合并时列表失败关闭，不能通过故意省略 `_SysMenuId` 绕过范围。单行详情只校验同表菜单访问权，不应用候选菜单范围。
- 确实没有菜单入口的 SDK 或定制页面，可在角色管理的【高级表权限】按最小权限授予目标表的 `Read`、`Add`、`Edit`、`Del`。

标准 PC 表单引擎的前端 FormEngine facade 只给“当前菜单绑定的当前表”自动注入真实 `_SysMenuId`。跨表 V8 调用不借用主表菜单，而是由后端按目标表授权推断，避免把错误菜单传播给其它表。

历史 PC/UniApp 的字段元数据请求还可能不传菜单、携带已删除菜单，或通过 `GetDiyFieldByDiyTables` 按“主表在前、关联表在后”批量请求。单表字段请求只可回退到当前用户真实拥有且引用同一张表的菜单；批量请求把第一张主表作为必须通过授权的锚点，后续关联表逐张校验，未授权表或当前读取仍要求超级管理员的平台表只从返回结果中剔除，不会拖垮已经授权的主表，也不会返回被剔除表的字段、SQL 数据源或 V8 配置。元数据兼容不会授予数据行访问；只有第一张主表本身无权访问时才返回 `NoAuth`。

### 3. 查询数据范围与写入操作权限必须分开

- 列表、计数、导出必须在真实查询中应用菜单数据范围，不能先查出越权数据再在前端或内存中过滤。单行详情按同表菜单访问权授权，不应用模块的 `SqlWhere` / `SqlJoin`。
- `sys_menu.SqlWhere`、`SqlJoin`、`JoinTables` 是模块引擎的**查询过滤配置**，不是行级写权限。主表新增、修改、删除分别由当前角色在该菜单上的 `Add`、`Edit`、`Del` 权限控制；拥有对应权限时，不得再因为查询配置包含单表条件或跨表 Join 拒绝写入，也不得把查询条件追加到最终 `INSERT`、`UPDATE` 或软删除 SQL。
- 项目若需要“只能修改自己负责的数据”等行级写入规则，应在 `SubmitBeforeServerV8` 或专用接口引擎中用服务端可信代码做业务校验并返回失败，同时可统一写入 `TenantId`、负责人、创建人等归属字段；不能改变通用 FormEngine 菜单权限的既有语义。
- 导入、导出必须携带真实菜单上下文，并分别拥有 `Import`、`Export`；高级表权限不能绕过。

客户端 `AddFormData` 仍先校验真实菜单和 `Add` 权限，之后才进入后端表单 V8。后端 `SubmitBeforeServerV8`、`SubmitAfterServerV8` 以及接口引擎中的 `V8.FormEngine` 属于服务器可信执行，可在租户边界内执行复杂 SQL、跨表事务和其它表的 CRUD，不会再次套用浏览器菜单权限；外部 HTTP 伪造 `_InvokeType:'Server'` 或 `_TrustedServerInvocation` 不能获得该能力。

### 4. TableChild 父记录范围内委托

隐藏的子表菜单不要求上百个存量项目逐个给角色补菜单权限。`TableChild` 请求由后端同时验证：

- 当前用户拥有父菜单，父菜单绑定父表。
- 父表字段确实配置为目标子表及隐藏子菜单。
- 当前用户在父菜单数据范围内能读取该父记录。
- 子表外键配置、父记录主键和子记录外键一致。

通过后，服务端把父记录外键条件强制写入子表查询或写入。伪造 `_TableChildAuth`、跨父记录借用外键、脱离父表直接访问子表都会失败。

更多 HTTP 路由与调用示例见 [FormEngine 接口](../v8-engine/form-engine)。

---

## 三、平台表分级保护与超级管理员基线

平台表策略的唯一事实源是后端 `PlatformResourceSecurity`。新增平台能力时必须根据数据内容和运行用途归入以下一类，不能再用一张全局硬拒绝清单阻断正常运行态：

- **管理员专用**：SaaS 配置、接口引擎、表/字段元数据、菜单/角色/用户/权限、任务、数据源、MQ/MQTT、密钥、基础设施、AI 私有配置和安全审计等资源，通用客户端 FormEngine 对 `Level < 9999` 的全部操作硬拒绝。
- **只读委托**：工作流、微服务/应用商店、蓝图和微应用运行元数据。普通角色只有获得真实菜单或高级表 `Read` 权限后才能查询；新增、修改、删除、导入和导出仍要求 `Level >= 9999`。
- **按角色管理**：`mic_page`、`mic_print`。登录用户按菜单或高级表中明确授予的 `Read`、`Add`、`Edit`、`Del` 操作；未授权仍返回 `NoAuth`。
- 三类平台表都禁止匿名 FormEngine 访问，匿名开关只适用于明确开放的普通业务表。
- 控制面 Controller 使用服务端管理员校验，不能因为普通角色看到了菜单就放行。角色增删改还会从当前租户主库复核活动用户、数据库 Level 和有效角色 Level；请求体伪造 `_IsAdmin`、`Level`、`RoleIds` 或 `OsClient` 无效。
- 角色 Level 变化后，在返回成功和提升共享授权 `epoch` 前同步更新受影响用户 Level，避免被降级管理员利用旧令牌或旧快照的短暂窗口。
- 角色表级权限只支持 `Read`、`Add`、`Edit`、`Del`；服务端会逐项按上述分级校验，前端禁用状态不作为安全边界。
- 表单设计器保存 `diy_table/diy_field` 时，外层接口先校验 `Level >= 9999`；内部批量字段写入继续携带同一服务端确认的管理员上下文，不能因为二次封装为 `JObject` 丢失身份，也不能把整个设计器改成无条件可信调用。
- `AddDiyField/AddField` 创建物理列前会在事务中写入 `diy_field`。这次嵌套写入同样必须使用强类型参数传递外层管理员或可信升级上下文；浏览器入口仍由 `PlatformAdminOnly + Level >= 9999` 校验，JSON 中伪造 `_InvokeType` 或 `_TrustedServerInvocation` 无效。

升级程序 Upgrade15 只清理当前“管理员专用”表的普通角色 `Type='Table'` 直连授权，保留正常业务菜单权限，并提升共享授权版本使所有节点放弃旧快照。旧版本曾清理 `mic_page`、`mic_print` 等现已放开的授权，升级不会猜测并自动恢复角色关系；管理员应按最小权限重新授予所需角色（打印运行通常只需 `mic_print.Read`）。
平台升级程序写入接口引擎、菜单、角色权限等保护表时使用服务端专用参数对象和不可由 HTTP JSON 绑定的可信标记；不能依赖匿名对象/JObject 的运行时类型猜测调用来源。

---

## 四、授权缓存与性能

安全校验不应让每个 FormEngine 请求重复全表查询。平台使用：

- 按 `OsClient` 隔离的共享 Redis 授权版本 `epoch`。
- “租户 + epoch + 用户”的授权快照。
- 短 TTL 的进程内 L1 与共享 Redis L2。
- Redis 不可用或快照不可用时从主库回源，不依赖只读库延迟。

用户状态、级别、角色，角色状态，菜单绑定/数据范围，角色菜单或高级表权限变化后，在事务成功后递增共享 `epoch`。各 API/Worker 节点看到新版本后自然丢弃旧快照，无需粘性会话、逐节点清 Redis 或重启容器。L1 只用于性能优化，不能成为权限事实源。

正确菜单上下文、可安全合并的历史无菜单范围以及高级表权限都复用一次授权快照，不会逐菜单查询数据库。详情只读取同一授权快照中的同表菜单绑定关系，不执行逐菜单数据范围探测；标准详情与列表不会因此增加额外数据库往返。

授权快照 Key 同时包含独立的“快照契约版本”。当快照新增 `UserLevel`、`IsActiveUser` 等安全字段或改变解释语义时必须提升该版本，使 Redis 中跨重启、跨滚动升级保留的旧 JSON 立即失效；不能让缺失字段按 `0/false` 反序列化后误判管理员或普通用户。

---

## 五、上传限制与私有文件

### 1. 租户业务配置与独立灾难保护上限

下列值是平台代码提供的租户业务默认值，不是租户不可突破的硬上限：

| 配置 | 默认值 |
|---|---:|
| 单文件 | 100 MB |
| 单次全部文件 | 200 MB |
| 单次文件数量 | 10 |
| 单帐号每日额度 | 2048 MB |
| 单租户每日额度 | 20480 MB |

Upgrade16 会在 `sys_osclients` 增加六个可空租户字段：

`FileUploadEnabled`、`FileUploadMaxFileMB`、`FileUploadMaxRequestMB`、`FileUploadMaxCount`、`FileUploadDailyUserQuotaMB`、`FileUploadDailyTenantQuotaMB`。

有效业务值按当前租户 `sys_osclients` → 代码默认值取第一项，租户可以提高或降低业务默认值。最终结果仍受平台固定灾难保护、API 接收硬顶和反向代理上限约束；这些边界不接受租户覆盖。帐号与租户日额度在共享 Redis 中原子预留，适用于多节点；Redis 不可用时失败关闭。普通交互式上传强制使用私有桶，且一级目录只能是 `file`、`img`、`avatar`、`editor`。可信后台任务仍受平台灾难保护上限。

### 2. 私有文件不是“知道路径即可访问”

普通客户端请求 `/api/HDFS/GetPrivateFileUrl` 时，必须同时提供：

- `FormEngineKey`
- `FormDataId`
- `FieldId`
- `SysMenuId`
- 私有文件相对路径

服务端验证菜单、菜单绑定表、记录数据范围、字段归属、字段组件及记录字段确实引用该文件后，才签发短期后端票据。不得返回真实对象存储签名地址、存储密钥或裸文件流。

可信后端 V8 使用 `V8.Method.GetPrivateFileUrl({ FilePathName })` 属于服务端能力；不要把这种调用方式复制成普通浏览器 HTTP 调用。文件列表、移动、重命名、覆盖、删除等管理 API 仅限 `Level >= 9999`。

完整配置见 [分布式存储与文件安全](./hdfs)。

---

## 六、SaaS 配置和租户隔离

`sys_osclients` 同时包含租户业务配置和数据库、认证、Redis、对象存储、MQ/MQTT、搜索等基础设施机密。运行时必须使用脱敏投影：

- `V8.OsClientModel` / `V8.ClientModel` 不注入数据库连接、`AuthSecret`、Redis、对象存储、MQ/MQTT、搜索等基础设施凭据。
- `V8.SysConfig` 不注入 `ClientSecrets`、`PwdV8`、`GlobalServerV8Code` 及疑似 Password/Secret/Token/Key/Connection 字段。
- 当前租户自行扩展的微信、支付、ERP 等业务密钥仍可能存在，V8 不得把整个对象或密钥返回前端。
- 子租户调用 `GetSysConfig` 时强制绑定当前 `OsClient`，不能借缓存命中读取主租户配置。

新租户不能复制整条主租户记录。受控开库流程必须排除租户身份、数据库、认证、Redis、存储、MQ/MQTT、搜索凭据，为新租户生成独立配置，并在刷新 SaaS 缓存后回读验证。跨租户路由时，Token 身份不能自动带到另一个 `OsClient`；目标接口只有明确允许匿名时才能按匿名边界执行。

DataSource、Translate、Workflow 等引擎在 V8 调用链中统一服从当前 `V8TenantContext`：普通租户脚本即使在参数中伪造其它 `OsClient`，服务端也会绑定回当前租户或拒绝。只有非 V8 的可信平台 C# 调用，或主租户经过明确控制面授权的调用，才可以显式处理目标租户；业务 HTTP 参数本身不能建立这种信任。

Redis 管理器只允许 `Level >= 9999` 使用当前租户连接或后端保存的连接。`temporary` 临时连接和匿名任意 Host/密码管理已禁止；保存密码由后端保护且不返回前端。MCP Redis 写操作必须传 `confirmExecution`，不得把 Redis 密码放入参数、日志或对话。

### AI、MCP 与向量数据

::: tip 向量数据库默认关闭
在线 AI 默认通过“大模型关键词扩展 + 权限感知 Schema 搜索 + 精确字段回读”工作，不需要安装或连接 Ollama、nomic-embed-text、Qdrant。`mic_ai.EnableVectorDatabase=1` 时才启用向量增强；字段缺失、为空、关闭或服务异常时，必须跳过向量连接/同步或回退到关键词模式。
:::

- 普通 `Chat/ChatStream` 当前使用服务端会话上下文和固定核心规范 Prompt，不检索完整向量 corpus；`NL2SQL` 默认使用当前租户权限范围内的 Schema 关键词检索，启用向量开关后才叠加 Schema RAG；`NL2V8` 同理叠加可选 Skill / Schema 向量召回。平台在线 AI 不是 MCP Host；只有真正注册 Tools 并处理 `tool_calls` 的宿主才能调用 MCP。模型文字声称“已调用”不能作为执行证据。
- 关键词、同义词和候选表均不是授权凭据。候选 Schema 必须先与服务端授权快照取交集，再从权威元数据精确回读；缓存按 `OsClient + 授权版本` 隔离，权限变化后失效，不能让模型或客户端提交的表名扩大范围。
- 启用向量数据库时，Schema 向量的写入、搜索、精确匹配、差量同步、删除和重建必须强制携带规范化 `OsClient`，Qdrant payload/filter 形成同一租户分区；point id 由 `OsClient + TableId` 确定性生成，重试和多节点同步不能生成重复点。
- HTTP 与 gRPC 使用不同版本/维度的 collection，禁止让 768 维和 384 维向量共用同名 collection。
- 初始化状态按租户和 Qdrant/Embedding 配置分区，只有初始化返回成功才允许缓存完成状态；进程内状态只是优化，失败后必须可重试。
- 重建只能删除当前租户的向量，不能删除共享 collection 或其它租户数据。
- Skill 公共知识库不得包含客户名称、真实租户、客户域名、私有表/接口 Key 或定制业务枚举；项目知识进入对应租户私有域。
- 向量命中是近似检索结果，不是授权、实时事实或执行凭据。写操作仍需 Token、权限、确认、审计和权威接口回读。
- NL2SQL 的可信授权标记和最大返回行数只由服务端写入，并由两套 JSON 序列化器忽略客户端输入。表白名单仅取当前租户未删除、非平台受保护的业务表。老数据库中某角色从未保存过 AI 策略时，服务端只按其现有 FormEngine `List` 读取权限兼容放行无行级范围的业务表；一旦存在该角色的策略记录（包括显式禁用），就严格要求启用的全量数据策略与 `AllowRawSql`。两种路径都会与 FormEngine 权限取交集，并按授权版本与用户缓存；Schema 关键词或向量命中后仍按该精确非空白名单再次过滤。
- 执行层使用严格词法门禁要求单条 `SELECT`，逐个验证每个 `FROM`/`JOIN` 来源表，拒绝注释、多语句、CTE、`UNION`、写操作、危险关键字/函数和变量赋值；按数据库施加 `MaxRows + 1` 行限制、最多返回 100 行并设置 30 秒命令超时。
- 该门禁不是完整 SQL AST，模型生成的动态值当前也不会被重写为数据库参数。通用 NL2SQL 不执行菜单 `SqlWhere`/`SqlJoin`；普通角色遇到带行级范围的表必须失败关闭，本人、部门或关联记录范围查询改走经过审核、显式参数化并记录审计的业务 ApiEngine。不得把表级读取权限、模型输出或向量命中描述为行级数据授权。
- OpenAI 代理流式接口会传递请求取消信号；普通 `ChatStream` 与 `NL2V8` 当前主要依赖内部超时，不能承诺客户端断开一定立即取消上游和计费。
- 当前计量表和诊断日志可能保存完整问题、回答或问题摘要。必须把它们视为敏感业务数据并限制访问、配置留存；全面脱敏和可配置留存实现前，不得宣称 Prompt/Answer 已全部脱敏或不落日志。

---

## 七、兼容优先的网络安全默认值

### IP 访问频率保护、VS Code 拉取与解封

平台普通访问默认按“同一 IP 10 秒 600 次请求、120 次异常状态码”保护，超过后默认临时封禁 30 分钟。被拦截时后端仍返回 HTTP 200 的标准 `DosResult`，其中 `Code=0`、`DataAppend.SecurityBlocked=true`，并保留 `Ip`、`Reason`、`ReasonKey`、`BlockedAtUtc`、`ExpiresAtUtc`、`RetryAfterSeconds`、解除建议和本文档地址。PC 前端必须显示这些原始信息，不能把它改写成“后端 API 服务暂时不可用”。安全中间件必须位于 CORS 之后，使独立域名部署的浏览器也能读取该 JSON。

吾码 VS Code 插件一次拉取多个服务器的 V8 源码时不降低并发或请求量。只读的 `/api/V8Debug/Get*`、`/api/V8Debug/List*` 请求在同时满足下列全部条件后使用独立计数桶，默认阈值为 10 秒 6000 次请求、1200 次异常状态码：

- 后端从共享登录态确认当前用户 `Level >= 9999`；
- 当前请求的 Bearer Token 是仍有效的活动 Token，且该 Token 的 `ClientType` 精确为 `VSCode`；
- 请求 `did` 与活动 Token 保存的 `Did` 完全一致，且为插件生成的 `VSCode:` 稳定设备标识；
- 路由属于上述 V8Debug 只读拉取；`Update/Create/Execute/Upload/Finalize` 以及普通 FormEngine 写请求不适用。

服务端不读取 `X-User-Level`、`ClientType`、User-Agent 等自报 Header 建立信任。伪造 `did`、只写 `ClientType=VSCode`、普通帐号或拿 PC Token 调用，都仍使用普通阈值。普通请求统一计入当前 API 主运行实例的安全域，请求方轮换 `OsClient` Query/Header 即使碰巧是已加载租户也不会获得新计数桶；只有通过上述联合校验的 VS Code 请求，才按活动 Token 服务端绑定的租户使用独立桶。独立阈值可通过当前服务器实际命中的 `sys_osclients.SecurityTrustedVsCodePerIpMaxRequests` 和 `SecurityTrustedVsCodePerIpMaxErrors` 调整；不要把普通 `SecurityPerIpMaxRequests` 全局放大，也不要关闭安全防护。

#### 反向代理后的真实 IP

安全防护只读取 ASP.NET Core 已验证后的 `HttpContext.Connection.RemoteIpAddress`，不会直接解析客户端发送的 `X-Forwarded-For`、`X-Real-IP`。因此伪造 `X-Forwarded-For: 127.0.0.1` 不能命中本机白名单。框架默认只信任安全的 loopback 直连代理；Nginx、Ingress、SLB、CDN 或其它 API 节点若不是 loopback，必须在后端配置其**直接连接 Kestrel 的最后一跳** IP 或 CIDR：

```json
{
  "ForwardedHeaders": {
    "KnownProxies": ["10.20.0.12"],
    "KnownNetworks": ["10.20.0.0/24"]
  }
}
```

在主租户 SaaS 引擎【后端运行配置】中，用 `BackendForwardedKnownProxies` 配置受信代理精确 IP、用 `BackendForwardedKnownNetworks` 配置受控 CIDR；多个值用逗号或换行分隔，修改后滚动重启 API 节点。禁止改用容器环境变量或自定义 `appsettings` 节点，也禁止填 `0.0.0.0/0`、`::/0` 或为了“拿到真实 IP”清空已知代理校验。每次只接受离 Kestrel 最近的一跳；多级代理应让最后一跳覆盖并清洗来自公网的转发头。历史租户字段 `SecurityRespectForwardedHeaders` 不再赋予原始 Header 信任，真实 IP 的信任根只由上述 SaaS 字段维护。

解除方式：

1. 等待 `ExpiresAtUtc`，到期后平台自动解除；错误页的“检测是否已解除”会重新探测。
2. 需立即处理时，从**未被该 IP 封禁的管理网络**登录平台超级管理员，进入【系统日志 → 安全防护】找到该 IP 并解除；对应受保护接口是 `/api/SecurityGuard/UnblockIp`。被封禁的同一出口无法调用自己的解封接口，这是预期的安全边界。
3. 固定办公出口或受控代理确需长期放行时，可将准确公网 IP 加入当前服务器匹配记录的 `SecurityWhitelistIps`，保存后等待运行配置重载。禁止加入 `0.0.0.0/0`、宽泛网段、动态家庭宽带或用户提交的任意 IP。
4. 多节点部署必须让封禁、解封与租约状态进入共享 Redis/数据库。Redis 可用且共享封禁字段不存在时，表示全局权威的“已解封”，节点必须丢弃本机旧缓存，绝不能把它重新写回 Redis；只有 Redis 不可用时才允许本机降级保护。逐节点重启或只删某个节点内存不能作为正式解封方案。验收至少从同一负载均衡入口命中两个 API 节点，确认提示、到期和管理员解除一致。

### CORS

为兼容本地开发、独立前端、H5 和存量租户，主 SaaS 配置 `sys_osclients.CorsAllowOrigins` 未配置时，默认允许任意来源跨域（等价于 `*` 的来源匹配，同时支持凭据）。只有配置来源后，才按精确来源或通配符收紧。

统一在 SaaS 引擎主租户的“平台运行配置”中维护：

- `CorsAllowOrigins`：允许的精确来源或通配来源；
- `CorsAllowAnyWhenUnconfigured`：来源未配置时是否保持兼容放行，默认开启。

默认兼容开关为允许。跨域响应暴露 `authorization`、`osclient`、`did` 等会话续签所需 Header。CORS 不是鉴权边界，不能代替 Token、菜单、表权限和数据范围。

### SSRF

吾码存量 V8 大量访问内网设备、InfluxDB、内部 ApiEngine 和本机 sidecar，因此严格 SSRF 模式默认关闭。未显式开启时保持历史行为，不默认拒绝：

- 非 HTTP(S) 协议
- URL 内嵌凭据
- 回环、私网、链路本地地址
- 云元数据地址
- HTTP 重定向

只有在 SaaS 引擎主租户的“平台运行配置”中启用 `SsrfProtectionEnabled` 后才进入严格模式。严格模式仅允许 HTTP(S)，拒绝 URL 凭据、私网/特殊地址和重定向；使用 `SsrfAllowedHosts` 精确放行主机。保存后由 SaaS 引擎刷新共享配置，无需给 API 容器增加环境变量。

---

## 八、登录 RSA、HTTPS 与 Token 续签

### 登录 RSA

登录 RSA 的用途只是避免密码在请求体和普通代理调试界面中直接显示，不能替代 HTTPS，也不是密码存储或身份认证密钥。

- 平台保留历史登录 RSA 密钥对作为默认 fallback，兼容已发布客户、旧前端和浏览器缓存；安全升级不得直接删除 fallback。
- 部署专属登录 RSA 密钥时，在主租户 SaaS 引擎【后端运行配置】中成对维护 `BackendLoginRsaPrivateKey` 与 `BackendLoginRsaPublicKey`；私钥只供可信服务端使用，匿名系统配置只返回公钥。不得改用环境变量或额外 `appsettings` 节点。
- 公钥和私钥必须成对切换；不匹配会导致所有用户无法登录。
- 生产登录和管理端必须使用 HTTPS。

### Token 和多标签页

- 登录时传 `_ClientType`，请求携带稳定 `did`，Token 始终绑定当前 `OsClient`。
- 客户端每次响应都应接收新的 `authorization` Header。
- 同一终端续签使用 single-flight，避免详情页并发请求同时换新 Token。
- 收到 `TokenReplaced` 时，先判断同一终端是否已保存新 Token；旧请求的错误响应不能清除新 Token。
- `TenantMismatch` 必须停止请求，不能把 Token 复制到其它租户。
- `JwtExpired`、`SessionExpired`、`SessionMissing`、`AuthVersionChanged` 仅清理受影响的租户/连接，不应让其它连接全局退出。
- 管理员禁用用户时应先通过平台统一能力吊销该用户全部终端 Token，再修改用户状态并记录审计。

### 浏览器访问密钥与免登录页面

吾码支持为同一个帐号创建多个浏览器访问密钥，适合会议室电视、车间看板、信息屏等固定页面。它不是把帐号密码或长期 Token 放进 URL，也不是 Gitee/GitHub 私人令牌的网页登录翻版；访问密钥只负责兑换短期吾码会话。

设计参考：[GitHub fine-grained PAT 权限模型](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)、[GitHub OAuth 临时代码流程](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps?apiVersion=2022-11-28)、[OWASP URL Token 安全要求](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) 和 [Gitee 私人令牌](https://gitee.com/help/articles/4336)。API/Git 令牌与浏览器会话的用途不同，因此吾码使用“长期访问密钥兑换短期受限会话”，而不是直接把长期登录 Token 当作页面凭据。

核心规则：

- 每个帐号最多 20 个有效密钥；创建时可选择默认 90 天、自定义到期时间（最长 365 天）或永久，可分别命名和吊销。永久密钥只用于受控固定终端，并应定期人工轮换。
- 明文格式为 `microi_ak_<48-bit公开前缀>.<128-bit随机秘密>`，当前总长度 41 个字符，只在创建成功时显示一次；`mci_user_access_key` 只保存 SHA-256 哈希、前缀、范围和使用审计。
- `mci_user_access_key` 是平台安全控制面表，不创建普通业务菜单，也不允许普通客户端通过通用 FormEngine 直接读取。
- 密钥权限只能收窄，最终权限始终是“帐号当前角色/菜单权限 ∩ 密钥范围”。帐号停用、角色变化、密钥到期或吊销都会影响后续请求。
- 默认范围为 `page:open + form:read`。创建界面通过页面名称勾选或粘贴完整页面网址自动解析，不要求普通用户手写路由或物理表名；写权限、文件读取和引擎运行必须显式启用。
- 页面和表单数据可以选择“全部已授权”，内部用单独的 `*` 范围值表示。这里的“全部”仅取消访问密钥自身的二次白名单，最终仍与目标帐号实时菜单、表单、部门和行级权限取交集，不能扩大帐号权限。接口引擎 Key 和数据源引擎 Key 不允许 `*`，仍须准确选择。
- 页面范围为“全部已授权”时，受限会话可以调用 `GetSysMenuStep` 加载该帐号实时菜单树；指定页面密钥不加载完整菜单树。平台只开放页面启动、表单运行、本人后台任务和本人终端信息所需的运行时接口，并按 scope 再校验每个表、接口引擎和数据源。显示密码、访问密钥管理、菜单/表结构设计、服务器与缓存管理、查看或踢出其它终端等控制面接口始终拒绝访问密钥会话。
- 表单范围保存的是易于管理的表名；运行时会从共享数据库解析成对应 `diy_table.Id`、所属 `diy_field.Id`，以及绑定这些表的 `sys_menu.Id/ModuleEngineKey`，并写入带版本的短 TTL Redis 缓存。因此只传 `TableId` 的字段元数据请求、只传 `_FieldId/FieldIds` 的下拉数据源请求，以及标准列表页只传 `ModuleEngineKey/_SysMenuId` 的请求，都会执行同一份精确白名单。解析失败时按未授权处理，不能降级为全部表。
- 列表和表单使用的 `GetTableData-{table-key}`、`Get-TableData-{table-key}`、`GetFormData-{table-key}` 等动态友好地址，会先归一化为标准 FormEngine action，再校验 scope、URL 后缀和请求体中的准确表或菜单引用。URL 后缀必须与 `FormEngineKey/TableId/ModuleEngineKey/_SysMenuId` 中的实际引用一致；路由转换与密钥鉴权共用同一份映射，空 Key、前后缀不一致、伪造相似前缀和额外路径段不会被放行。
- `ApiEngineController` 的动态运行入口虽然兼容匿名接口，但只要请求携带访问密钥会话，就必须先解析实际命中的接口模型，再核对准确 `ApiEngineKey`；数据源和后台接口任务同样核对准确 Key，禁止用 URL 别名或异步任务绕过白名单。
- 密钥兑换得到的 `_ClientType=AccessKey` 会话默认 20 分钟，通过正常 Token 轮换续期；每次请求仍校验共享 Redis/数据库中的密钥状态，不依赖单机内存或粘性会话。
- 兑换接口只接收 JSON Body，不接受 Query String。前端链接把密钥放在 Hash 路由参数中，首次解析后立即从地址栏清除，避免它随初始 HTTP 请求进入反向代理和 Referer 日志。
- 仍应使用 HTTPS，并为看板创建独立的只读帐号。链接本身属于敏感凭据，复制到聊天、截图或浏览器同步历史都可能泄露，应按密钥处理。

管理员在【系统账号】页面（`/#/mic-sys-user`）中创建：表格视图和默认卡片视图都会在每个帐号旁直接显示【访问密钥】，无需进入帐号编辑表单或展开【更多】。创建时选择指定页面或全部已授权页面、指定表单或全部已授权数据，并单独设置“登录后打开”的页面。看板示例：

```text
https://os.example.com/?OsClient=iTdos#/access-login?access_key=microi_ak_xxx.yyy&redirect=%2Fmic%2Fdata-dashboard%2Fpreview%2F01KK988A0YPHKAM8SF216917HX
```

通用格式为：

```text
{Microi.Client前端WebBase}/?OsClient={租户Key}#/access-login?access_key={密钥}&redirect={encodeURIComponent后的站内Hash路由}
```

`redirect` 保存的是以 `/` 开头的站内 Hash 路由原值，拼接链接时要对整个路由执行一次 `encodeURIComponent`。例如原值 `/mic/data-dashboard/preview/01KK988A0YPHKAM8SF216917HX` 应编码为 `%2Fmic%2Fdata-dashboard%2Fpreview%2F01KK988A0YPHKAM8SF216917HX`；该原值还必须位于密钥允许页面范围内。域名必须使用用户实际访问的 Microi.Client 前端地址，不能误用 API Server 地址。

固定电视、看板和信息屏应把**完整的 `/access-login` 自动登录链接**保存为浏览器开机主页或受控书签，而不是只保存兑换后的预览页地址。首次兑换成功后，地址栏变成不含 `access_key` 的目标页面属于预期的安全清理；页面随后使用请求头中的短期受限 Token，并按平台协议自动轮换。永久密钥表示密钥记录没有计划到期时间，不表示生成永久 JWT；浏览器会话丢失、缓存被清理或服务端登录态重建后，重新打开原启动链接即可再次自动兑换，全程不需要输入帐号密码。不要给目标页面重复追加密钥，也不要新增 `permanent=1`、`keep_login=1` 等由客户端决定密钥寿命的 URL 参数。

生成链接必须携带当前租户的 `OsClient`，否则全新浏览器没有租户缓存时无法确定兑换数据库。`/access-login` 不等待普通 SSO 菜单初始化，兑换超过 20 秒会显示明确错误，不会一直停留在“正在自动登录”。

旧版 `?token=` 自动登录仅保留兼容，不应再生成新链接。前端会立即清除该参数，且不会再把完整 Token 输出到控制台或 `sessionStorage`。

常用权限范围：

| Scope | 说明 |
|---|---|
| `page:open` | 打开勾选页面；页面范围为 `*` 时表示全部帐号已授权页面；浏览器密钥必选 |
| `form:read` | 只读访问勾选表单；数据范围为 `*` 时表示全部帐号已授权数据 |
| `form:write` | 写配置表，默认关闭，高风险 |
| `form:export` | 导出配置表，默认关闭 |
| `api-engine:run` | 运行配置的准确 `ApiEngineKey` |
| `data-source:run` | 运行配置的准确 `DataSourceKey` |
| `file:read` | 调用文件读取 API，默认关闭 |

配置大屏时优先勾选目标页面，并选择“全部已授权数据”，避免普通用户判断底层表名；使用专用只读帐号即可继续限制实际数据范围。如果大屏组件还会调用接口引擎或数据源引擎，只添加实际使用的准确 Key，禁止为引擎填写通配符。

排错时如果 `GetSysMenuStep` 返回“当前访问密钥未授权调用此接口”，先确认密钥页面范围是否为“全部已授权”。指定页面密钥不需要该接口；若全部页面密钥仍被拒绝，说明 API 服务尚未部署支持访问密钥运行时接口矩阵的版本。如果 `GetTableData-xxxx` 或 `GetFormData-xxxx` 返回“当前访问密钥未授权访问请求中的表”，还应检查请求体是否只传了 `ModuleEngineKey`：旧版 API 未把菜单 Id 映射到其绑定的 `DiyTableId`，升级到支持菜单引用派生的版本即可，无需把菜单 Id 当物理表名手工加入白名单。不要为了临时放行把整个 `SysMenu`、`FormEngine` 或其它 Controller 加入无条件白名单。

### 管理员显示系统用户密码

存量部署将 `sys_user.Pwd` 以可逆 DES 保存时，平台超级管理员可以在【系统账号】页面（/#/mic-sys-user）打开帐号编辑表单后点击【显示密码】。`POST /api/SysUser/GetSysUserPassword` 只允许普通管理员登录会话调用；访问密钥会话和普通角色均拒绝。接口只解密 `PwdEncode=DES`（历史空值按 DES 兼容），自定义 V8 密码编码不做通用解密；成功查看会写安全审计日志，响应禁止缓存且日志不记录明文密码。

这是存量可逆密码方案的兼容管理能力，不应扩展给业务 V8、接口引擎、普通菜单或匿名接口。新系统仍建议逐步迁移到不可逆的专用密码哈希；完成迁移后只能重置，不能读取原密码。

---

## 九、运行时资源保护

恶意访问防护、请求压力保护、ORM、启动并发等普通运行参数统一在 SaaS 引擎主租户的“平台运行配置”中维护；V8 执行额度在系统设置中维护，并继续受代码固定硬边界约束。子租户隔离值只能降低自己的额度，不能抬高整个进程上限。

限流、并发控制和熔断需要按多节点语义设计。进程内计数只代表当前节点；平台级配额、授权版本、会话、票据和任务租约应使用共享 Redis、数据库或可靠消息系统。

### Spider / 浏览器采集

`V8.Spider` 与 `V8.Http` 使用同一套 SSRF 兼容开关：默认不拦截存量内网目标；开启严格模式后，初始页面、跳转和浏览器子资源都执行协议、URL 凭据、DNS/IP 与白名单检查。V8 脚本不能传 `ExecutablePath` 或 `UserDataDir`，浏览器配置目录由平台按 `OsClient + ApiEngineKey/EventName + SessionId/ProfileKey` 建立隔离。

默认资源边界为：

| 配置 | 默认值 | SaaS 引擎主租户字段 |
|---|---:|---|
| 当前节点全部会话 | 32 | `SpiderMaxSessionsTotal` |
| 每个租户与引擎作用域会话 | 4 | `SpiderMaxSessionsPerScope` |
| 空闲回收 | 30 分钟 | `SpiderSessionIdleMinutes` |
| 最长生命周期 | 8 小时 | `SpiderSessionMaxHours` |
| 单条抓包响应体 | 默认 200,000 字符，硬上限 1,000,000 | 调用参数 `CaptureResponseBodyMaxLength` 只能在硬上限内收紧 |
| 每会话抓包条数 | 100 | 超出后移除最旧记录 |

目前 Spider 的浏览器会话和上述会话数配额是**节点进程内状态**，不是跨节点共享会话。多 API 节点部署若要复用登录态，应对 Spider 流量使用按会话的粘性路由，或部署独立 Spider Worker；不要假设任意节点都能恢复另一个节点的浏览器进程。需要跨重启可靠恢复的采集任务，应把任务状态、幂等键和业务结果写入共享数据库/MQ，浏览器会话本身只作为可丢失执行资源。

---

## 十、安全升级与发布约束

- Upgrade15 只清理普通角色对“管理员专用”表的直接授权，不删除正常业务菜单权限；曾被旧策略清理的运行表权限按实际角色重新授予。
- Upgrade16 只补充六个租户上传配置字段，空值保持升级前兼容行为。
- 安全升级不得删除或清空私有子 Git 中的 `Microi.Server/Microi.net/License/keys/`。授权签名资产与登录 RSA 是两套不同用途的密钥，不能以“清理硬编码密钥”为由混删。
- 不得删除登录 RSA 历史 fallback，除非已经完成所有客户前后端成对迁移并有明确发布方案。
- 不得把未配置 CORS 改成默认拒绝，也不得把严格 SSRF 改成默认开启。
- 新旧版本滚动共存时，数据库字段、缓存值、Token 和 API 合约遵守“先扩展、后迁移、再收缩”。
- 文档、Skills、VS Code 插件内置 Skills 与实际运行版本必须同步校验；仅 Skill 数量相同不代表内容一致。

---

## 十一、最低安全验收

1. 普通角色不能访问管理员专用表；只读委托表只能查询；`mic_page/mic_print` 必须有真实角色权限；伪造菜单、角色字段或可信标记无效。
2. 真实菜单访问成功；历史无菜单 V8 能安全推断；无候选或范围歧义失败。
3. TableChild 只能访问父记录范围内子数据，跨父记录失败。
4. 单表行级写入受真实 SQL 约束，Join 型写入和导入失败关闭。
5. 节点 A 修改权限后，节点 B 不重启即可使用新 `epoch`；Redis 故障时按设计回源或失败关闭。
6. 上传大小、数量、帐号/租户日额度生效，多节点不能绕过；Redis 故障不会变成无限上传。
7. 私有文件跨菜单、记录、字段访问失败；授权访问成功；匿名访问失败。
8. CORS 未配置时本地与存量前端可访问，配置后只有指定来源可访问。
9. SSRF 默认保持历史内网调用，严格模式按白名单拦截。
10. 历史 RSA fallback 与部署专属匹配密钥对都能登录；不匹配密钥对明确失败。
11. 多标签页并发续签不会反复退出登录，旧响应不会删除新 Token。
12. Redis 临时/匿名管理和普通角色管理均被拒绝。
