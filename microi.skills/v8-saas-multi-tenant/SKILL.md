---
name: v8-saas-multi-tenant
description: Microi V8 SaaS 多租户指南。用于处理 OsClient、OsClientType、OsClientNetwork、租户配置、V8.OsClientModel、隔离和租户感知代码。
---

# Microi V8 SaaS 多租户引擎

你正在为 Microi 吾码平台编写多租户（SaaS）相关代码。每个租户使用独立数据库账号；Redis、对象存储、RabbitMQ、MQTT 和搜索集群可以共享基础设施，但必须使用租户命名空间与独立服务凭据，**所有 V8 代码都在租户上下文中运行**。

## 核心概念

Microi 多租户 = **`OsClient` + `OsClientType` + `OsClientNetwork`** 三参数模型：

| 参数 | 说明 | 示例 |
|------|------|------|
| `OsClient` | 租户标识（系统Key） | `master`, `veken`, `demo` |
| `OsClientType` | 租户类型 | `Normal` / `App` / `Wechat` |
| `OsClientNetwork` | 网络环境 | `Intranet`（内网）/`Outernet`（外网） |

`master` 是平台默认主租户，新增租户在 `sys_osclient` 表中配置（由表单引擎驱动，可自由扩展配置项）。

## 上下文变量

```javascript
V8.OsClient            // 当前租户标识，如 'veken'
V8.OsClientType        // 'Normal' / 'App' / 'Wechat'
V8.OsClientNetwork     // 'Intranet' / 'Outernet'
V8.OsClientModel       // 当前租户 SaaS 配置的脱敏副本
V8.ClientModel         // OsClientModel 的兼容别名，同样是脱敏副本
V8.SysConfig           // 当前租户 sys_config 的独立脱敏副本
```

`V8.SysConfig` 与 `V8.FormEngine.GetSysConfig(...)` 不暴露 `ClientSecrets`、`PwdV8`、`GlobalServerV8Code` 或疑似凭据字段；子租户显式传其它 `OsClient` 也会被强制改回当前租户。

### V8.OsClientModel 常用字段

```javascript
V8.OsClientModel.SysTitle              // 租户系统标题
V8.OsClientModel.DbType                // 非敏感数据库类型
V8.OsClientModel.HDFS                  // 'Aliyun' / 'MinIO' / 'S3'
V8.OsClientModel.AliOssPublicDomain    // 可公开的文件域名
// 当前租户自行扩展的业务集成字段仍可读取

// 以下基础设施字段不会注入 V8：
// DbConn / DbReadConn / AuthSecret
// RedisHost / RedisPwd / MinIOSecretKey / AliOss*AccessKey*
// MQHost / MQUserName / MQPassword / MqttPwd / SearchEngineApiKey
```

## 平台级配置与主租户规则

`sys_osclients` 既保存每个租户自己的数据库、Redis、第三方密钥等配置，也可以承载影响整个 API 进程的平台级配置。平台级配置必须遵守“主租户为准、子租户只能降额隔离”的规则：

- 所有可变业务逻辑默认必须由接口引擎编排，包括但不限于租户开通、开库、初始化、归属修复、官网个人中心、付费额度等 SaaS 业务流程。C# 后端只暴露原子 V8 能力，例如建库、导入空库模板、复制 `sys_config`、刷新 SaaS 缓存、补偿回滚、字段兜底等；不要把可变业务分支写死到 Controller 或 `TenantProvisioningService` 这类后端定制代码里。接口引擎缺少能力时，优先扩展 `V8.Method`/V8 引擎原子函数，再由接口引擎调用。
- 主租户由运行环境决定：优先读取环境变量 `OsClient`，其次读取 `appsettings.json` 的 `AppSettings:OsClient`。只有这条主租户 `sys_osclients` 数据中的平台级字段会作为全局配置生效。
- 环境变量仍然拥有最高优先级，适合容器编排统一兜底；主租户 `sys_osclients` 次之，体现吾码 SaaS 引擎可配置能力；再其次才是 `appsettings.json`；最后才使用代码默认值。
- 类似 MQTT 端口、PressureGuard、V8Limits、OrmLimits、StartupLimits、SecurityGuard 这类影响整进程资源的配置，不能让每个子租户各自抬高全局上限。子租户同名隔离字段只能降低自己的并发、等待时间或资源额度，用于隔离弱租户、试用租户或异常租户。
- 修改 `sys_osclients` 的表、字段、数据源或配置值后，必须刷新 SaaS 引擎运行缓存，并回读验证字段 `Component`、`Data`、`Config`、实际数据值和前端真实消费结果。不要只看 MCP 写入成功。
- 新增平台级字段时，字段名建议保持英文稳定，例如 `PressureGlobalMaxConcurrentRequests`、`PressureV8MaxConcurrentExecutions`、`PressureOrmMaxConcurrentConnectionOpens`；字段标签和说明必须中文，说明中写清楚“主租户有效/子租户仅可降低”。
- 新租户记录不得复制主租户的数据库、鉴权、Redis/对象存储密钥或 MQ/MQTT/Search 凭据。共享基础设施地址与管理密钥只在服务端运行时解析，不持久化到子租户记录，也不进入 V8 投影。
- RabbitMQ 子租户必须使用独立 user/vhost/ACL，MQTT 必须使用独立账号密码，Search 必须使用限制到 `{osClient}_*` 的 API Key/用户。外部资源尚未真实创建时保持空凭据并失败关闭，禁止把主租户管理员凭据复制过去冒充完成。
- `V8.Cache`、`V8.HDFS`、RabbitMQ、MQTT、Search 分别强制 `Microi:{OsClient}:*`、`/{osClient}/...`、`microi.{osClient}.*`、`tenant/{osClient}/...`、`{osClient}_*` 命名空间。body/query 中的 `OsClient` 不能覆盖登录 Token 或 V8 上下文。

## 接口调用区分租户的三种方式

### 方式 1：Token 自动识别（最常用）

请求头携带 `Token`，平台自动识别用户所属租户。

```bash
GET /apiengine/get-products
Token: xxx-token-xxx
```

### 方式 2：URL 参数

```bash
GET /apiengine/get-products?OsClient=veken
```

### 方式 3：特殊 URL 格式（无 Token、无参数）

```bash
GET /apiengine/get-products--OsClient--veken--
GET /apiengine/get-products--OsClient--veken--OsClientType--App--
```

> 适用于第三方回调（无法添加 Header）、支付/微信回调等场景。

## 跨租户操作（管理员场景）

```javascript
// 主租户管理员代为操作子租户
// 1) 获取子租户的 OsClientModel
var sub = V8.FormEngine.GetFormData('sys_osclient', {
  _Where: [['OsClient', '=', V8.Param.targetOsClient]]
});
if (sub.Code !== 1) return sub;

// 2) 通过 V8.Dbs 访问子租户数据库
// （扩展数据库需要先在 SaaS 引擎中配置）
var list = V8.Dbs[sub.Data.DbAlias].FromSql('SELECT * FROM diy_xxx').ToArray();
```

## 缓存按租户隔离

```javascript
// 推荐传逻辑 Key；服务端自动添加当前租户前缀
var key = 'Product:' + V8.Param.id;
V8.Cache.Set(key, value, 600);

// 完整当前租户 Key 继续兼容
var fullKey = 'Microi:' + V8.OsClient + ':Product:' + V8.Param.id;

// 其它租户的 Microi: 前缀会被服务端拒绝
```

## 接口引擎中针对不同租户走不同逻辑

```javascript
// 主租户跳过审批，子租户走审批
if (V8.OsClient === 'master') {
  V8.FormEngine.UptFormData('Order', { Id: id, Status: 'Approved' });
} else {
  V8.WF.StartWork({ FlowDesignId: 'order-flow', TableRowId: id });
}

// App 端 vs PC 端不同返回
if (V8.OsClientType === 'App') {
  return { Code: 1, Data: simplifiedList };
}
return { Code: 1, Data: fullList };

// 内网外网走不同 ERP 网关
var erpUrl = (V8.OsClientNetwork === 'Intranet')
  ? 'http://192.168.1.10/erp/api'
  : 'https://erp.public.com/api';
```

## 第三方密钥放 OsClientModel（不要硬编码）

```javascript
// ❌ 危险：密钥写在代码里，所有租户共用，无法独立轮换
var ak = 'AKIDxxxxxxxx';

// ✅ 正确：每个租户在 sys_osclient 表中配置自己的密钥
var ak = V8.OsClientModel.WxPayMchKey;
var secret = V8.OsClientModel.WxPaySecret;
```

> 在表单引擎中给 `sys_osclients` 添加租户自有业务字段（如 `WxPayMchKey`），可通过 `V8.OsClientModel.字段名` 访问。共享基础设施字段由服务端强制移除，不能用自定义同义字段绕过安全代理。

## 用户扩展字段访问（同理）

平台 `sys_user` 也由表单引擎驱动。如给 `sys_user` 添加 `Wife` 字段：

```javascript
// V8 代码中可访问
V8.CurrentUser.Wife;

// SQL 数据源中可访问
SELECT * FROM Contact WHERE OwnerId = $CurrentUser.Id$ AND Spouse = $CurrentUser.Wife$
```

## 常见错误

❌ 绕开 `V8.Cache` 使用底层 Redis → 租户数据串号（V8 已不再暴露底层句柄）
❌ MongoDB DbName 不带 OsClient → 数据混淆  
❌ 把 OsClientModel 字段直接返回给前端 → 密钥泄漏  
❌ 在前端硬编码 OsClient → 一改全改，应通过 token/URL 自动识别  
❌ 跨租户操作不验证当前用户权限 → 越权风险  
❌ 子租户缺少 MQ/MQTT/Search 独立凭据时回退主账号 → 全平台越权

## 检查清单

- [ ] 缓存只通过 `V8.Cache` 使用逻辑 Key 或当前租户完整 Key
- [ ] 所有 MongoDB DbName 都包含 `V8.OsClient`
- [ ] 当前租户自有的业务集成密钥可放 `V8.OsClientModel`，共享 Redis/存储/MQ/MQTT/Search 凭据只能由服务端托管
- [ ] 跨租户操作前校验权限
- [ ] 不向前端返回 `V8.OsClientModel`
- [ ] 子租户数据库账号只授权本租户库，MQ/MQTT/Search 独立凭据已真实创建
- [ ] 文件、队列、Topic、索引均由服务端规范为当前租户命名空间

## Microi.AI 中转站租户凭据

- `mic_ai` 的 `Microi.AI中转站.ApiKey` 是租户调用吾码官方中转站的用户凭据。运行时不得因为该字段为空而静默创建、回退到当前用户字段或绕过校验，否则管理员无法判断真实配置来源。
- 老租户由用户在吾码官网个人中心复制 ApiKey 后填写到本租户的 `mic_ai` 中转站记录；空值应返回明确配置错误。
- 官网创建新 SaaS 租户时，必须先取得当前官网账号的 ApiKey，再由租户初始化服务写入新库 `mic_ai` 的 `Microi.AI中转站` 记录。该自动写入只发生在受控开库流程，不得散落到普通 AI 对话请求中。
- 开库入口把 ApiKey 传给后台 worker 后，worker 还必须继续显式传入最终的原子初始化方法；不能只在父接口或中间参数中“带过”。每个异步/后台边界都应对空值立即失败，避免租户创建成功但 `mic_ai.ApiKey` 静默为空。
- 自动化验收必须通过新租户 `admin` 登录回读 `mic_ai`，只输出“非空、长度、与官网账号 ApiKey 是否一致”等布尔结果，不得把真实 ApiKey 写入日志、截图或测试报告。
- 中转模型公开目录只返回模型 Id、显示名、厂商等非敏感字段，可匿名读取；严禁把官方上游模型的 ApiKey、Endpoint 私密配置随模型列表返回前端。
