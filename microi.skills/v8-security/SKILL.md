---
name: v8-security
description: Microi V8 安全指南。用于审查接口引擎安全、密钥管理、SQL 注入、权限检查、匿名端点、文件上传安全和租户隔离。
---

# Microi V8 安全最佳实践

你正在开发 Microi 吾码平台的 V8 引擎代码，必须遵守以下安全规范。

## 0. 租户业务密钥放 OsClientModel（基础设施密钥由服务端托管）

第三方密钥（微信、支付宝、OpenAI、阿里云、ERP、SMTP）**禁止**硬编码在 V8 代码或前端。`sys_osclient` 表由表单引擎驱动，可自由扩展配置项，按租户独立配置：

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

存入数据库前过滤危险字符：

```javascript
function sanitizeHtml(str) {
  if (!str) return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

V8.FormEngine.AddFormData('Comment', {
  Content: sanitizeHtml(V8.Param.content),
  UserId: V8.CurrentUser.Id
});
```

## 5. 防重复提交

```javascript
var lockKey = 'submit:' + V8.CurrentUser.Id + ':' + V8.Param.formKey;
if (V8.Cache.Exists(lockKey)) {
  return { Code: 0, Msg: '请勿重复提交' };
}
V8.Cache.Set(lockKey, '1', 5);  // 5 秒内不可重复

try {
  // 执行业务逻辑
  var result = V8.FormEngine.AddFormData('Order', { ... });
  return { Code: 1, Data: result.Data };
} finally {
  V8.Cache.Remove(lockKey);
}
```

## 6. 敏感数据

### 密码加密存储

```javascript
// 存储时加密
var encryptedPwd = V8.EncryptHelper.MD5Encrypt(V8.Param.password);
V8.FormEngine.AddFormData('SysUser', {
  Account: V8.Param.account,
  Password: encryptedPwd
});

// 验证密码
var user = V8.FormEngine.GetFormData('SysUser', {
  _Where: [['Account', '=', V8.Param.account]]
});
if (!user.Data || user.Data.Password !== V8.EncryptHelper.MD5Encrypt(V8.Param.password)) {
  return { Code: 0, Msg: '账号或密码错误' };
}
```

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
if (!V8.CurrentUser || (!V8.CurrentUser._IsAdmin && Number(V8.CurrentUser.Level || 0) < 9999)) {
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
  // 记录完整错误日志
  console.error('查询失败: ' + ex.message + ' | 参数: ' + JSON.stringify(V8.Param));
  // 返回给前端的信息不含内部细节
  return { Code: 0, Msg: '查询失败，请稍后重试' };
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
- [ ] 关键操作校验 `V8.CurrentUser` 权限
- [ ] 涉及数据修改的接口校验请求参数合法性
- [ ] 敏感数据（手机号、身份证等）脱敏返回
- [ ] 密码使用加密存储，不存明文
- [ ] 写操作有防重复提交机制
- [ ] 关键操作写审计日志
- [ ] catch 块不暴露内部错误给前端
