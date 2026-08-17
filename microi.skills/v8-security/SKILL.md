---
name: v8-security
description: Microi V8 安全指南。用于审查 DiyToken 与权限、可逆业务秘密、Passkey/TOTP/人脸步进验证、接口引擎安全、密钥管理、SQL 注入、匿名端点、文件上传和租户隔离。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 安全最佳实践

你正在开发 Microi 吾码平台的 V8 引擎代码，必须遵守以下安全规范。

访问密钥由 `microi_list_my_access_keys`、`microi_create_my_access_key`、`microi_revoke_my_access_key` 管理，只允许当前用户、限期、最小 scope，明文仅创建时返回一次。外部身份回调固定为 `/api/ExternalLogin/Callback`，服务端校验租户、Provider、state、redirect 和回调域名，验证成功后仍签发 DiyToken。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-security-000 sha256=5cf3d472c04eb49aee9dc8f251bdb825b73574e046c968547e51af7c8492b9b3 -->
## 0. 租户动态系统设置与密钥边界

第三方密钥（微信、支付宝、OpenAI、阿里云、ERP、SMTP）**禁止**硬编码在 V8 代码或前端。新增租户业务配置使用当前租户数据库的 `mci_system_setting`；数据库、Redis、MongoDB、MinIO、MQ 等部署控制面仍由主库 `sys_osclients` 托管，子租户不能修改。

```javascript
// ✅ 浏览器/前端 V8 只能读取管理员明确公开的普通设置，直接位于根对象
var loginName = V8.SysConfig['Login.Gitee.Name'];

// ✅ 后端接口引擎/后端 V8 事件可读取当前租户完整配置（包括 Secret）
var clientSecret = V8.SysConfig['Login.Gitee.ClientSecret'];
// 只能在后端使用，禁止 return、日志、审计或写入前端可读数据。

// ❌ 危险：密钥泄漏 / 跨租户串号
var openaiKey = 'sk-xxxxxxxxxx';
```

`V8.OsClientModel` 与兼容别名 `V8.ClientModel` 均为独立脱敏副本：数据库连接、AuthSecret、Redis、对象存储、MQ、MQTT、Search 的地址与凭据不会注入脚本。存量租户业务字段只作兼容，新增 Secret 不得继续依赖 `V8.OsClientModel`。

`V8.SysConfig` 按运行端采用不同权限投影，且任何运行端都不存在 `PublicSettings` 属性。浏览器/前端 V8 只得到匿名 `GetSysConfig` 的独立脱敏副本；当前租户 `mci_system_setting` 中 `IsPublic=1` 的普通设置直接平铺到根对象，Secret 或 Key 命中 Password、Secret、Token、Credential、PrivateKey、AccessKey、ApiKey、ConnectionString、DbConn、Redis、MinIO、ClientSecret 等敏感片段时永远失败关闭。后端接口引擎和后端 V8 事件得到当前租户完整、独立的 `sys_config`，并在根对象中获得全部启用的 `mci_system_setting`，Secret 由可信后端按租户解密。子租户调用 `V8.FormEngine.GetSysConfig(...)` 时仍强制使用当前 `OsClient`，不能借缓存命中读取其它租户配置。

Secret 只通过租户管理员专用端点写入租户绑定的认证密文。列表不返回密文或原文；临时显示必须消费 Passkey/TOTP/严格人脸一次性票据，设置 `no-store`，30 秒清除，审计不含原文。前端 V8、普通 FormEngine HTTP、匿名请求和访问密钥会话不得读取 `SecretCipher` 或 Secret 原文；后端 V8 只能通过当前租户 `V8.SysConfig[ConfigKey]` 使用已解密值，不获得通用解密器，也不得返回或记录原文。

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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-001 sha256=c5868fd8a159b72f1038658873dfee83a9eca68661eebd837ecadab13dea5c22 -->
## 0.5 接口引擎配置安全

代码以外，接口本身的配置项也是安全防线（详见 `v8-api-config/SKILL.md`）：

| 配置 | 何时开启 |
|------|---------|
| `IsAnonymous = false` | 非公开接口默认关闭，防止匿名调用越权 |
| `StopHttp = true` | 内部接口（核心扣款、内部计算）防止外部直接 HTTP 调用 |
| `LockKey = ...` | 写操作类接口（对账、补单）防止并发执行 |
| `RateLimit = 60/m` | 公开接口（验证码、登录）防爬虫 |
| `LogParam = true` | 支付/审计类接口记录请求 |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-002 sha256=ed6c3fabf36da5a359778a0e7d085aa9b0d8a2f55337c0c9a1d39da4d72bac95 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-003 sha256=8813dffa5c5c4c8816abddf3628579d474fe02137504d6c909f36303d4692560 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-004 sha256=e811dff8614c24c751291dda271b1574debccf741c0e166790f5324a3d3594ad -->
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

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-2-权限校验.md](references/progressive-01-2-权限校验.md)：2. 权限校验；5. 防重复提交；6. 敏感数据
- [references/progressive-02-7-日志记录.md](references/progressive-02-7-日志记录.md)：7. 日志记录；8. 错误处理；9. Token、终端会话与租户隔离；10. Jint 运行时升级边界；安全检查清单；浏览器访问密钥
<!-- microi-progressive:end -->
