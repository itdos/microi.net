---
name: v8-utilities
description: Microi V8 全局对象、上下文变量和通用函数索引。用于查询某个 V8 函数是否存在、区分前端与后端 API，或使用 V8.Method、Base64、EncryptHelper、Action、CurrentUser、SysConfig、OsClient、扫码和客户端导航工具。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

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

| 需求 | 专项 Skill |
|---|---|
| 表单 CRUD、`_Where` | `v8-crud-api`、`v8-sql-query` |
| HTTP/第三方接口 | `v8-http-integration` |
| TCP 原始字节/网络小票机/设备 | `v8-tcp-integration` |
| Redis/Hash | `v8-cache-pattern` |
| 文件/HDFS | `v8-file-upload` |
| 图片 | `v8-image-processing` |
| Excel/Word/PPT/邮件 | `v8-export-import` |
| 前端事件/打印/扫码 | `v8-frontend-events` |
| 后端表单事件 | `v8-table-event` |
| 接口配置/异步/后台任务 | `v8-api-config` |

## 不可越过的边界

- 平台能力优先使用 `V8.*`，不要假设全局 `System` 可访问任意 CLR 类型。
- `V8.SysConfig`、`V8.OsClientModel`、`V8.ClientModel` 可能含连接串、密钥和供应商配置，不直接返回前端或写日志。
- 摘要算法不是密码存储。新密码不使用 MD5/SHA1/SHA256 直接保存。
- `setTimeout`、`Task.Run` 不能承担请求返回后的可靠后台执行。
- 前端值只可用于交互；权限、事务和最终业务校验必须在可信后端执行。
