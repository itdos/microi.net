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
| `V8.Action` | 服务器全局 V8 自定义方法 |

## 调用、数据与异步

| API | 说明 |
|---|---|
| `V8.ApiEngine.Run(...)` | 同步调用接口引擎 |
| `await V8.ApiEngine.RunAsync(...)` | 请求内异步调用接口引擎 |
| `V8.FormEngine.*` | 表单 CRUD，见 `v8-crud-api` |
| `await V8.FormEngine.GetTableDataAsync(...)` | 请求内异步查列表 |
| `V8.Db`、`V8.DbRead`、`V8.DbTrans` | 主库、只读库、共享事务 |
| `V8.DbTrans.FromSql(sql)` | 在平台提供的共享事务内执行参数化 SQL |
| `V8.Dbs`、`V8.Dbs.Open(...)` | 已配置的扩展数据库 |
| `V8.MongoDb.*` | MongoDB CRUD |
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
| `V8.Method.GetCurrentToken(token,osClient)` | 读取当前 Token 对象；不透传前端 |
| `V8.Method.RefreshLoginUser(userId,osClient)` | 刷新用户登录缓存 |
| `V8.Method.ClearUserLoginInfo(userId,osClient)` | 管理员吊销用户全部终端 Token |
| `V8.Method.ConsumeIdentityVerificationTicket({Ticket,Purpose,ActionHash})` | 按当前 DiyToken 用户、租户、用途和操作摘要原子消费一次性 Passkey/人脸票据 |
| `V8.Method.GetPrivateFileUrl({FilePathName})` | 签发当前租户短期私有文件代理地址 |
| `V8.Method.Upload(options)` | 受配额限制的上传 |
| `V8.Method.AddSysLog(options)` | 结构化系统日志 |
| `V8.Method.ParseWhere(where)` | 兼容旧 Where 转换 |
| `V8.Method.UpdateBackgroundTask(options)` | 上报已提交单位的后台任务进度 |
| `V8.Method.RefreshExtensionDatabases(osClient?)` | 配置表提交后刷新全节点 `V8.Dbs` |

管理员维护、备份、清库、缓存连接管理等低层方法即使可见，也不能暴露为普通
或匿名业务 API。

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

`V8.Alipay`、`V8.AlipayV3`、`V8.WeChat`、`V8.Alidns`、`V8.System` 和
`V8.Image` 由当前 `Microi.V8Engine/V8Extend.cs` 注册。扩展可被裁剪或二次
开发，调用前以目标部署源码和编辑器定义为准。

- `V8.Alipay.CreatePay(...)` 创建支付宝支付参数；
  `V8.Alipay.Test22(...)` 是历史诊断方法，不能作为生产业务接口。
- `V8.WeChat` 当前包含签名、授权头与 AES-GCM 解密等微信支付帮助方法。
- 自定义扩展通过 `V8ExtensionRegistry.Register(name,factory)` 注册为
  `V8.<name>`；不要把某个客户的扩展名写成全平台标准能力。

支付/微信/DNS 扩展必须只读取当前租户受控凭据，调用前校验权限、金额、订单状态、
幂等键和回调签名；私钥、Secret 和原始签名材料不得进入日志或响应。

## 其它后端扩展

| 能力 | API |
|---|---|
| 缓存 | `V8.Cache.Set/Get/Remove/Exists/KeyExist/HashSet/HashGet/HashGetAll/HashDelete/HashIncrement` |
| HTTP | `V8.Http.Get/Post/Patch`、`GetResponse/PostResponse/PatchResponse` 及真实 `*Async` 版本 |
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
