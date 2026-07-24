---
name: v8-security
description: Microi V8 安全指南。用于审查接口引擎安全、密钥管理、SQL 注入、权限检查、匿名端点、文件上传安全和租户隔离。
---

# Microi V8 安全最佳实践

你正在开发 Microi 吾码平台的 V8 引擎代码，必须遵守以下安全规范。

## 0. 租户业务密钥放 OsClientModel（基础设施密钥由服务端托管）

第三方密钥（微信、支付宝、OpenAI、阿里云、ERP、SMTP）**禁止**硬编码在 V8 代码或前端。受保护的 `sys_osclients` 表可扩展租户自有业务集成字段；只有可信控制面能维护，普通角色不能通过 FormEngine 直接读写：

```javascript
// ✅ 正确
var openaiKey = V8.OsClientModel.OpenAIKey;
var wxSecret  = V8.OsClientModel.WxPaySecret;
var smtpPwd   = V8.OsClientModel.SmtpPassword;

// ❌ 危险：密钥泄漏 / 跨租户串号
var openaiKey = 'sk-xxxxxxxxxx';
```

> `V8.OsClientModel` 与兼容别名 `V8.ClientModel` 均为独立脱敏副本：数据库连接、AuthSecret、Redis、对象存储、MQ、MQTT、Search 的地址与凭据不会注入脚本。当前租户自有的微信、支付、ERP 等业务密钥仍可能存在，因此仍严禁把整个对象或单个密钥返回前端。

`V8.SysConfig` 也是独立脱敏副本，`ClientSecrets`、`PwdV8`、`GlobalServerV8Code` 及疑似 Password/Secret/Token/Key/Connection 字段不会注入脚本。子租户调用 `V8.FormEngine.GetSysConfig(...)` 时服务端会强制使用当前 `OsClient`，不能借缓存命中读取主租户配置。

共享基础设施只能通过受控能力访问：`V8.Cache` 自动绑定 `Microi:{OsClient}:*`，文件路径绑定 `/{OsClient}/...`，RabbitMQ 队列绑定 `microi.{OsClient}.*`，MQTT Topic 绑定 `tenant/{OsClient}/...`，Search 索引绑定 `{OsClient}_*`。V8 不得获得 Redis `IDatabase`、HDFS `ClientModel` 或原始基础设施配置。

子租户缺少 RabbitMQ/MQTT/Search 独立凭据时必须失败关闭，禁止回退主租户账号。新租户开通只有在外部 broker/search 中真实创建 user、vhost、ACL 或 API Key 后，才能标记对应服务可用。

登录和管理端必须强制 HTTPS。登录 RSA 只用于避免密码在请求体、代理调试界面中直接显示，不能替代 HTTPS，也不能作为身份认证或密码存储密钥。平台为兼容已发布客户、旧前端和浏览器缓存，保留历史登录 RSA 密钥对作为缺省回退；安全修复不得直接删除该回退并造成全量客户无法登录。需要部署专属密钥时，服务端通过 `MICROI_LOGIN_RSA_PRIVATE_KEY` 或受限密钥文件注入私钥，同时通过 `MICROI_LOGIN_RSA_PUBLIC_KEY` / `Security:LoginRsaPublicKey` 向匿名 `GetSysConfig` 提供匹配公钥；两端必须成对切换。源码、V8、前端业务代码和日志中仍禁止新增或输出其它真正的业务私钥、JWT 密钥、支付密钥及对象存储凭据。

吾码现有多端兼容约定是：主 SaaS 引擎 `sys_osclients.CorsAllowOrigins` 为空时默认允许全部跨域，便于本地开发、独立前端、H5 和不同租户域名访问；配置了来源后才按精确来源或通配符限制。安全修复不得把“未配置”改成默认拒绝，否则会造成所有存量部署和本地调试突然失效。CORS 不是鉴权边界，权限仍必须依赖 Token、租户隔离、菜单/表权限和服务端数据范围。

吾码既有客户大量通过 `V8.Http` 访问内网设备、InfluxDB、内部 ApiEngine 和本机 sidecar。严格 SSRF 防护必须默认关闭：未配置时不得限制协议、URL 内嵌凭据、回环、私网、链路本地、云元数据或重定向。只有客户显式设置 `SsrfProtection:Enabled=true` / `MICROI_SSRF_PROTECTION_ENABLED=true` 后才进入严格模式，并用精确 `SsrfProtection:AllowedHosts` / `MICROI_SSRF_ALLOWED_HOSTS` 放行。

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
- SaaS 配置、接口引擎、表/字段元数据、菜单角色、系统用户、任务、数据源、MQ/MQTT、页面/打印/工作流、扩展数据库等平台敏感表，对 `Level < 9999` 的通用客户端 FormEngine 硬拒绝。错误的菜单或 Table 授权不能覆盖。
- 匿名读取/新增仅适用于 `diy_table` 明确开启匿名能力的普通业务表；敏感平台表必须先于匿名开关拒绝。
- 权限 JSON、角色 Id 或菜单上下文解析失败时必须失败关闭；角色 Id 使用精确集合匹配，禁止 `Contains` 子串判断。

标准菜单模块继承菜单权限，不需要维护“角色 × 全部业务表”的巨大矩阵，也不能要求所有历史前端 V8 立即补传菜单 Id。新前端在当前表上下文应由平台 facade 自动携带真实菜单；历史无菜单请求继续由后端安全推断。【高级表权限】只用于确实没有任何菜单入口的定制页面/SDK，并按最小权限授予。

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

## 安全检查清单

- [ ] 所有数据库查询使用参数化（`_Where` 或 `@p0`）
- [ ] 把 Token 认证与表/菜单/操作授权分开；列表/写入显式菜单严格精确校验，历史唯一详情只校验同表已授权菜单访问权
- [ ] 当前表前端 facade 自动注入真实菜单，跨表不借用主菜单；可信后端 V8 由服务端标记且不要求菜单
- [ ] 敏感平台表仅限 `Level >= 9999` 的可信管理链路，Import/Export 必须携带真实菜单并有专项权限
- [ ] 菜单 `SqlWhere` / `SqlJoin` 覆盖真实列表、计数和导出查询；详情只校验同表菜单访问；主表新增/修改/删除/导入只按专项操作权限，不把查询范围带入写 SQL；行级写业务限制由后端 V8/接口引擎校验
- [ ] 授权缓存按租户使用 Redis `epoch` 和用户级快照；冷加载读主库，权限变更递增 `epoch`
- [ ] 关键操作校验 `V8.CurrentUser` 权限
- [ ] 涉及数据修改的接口校验请求参数合法性
- [ ] 敏感数据（手机号、身份证等）脱敏返回
- [ ] 密码只走平台认证/重置流程；禁止MD5/SHA直接存储，后端使用带盐自适应密码哈希
- [ ] 写操作有防重复提交机制
- [ ] 关键操作写审计日志
- [ ] catch 块不暴露内部错误给前端

### 复盘：管理员设计器和升级任务的嵌套 FormEngine 写入被误判

- 触发场景：`Level=9999` 管理员在表单设计器保存时，外层 `UptFormData`、内部 `UptDiyFieldList` 或 `AddDiyField` 返回 `NoAuth`；无 HTTP 用户的升级任务写 `sys_apiengine/sys_menu/diy_field` 也被拒绝。
- 根因：Redis 保留了旧结构的授权快照，新字段反序列化为 `0/false`；同时更新前旧记录读取或动态新增字段把已校验上下文降成裸 `JObject` / 匿名参数，丢失管理员或可信服务端来源。批量字段保存若逐字段调用完整 CRUD，还会把授权、V8 和缓存工作放大 N 倍。
- 通用规则：授权快照使用独立契约版本；内部嵌套调用必须显式传递原始客户端管理员上下文，或由真正的服务端任务构造不可伪造的强类型可信参数，不能依赖 `_InvokeType` 或 CLR/JObject 猜测。
- 自动化检查：预置缺少新字段的旧 Redis 快照后验证新版本 Key 不命中；分别覆盖管理员设计器批量字段保存/新增字段、普通用户直接写保护表被拒绝、升级程序可信写入成功，以及 HTTP JSON 伪造可信字段仍失败。
