# v8-security 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-security-005 sha256=c2bc7b1ec3ad6240b05537e1ffada3ef2e07e7a10e15102d9e3c8f777ae7ee31 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-006 sha256=ba49a1e5ea27c6cca4c78c6ee3e95a5e41032bb08f6813753bc8aa855ddfc832 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-007 sha256=60297c515c7c7b6e35cd871ab2fd7c772f8b227dfcefa0419868943213556c06 -->
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

<!-- /microi-progressive:chunk -->
