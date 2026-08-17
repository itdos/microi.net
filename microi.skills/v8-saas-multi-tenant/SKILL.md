---
name: v8-saas-multi-tenant
description: Microi V8 SaaS 多租户指南。用于处理 OsClient、OsClientType、OsClientNetwork、租户配置、V8.OsClientModel、隔离和租户感知代码。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 SaaS 多租户引擎

你正在为 Microi 吾码平台编写多租户（SaaS）相关代码。每个租户使用独立数据库账号；Redis、对象存储、RabbitMQ、MQTT 和搜索集群可以共享基础设施，但必须使用租户命名空间与独立服务凭据，**所有 V8 代码都在租户上下文中运行**。

## 核心概念

Microi 多租户 = **`OsClient` + `OsClientType` + `OsClientNetwork`** 三参数模型：

| 参数 | 说明 | 示例 |
|------|------|------|
| `OsClient` | 租户标识（系统Key） | `tenant_a`, `tenant_demo` |
| `OsClientType` | 租户类型 | `Normal` / `App` / `Wechat` |
| `OsClientNetwork` | 网络环境 | `Intranet`（内网）/`Outernet`（外网） |

主租户不是固定字符串 `master`，而是由当前部署的环境变量 `OsClient` 或 `AppSettings:OsClient` 决定。租户记录存放在受保护的 `sys_osclients` 表中；普通业务角色和普通 V8 不得直接查询、复制或修改该表。

## 上下文变量

```javascript
V8.OsClient            // 当前租户标识，如 'tenant_demo'
V8.OsClientType        // 'Normal' / 'App' / 'Wechat'
V8.OsClientNetwork     // 'Intranet' / 'Outernet'
V8.OsClientModel       // 当前租户 SaaS 配置的脱敏副本
V8.ClientModel         // OsClientModel 的兼容别名，同样是脱敏副本
V8.SysConfig           // 当前租户系统配置根对象；不存在 PublicSettings 属性
```

前端 V8 的 `V8.SysConfig` 是匿名 `GetSysConfig` 的独立脱敏副本，`mci_system_setting` 中允许公开的普通值直接平铺到根对象；不会暴露 `ClientSecrets`、`GlobalServerV8Code` 或疑似凭据字段。后端接口引擎与后端 V8 事件的 `V8.SysConfig` 是当前租户完整、独立的 `sys_config`，并把全部启用的租户设置（含后端解密后的 Secret）平铺到根对象。两端都不存在 `PublicSettings` 包装层。后端可使用 Secret，但严禁返回前端、写日志或写审计。子租户显式传其它 `OsClient` 仍会被强制改回当前租户。

### V8.OsClientModel 常用字段

```javascript
V8.OsClientModel.SysTitle              // 租户系统标题
V8.OsClientModel.DbType                // 非敏感数据库类型
V8.OsClientModel.HDFS                  // 'Aliyun' / 'MinIO' / 'S3'
V8.OsClientModel.AliOssPublicDomain    // 可公开的文件域名
// 当前租户自行扩展的业务字段只作存量兼容；新增配置使用 mci_system_setting

// 以下基础设施字段不会注入 V8：
// DbConn / DbReadConn / AuthSecret
// RedisHost / RedisPwd / MinIOSecretKey / AliOss*AccessKey*
// MQHost / MQUserName / MQPassword / MqttPwd / SearchEngineApiKey
```

## 平台级配置与主租户规则

主库 `sys_osclients` 保存租户数据库/Redis/存储路由及影响整个 API 进程的平台级配置；目标租户建立上下文后，`sys_config` 和 `mci_system_setting` 从该租户自己的数据库读取。平台级配置必须遵守“主租户为准、子租户只能降额隔离”的规则：

- 所有可变业务逻辑默认必须由接口引擎编排，包括但不限于租户开通、开库、初始化、归属修复、官网个人中心、付费额度等 SaaS 业务流程。C# 后端只暴露原子 V8 能力，例如建库、导入空库模板、复制 `sys_config`、刷新 SaaS 缓存、补偿回滚、字段兜底等；不要把可变业务分支写死到 Controller 或 `TenantProvisioningService` 这类后端定制代码里。接口引擎缺少能力时，优先扩展 `V8.Method`/V8 引擎原子函数，再由接口引擎调用。
- 主租户由运行环境决定：优先读取环境变量 `OsClient`，其次读取 `appsettings.json` 的 `AppSettings:OsClient`。只有这条主租户 `sys_osclients` 数据中的平台级字段会作为全局配置生效。
- API 启动配置只有十项白名单：`OsClient`、`OsClientType`、`OsClientNetwork`、`OsClientDbType`、`OsClientDbConn`、`OsClientRedisHost`、`OsClientRedisPort`、`OsClientRedisPwd`、`OsClientRedisDataBase`、`OsClientDbMongoConn`。除这十项外，部署/节点级运行参数与基础设施秘密从主控 `sys_osclients` 读取；允许子租户自行维护的业务开关、OAuth/第三方集成和展示设置从该租户 `sys_config` / `mci_system_setting` 读取，未配置时使用代码安全默认值。官方 License 恢复次数/间隔与固定私钥挂载 `/app/microi_private.pem` 是信任链例外。禁止再增加 `MICROI_*`、`DOS_ORM_*`、自定义 `AppSettings` 节点或动态名称的环境变量读取。节点身份由平台自动生成。
- `ASPNETCORE_*`、`DOTNET_*` 仅用于 .NET 宿主；构建、安装、测试、MCP、发布脚本可使用自身进程变量，但 API 生产代码不得把它们当业务配置。新增 SaaS 运行字段必须配套独立或既有 Tab、幂等升级、缓存刷新、敏感字段脱敏、子租户不继承和源码扫描测试。
- 文件上传的租户业务开关与额度按“当前租户 `sys_osclients` → 代码默认值”解析；平台固定灾难保护、HTTP/Multipart/Form 和反向代理上限不可由租户覆盖，也不要求安装者维护额外上传环境变量。
- 类似 MQTT 端口、PressureGuard、V8Limits、OrmLimits、StartupLimits、SecurityGuard 这类影响整进程资源的配置，不能让每个子租户各自抬高全局上限。子租户同名隔离字段只能降低自己的并发、等待时间或资源额度，用于隔离弱租户、试用租户或异常租户。
- 修改 `sys_osclients` 的表、字段、数据源或配置值后，必须刷新 SaaS 引擎运行缓存，并回读验证字段 `Component`、`Data`、`Config`、实际数据值和前端真实消费结果。不要只看 MCP 写入成功。
- SaaS 配置只在启动、管理员保存 `sys_osclients` 或显式租户刷新时发布到共享 Redis。初始化数据库会话、创建 `V8.Dbs` 运行态对象、普通 FormEngine 请求和表单设计器保存不得冒充配置变更反复发布。
- 扩展库缓存必须区分“尚未加载”和“已加载但为 0 条”；后者是有效结果。没有配置 `microi_database` 的租户不能在每次 V8 执行时重复查询、调用 `AddOrUptClient` 或打印“缓存 OsClient 配置到 Redis”。
- 多节点的缓存失效订阅只做本节点失效与数据库回源，禁止收到消息后再次发布形成回声。进程内初始化标记仅是可丢失优化，真正租户配置仍以共享数据库/Redis 为准。
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
GET /apiengine/get-products?OsClient=tenant_demo
```

### 方式 3：特殊 URL 格式（无 Token、无参数）

```bash
GET /apiengine/get-products--OsClient--tenant_demo--
GET /apiengine/get-products--OsClient--tenant_demo--OsClientType--App--
```

> 适用于第三方回调（无法添加 Header）、支付/微信回调等场景。

## 跨租户操作（仅可信控制面）

普通 V8 的 `FormEngine`、`DataSourceEngine`、`TranslateEngine`、`WFEngine`、`Cache`、`HDFS`、MQ/MQTT、Search 和 `Dbs` 都必须绑定当前 Token/V8 上下文中的 `OsClient`。请求 body/query 里传入其它租户不能切换连接，也不能读取其它租户凭据。

租户开通、迁移、备份或平台管理员代维只能走明确的控制面服务/接口引擎：

- 调用者必须是 `Level >= 9999`，并再次校验目标租户白名单和操作类型；
- 使用专用原子能力，不通过通用 FormEngine 读取完整 `sys_osclients` 记录；
- 不把数据库、认证、Redis、存储、MQ/MQTT、搜索等连接与密钥投影进 V8；
- 每次操作写安全审计、幂等键和补偿状态，并对目标租户回读验收；
- 多节点部署使用共享租约和业务幂等，不能依赖进程静态锁。

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
// 租户差异应来自当前租户的非敏感业务配置，不要硬编码某个“主租户”字符串
if (V8.OsClientModel.OrderApprovalMode === 'Direct') {
  V8.FormEngine.UptFormData('Order', { Id: id, Status: 'Approved' });
} else {
  await V8.WFEngine.StartWork({ FlowDesignId: 'order-flow', TableRowId: id });
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

## 第三方密钥放租户动态设置（不要硬编码）

```javascript
// ❌ 危险：密钥写在代码里，所有租户共用，无法独立轮换
var ak = 'AKIDxxxxxxxx';

// ✅ 普通业务值：每个租户在 mci_system_setting 动态维护
var loginName = V8.SysConfig['Login.Gitee.Name'];

// ✅ 后端 V8 可读取当前租户 Secret 并直接调用供应商
var secret = V8.SysConfig['Login.Gitee.ClientSecret'];
// 禁止 return secret、console.log(secret) 或写入前端可读字段。
```

> `mci_system_setting` 位于每个租户自己的数据库。普通设置可逐条动态公开并直接平铺到前端 `V8.SysConfig`；Secret 保存认证密文，只在后端 V8 的当前租户 `V8.SysConfig` 中解密使用。前端 V8、普通 FormEngine HTTP、匿名/访问密钥会话不能读取 Secret，后端 V8 也不能获得通用解密器。`sys_osclients` 自定义业务字段只保留存量兼容；共享基础设施字段由服务端强制移除，不能用自定义同义字段绕过安全代理。

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
❌ 查询 `mci_system_setting.SecretCipher` 或给 V8 暴露通用解密器 → 密钥边界失效  
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
- [ ] 无扩展库租户重复执行 V8 时不会重复刷新 SaaS 配置；真实 `sys_osclients` 保存后各节点能按租户失效并回源

## Microi.AI 中转站租户凭据

- `mic_ai` 的 `Microi.AI中转站.ApiKey` 是租户调用吾码官方中转站的用户凭据。运行时不得因为该字段为空而静默创建、回退到当前用户字段或绕过校验，否则管理员无法判断真实配置来源。
- 老租户由用户在吾码官网个人中心复制 ApiKey 后填写到本租户的 `mic_ai` 中转站记录；空值应返回明确配置错误。
- 官网创建新 SaaS 租户时，必须先取得当前官网账号的 ApiKey，再由租户初始化服务写入新库 `mic_ai` 的 `Microi.AI中转站` 记录。该自动写入只发生在受控开库流程，不得散落到普通 AI 对话请求中。
- 开库入口把 ApiKey 传给后台 worker 后，worker 还必须继续显式传入最终的原子初始化方法；不能只在父接口或中间参数中“带过”。每个异步/后台边界都应对空值立即失败，避免租户创建成功但 `mic_ai.ApiKey` 静默为空。
- 自动化验收必须通过新租户 `admin` 登录回读 `mic_ai`，只输出“非空、长度、与官网账号 ApiKey 是否一致”等布尔结果，不得把真实 ApiKey 写入日志、截图或测试报告。
- 中转模型公开目录只返回模型 Id、显示名、厂商等非敏感字段，可匿名读取；严禁把官方上游模型的 ApiKey、Endpoint 私密配置随模型列表返回前端。
