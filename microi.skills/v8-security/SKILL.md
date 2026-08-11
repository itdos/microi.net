---
name: v8-security
description: Microi V8 安全指南。用于审查 DiyToken 与权限、可逆业务秘密、Passkey/TOTP/人脸步进验证、接口引擎安全、密钥管理、SQL 注入、匿名端点、文件上传和租户隔离。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi V8 安全最佳实践

你正在开发 Microi 吾码平台的 V8 引擎代码，必须遵守以下安全规范。

访问密钥由 `microi_list_my_access_keys`、`microi_create_my_access_key`、`microi_revoke_my_access_key` 管理，只允许当前用户、限期、最小 scope，明文仅创建时返回一次。外部身份回调固定为 `/api/ExternalLogin/Callback`，服务端校验租户、Provider、state、redirect 和回调域名，验证成功后仍签发 DiyToken。

## 0. 租户动态系统设置与密钥边界

第三方密钥（微信、支付宝、OpenAI、阿里云、ERP、SMTP）**禁止**硬编码在 V8 代码或前端。新增租户业务配置使用当前租户数据库的 `mci_system_setting`；数据库、Redis、MongoDB、MinIO、MQ 等部署控制面仍由主库 `sys_osclients` 托管，子租户不能修改。

```javascript
// ✅ 浏览器/前端 V8 只能读取管理员明确公开的普通设置
var loginName = V8.SysConfig.PublicSettings['Login.Gitee.Name'];

// ✅ Secret 由固定协议的可信后端原子能力读取和使用
//    V8 只传业务参数，不能拿到 ClientSecret 原文。

// ❌ 危险：密钥泄漏 / 跨租户串号
var openaiKey = 'sk-xxxxxxxxxx';
```

`V8.OsClientModel` 与兼容别名 `V8.ClientModel` 均为独立脱敏副本：数据库连接、AuthSecret、Redis、对象存储、MQ、MQTT、Search 的地址与凭据不会注入脚本。存量租户业务字段只作兼容，新增 Secret 不得继续依赖 `V8.OsClientModel`。

`V8.SysConfig` 也是独立脱敏副本，`ClientSecrets`、`PwdV8`、`GlobalServerV8Code` 及疑似 Password/Secret/Token/Key/Connection 字段不会注入脚本。`V8.SysConfig.PublicSettings` 来自当前租户 `mci_system_setting`：每条记录可以动态设置 `IsPublic`，但 `IsSecret=1` 或 Key 命中 Password、Secret、Token、Credential、PrivateKey、AccessKey、ApiKey、ConnectionString、DbConn、Redis、MinIO、ClientSecret 等固定敏感片段时永远失败关闭。子租户调用 `V8.FormEngine.GetSysConfig(...)` 时服务端会强制使用当前 `OsClient`，不能借缓存命中读取主租户配置。

Secret 只通过租户管理员专用端点写入租户绑定的认证密文。列表不返回密文或原文；临时显示必须消费 Passkey/TOTP/严格人脸一次性票据，设置 `no-store`，30 秒清除，审计不含原文。普通 FormEngine、可编辑 V8、匿名请求和访问密钥会话不得读取 `SecretCipher` 或获得通用解密器。

共享基础设施只能通过受控能力访问：`V8.Cache` 自动绑定 `Microi:{OsClient}:*`，文件路径绑定 `/{OsClient}/...`，RabbitMQ 队列绑定 `microi.{OsClient}.*`，MQTT Topic 绑定 `tenant/{OsClient}/...`，Search 索引绑定 `{OsClient}_*`。V8 不得获得 Redis `IDatabase`、HDFS `ClientModel` 或原始基础设施配置。

子租户缺少 RabbitMQ/MQTT/Search 独立凭据时必须失败关闭，禁止回退主租户账号。新租户开通只有在外部 broker/search 中真实创建 user、vhost、ACL 或 API Key 后，才能标记对应服务可用。

登录和管理端必须强制 HTTPS。登录 RSA 只用于避免密码在请求体、代理调试界面中直接显示，不能替代 HTTPS，也不能作为身份认证或密码存储密钥。平台为兼容已发布客户、旧前端和浏览器缓存，保留历史登录 RSA 密钥对作为缺省回退；安全修复不得直接删除该回退并造成全量客户无法登录。需要部署专属密钥时，在主租户 SaaS 引擎【后端运行配置】中成对维护 `BackendLoginRsaPrivateKey` 与 `BackendLoginRsaPublicKey`；私钥只允许可信服务端读取，匿名 `GetSysConfig` 只返回匹配公钥。源码、环境变量、普通 V8、前端业务代码和日志中仍禁止新增或输出真正的业务私钥、JWT 密钥、支付密钥及对象存储凭据。

微信内容安全回调固定使用 `/api/wechatcontentsecurity/callback` 或第三方不支持 QueryString 时以 `/api/wechatcontentsecurity/callback--osclient--` 为路径前缀并追加 `{OsClient}--`；回调只能由服务端按签名和租户规则建立信任。

吾码现有多端兼容约定是：主 SaaS 引擎 `sys_osclients.CorsAllowOrigins` 为空时默认允许全部跨域，便于本地开发、独立前端、H5 和不同租户域名访问；配置了来源后才按精确来源或通配符限制。安全修复不得把“未配置”改成默认拒绝，否则会造成所有存量部署和本地调试突然失效。CORS 不是鉴权边界，权限仍必须依赖 Token、租户隔离、菜单/表权限和服务端数据范围。

吾码既有客户大量通过 `V8.Http` 访问内网设备、InfluxDB、内部 ApiEngine 和本机 sidecar。严格 SSRF 防护必须默认关闭：未配置时不得限制协议、URL 内嵌凭据、回环、私网、链路本地、云元数据或重定向。只有客户在 SaaS 引擎主租户启用 `SsrfProtectionEnabled` 后才进入严格模式，并用精确 `SsrfAllowedHosts` 放行；不要为这类普通运行参数增加 API 容器环境变量。

外部数据库与附件迁移属于更高风险的控制面操作：

- `microi_database` 只允许 `Level >= 9999` 的可信管理链路维护；连接字符串、密码和鉴权 Header 不得出现在日志、接口返回、前端或审计详情。
- MCP 临时连接和保存连接只接受平台认证数据库类型；保存前测试写连接和独立读连接，写入必须显式确认，返回只包含 DbKey、类型和回读状态。
- `microi_query_external_database` 是默认只读入口；`microi_execute_external_database` 是独立超级管理员入口，后端必须从当前 Token 硬校验 `Level >= 9999`。显式确认后不限制 SQL 类型，可执行数据库账号有权执行的 DML、DDL、存储过程、文件能力和多语句；审计仅保留 SQL 哈希、长度、模式和结果。
- `V8.Dbs.Open` 只能在可信后端代码中使用，连接串来自服务端密钥或管理员配置；禁止把 `V8.Param`、Header 或匿名请求里的连接串直接传入。
- `microi_import_external_attachment` 仅对后端确认的 `Level >= 9999` 当前用户开放，可访问 HTTP/HTTPS、私网、本机绝对路径和 UNC；不设固定 MCP 大小上限并采用流式迁移。源 URL、鉴权 Header、本机/UNC 路径只以哈希进入审计，能力仍受 API 服务账号和目标基础设施授权约束。
- 多节点保存连接使用按 `OsClient + DbKey` 隔离的分布式锁，并由数据库唯一索引兜底；同步数据和附件仍必须使用业务幂等键，锁不能替代唯一约束、状态机或 inbox/outbox。

## 0.5 接口引擎配置安全

代码以外，接口本身的配置项也是安全防线（详见 `v8-api-config/SKILL.md`）：

| 配置 | 何时开启 |
|------|---------|
| `IsAnonymous = false` | 非公开接口默认关闭，防止匿名调用越权 |
| `StopHttp = true` | 内部接口（核心扣款、内部计算）防止外部直接 HTTP 调用 |
| `LockKey = ...` | 写操作类接口（对账、补单）防止并发执行 |
| `RateLimit = 60/m` | 公开接口（验证码、登录）防爬虫 |
| `LogParam = true` | 支付/审计类接口记录请求 |

## 1. 防 SQL 注入

### 必须：参数化查询

```javascript
// ✅ 使用 _Where（自动参数化）
V8.FormEngine.GetTableData('SysUser', {
  _Where: [['Account', '=', V8.Param.account]],
  _PageSize: 20
});

// ✅ 必须原生 SQL 时：FromSql 只传 SQL，参数用 AddInParameter
V8.Db.FromSql('SELECT * FROM SysUser WHERE Account = @p0')
  .AddInParameter("@p0", V8.Param.account)
  .ToArray();
```

### 禁止：字符串拼接

```javascript
// ❌ 绝对禁止
V8.Db.FromSql("SELECT * FROM SysUser WHERE Account = '" + V8.Param.account + "'").ToArray();

// ❌ 禁止动态拼接表名/字段名
V8.Db.FromSql("SELECT * FROM " + V8.Param.table).ToArray();
```

## 2. 权限校验

### DiyToken 是平台会话与权限入口，不替换为 ASP.NET Identity

DiyToken 与 `sys_user`、`OsClient`、终端 `did`、共享 Redis 登录态、角色/部门、菜单动作、表权限、数据范围和接口引擎共同构成吾码认证授权体系。它不是“只有一个 Token 字符串”的简化登录：

- 登录、SSO、OAuth、Passkey、人脸或访问密钥验证成功后，统一签发/兑换 DiyToken。
- Token 认证只证明用户和租户；服务端仍按资源、动作和数据范围授权，前端按钮不可代替。
- 用户停用、角色变化、单终端/全部终端吊销和 Token 轮换都依赖共享会话事实，不依赖单机内存。
- ASP.NET Identity 可以作为外部身份源的适配参考，但不能整体替换吾码的租户、低代码权限、V8 和在线终端协议。

开发新登录入口时只实现“验证身份 -> 获取仍启用的 `sys_user` -> 签发 DiyToken”，禁止并行创建第二套用户、角色、权限 Token 或会话有效期规则。

### 平台 FormEngine 授权边界

**Token 只完成身份认证，不是任意表的访问凭证。** 来自浏览器、UniApp、SDK 或其它外部客户端的通用 FormEngine 请求，必须由服务端完成以下授权，V8 或前端代码不得自行模拟、放宽：

- HTTP 客户端显式传入 `_SysMenuId`（或兼容的 `ModuleEngineKey`）时，服务端默认进入**严格精确菜单授权**：校验该菜单真实存在、绑定的 `DiyTableId` 与目标表一致、当前用户有效角色拥有该菜单，以及当前操作的 `Read`、`Add`、`Edit`、`Del` 等权限。列表、写入、导入、导出显式传错、伪造或借用其它菜单 Id 必须失败关闭。
- 为兼容已发布项目中大量未传或保留过期 `_SysMenuId` 的旧版 PC/UniApp，普通业务表的唯一详情只要当前角色真实拥有至少一个直接绑定同表的菜单（或精确表级 `Read` 权限）即可读取，不应用菜单 `SqlWhere` / `SqlJoin`。该规则不能用于放宽列表、导入、导出或写入的菜单动作权限。
- 历史前端 V8 的无菜单 FormEngine 集合请求由后端根据“当前用户有效角色可访问的 `sys_menu`”推断目标表权限；多个菜单范围只有 Join 上下文一致时才可合并，否则失败关闭。推断必须使用后端授权快照，不能相信前端提交的角色、菜单列表或权限 JSON。确实没有菜单入口的 SDK/定制页面仍可按最小权限使用高级表权限；`diy_table.BindRole` 只做候选角色过滤，不能单独代替操作权限。
- 标准 PC 表单引擎会通过前端 FormEngine facade 给“当前表”的 V8 调用自动注入真实 `_SysMenuId`；V8 跨表调用故意保持无菜单，让后端按目标表的已授权菜单推断，禁止把当前主表菜单错误传播给其它表。
- 历史 PC/UniApp 的单表字段元数据可在菜单缺失/过期时回退到当前角色另一个引用同表的已授权菜单；`GetDiyFieldByDiyTables` 还可能批量提交“主表 + 关联表”，后端必须保留调用顺序，以第一张主表作为强制授权锚点。主表通过后，后续表逐张授权并过滤未授权表/保护表，不能让一张被拒绝的关联表拖垮已授权主表，也不能把被过滤表的字段、SQL 数据源或 V8 配置返回客户端。元数据兼容不授予数据行权限。
- `TableChild` 隐藏子菜单不要求存量角色逐个补授权。子表访问只能由后端在同一次请求中验证“已授权父菜单、父表 TableChild 字段配置、子菜单绑定、父记录可见范围、父键唯一性和子表外键”后委托，并把外键条件强制写入真实查询/写入；伪造 `_TableChildAuth`、跨父记录借用外键或脱离父表直接访问都必须失败。
- 菜单 `SqlWhere`、`SqlJoin` / `JoinTables` 数据范围必须在服务端形成的**真实列表、计数和导出查询**中执行，不能只用于界面展示或查询后过滤。单行详情只校验同表菜单访问权，不应用这些模块列表过滤；它们也不是行级写权限。
- 主表新增、修改、删除分别由当前角色的 `Add`、`Edit`、`Del` 权限控制；不得把查询 SqlWhere 追加到写入 SQL，也不得因为查询包含跨表 Join 拒绝已获授权的写入。需要“仅可修改本人数据”等业务限制时，在 `SubmitBeforeServerV8` 或专用接口引擎中以可信服务器代码校验，并统一写入 `TenantId`、负责人、创建人等归属字段。
- 导入、导出必须携带真实菜单上下文，并分别拥有 `Import`、`Export`；不能用 Table 级直接授权绕过。
- 平台表必须按后端 `PlatformResourceSecurity` 分级：账号/角色/权限、SaaS 配置、接口引擎、表字段元数据、任务、数据源、密钥和基础设施等管理员专用表，对 `Level < 9999` 的通用客户端 FormEngine 全操作硬拒绝；工作流、微服务/商店、蓝图和微应用运行元数据只允许显式授权后的 `Read/List`，写入仍硬拒绝；`mic_page/mic_print` 按真实菜单或 Table 的 `Read/Add/Edit/Del` 权限管理。
- 匿名读取/新增仅适用于 `diy_table` 明确开启匿名能力的普通业务表；上述三类平台表必须先于匿名开关拒绝。
- 角色增删改接口不能只相信 Token 缓存或前端禁用状态，必须覆盖请求中的 `_CurrentUser/OsClient`，并从租户主库复核活动用户、数据库 Level 与有效角色 Level。角色降级要先同步受影响用户 Level，再提升共享授权 `epoch`，避免旧令牌窗口；Postman 伪造 `_IsAdmin/Level/RoleIds` 必须失败。
- 权限 JSON、角色 Id 或菜单上下文解析失败时必须失败关闭；角色 Id 使用精确集合匹配，禁止 `Contains` 子串判断。

标准菜单模块继承菜单权限，不需要维护“角色 × 全部业务表”的巨大矩阵，也不能要求所有历史前端 V8 立即补传菜单 Id。新前端在当前表上下文应由平台 facade 自动携带真实菜单；历史无菜单请求继续由后端安全推断。【高级表权限】只用于确实没有任何菜单入口的定制页面/SDK，并按最小权限授予。

跨租户公共发现接口可以匿名，但返回值必须采用严格字段白名单，只返回公开标识和展示信息，禁止返回 `ApiKey`、上游 Endpoint、连接串或内部配置。例如官方 AI 中转模型清单应保持 `IsEnable=1`、`StopHttp=0`、`AllowAnonymous=1`，且只返回模型 Id、展示名等公开字段；将这类被其它租户服务器调用的发现接口误改为非匿名，会让所有消费者得到空模型列表或 `NoAuth`，属于破坏性配置变更。发布和升级后必须用无 Token 的真实 HTTP 请求验证返回字段与匿名状态。

> 后端接口引擎、后端表单 V8 和平台内部调用由服务端在构造参数时设置不可由 HTTP JSON 注入的 `_TrustedServerInvocation`，因此调用 `V8.FormEngine` 不要求 `_SysMenuId`。`_InvokeType:'Server'` 只是事件调用语义，不是外部客户端可用的授权开关；普通用户即使在请求中伪造这两个字段也不能成为可信调用。任何能让普通用户写 V8、接口引擎、任务或数据源配置的管理入口本身都必须限制为 `Level >= 9999`，否则会重新获得任意数据执行能力。

> 外层 `AddFormData` 的客户端菜单/`Add` 权限校验与事件内部执行权是两件事：前者防止无新增权限的用户进入事件，后者允许已经进入的 `SubmitBeforeServerV8` / `SubmitAfterServerV8` 像接口引擎一样在当前租户内执行复杂 SQL、跨表事务和其它表 CRUD。不要把客户端菜单范围再次套到服务器 V8 的嵌套调用。

### FormEngine 授权缓存与性能

授权不能在每次 FormEngine 请求中重复全表查询，也不能用只在单节点有效的永久静态字典。平台使用按 `OsClient` 隔离的 Redis 授权版本 `epoch`、用户级授权快照、短 TTL 的进程内 L1 与共享 Redis L2：

- 请求先读取当前租户 `epoch`，再按“租户 + epoch + 用户”读取授权快照；同一版本命中时复用有效用户、有效角色、菜单、表与操作权限。
- 正确菜单、无菜单候选范围和详情同表菜单访问都只读取一次缓存快照；详情不逐菜单执行数据范围探测。不得把详情的同表菜单兼容扩展为无范围列表或批量查询。
- 冷加载必须从主库读取 `sys_user`、`sys_role`、`sys_rolelimit`、`sys_menu` 等授权事实，避免只读副本延迟把已撤销权限重新缓存。
- 用户状态/级别/角色、角色状态、菜单绑定/数据范围、角色菜单或高级表权限发生变化时，必须在事务成功后递增共享 Redis `epoch`。所有 API 节点看到新版本后自然放弃旧快照，不依赖粘性会话或逐节点重启。
- L1 只做短时性能优化，允许丢失；L2 和 `epoch` 才负责多节点共享版本。缓存失效异常时应缩短使用窗口并失败关闭敏感操作，不能无限沿用旧权限。
- 快照 Key 必须包含独立的“序列化契约版本”。新增 `UserLevel`、`IsActiveUser` 等安全字段或改变字段语义时提升版本，让 Redis 中跨重启、滚动升级遗留的旧 JSON 立即失效，禁止缺失字段按 `0/false` 反序列化后误拒绝有效管理员或误放普通用户。
- 已通过 `Level >= 9999` 校验的表单设计器批量写 `diy_field` 时，应在外层只授权一次，并校验所有字段都属于同一 `TableId`；随后在同一事务内更新元数据，批次结束后只清一次缓存/版本。不要让每个字段重新进入通用 FormEngine 授权、V8、日志和缓存管线。`AddDiyField/AddField` 等单字段能力仍须传递经服务端确认的管理员上下文；升级程序等无 HTTP 用户的可信任务必须构造强类型参数并设置不可由 JSON 绑定的 `_TrustedServerInvocation`。

### 接口引擎中校验当前用户

```javascript
// 只允许自己查看自己的数据
if (!V8.CurrentUser || !V8.CurrentUser.Id) {
  return { Code: -1, Msg: '未登录' };
}

var result = V8.FormEngine.GetFormData('UserProfile', {
  _Where: [['UserId', '=', V8.CurrentUser.Id]]
});
```

### 角色权限控制

```javascript
// 仅管理员可执行
if (!V8.CurrentUser.RoleName || V8.CurrentUser.RoleName.indexOf('管理员') === -1) {
  return { Code: 0, Msg: '无操作权限' };
}

// 多角色判断
var allowedRoles = ['管理员', '财务主管', '总经理'];
var userRoles = (V8.CurrentUser.RoleName || '').split(',');
var hasPermission = userRoles.some(function(role) {
  return allowedRoles.indexOf(role.trim()) !== -1;
});
if (!hasPermission) {
  return { Code: 0, Msg: '无操作权限' };
}
```

### 数据行级权限

```javascript
// 普通用户只能操作自己部门的数据
var where = [['Status', '=', 1]];
if (V8.CurrentUser.RoleName.indexOf('管理员') === -1) {
  where.push(['AND', 'DeptId', '=', V8.CurrentUser.DeptId]);
}

var result = V8.FormEngine.GetTableData('Order', {
  _Where: where,
  PageIndex: V8.Param.pageIndex || 1,
  PageSize: V8.Param.pageSize || 20
});
```

## 3. 输入验证

### 必填校验

```javascript
if (!V8.Param.name || !V8.Param.phone) {
  return { Code: 0, Msg: '姓名和手机号不能为空' };
}
```

### 格式校验

```javascript
// 手机号
if (V8.Param.phone && !/^1[3-9]\d{9}$/.test(V8.Param.phone)) {
  return { Code: 0, Msg: '手机号格式不正确' };
}

// 邮箱
if (V8.Param.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(V8.Param.email)) {
  return { Code: 0, Msg: '邮箱格式不正确' };
}

// ID 格式（GUID）
if (V8.Param.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(V8.Param.id)) {
  return { Code: 0, Msg: 'ID 格式不正确' };
}
```

### 数值范围

```javascript
var pageSize = parseInt(V8.Param.pageSize) || 20;
pageSize = Math.max(1, Math.min(pageSize, 100));  // 限制 1~100

var amount = parseFloat(V8.Param.amount);
if (isNaN(amount) || amount <= 0 || amount > 999999.99) {
  return { Code: 0, Msg: '金额不合法' };
}
```

## 4. 防 XSS

四个字符替换不是通用 XSS 防护。必须按输出上下文处理：

- 纯文本保存原始业务值，渲染时使用 Vue 文本绑定/`textContent`，不要用 `v-html`；
- URL 只允许明确协议和域名，并通过 URL 解析器校验；
- 富文本使用平台统一 allowlist 清洗器，移除 `script`、事件属性、危险协议、`iframe/object` 等；
- V8 模板经 `v-safe-html` / DOMPurify 清洗，内联 `onclick` 等事件会被移除；交互使用平台按钮/V8 事件，不拼接可执行 HTML；
- CSV、Excel、邮件和日志还要分别处理公式注入、HTML 邮件和日志换行注入。

```javascript
var content = String(V8.Param.content || '');
if (content.length > 5000) {
  return { Code: 0, Msg: '内容过长' };
}
V8.FormEngine.AddFormData('Comment', {
  Content: content,
  UserId: V8.CurrentUser.Id
});
```

## 5. 防重复提交

前端禁用按钮或普通 Cache 的 `Exists → Set` 只能改善体验，不能保证业务只执行一次。写操作必须接收稳定幂等键，并通过数据库唯一约束、条件更新或状态机原子落库；接口引擎可再配置 `LockKey` 降低并发，但锁不能代替业务幂等。

```javascript
var requestId = String(V8.Param.RequestId || '');
if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) {
  return { Code: 0, Msg: '缺少合法幂等键' };
}

// IdempotencyKey 在数据库中建立唯一索引；重复请求读取并返回已有结果
var old = V8.FormEngine.GetFormData('Order', {
  _Where: [['IdempotencyKey', '=', requestId]]
});
if (old.Code === 1 && old.Data) {
  return { Code: 1, Data: old.Data, Msg: '重复请求已复用原结果' };
}
// 最终仍以唯一约束处理并发竞态，不以这次预查询作为安全保证
```

## 6. 敏感数据

### 密码与认证

业务 V8 禁止自行查询 `sys_user`、保存密码或用 MD5/SHA1/SHA256 直接哈希密码。统一使用平台登录、重置密码和管理员用户管理接口；新密码存储必须由后端使用带盐、可调成本的专用密码哈希，并支持版本与轮换。登录 RSA 只隐藏传输报文中的明文外观，不能替代 HTTPS，也不能用于密码存储。

存量 `PwdEncode=DES` 的兼容例外只能位于 `[PlatformAdminOnly]` 的 `GetSysUserPassword`：还要拒绝访问密钥会话、按当前 `OsClient` 和准确用户 Id 查询、用“解密后重新加密等于原密文”验证结果、返回 `no-store` 并写不含明文的安全审计。`PwdEncode=V8` 不假定可逆。不得把该能力暴露给 FormEngine、V8、普通角色或匿名端点。

### 可逆业务秘密：允许加密存储和授权显示

设备口令、第三方业务账号密码、客户明确要求再次显示的字段可以使用 `V8.EncryptHelper.DESEncode/DESDecode` 兼容机制，但必须与登录密码、支付私钥、`AuthSecret` 和基础设施密钥分开：

```javascript
// 保存：只在可信后端执行
V8.Form.SecretCipher = V8.EncryptHelper.DESEncode(String(V8.Form.SecretPlain || ''));
V8.NotSaveField.push('SecretPlain');
```

显示明文必须设计为独立后端动作，并同时做到：

- 校验当前 DiyToken、准确 `OsClient`、当前用户真实角色/菜单/业务权限；高风险场景再要求下面的一次性强身份票据。
- 只解密一条明确记录，不向列表、批量导出、通用 FormEngine、匿名或访问密钥会话提供解密器。
- 只记录操作者、目标 Id、用途、结果和时间，禁止日志/审计/通知/缓存保存明文；HTTP 响应设置 `no-store`。
- 页面默认掩码，点击显示需二次确认，失焦/超时/路由离开后清除；禁止复制到 URL、LocalStorage 或前端日志。
- DES 是存量兼容格式。新高价值秘密优先由可信 C# 原子能力使用带版本的现代认证加密和集中密钥管理，V8 仍只编排授权显示，不能获取主密钥。

### Passkey、Authenticator、人脸与敏感操作票据

前端 V8 使用 `V8.Identity.Verify({Purpose,ActionHash,Method,Code})` 完成人机交互；`Method=Totp` 时 `Code` 是用户当前看到的 6 位动态口令。后端必须从数据库重读权威业务字段、按稳定版本/顺序重算 `ActionHash`，再消费票据：

```javascript
var actionHash = V8.EncryptHelper.Sha256Hex(canonicalCommand);
var verified = V8.Method.ConsumeIdentityVerificationTicket({
  Ticket: V8.Param.IdentityVerificationTicket,
  Purpose: 'RevealBusinessSecret',
  ActionHash: actionHash
});
if (verified.Code !== 1) return verified;
```

- Ticket 绑定 `OsClient + UserId + Purpose + ActionHash`，共享 Redis 保存两分钟并使用原子 `GETDEL`，只能消费一次。
- 前端提交的摘要、`Verified=true`、认证器名称或方法不能作为授权事实；访问密钥会话不能使用。
- 票据只证明近期强身份，不代替菜单/表/行权限、业务状态机、事务、幂等或审计。
- 设备指纹/Face ID/Windows Hello 优先走 WebAuthn/Passkey，不需要模型 Docker；只有严格服务端人脸/活体检测才通过 `Microi Face Gateway v1` 接入独立服务。
- 标准 TOTP Authenticator 不需要 Docker，但 6 位码不能单独标识账号：登录时仍需账号；密钥只以租户绑定的认证密文保存，并用共享限流和已接受计数器阻止暴力尝试与重放。
- 每个 Passkey/TOTP 分别保存 `AllowPasswordlessLogin` 与 `AllowStepUp`；登录和票据签发都必须服务端重新读取策略，不能只依赖个人中心开关的前端状态。
- Gitee、微信、GitHub 等外部身份只允许登录已绑定的吾码用户；禁止按邮箱/昵称自动合并账号。OAuth state 与登录票据保存在共享 Redis、单次消费并绑定 `OsClient`/Provider/Origin；固定端点白名单，ClientSecret 只由可信后端读取，最终仍签发 DiyToken。
- 官方升级通过 `app.microi.saas-engine` 应用包幂等安装身份表、`mci_system_setting`、`mci_user_external_identity`、默认设置、个人中心和系统设置微服务。默认设置按 `ConfigKey + InsertIfMissing` 补齐，不覆盖 `ValueSource=Tenant` 的租户值；Passkey、TOTP、总开关和改密步进验证默认开启，严格人脸及各外部 Provider 默认关闭。
- 完整表、SaaS 字段、API 和启用顺序见 `microi.doc/docs/doc/more/identity-verification.md`。
- 身份验证 HTTP 控制面位于 `/api/identityverification/`，外部登录位于 `/api/externallogin/`，动态设置位于 `/api/tenantsystemsettings/`；业务页面优先使用 `V8.Identity` 或官方个人中心，不要自行复制 WebAuthn/OAuth 协议代码。

### 脱敏返回

```javascript
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

function maskIdCard(idCard) {
  if (!idCard || idCard.length < 8) return idCard;
  return idCard.substring(0, 4) + '**********' + idCard.substring(idCard.length - 4);
}

var user = result.Data;
user.Phone = maskPhone(user.Phone);
user.IdCard = maskIdCard(user.IdCard);
return { Code: 1, Data: user };
```

## 7. 日志记录

关键操作必须记录审计日志：

```javascript
// 记录敏感操作
V8.Method.AddSysLog({
  Title: '删除用户',
  Content: JSON.stringify({
    OperatorId: V8.CurrentUser.Id,
    OperatorName: V8.CurrentUser.Name,
    TargetId: V8.Param.userId,
    Time: DateNow('yyyy-MM-dd HH:mm:ss')
  }),
  Type: '安全审计',
  Level: 2
});
```

### 管理员吊销用户全部登录态

需要让某个用户所有终端立即退出时，接口引擎必须调用平台统一能力，不要只删除前端 Token，也不要只修改用户状态：

```javascript
if (!V8.CurrentUser || Number(V8.CurrentUser.Level || 0) < 9999) {
  return { Code: 0, Msg: '仅系统管理员可执行此操作' };
}

var clearResult = V8.Method.ClearUserLoginInfo(V8.Param.UserId, V8.OsClient);
if (clearResult.Code != 1) {
  return clearResult;
}
```

- `ClearUserLoginInfo` 会删除该用户 Redis 中的全部终端 Token，旧 Token 随即失效且不能继续以旧换新。
- 已建立实时连接的终端会收到 `ReceiveForceLogout` 并立即退出；没有实时连接的终端在下一次请求时收到 Token 失效。
- “禁用用户”必须先吊销全部登录态，再把 `sys_user.State` 更新为 `0`，并记录安全审计日志。
- 接口引擎和底层方法都必须校验管理员权限、目标用户 Id 和租户边界，禁止跨租户吊销。

## 8. 错误处理

不要把内部错误信息暴露给前端：

```javascript
try {
  var result = V8.Db.FromSql('SELECT * FROM t WHERE Id = @p0')
    .AddInParameter("@p0", V8.Param.id)
    .ToArray();
  return { Code: 1, Data: result };
} catch (ex) {
  // 内部日志使用追踪号和必要的非敏感字段；不要记录完整V8.Param
  var traceId = V8.Method.NewUlid();
  console.error('查询失败 traceId=' + traceId + ' error=' + ex.message);
  // 返回给前端的信息不含内部细节
  return { Code: 0, Msg: '查询失败，请稍后重试', DataAppend: { TraceId: traceId } };
}
```

## 9. Token、终端会话与租户隔离

开发 Web、H5、UniApp、小程序、App、VS Code 或 MCP 客户端时，必须同时遵守 `microi-frontend-sdk/SKILL.md` 的 Token 协议：登录传 `_ClientType`，请求头传稳定 `did`，每次响应接收新的 `authorization`，并在浏览器/应用恢复前台时检查续签。

- PC 默认使用 `SessionAuthTimeout` 分钟策略；移动端、VS Code、MCP 默认使用 `AccessTokenLifetime` 天策略。不要在前端自行扩大服务端有效期。
- Token 的 `OsClient` 必须与当前请求租户一致。收到 `TenantMismatch` 时立即停止请求，不能自动把 Token 复制到另一个租户。
- 收到 `JwtExpired`、`SessionExpired`、`SessionMissing`、`AuthVersionChanged` 时清理当前连接的 Token；多服务器或多租户客户端只能清理受影响的连接，不能全局退出其它连接。
- 收到 `TokenReplaced` 时先检查同一终端是否已有新 Token，避免并发旧响应误清新登录态。
- 用户提示可以显示过期时长、终端类型和租户 Key，但日志、Toast、URL、截图禁止输出完整 Token。

### IP 高频拦截、受信 VS Code 独立阈值与解除

- `DataAppend.SecurityBlocked=true` 是服务端已可达但当前 IP 被临时拦截，不是网络断开。前端必须展示原始 `Msg`、`Reason`、`ExpiresAtUtc`、IP 和解除建议；不能把它转换成“后端 API 服务暂时不可用”。直接返回该结果的安全中间件必须在 CORS 之后。
- 普通访问默认阈值为 10 秒 600 请求/120 异常。VS Code 多服务器源码拉取不能通过减少并发或请求量规避；符合条件的只读 V8Debug `Get/List` 使用独立桶，默认 10 秒 6000 请求/1200 异常。
- 受信判断必须同时满足：服务端共享登录态确认 `Level >= 9999`、请求 Token 是活动 `ClientType=VSCode` Token、请求 `did` 与该 Token 保存的 Did 完全一致、路由为只读 `/api/V8Debug/Get*` 或 `/api/V8Debug/List*`。自报 `ClientType`、User-Agent、`X-User-Level`、单独伪造 did 都不可信；Update/Create/Execute/Upload/Finalize 和 FormEngine 写入不放宽。
- 普通请求的计数 scope 固定为当前 API 主运行实例，不能使用请求方可控的 `OsClient` Query/Header 选择 Redis 桶；只有已通过上述联合校验的 VS Code profile 才能使用活动 Token 服务端绑定的租户 scope。测试必须覆盖轮换两个真实租户 Key 仍落入同一普通桶。
- SecurityGuard 只读取 `Connection.RemoteIpAddress`，不得直接解析 `X-Forwarded-For`/`X-Real-IP`。容器运行时可自动信任当前容器路由表实际发现的 RFC1918/ULA 私有默认网关**精确 IP**，用于宿主 Nginx 经 Docker 发布端口转发的最后一跳；不得自动信任公网网关或任意私有网段。其它代理只信任主租户 SaaS 引擎【后端运行配置】的 `BackendForwardedKnownProxies` 精确 IP 和 `BackendForwardedKnownNetworks` 受控 CIDR；禁止使用环境变量、自定义 `appsettings` 节点、`0.0.0.0/0` 或 `::/0`。历史 `SecurityRespectForwardedHeaders` 字段不能建立 Header 信任。该宿主配置变更需滚动重启节点，测试必须覆盖容器网关把 XFF 投影为真实 IP，以及公网 Remote IP 携带伪造 `X-Forwarded-For: 127.0.0.1` 时仍识别公网 IP。
- `UseForwardedHeaders` 后若 Remote IP 仍是自动发现的精确容器网关，表示代理未提供可验证的客户端地址；该请求不得进入按 IP 自动封禁，否则任一用户可导致全站误封。此降级不跳过后续全局请求压力、内存和业务鉴权，公网或普通私网地址也不适用；运维仍应补齐最后一跳转发头。
- IP 错误窗口只把未匹配端点的 404/405 作为扫描计数；400/401/403/413/429、5xx、已匹配 Controller 以及 `/api`、`/apiengine` 动态路由的应用级 404/405 只能审计，不能触发自动封禁。请求总量窗口继续作为独立的高频攻击门禁，禁止用服务端故障或正常业务拒绝反向惩罚客户端。
- 旧版 `HighError`／`TrustedVsCodeHighError` 宽泛错误策略产生的自动封禁属于可识别的失效状态；升级节点应从共享 Redis 和本机缓存幂等退休，不能要求所有租户等待旧 TTL，也不能解除手动、`HighFrequency` 或新版 `RouteScan` 封禁。
- 自动封禁按 `ExpiresAtUtc` 到期解除。立即解除只能从未被封禁的管理网络，以平台超级管理员进入【系统日志 → 安全防护】操作 `/api/SecurityGuard/UnblockIp`；同一被封出口不能给自己解封。
- 固定可信出口才可精确加入当前服务器匹配 `sys_osclients.SecurityWhitelistIps`。禁止全网段、动态用户 IP 或请求参数自动入白名单，也不要关闭安全防护或全局放大普通阈值。
- 多节点封禁、解封和到期状态必须进入共享 Redis/数据库；本机静态字典只能做缓存。Redis 可用且共享 block 不存在就是权威已解封，节点必须删除本机旧 block，禁止把旧状态回写复活；Redis 不可用时才允许本机降级。验收要让同一出口分别命中至少两个 API 节点，覆盖普通阈值、受信读取、伪造 Header、手动解除和自动到期。

## 10. Jint 运行时升级边界

升级 Jint 时必须逐版阅读官方 release notes，并至少验证以下兼容面，不能只以编译通过作为验收：

- `Engine` 非线程安全；每次执行使用独立 Engine。`setTimeout` 等回调必须在当前请求内由同一 Engine 串行排空后再释放，禁止 `Task.Run` 捕获 Engine 跨线程或在响应后继续执行。需要可靠后台执行时改用 MQ、Job 或 outbox，不把进程内定时器当作持久任务。
- 重复脚本使用有上限的 `Engine.PrepareScript` 缓存；`Prepared<Script>` 可跨 Engine 复用。Promise 使用 `EvaluateAsync` / `UnwrapIfPromiseAsync` 和请求取消令牌，禁止在 ASP.NET 请求线程上使用阻塞的 `UnwrapIfPromise`。
- 内存 MB 转字节前先提升为 `long`，例如 `checked((long)mb * 1024L * 1024L)`；2GB 用 `int` 相乘会溢出并让限制失真。
- Jint 4.14 默认把 CLR 数组改为 `LiveView`，并默认缓存最近对象包装器。Microi 为兼容历史脚本显式使用 `ArrayConversionMode.Copy + CacheRecentObjectWrappers=false`；若以后切到 LiveView，必须覆盖宿主数组被 JS 修改、固定长度 push/pop 报错、`Array.isArray=false` 和重复读取身份缓存测试。
- 引擎约束必须在平台宿主对象注入完成、用户脚本执行前 `Constraints.Reset()`；同时覆盖超时、语句数、递归、内存、Promise 取消及 CLR 宿主边界返回后的再次检查。

## 安全检查清单

- [ ] 所有数据库查询使用参数化（`_Where` 或 `@p0`）
- [ ] 把 Token 认证与表/菜单/操作授权分开；列表/写入显式菜单严格精确校验，历史唯一详情只校验同表已授权菜单访问权
- [ ] 当前表前端 facade 自动注入真实菜单，跨表不借用主菜单；可信后端 V8 由服务端标记且不要求菜单
- [ ] 平台表按管理员专用、只读委托、按角色管理三级执行；全部拒绝匿名，Import/Export 必须携带真实菜单并有专项权限
- [ ] 菜单 `SqlWhere` / `SqlJoin` 覆盖真实列表、计数和导出查询；详情只校验同表菜单访问；主表新增/修改/删除/导入只按专项操作权限，不把查询范围带入写 SQL；行级写业务限制由后端 V8/接口引擎校验
- [ ] 授权缓存按租户使用 Redis `epoch` 和用户级快照；冷加载读主库，权限变更递增 `epoch`
- [ ] 关键操作校验 `V8.CurrentUser` 权限
- [ ] 涉及数据修改的接口校验请求参数合法性
- [ ] 敏感数据（手机号、身份证等）脱敏返回
- [ ] 密码只走平台认证/重置流程；禁止MD5/SHA直接存储，后端使用带盐自适应密码哈希
- [ ] 可逆业务秘密只在后端加解密；列表掩码、独立授权显示、no-store 且审计不含明文
- [ ] 新登录/SSO/Passkey/人脸入口最终签发 DiyToken，不并行创建第二套权限体系
- [ ] 敏感操作票据由后端重算 ActionHash 后原子消费，不能相信前端验证成功布尔值
- [ ] 写操作有防重复提交机制
- [ ] 关键操作写审计日志
- [ ] catch 块不暴露内部错误给前端
- [ ] 外部数据库连接串不来自普通请求、不回显，DbKey 无重复且不占用 V8.Dbs 保留名称
- [ ] 外部附件管理入口硬校验 `Level >= 9999`、显式确认、来源脱敏，流式迁移并按源附件 Id 幂等回读
- [ ] Jint 升级覆盖 Prepared 缓存、非阻塞 Promise、long 内存换算、数组互操作兼容和同线程定时器生命周期

### 复盘：管理员设计器和升级任务的嵌套 FormEngine 写入被误判

- 触发场景：`Level=9999` 管理员在表单设计器保存时，外层 `UptFormData`、内部 `UptDiyFieldList` 或 `AddDiyField` 返回 `NoAuth`；无 HTTP 用户的升级任务写 `sys_apiengine/sys_menu/diy_field` 也被拒绝。
- 根因：Redis 保留了旧结构的授权快照，新字段反序列化为 `0/false`；同时更新前旧记录读取或动态新增字段把已校验上下文降成裸 `JObject` / 匿名参数，丢失管理员或可信服务端来源。批量字段保存若逐字段调用完整 CRUD，还会把授权、V8 和缓存工作放大 N 倍。
- 通用规则：授权快照使用独立契约版本；内部嵌套调用必须显式传递原始客户端管理员上下文，或由真正的服务端任务构造不可伪造的强类型可信参数，不能依赖 `_InvokeType` 或 CLR/JObject 猜测。
- 自动化检查：预置缺少新字段的旧 Redis 快照后验证新版本 Key 不命中；分别覆盖管理员设计器批量字段保存/新增字段、普通用户直接写管理员专用表被拒绝、只读委托表写入被拒绝、`mic_print` 有权读取成功、升级程序可信写入成功，以及 HTTP JSON 伪造可信字段仍失败。

## 浏览器访问密钥

固定看板、电视和信息屏免输入帐号密码时，使用平台 `mci_user_access_key`，禁止自行在接口引擎中保存明文 Secret，也禁止把长期登录 Token 拼进 URL。

- 一个帐号可有多个密钥；每个密钥独立名称、到期时间（90天/自定义/永久）、范围、使用审计和吊销状态。永久密钥必须可单独吊销并建议定期人工轮换。
- 密钥格式固定为 `microi_ak_<48-bit公开前缀>.<128-bit随机秘密>`，当前总长度 41 个字符；只保存完整密钥的 SHA-256 哈希，明文只在创建时返回一次。日志、MongoDB、Redis、异常和回答中不得出现完整密钥。
- 浏览器启动链接使用 `{Microi.Client前端WebBase}/?OsClient={租户Key}#/access-login?access_key={密钥}&redirect={encodeURIComponent后的站内Hash路由}`。例如目标路由 `/mic/data-dashboard/preview/01KK988A0YPHKAM8SF216917HX` 编码后是 `redirect=%2Fmic%2Fdata-dashboard%2Fpreview%2F01KK988A0YPHKAM8SF216917HX`。前端域名不能误用 API Server；目标路由必须以 `/` 开头并位于密钥允许页面范围内。
- 固定电视/看板应保存完整 `/access-login` 链接作为浏览器开机主页或受控书签，不能只保存兑换后的预览页。`access_key` 位于 Hash 中，前端解析后立即 `history.replaceState` 清除；地址栏随后不含密钥是正常安全行为，禁止给目标页重复追加密钥或引入 `permanent=1/keep_login=1` 等客户端寿命参数。永久只描述密钥记录不计划到期；短期受限 Token 正常轮换，会话丢失时重新打开启动链接再次兑换。后端兑换只接受 JSON Body。
- 兑换得到短期 `_ClientType=AccessKey` Token。JWT 只保存 `MicroiAccessKeyId`，权限范围从共享数据库/Redis实时加载，不能把范围写进共享 `CurrentToken.CurrentUser`。
- 密钥权限只能收窄：帐号实时角色/菜单/行范围与 `Scopes + AllowedRoutes + AllowedTableNames + AllowedApiEngineKeys + AllowedDataSourceKeys` 取交集。检查必须位于管理员快捷放行之前。
- 默认只允许 `page:open + form:read`；`form:write/form:export/file:read/api-engine:run/data-source:run` 必须显式启用。`AllowedRoutes` 和 `AllowedTableNames` 可以使用单独值 `*` 表示“全部目标帐号已授权资源”，但检查仍必须位于管理员快捷放行之前并继续执行帐号菜单、表单、部门和行权限；旧 UI 误存的路由值 `/*` 只作为该通配值的兼容别名。`AllowedApiEngineKeys` 和 `AllowedDataSourceKeys` 必须是准确白名单，禁止 `*`。
- API 放行必须使用按 capability 分类的运行时矩阵，不能靠零散补一个报错路径：页面范围为 `*` 且具有 `page:open` 时才允许 `SysMenu/GetSysMenuStep`；指定页面密钥不得读取完整菜单树。只允许会话启动、页面元数据、表单 CRUD/导出、本人后台任务和本人终端信息等明确运行面；显示密码、密钥管理、菜单/表/字段设计、索引、缓存、服务器、其它终端管理等控制面保持拒绝。
- FormEngine 通过 action filter 对模型绑定后的 `FormEngineKey/TableName/TableId/TableIds` 逐项校验，并单独识别 `ModuleEngineKey/_ModuleEngineKey/_SysMenuId/SysMenuId`。`AllowedTableNames` 在共享数据库回源时派生为 `AllowedTableIds + AllowedFieldIds + AllowedMenuReferences`；菜单引用只收集 `DiyTableId` 位于允许范围内的 `sys_menu.Id/ModuleEngineKey`，全部放进带契约版本的短 TTL Redis 运行时缓存。解析失败必须 fail closed。这样只传表 Id 的元数据接口、只传 `_FieldId/FieldIds` 的字段 SQL/批量下拉数据接口，以及只传菜单 Id 的标准列表请求，都不能绕过表名白名单或被误拒绝。
- FormEngine 的动态友好路由（如 `GetTableData-{table-key}`、`Get-TableData-{table-key}`、`GetFormData-{table-key}` 及写入别名）必须在 API capability 鉴权前归一化。动态路由转换器与访问密钥鉴权必须复用同一个别名解析器，禁止各维护一份前缀清单；归一化只决定所需 scope，URL 后缀还必须与模型绑定后的 `FormEngineKey/TableId/ModuleEngineKey/_SysMenuId` 之一规范化一致，并再次校验准确表或菜单引用。空 Key、前后缀不一致、额外路径段和相似前缀必须拒绝。
- `ApiEngineController` 的 Run 系列即使标记了 `[AllowAnonymous]`，检测到访问密钥会话后也必须解析实际命中的引擎模型并校验准确 `ApiEngineKey`；数据源运行和后台接口任务同样校验准确 Key。禁止只在 MVC 授权过滤器中检查粗粒度路径，因为匿名兼容入口会跳过该过滤器。
- 自动登录 URL 必须携带当前 `OsClient`；前端进入 `/access-login` 时先清除 Hash 中的密钥，再用 JSON Body 兑换，并设置有限超时。禁止等待与兑换无关的 SSO 初始化导致无限加载。
- 管理操作只允许普通登录会话的本人或管理员；访问密钥会话不能创建或吊销密钥。系统账号中的管理入口必须由 `sys_menu.MoreBtns` 动态配置，并通过通用 `V8.OpenDialog` 打开预注册的 `UserAccessKeyPanel`；不得新增业务专用 `V8.OpenUserAccessKeys`，也不得在通用表格/卡片模板中按表名硬编码。按钮显隐不能代替后端逐次鉴权。
- 多节点共享 Redis 只作为短 TTL 缓存和限流；数据库是事实源，吊销主动清除缓存。不得使用 `static` 字典、本机文件或本地定时器保存密钥状态。
- 对外仍要求 HTTPS。固定终端使用独立只读帐号，不能用超级管理员帐号创建看板密钥。

验收至少覆盖：明文只返回一次、错误密钥固定时间比较、过期/吊销/停用帐号失败、指定页面成功而其它路由失败、全部页面可加载 `GetSysMenuStep`、标准与动态 `GetTableData/GetFormData` 路由均可读取允许表、仅传绑定菜单 Id 的 `ModuleEngineKey` 动态列表成功、动态写路由仍要求 `form:write`、空 Key/前后缀不一致/相似前缀/额外路径段失败、允许表名及对应表 Id/菜单 Id 成功而其它资源失败、FormEngine 设计接口仍拒绝、接口/数据源 Key 精确限制且动态/后台入口不能绕过、普通帐号权限变化即时收窄、两个 API 节点吊销一致生效。
