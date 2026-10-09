---
name: v8-utilities
description: Microi V8 全局对象、上下文变量和通用函数索引。用于查询某个 V8 函数是否存在、区分前端与后端 API，或使用 V8.Method、Base64、EncryptHelper、V8.WeChat、Action、CurrentUser、SysConfig、OsClient、扫码和客户端导航工具。
---

> **Microi吾码基础规范（强制）：** 任何 AI 模型与宿主每次新建或接续吾码任务，先完整读取 `../workspace-conventions/SKILL.md`，必须执行版本播报、`@microi.net/cli` 后台自动升级、Skills/MCP 同步和进度播报。安装与诊断读取 `../microi-codex-installer/SKILL.md`；更新失败延后重试，不阻断当前工作。

# Microi V8 通用能力与函数索引

本 Skill 是 V8 能力的路由入口，不替代 CRUD、HTTP、缓存、文件、图片、Office、
工作流等专项 Skill。遇到“吾码有没有某个函数”“这个 API 在前端还是后端”
或官网函数列表同步任务时，先在这里确定运行端和正式名称，再读取专项 Skill。

## 先判断运行端

| 运行端 | 典型位置 | API 特征 |
|---|---|---|
| 前端 | 字段事件、按钮、列表、InFormV8、SubmitFormV8、OutFormV8 | 浏览器 Promise/回调、弹窗、路由、`V8.Print`、扫码 |
| 后端 | 接口引擎、SubmitBeforeServerV8、SubmitAfterServerV8、DataFilterV8 | `V8.Db`、事务、缓存、Office、加密、服务端 HTTP |

同名对象不保证两端方法一致。例如前端 `V8.Base64.encode/decode` 与后端
`V8.Base64.StringToBase64/Base64ToString` 不同；前端标准运行时没有公开
`V8.ModuleEngine`，后端才有模块引擎对象。

## 必读索引

- 前端全部上下文、表单/列表、导航、网络、引擎和工具：
  `references/client-api-index.md`
- 后端上下文、`V8.Method`、Base64、加密、异步与扩展对象：
  `references/server-api-index.md`
- 平台 HTTP 路由、动态路由与管理接口边界：
  `references/platform-http-routes.md`
- 蓝牙标签/小票打印：
  `../v8-frontend-events/references/bluetooth-print.md`

若函数未出现在上述索引或当前源码定义中，不得按名字猜测。先搜索
`Microi.Client/src/views/form-engine/diy-components/v8-api-definitions.js`、
`v8-api-server-definitions.js`、V8 宿主接口和官网中文函数列表。

邮箱相关能力读取 [email-engine](../email-engine/SKILL.md)：`V8.Email` 包含
`ProtectCredential / TestConnection / ListFolders / Fetch / Inspect / GetMessage /
GetAttachment / SetFlags / Move / Send / StoreSent`。
业务使用 `mci-email` 接口引擎，MCP 使用 `microi_email_query / microi_email_manage / microi_email_send`。

## 常用通用写法

```javascript
// 两端通用的租户/用户上下文，具体字段按当前上下文判空
var osClient = V8.OsClient;
var userId = V8.CurrentUser && V8.CurrentUser.Id;

// 后端稳定标识与时间
var id = V8.Method.NewUlid();
var now = DateNow('yyyy-MM-dd HH:mm:ss');
var timestamp = V8.Method.GetTimestamp();

// 后端 Base64
var encoded = V8.Base64.StringToBase64('吾码');
var decoded = V8.Base64.Base64ToString(encoded);

// 前端 Base64
var clientEncoded = V8.Base64.encode('吾码');
var clientDecoded = V8.Base64.decode(clientEncoded);
```

## 能力选择

- 日期基础函数由新版后端运行时自举，不能要求租户先配置 DateNow 才能安装应用。全局函数管理使用系统设置子表 `mci_global_function`，按 `SysConfigId + Runtime(Client/Server) + FunctionName` 隔离，一行一个同名 function 声明；用 `V8.Method.ValidateGlobalFunction` 只解析验证，不执行源码。
- 原有前后端全局 V8 必须保留，合并顺序为内置日期、函数库、租户原有代码；同名原有函数优先。不得用官方全局脚本整段覆盖客户脚本。函数库种子 `InsertIfMissing`，不得升级覆盖客户已改源码。
- 列表和合并代码走 L1/Redis，表单引擎真实提交后更新租户版本并通知其它节点；回滚不变更版本。禁止通过直接 SQL 修改函数库规避失效。前端已打开页面需要刷新。

## 受信固定步长运行时发现

`V8.Method.RunPlatformApiRuntime({RuntimeKey:'fixed-step-simulation',Action,Param})` 属于需后端正式安装的通用原子。动作是 DescribeInvocation/CreateInitialState/AdvanceBatch/Project/ObserveOwnedRoom/StopOwnedRoom/DrainOwnedRoom；精确引擎Key由后台已审批目录限制，不能用通用private转发接口原样接受玩家信封。Param只能承载经接口引擎授权后的数据，不能指定Tenant/EngineKey/NodeId/客户端时钟作为真实上下文。Observe是提交前有界调度提示，后续须重新核DB，不是提交回执；终局用Drain保留当前请求提交机会，Stop则立即取消。规则程序集入口与hash须由私有后端发行组合固定，V8/MCP不提供上传即执行的注册能力。详细边界见unity-integration及后端V8主文档；线上缺原子时明确未安装，不能用Job/SignalR冒充。

固定步运行时的临时拒绝仅使用 `DataAppend.ErrorCode` 六码白名单：KernelBusy/HostMemoryPressure/RoomStillDraining/CoordinatorStopping/StaleLease/ComputeBudgetExceeded，并要求 `Retryable===true`。Managed须显式catch-return稳定Code0并回滚，客户端有界同键重试；禁止按中文Msg或带行号异常猜测重试，更不能把授权/来源/未知失败当临时成功。此兼容扩展不增加审批表/配置或MCP任意注册入口。

普通租户的编译证明默认 `TenantInstallation`，保留真实 Installed 回执及旧摘要。官方同租户发布源禁止安装自己，只能由后端发行组合明确固定 `OfficialPublishedSnapshot`：`InstallRecordId` 绑定 `mic_data_version.Id`，原始 `Data` 的UTF-8 SHA-256另固定于编译回执并参与独立审批摘要。该类别与快照摘要不从Param或自由表字段选择、不新增表字段、不伪造Installed。受信官方身份、当前Published/审批有效指针、Verified包hash/size/HDFS、不可变快照、V3 Completed源码hash及实际DLL依赖须全部匹配；当前状态变化、软删或主库不可用下次调用立即拒绝，旧历史存在不足以授权。跨租户仍拒绝，结构发布不等于后端安装或代码审批。审批表纳入通用强制管理员清单，普通用户即使误授表/菜单权限仍不得改授权状态；V8Limit和ReadPrimary不是写权限。

## 平台兼容入口索引

下列旧 HTTP 地址仍由受控兼容链路识别，不能据此绕过 DiyToken、租户或权限校验：`/api/FormEngine/GetSysConfig`、`/api/Os/GetDateTimeNow`、`/api/SysLog/AddSysLog`、`/api/SysUser/`。畅捷通 V2 回调在接口引擎中编排，可信后端只提供当前租户绑定的 `V8.Method.DecodeChanjetCallbackV2` 原子。

| 需求 | 专项 Skill |
|---|---|
| 表单 CRUD、`_Where` | `v8-crud-api`、`v8-sql-query` |
| HTTP/第三方接口 | `v8-http-integration` |
| TCP 原始字节/网络小票机/设备 | `v8-tcp-integration` |
| Redis/Hash | `v8-cache-pattern` |
| 文件/HDFS | `v8-file-upload` |
| 图片 | `v8-image-processing` |
| Excel/Word/PPT/邮件 | `v8-export-import` |
| 微信支付签名、授权头、API v3 AES-GCM 解密 | `references/server-api-index.md`；安全边界见 `v8-security` |
| 前端事件/打印/扫码 | `v8-frontend-events` |
| 后端表单事件 | `v8-table-event` |
| 接口配置/流式响应/异步/后台任务 | `v8-api-config` |

## 不可越过的边界

- 平台能力优先使用 `V8.*`，不要假设全局 `System` 可访问任意 CLR 类型。
- `V8.SysConfig`、`V8.OsClientModel`、`V8.ClientModel` 可能含连接串、密钥和供应商配置，不直接返回前端或写日志。
- 摘要算法不是密码存储。新密码不使用 MD5/SHA1/SHA256 直接保存。
- `setTimeout`、`Task.Run` 不能承担请求返回后的可靠后台执行。
- 前端值只可用于交互；权限、事务和最终业务校验必须在可信后端执行。
