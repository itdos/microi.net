# v8-security 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-security-008 sha256=dfd8dabfc7d1ecdd99283c0dd5e1d5499d76f8337eff0d9cd9b0cfcac0a9dddc -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-009 sha256=c3618f2fae953f2951195d0669f51963f5dfbc96f43b4262e4234f556935e1f7 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-010 sha256=9d8e9186a7fa3a6c85e2df8cf0d6776ca05c3eff1c97dd36424722b5880c2812 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-011 sha256=aaf4ca37e6a03ddd3520d32559e322d0d7bbba60be8aceef03d200138df77a98 -->
## 10. Jint 运行时升级边界

升级 Jint 时必须逐版阅读官方 release notes，并至少验证以下兼容面，不能只以编译通过作为验收：

- `Engine` 非线程安全；每次执行使用独立 Engine。`setTimeout` 等回调必须在当前请求内由同一 Engine 串行排空后再释放，禁止 `Task.Run` 捕获 Engine 跨线程或在响应后继续执行。需要可靠后台执行时改用 MQ、Job 或 outbox，不把进程内定时器当作持久任务。
- 重复脚本使用有上限的 `Engine.PrepareScript` 缓存；`Prepared<Script>` 可跨 Engine 复用。Promise 使用 `EvaluateAsync` / `UnwrapIfPromiseAsync` 和请求取消令牌，禁止在 ASP.NET 请求线程上使用阻塞的 `UnwrapIfPromise`。
- 内存 MB 转字节前先提升为 `long`，例如 `checked((long)mb * 1024L * 1024L)`；2GB 用 `int` 相乘会溢出并让限制失真。
- Jint 4.14 默认把 CLR 数组改为 `LiveView`，并默认缓存最近对象包装器。Microi 为兼容历史脚本显式使用 `ArrayConversionMode.Copy + CacheRecentObjectWrappers=false`；若以后切到 LiveView，必须覆盖宿主数组被 JS 修改、固定长度 push/pop 报错、`Array.isArray=false` 和重复读取身份缓存测试。
- 引擎约束必须在平台宿主对象注入完成、用户脚本执行前 `Constraints.Reset()`；同时覆盖超时、语句数、递归、内存、Promise 取消及 CLR 宿主边界返回后的再次检查。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-012 sha256=782777ed84d4030038999d74be896385365f7f3a005332558b7f5e46b17b351b -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-security-013 sha256=d87a3b8c82d4eb9c88ee5214711672f9e0684895dc3f4eca32b0278587f68426 -->
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
<!-- /microi-progressive:chunk -->
