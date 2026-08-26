# 后端 V8 API 索引

本索引对应接口引擎和后端表单事件。专项 API 的完整模板仍以相应 Skill 为准。

## 请求与执行上下文

| API/变量 | 说明 |
|---|---|
| `V8.Param`、`V8.Header` | URL、Form、JSON 参数与请求头 |
| `V8.CurrentUser` | 当前可信用户；匿名接口可能为空 |
| `V8.OsClient` | 当前租户 |
| `V8.SysConfig` | 系统配置；可能含敏感项，不直接返回 |
| `V8.OsClientModel`、`V8.ClientModel` | 租户配置兼容别名；严禁泄露连接串/密钥 |
| `V8.Form`、`V8.OldForm` | 后端表单事件的新旧数据 |
| `V8.FormSubmitAction` | `Add/Upt/Del` |
| `V8.EventName`、`V8.InvokeType` | 事件名与 Server/Client 调用来源 |
| `V8.TableModel`、`V8.TableData` | 当前表模型/行数据 |
| `V8.RowIndex`、`V8.CacheData`、`V8.NotSaveField` | DataFilter 等事件上下文 |
| `V8.LineValue`、`V8.NextNodeId`、`V8.WF` | 工作流路线与节点上下文 |
| `V8.FilesByteBase64` | 上传文件 Base64 字典 |
| `V8.Limits` | 当前 Jint 资源预算与调用深度 |
| `V8.Stream` | 仅 `ResponseType=Stream` 的接口引擎可用；SSE/NDJSON 暂态分片写入器 |
| `V8.Action` | 服务器全局 V8 自定义方法 |

## 调用、数据与异步

| API | 说明 |
|---|---|
| `V8.ApiEngine.Run(...)` | 同步调用接口引擎 |
| `await V8.ApiEngine.RunAsync(...)` | 请求内异步调用接口引擎 |
| `V8.Stream.Write(data,eventName?,id?)` | 同步写一个受大小限制的暂态流式分片 |
| `await V8.Stream.WriteAsync(data,eventName?,id?)` | 等待网络背压后写暂态分片；每次检查返回 `Code` |
| `V8.FormEngine.*` | 表单 CRUD，见 `v8-crud-api` |
| `await V8.FormEngine.GetTableDataAsync(...)` | 请求内异步查列表 |
| `V8.Db`、`V8.DbRead`、`V8.DbTrans` | 主库、只读库、共享事务 |
| `V8.DbTrans.FromSql(sql)` | 在平台提供的共享事务内执行参数化 SQL |
| `V8.Dbs`、`V8.Dbs.Open(...)` | 已配置的扩展数据库 |
| `V8.MongoDb.*` | MongoDB CRUD；`UptFormDataByWhere` / `DelFormDataByWhere` 强制参数化非空 `_Where`，禁止更新 `_id`，绑定当前 V8 租户，且不参与 `V8.DbTrans` |
| `V8.DataSourceEngine` | 当前租户数据源引擎对象 |
| `V8.DataSourceEngine.Run(...)`、`V8.DataSourceEngine.RunAsync(...)` | 同步/请求内异步运行数据源 |
| `V8.ModuleEngine` | 后端模块模型能力；不能绕过用户模块权限 |
| `V8.ModuleEngine.GetTableData(...)` | 按 `ModuleEngineKey` 应用模块关联表配置查询 |

接口引擎返回后宿主上下文会释放。只在真实 `*Async` 方法上使用 `await`；
脱离请求的工作使用后台任务、Job、MQ 或 outbox。

## V8.Method

| API | 说明 |
|---|---|
| `V8.Method.NewGuid()`、`V8.Method.NewUlid()` | 生成标识 |
| `V8.Method.GetTimestamp()` | Unix 秒时间戳 |
| `V8.Method.GetBackendVersion()` | 当前 Microi.Core 运行程序集的公开发行版本，格式 `vX.Y.Z`；固定匿名健康接口使用，不返回路径或主机信息 |
| `V8.Method.GetCurrentToken(token,osClient)` | 读取当前 Token 对象；不透传前端 |
| `V8.Method.RefreshLoginUser(userId,osClient?,token?)` | 刷新登录投影；租户取当前 V8/已认证 DiyToken（可信宿主须建立用户+租户作用域），显式 OsClient 仅作一致性断言；普通用户仅本人，同租户超级管理员主库复核后可跨用户。第三参仅兼容历史 `microi-init` 的原始 Token，宿主重新验证且只允许 Token 本人；返回对象、访问密钥、空身份和跨租户均拒绝 |
| `V8.Method.ClearUserLoginInfo(userId,osClient)` | 管理员吊销用户全部终端 Token |
| `V8.Method.GetDirectTableGrantPolicies()` | 读取平台表直连授权策略；仅供可信角色表单事件做最终校验 |
| `V8.Method.ConsumeIdentityVerificationTicket({Ticket,Purpose,ActionHash})` | 按当前 DiyToken 用户、租户、用途和操作摘要原子消费一次性 Passkey/TOTP/人脸票据 |
| `V8.Method.GetPrivateFileUrl({FilePathName})` | 签发当前租户短期私有文件代理地址 |
| `V8.Method.ResolveOsClientByDomain(domain)` | 仅允许官方 `platform-os-client-by-domain` 调用；返回最小 OsClient 投影 |
| `V8.Method.GetPublicSysConfig(lang?)` | 仅允许官方 `platform-sys-config` 调用；返回浏览器安全系统设置投影 |
| `V8.Method.GetLangBundle(lang?,prefix?)` | 仅允许官方 `platform-lang-bundle` 调用；读取当前租户词条包 |
| `V8.Method.GetLoginWallpapers()` | 仅允许官方 `platform-login-wallpapers` 调用；固定读取当前租户最多 200 条启用壁纸的 `Id/Name/Category/ImgUrl`，不开放通用匿名表权限 |
| `V8.Method.GetLegacyInitMenuTree(rawToken, osClient?)` | 仅允许官方 `microi-init` 调用；重新验证请求体原始 DiyToken、拒绝访问密钥与跨租户请求，并按当前角色返回权威菜单树 |
| `V8.Method.GetAuthorizedPrivateFileUrl(options)` | 仅允许官方 `platform-private-file-url` 调用；重算菜单、行、字段与文件引用授权 |
| `V8.Method.AuthorizeCurrentUserTenantProvisioning()` | 仅允许官方 `platform-create-tenant` 在 Before Hook 前校验主租户普通登录会话 |
| `V8.Method.ProvisionCurrentUserTenant(options)` | 仅允许官方 `platform-create-tenant` 调用；所有者、手机号、姓名和密码材料从可信当前用户派生 |
| `V8.Method.PrepareCurrentUserProfileUpdate(options)` | 仅允许官方 `platform-user-update-profile` 调用；固定当前用户并规范当前租户头像路径 |
| `V8.Method.ManageSysUserAdmin(options)` | 仅允许官方 `platform-sys-user-admin` 调用；固定身份与租户并执行表权限、角色层级、改密 step-up、内容安全及会话安全边界；授权预检返回规范化 `DataAppend.ChangesPassword` |
| `V8.Method.AuthorizeOfficialResourcePublish()` | 仅允许官方 `get-microi-upgrade-resource` 的发布分支调用；固定 `iTdos`、拒绝访问密钥并从主库复核平台管理员；不是通用授权 API |
| `V8.Method.SendWeChatTemplateMessage(options)` | 仅允许消息通知官方 Managed 接口 `wechat_send_tpl_msg` 调用；公众号 AppId/AppSecret 固定从当前租户 `wx_mp` 读取且不进入 V8，脚本只编排接收人、模板、受限模板字段和跳转地址 |
| `V8.Method.ValidateTenantSystemSettingsOperation(options)` | 仅允许官方 `platform-tenant-system-settings` 调用；拒绝访问密钥、非管理员、Secret/Sensitive Key 和已迁移公开 Key |
| `V8.Method.GetTenantSystemSettingsSecurityProjection()` | 仅允许官方 `platform-tenant-system-settings` 调用；只返回 Secret 是否已配置与迁移 Key，不返回值或密文 |
| `V8.Method.Upload(options)` | 受配额限制的上传 |
| `V8.Method.UploadText(options)` | 直接上传当前租户 UTF-8 文本，避免 Base64 膨胀；仍执行安全文件名、扩展名、HDFS、配额与 256 MB 文本上限 |
| `V8.Method.AddSysLog(options)` | 结构化系统日志 |
| `V8.Method.ParseWhere(where)` | 兼容旧 Where 转换 |
| `V8.Method.UpdateBackgroundTask(options)` | 上报已提交单位的后台任务进度 |
| `V8.Method.RefreshExtensionDatabases(osClient?)` | 配置表提交后刷新全节点 `V8.Dbs` |

管理员维护、备份、清库、缓存连接管理等低层方法即使可见，也不能暴露为普通
或匿名业务 API。

以上启动、文件、系统账号和租户设置 `platform-*` 原子都是固定 Managed 接口的可信宿主边界，不是普通业务脚本可复用的快捷方法。官网客户端调用对应 `/apiengine/platform-*` 路由；旧 Controller 只保留旧版本兼容。登录壁纸原子不要求 `diy_wallpaper.IsAnonymousRead=1`，也不允许租户 Hook 参与匿名请求。租户个性化逻辑写入应用声明的 `CreateIfMissing` Hook，禁止直接修改会被官方安装或更新恢复的 Managed 接口。密码、DiyToken、Secret 保存和 Reveal 仍属于 C# 可信边界。

旧客户端兼容路由 `/api/SysUser/UpdateMyDefaultIndexUrl`、`/api/SysUser/UpdateCurrentProfile` 和 `/api/TenantSystemSettings/List` 只固定转发上述 Managed 接口；新客户端不得继续以 Controller 作为业务事实源。

## Base64 与加密

```javascript
var encoded = V8.Base64.StringToBase64('吾码');
var decoded = V8.Base64.Base64ToString(encoded);

var des = V8.EncryptHelper.DESEncode('legacy-value');
var plain = V8.EncryptHelper.DESDecode(des);
var sha1 = V8.EncryptHelper.SHA1('legacy-value');
var sha256 = V8.EncryptHelper.SHA256('text');
var sha512 = V8.EncryptHelper.SHA512('text');
var hex = V8.EncryptHelper.Sha256Hex('text');
var signature = V8.EncryptHelper.HmacSha256(secretFromConfig, payload);
```

`V8.EncryptHelper` 是后端加密/摘要帮助对象。完整入口：
`V8.EncryptHelper.MD5Encrypt`、`V8.EncryptHelper.SHA1`、
`V8.EncryptHelper.SHA256`、`V8.EncryptHelper.SHA512`、
`V8.EncryptHelper.Sha256Hex`、`V8.EncryptHelper.HmacSha256`、
`V8.EncryptHelper.AESEncrypt`、`V8.EncryptHelper.AESDecrypt`、
`V8.EncryptHelper.DESEncode`、`V8.EncryptHelper.DESDecode`。

DES 只用于明确要求取回原文的兼容业务秘密；保存和显示都在可信后端完成，列表掩码、独立授权、`no-store` 且审计不含明文。登录密码不使用摘要或可逆加密的新设计，完整分级见 `v8-security/SKILL.md`。

MD5/SHA1 仅为兼容摘要；任何摘要都不能直接作为新密码存储方案。AES/DES/HMAC
密钥从受控配置读取，不硬编码、不写日志、不返回客户端。

## 内置与自定义扩展

`V8.Alipay`、`V8.AlipayV3`、`V8.WeChat`、`V8.Alidns`、`V8.System`、
`V8.Image` 和 `V8.Tcp` 由当前 `Microi.V8Engine/V8Extend.cs` 注册。扩展可被裁剪或二次
开发，调用前以目标部署源码和编辑器定义为准。

- `V8.Alipay.CreatePay(...)` 创建支付宝支付参数；
  `V8.Alipay.Test22(...)` 是历史诊断方法，不能作为生产业务接口。
- `V8.WeChat` 当前包含签名、授权头与 AES-GCM 解密等微信支付协议原子，
  精确边界见下节。
- 自定义扩展通过 `V8ExtensionRegistry.Register(name,factory)` 注册为
  `V8.<name>`；不要把某个客户的扩展名写成全平台标准能力。

支付/微信/DNS 扩展必须只读取当前租户受控凭据，调用前校验权限、金额、订单状态、
幂等键和回调签名；私钥、Secret 和原始签名材料不得进入日志或响应。

### V8.WeChat 微信支付最小协议原子

| API | 说明 |
|---|---|
| `V8.WeChat.AesGcmDecrypt(associatedData, nonce, ciphertext, apiV3Key)` | 解密微信支付 API v3 `resource`，同时认证密文尾部 GCM 标签 |
| `V8.WeChat.GetWeChatSign(privateKeyPem, paramList)` | 按参数顺序和换行规则生成 SHA256-RSA2048 Base64 签名 |
| `V8.WeChat.GetWeChatAuthorization(mchid, serialNo, privateKeyPem, wxApiAddress, body)` | 为 `POST` 请求生成 `WECHATPAY2-SHA256-RSA2048` Authorization 值；路径和 Query 必须与真实请求一致 |

`AesGcmDecrypt` 的四个参数具有不同编码，不能统一按 Base64 处理：

| 参数 | 必须采用的编码 |
|---|---|
| `apiV3Key` | 商户 APIv3 密钥原文的 UTF-8 字节，必须恰好 32 字节 |
| `nonce` | `resource.nonce` 原文的 UTF-8 字节，必须恰好 12 字节；**不是 Base64** |
| `associatedData` | `resource.associated_data` 原文的 UTF-8 字节；缺省时使用空字节串 |
| `ciphertext` | 唯一需要 Base64 解码的参数；解码结果是“密文 + 尾部 16 字节 GCM 标签”，必须完整交给解密器 |

禁止把 `nonce` 改为 Base64 解码，也不要增加“UTF-8/Base64 两种 nonce 都接受”的
模糊兼容分支。`AesGcmDecrypt` 只完成资源解密与 GCM 完整性认证，不等于微信支付
HTTP 回调签名验证；必须先使用原始请求体和 `Wechatpay-*` 请求头完成平台签名验证。

该对象保持最小协议原子：C# 只承担路由、原始报文、可信验签、租户恢复和密钥隔离等
V8 无法安全表达的边界；订单/退款状态、商户与金额复核、幂等、事务、日志、通知和
outbox 编排放在接口引擎。密钥从当前租户 `V8.SysConfig.ServerPrivateSettings` 等受控
私密配置读取，不写进 V8 源码、请求参数、日志或响应。

回归测试至少覆盖：微信支付官方固定向量可解密、篡改密文或标签必然认证失败，以及
真实 Jint 表达式 `V8.WeChat.AesGcmDecrypt(...)` 可调用；只直接测试 C# 方法不算完成。

## 其它后端扩展

| 能力 | API |
|---|---|
| 缓存 | `V8.Cache.Set/Get/Remove/Exists/KeyExist/HashSet/HashGet/HashGetAll/HashDelete/HashIncrement` |
| HTTP | `V8.Http.Get/Post/Patch`、`GetResponse/PostResponse/PatchResponse` 及真实 `*Async` 版本 |
| TCP | `V8.Tcp.Send/SendAsync/SendAndReceive/SendAndReceiveAsync`；原始字节与出站安全见 `v8-tcp-integration` |
| 图片 | `V8.Image.Create/Merge/Overlay/Watermark/Resize/Crop/Rotate/Flip/Draw/Convert/GetInfo/CreateQRCode` |
| Office | `V8.Office.ExportExcel/ExcelToList/ExportWord/ExportPowerPoint/SendEmail` |
| OCR | `await V8.OCR.Recognize({...})`；服务端租户配置与调用参数隔离，详见 `ocr-engine` |
| 文件 | `V8.HDFS`、`V8.Method.Upload/GetPrivateFileUrl` |
| MQ | `V8.MQ.SendMsg` |
| 短信 | `V8.Sms.Send` |
| 翻译 | `V8.TranslateEngine.Translate` 与语言缓存方法 |
| 爬虫 | `V8.Spider` |
| 主机监控 | `V8.System`，仅管理员/运维 |
| 工作流 | `V8.WFEngine`、事件中的 `V8.WF` |

## 全局函数与 CLR 边界

| 函数 | 说明 |
|---|---|
| `DateNow(format)` | 当前时间字符串 |
| `DateFormat(value,format)` | 格式化日期 |
| `DateAdd(value,unit,amount,format)` | 日期加减 |
| `console.log/error/warn/info` | 服务端日志，必须脱敏限长 |

平台能力优先使用 `V8.*`。不要依赖任意全局 `System` CLR 访问；平台还存在
`V8.System` 主机监控对象，两者不是一回事。
