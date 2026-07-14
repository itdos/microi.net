---
name: v8-cache-pattern
description: Microi V8 Redis 缓存与管理模式。用于读写 V8.Cache、租户缓存命名、TTL 策略、防陈旧数据，以及使用 Redis 管理器页面或 MCP 检索、统计、查看和维护 String、Hash、List、Set、Sorted Set、Stream。
---

# Microi V8 Redis 缓存模式

你正在开发 Microi 吾码平台的 V8 引擎代码，需要使用 Redis 缓存提升性能。

## V8.Cache API

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `V8.Cache.Set(key, value, expire)` | 设置缓存 | `boolean` |
| `V8.Cache.Get(key)` | 获取缓存 | `string \| null` |
| `V8.Cache.Remove(key)` | 删除缓存 | `boolean` |
| `V8.Cache.Exists(key)` | 是否存在 | `boolean` |

## Redis 管理器与 MCP

平台 Redis 管理器固定路由为 `#/mci-redis-manager`：

- 已登录平台管理员可使用当前租户默认 Redis，并可管理保存于主租户 `mci_redis_connection` 表的额外连接；记录必须按 `TenantOsClient` 隔离，密码只在后端加密保存且永不回传前端。
- 未登录时只允许创建当前页面内存中的临时连接；不得加载当前租户 Redis、已保存连接或缓存中的旧用户信息，刷新页面后必须清空临时凭据。
- Key 列表必须使用 `SCAN` 游标分页，禁止在生产 Redis 上使用阻塞式 `KEYS *`。内容查看支持 String、Hash、List、Set、Sorted Set、Stream；集合内容要分页并限制单次条数。
- 写入 Hash/List/Set/Sorted Set 时先完整解析 JSON，再覆盖旧 Key；删除、覆盖、重命名和 TTL 变更属于破坏性操作，必须先展示目标连接、数据库与 Key 并要求明确确认。
- 临时匿名接口只开放白名单操作，不开放任意 Redis 命令、Lua、`FLUSHALL` 或 `FLUSHDB`；设置短连接超时、访问频率限制、单次 Key 数量和内容大小上限。

MCP 默认操作当前 MCP `OsClient` 的租户 Redis；额外连接只传管理页保存后的 `connectionId`，禁止在 MCP 参数、日志或回答中传递 Redis 密码。

| MCP 工具 | 用途 | 确认规则 |
|------|------|------|
| `microi_redis_statistics` | 服务器、内存、客户端、命中率与 Key 类型统计 | 只读 |
| `microi_redis_list_keys` | SCAN 分页检索 Key、类型、TTL、内存估算 | 只读 |
| `microi_redis_get_key` | 分页查看单个 Key 内容 | 只读 |
| `microi_redis_delete_keys` | 单个或批量删除，最多 500 个 | `confirmExecution="DELETE"` |
| `microi_redis_replace_value` | 新建或覆盖 String/Hash/List/Set/Sorted Set | `confirmExecution` 等于完整 Key 或 `EXECUTE` |
| `microi_redis_rename_key` | 不覆盖目标的 Key 重命名 | `confirmExecution` 等于新 Key 或 `EXECUTE` |
| `microi_redis_set_ttl` | `-1` 永久、`0` 删除、正数为秒 | `confirmExecution` 等于完整 Key 或 `EXECUTE` |

**过期时间格式：** 支持两种写法
- 整数（秒）：`V8.Cache.Set(key, value, 3600)` = 1 小时
- 字符串 `d.HH:mm:ss`：
  - `'0.00:00:59'` = 59 秒
  - `'0.01:00:00'` = 1 小时
  - `'0.12:00:00'` = 12 小时
  - `'1.00:00:00'` = 1 天
  - `'7.00:00:00'` = 7 天
- 不传则**永久缓存**（直到手动 Remove 或 Redis 重启）

## 🔑 Key 命名规范（必须遵守）

平台统一使用 4 段式 Key：`Microi:${OsClient}:{Category}:{Key}`

```javascript
// ✅ 正确
var k1 = 'Microi:' + V8.OsClient + ':User:' + userId;
var k2 = 'Microi:' + V8.OsClient + ':SmsCode:' + phone;
var k3 = 'Microi:' + V8.OsClient + ':Lock:OrderPay:' + orderId;

// ❌ 错误：缺少 OsClient → 多租户串号
var k = 'User:' + userId;
```

| 段 | 说明 |
|----|------|
| `Microi:` | 平台前缀，固定 |
| `${V8.OsClient}` | 租户隔离 |
| `{Category}` | 业务分类（User / SmsCode / Lock / Token / ImportStep …） |
| `{Key}` | 具体业务 Key |

> 系统已用前缀（避免冲突）：`Microi:${OsClient}:Token:`、`Microi:${OsClient}:User:`、`Microi:${OsClient}:OsClient`、`Microi:${OsClient}:DiyTable:`、`Microi:${OsClient}:Sys:`

## 缓存层级（L1 + L2）

平台内部对系统配置等场景实现了 **L1 进程内缓存 + L2 Redis 缓存**：

- L1：.NET 进程内 `IMemoryCache`（每个容器独立）
- L2：Redis（全集群共享）

读取顺序：L1 命中 → L2 命中 → 数据库  
写入顺序：DB → L2 → L1

> ⚠️ 直接修改数据库未走 V8 引擎时，L1 不会自动失效，需要**重启 docker 容器**（或调 `刷新缓存` 接口）让 L1 重建

## 基本读写

```javascript
// 设置缓存（有效期 1 小时）
V8.Cache.Set('user:' + userId, JSON.stringify(userData), '0.01:00:00');

// 读取缓存
var cached = V8.Cache.Get('user:' + userId);
if (cached) {
  return { Code: 1, Data: JSON.parse(cached) };
}

// 删除缓存
V8.Cache.Remove('user:' + userId);
```

## Cache-Aside 模式（最常用）

先查缓存，缓存不存在时查数据库并回填缓存。

```javascript
var cacheKey = 'Microi:' + V8.OsClient + ':product:detail:' + V8.Param.id;

// 1. 先查缓存
var cached = V8.Cache.Get(cacheKey);
if (cached) {
  return { Code: 1, Data: JSON.parse(cached) };
}

// 2. 缓存未命中，查数据库
var result = V8.FormEngine.GetFormData('Product', {
  _Where: [['Id', '=', V8.Param.id]]
});

if (result.Code !== 1 || !result.Data) {
  return { Code: 0, Msg: '数据不存在' };
}

// 3. 回填缓存（有效期 30 分钟）
V8.Cache.Set(cacheKey, JSON.stringify(result.Data), '0.00:30:00');

return { Code: 1, Data: result.Data };
```

## 数据更新时清除缓存

```javascript
// 在 SubmitAfterServerV8.js（数据写入后）清除缓存
if (V8.FormSubmitAction === 'Update' || V8.FormSubmitAction === 'Delete') {
  V8.Cache.Remove('Microi:' + V8.OsClient + ':product:detail:' + V8.Form.Id);
  V8.Cache.Remove('Microi:' + V8.OsClient + ':product:list');
}
```

## 列表缓存（含分页）

```javascript
var pageIndex = parseInt(V8.Param.pageIndex) || 1;
var pageSize = parseInt(V8.Param.pageSize) || 20;
var cacheKey = 'Microi:' + V8.OsClient + ':product:list:' + pageIndex + ':' + pageSize;

var cached = V8.Cache.Get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}

var result = V8.FormEngine.GetTableData('Product', {
  _Where: [['Status', '=', 1]],
  _OrderBy: 'SortOrder',
  _PageIndex: pageIndex,
  _PageSize: pageSize
});

var response = { Code: 1, Data: result.Data, Total: result.DataCount };

// 列表缓存时间短一些（5 分钟）
V8.Cache.Set(cacheKey, JSON.stringify(response), '0.00:05:00');

return response;
```

## 防缓存穿透（查询不存在的数据）

```javascript
var cacheKey = 'Microi:' + V8.OsClient + ':user:' + V8.Param.id;
var cached = V8.Cache.Get(cacheKey);

// 注意：缓存值可能是 "null" 字符串（空对象占位）
if (cached !== null) {
  if (cached === 'null') {
    return { Code: 0, Msg: '数据不存在' };
  }
  return { Code: 1, Data: JSON.parse(cached) };
}

var result = V8.FormEngine.GetFormData('SysUser', {
  _Where: [['Id', '=', V8.Param.id]]
});

if (result.Code === 1 && result.Data) {
  V8.Cache.Set(cacheKey, JSON.stringify(result.Data), '0.00:30:00');
  return { Code: 1, Data: result.Data };
} else {
  // 缓存空值，短过期时间防止穿透
  V8.Cache.Set(cacheKey, 'null', '0.00:01:00');
  return { Code: 0, Msg: '数据不存在' };
}
```

## 分布式锁（简易版）

```javascript
var lockKey = 'Microi:' + V8.OsClient + ':lock:order:' + V8.Param.orderId;

// 尝试获取锁（10 秒过期）
if (V8.Cache.Exists(lockKey)) {
  return { Code: 0, Msg: '操作正在进行中，请勿重复提交' };
}
V8.Cache.Set(lockKey, '1', '0.00:00:10');

try {
  // 执行业务逻辑
  var result = processOrder(V8.Param.orderId);
  return result;
} finally {
  // 释放锁
  V8.Cache.Remove(lockKey);
}
```

## 计数器

```javascript
// 简单计数器（如接口调用次数限制）
var countKey = 'Microi:' + V8.OsClient + ':api:count:' + V8.CurrentUser.Id + ':' + DateNow('yyyy-MM-dd');
var count = V8.Cache.Get(countKey);

if (count && parseInt(count) >= 100) {
  return { Code: 0, Msg: '今日调用次数已达上限' };
}

V8.Cache.Set(countKey, (parseInt(count || '0') + 1).toString(), '1.00:00:00');
```

## 缓存 Key 命名规范

```
Microi:{OsClient}:{业务}:{类型}:{标识}
Microi:myapp:product:detail:xxx-id     单条产品
Microi:myapp:product:list:1:20         产品列表第1页
Microi:myapp:user:profile:xxx-id       用户资料
Microi:myapp:config:system             系统配置
Microi:myapp:wx:access_token           微信 token
Microi:myapp:lock:order:xxx-id         订单锁
Microi:myapp:api:count:userId:date     API 调用计数
```

## 注意事项

- `V8.Cache.Get()` 返回 `null` 表示 key 不存在，返回空字符串 `''` 是合法值
- `V8.Cache.Set()` 的 value 必须是字符串，对象需要 `JSON.stringify()`
- **过期时间格式为 `d.HH:mm:ss` 字符串**（非秒数），不传则永久缓存
- Key 命名建议：`Microi:{V8.OsClient}:{分类}:{Key}`，避免跨应用冲突
- 写操作后即时清除相关缓存，避免脏数据
- 不要缓存频繁变化的数据（如实时库存），不如每次查库
