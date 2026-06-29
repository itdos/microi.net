---
name: v8-saas-multi-tenant
description: Microi V8 SaaS 多租户指南。用于处理 OsClient、OsClientType、OsClientNetwork、租户配置、V8.OsClientModel、隔离和租户感知代码。
---

# Microi V8 SaaS 多租户引擎

你正在为 Microi 吾码平台编写多租户（SaaS）相关代码。SaaS 引擎为每个租户配置独立的数据库、Redis、MQ、存储、第三方密钥等，**所有 V8 代码都在租户上下文中运行**。

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
V8.OsClientModel       // 当前租户敏感配置对象（数据库、密钥等，仅服务端可访问）
```

### V8.OsClientModel 常用字段

```javascript
V8.OsClientModel.SysTitle              // 租户系统标题
V8.OsClientModel.DbType                // 'MySql' / 'Oracle' / 'SqlServer'
V8.OsClientModel.DbConnString          // 主库连接串
V8.OsClientModel.DbReadConnString      // 从库连接串
V8.OsClientModel.RedisHost / RedisPort
V8.OsClientModel.MQHost / MQUserName / MQPassword
V8.OsClientModel.HDFSStorageType       // 'Aliyun' / 'MinIO' / 'AmazonS3'
V8.OsClientModel.AliyunOSSAccessKeyId
V8.OsClientModel.AliyunOSSAccessKeySecret
// ... 任何用户在 sys_osclient 表中扩展的字段
```

## 平台级配置与主租户规则

`sys_osclients` 既保存每个租户自己的数据库、Redis、第三方密钥等配置，也可以承载影响整个 API 进程的平台级配置。平台级配置必须遵守“主租户为准、子租户只能降额隔离”的规则：

- 主租户由运行环境决定：优先读取环境变量 `OsClient`，其次读取 `appsettings.json` 的 `AppSettings:OsClient`。只有这条主租户 `sys_osclients` 数据中的平台级字段会作为全局配置生效。
- 环境变量仍然拥有最高优先级，适合容器编排统一兜底；主租户 `sys_osclients` 次之，体现吾码 SaaS 引擎可配置能力；再其次才是 `appsettings.json`；最后才使用代码默认值。
- 类似 MQTT 端口、PressureGuard、V8Limits、OrmLimits、StartupLimits、SecurityGuard 这类影响整进程资源的配置，不能让每个子租户各自抬高全局上限。子租户同名隔离字段只能降低自己的并发、等待时间或资源额度，用于隔离弱租户、试用租户或异常租户。
- 修改 `sys_osclients` 的表、字段、数据源或配置值后，必须刷新 SaaS 引擎运行缓存，并回读验证字段 `Component`、`Data`、`Config`、实际数据值和前端真实消费结果。不要只看 MCP 写入成功。
- 新增平台级字段时，字段名建议保持英文稳定，例如 `PressureGlobalMaxConcurrentRequests`、`PressureV8MaxConcurrentExecutions`、`PressureOrmMaxConcurrentConnectionOpens`；字段标签和说明必须中文，说明中写清楚“主租户有效/子租户仅可降低”。

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
// ✅ 必须在 Key 中包含 OsClient
var key = 'Microi:' + V8.OsClient + ':Product:' + V8.Param.id;
V8.Cache.Set(key, value, 600);

// ❌ 错误：跨租户数据混淆，严重安全问题
var key = 'Product:' + V8.Param.id;
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

> 在表单引擎中给 `sys_osclient` 添加任意自定义字段（如 `WxPayMchKey`），即可通过 `V8.OsClientModel.字段名` 访问。

## 用户扩展字段访问（同理）

平台 `sys_user` 也由表单引擎驱动。如给 `sys_user` 添加 `Wife` 字段：

```javascript
// V8 代码中可访问
V8.CurrentUser.Wife;

// SQL 数据源中可访问
SELECT * FROM Contact WHERE OwnerId = $CurrentUser.Id$ AND Spouse = $CurrentUser.Wife$
```

## 常见错误

❌ 缓存 Key 不带 OsClient → 租户数据串号  
❌ MongoDB DbName 不带 OsClient → 数据混淆  
❌ 把 OsClientModel 字段直接返回给前端 → 密钥泄漏  
❌ 在前端硬编码 OsClient → 一改全改，应通过 token/URL 自动识别  
❌ 跨租户操作不验证当前用户权限 → 越权风险  

## 检查清单

- [ ] 所有缓存 Key 都包含 `V8.OsClient`
- [ ] 所有 MongoDB DbName 都包含 `V8.OsClient`
- [ ] 第三方密钥放 `V8.OsClientModel`，不硬编码
- [ ] 跨租户操作前校验权限
- [ ] 不向前端返回 `V8.OsClientModel`
