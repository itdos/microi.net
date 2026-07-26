---
name: v8-cache-pattern
description: Microi V8 Redis 缓存与管理模式。用于读写 V8.Cache、租户缓存命名、TTL 策略、防陈旧数据，以及使用 Redis 管理器页面或 MCP 检索、统计、查看和维护 String、Hash、List、Set、Sorted Set、Stream。
---

# Microi V8 Redis 缓存模式

你正在开发 Microi 吾码平台的 V8 引擎代码，需要使用 Redis 缓存提升性能。V8 只获得当前租户的安全缓存代理，不会获得 Redis `IDatabase`、连接管理或服务器扫描能力。

## V8.Cache API

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `V8.Cache.Set(key, value, expire)` | 设置缓存 | `boolean` |
| `V8.Cache.Get(key)` | 获取缓存 | `string \| null` |
| `V8.Cache.Remove(key)` | 删除缓存 | `boolean` |
| `V8.Cache.KeyExist(key)` | 是否存在（兼容旧版运行时的真实方法名） | `boolean` |

> 需要把接口引擎复制到不同版本的 Microi 环境时，统一使用 `V8.Cache.KeyExist(key)`。部分新版本可能提供 `Exists` 别名，但旧版运行时没有该方法。

> 新运行时把逻辑 Key 自动规范为 `Microi:${V8.OsClient}:{逻辑Key}`；已带当前租户完整前缀的历史 Key 不会重复添加。任何其它租户的 `Microi:` 前缀都会被拒绝，而不是改写后继续执行。

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

Redis 中统一保存 4 段式 Key：`Microi:${OsClient}:{Category}:{Key}`。V8 代码推荐只传 `{Category}:{Key}`，服务端自动添加当前 `OsClient`；传完整当前租户 Key 用于兼容旧脚本。

```javascript
// ✅ 推荐：逻辑 Key，运行时自动绑定当前租户
var k1 = 'User:' + userId;
var k2 = 'SmsCode:' + phone;
var k3 = 'Lock:OrderPay:' + orderId;

// ✅ 兼容：完整当前租户 Key
var fullKey = 'Microi:' + V8.OsClient + ':User:' + userId;

// ❌ 拒绝：不能访问其它租户
var foreignKey = 'Microi:other-tenant:User:' + userId;
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

> ⚠️ 直接修改数据库未走平台保存流程时，可能绕过缓存失效。优先调用受支持的保存/刷新接口并回读验证；不要把重启容器或清空整个 Redis 当作日常缓存刷新方案。

### FormEngine 授权缓存（Redis epoch + 用户级快照）

FormEngine 授权是平台内部安全缓存，不能由业务 V8 直接读写。它既要兼容历史前端 V8 的无 `_SysMenuId` 调用，也要避免每个请求重复查询 `sys_user`、`sys_role`、`sys_rolelimit` 和 `sys_menu`：

1. 每个 `OsClient` 在共享 Redis 中维护单调递增的授权版本 `epoch`。
2. 用户授权快照 Key 至少包含 `OsClient + epoch + UserId`，内容包含当前有效用户状态/级别、有效角色、可访问菜单、菜单绑定表、操作权限和数据范围元数据。
3. 每个 API 节点可用短 TTL 的进程内 L1 加速；Redis L2 在所有节点间共享。读取顺序为“当前 epoch → L1 用户快照 → L2 用户快照 → 主库冷加载”。
4. 冷加载必须查询主库而不是只读副本，防止复制延迟把刚禁用的用户、撤销的角色或旧菜单范围重新写回缓存。并发冷加载可在单节点合并，但正确性仍以 Redis `epoch` 和主库事实为准。
5. 用户状态/级别/角色、角色状态、角色菜单/高级表权限、菜单绑定表、菜单权限 JSON、`SqlWhere`、`SqlJoin` / `JoinTables` 等授权事实变更后，必须在写入成功后递增 Redis `epoch`。新旧节点滚动发布期间都通过版本切换自然淘汰旧快照。
6. L1 丢失、节点重启或发布不影响正确性；禁止把永久 `static` 字典、单机文件或粘性会话当作授权事实源。短 TTL 只是兜底，不能代替变更时递增 `epoch`。

无菜单客户端请求只使用该快照推断当前用户对目标表的权限；显式 `_SysMenuId` 仍按对应菜单严格精确校验。两种路径都必须在实际 SQL 中应用菜单 `SqlWhere` / `SqlJoin` 数据范围，不能只缓存一个“允许/拒绝”结果后绕过行级范围。

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

## 分布式锁：不要用普通 Cache 拼装

`KeyExist → Set → Remove` 不是分布式锁：检查与写入不原子、没有唯一持有者令牌、锁过期后旧持有者会删除新持有者的锁，也无法处理节点暂停、网络分区和滚动发布。

V8 业务脚本需要互斥时：

1. 接口引擎使用平台 `LockKey/LockTimeout` 配置；
2. Job/Worker 使用带租约、唯一持有者令牌、续租、超时自动释放和“仅持有者可释放”语义的共享锁；
3. Key 至少包含 `OsClient + 任务/业务唯一标识`；
4. 分布式锁只能减少并发，业务副作用仍必须用幂等键、唯一约束/条件更新、状态机或 outbox/inbox 保证只执行一次。

`V8.Cache` 没有公开安全的 compare-and-set/带令牌释放原语时，禁止自行实现锁。

## 原子计数与限流

`Get → parseInt → Set` 在并发下会丢计数。普通 Hash 计数可使用 `V8.Cache.HashIncrement`；需要“计数 + 首次设置 TTL + 超限拒绝”的安全限流、日上传配额或金额额度时，应使用平台 `RateLimit` / SecurityGuard 或后端 Redis Lua 原子脚本，并在 Redis 不可用时按风险选择失败关闭。不要在 V8 中用多个普通 Cache 调用模拟原子配额。

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

## 后端批量写入与 Redis Pub/Sub 回压

平台源码中的缓存写入、删除和按模式删除不仅操作 Redis 数据，还会发布跨节点 L1
失效通知。批量导入、自动升级和迁移代码必须 `await` 这些异步调用，禁止
fire-and-forget；否则数千个 `SCAN/DEL/PUBLISH` 会同时进入同一个
`ConnectionMultiplexer`，表现为 `outstanding` 持续升高、`SocketClosed`，并可能让
其它节点继续使用旧缓存。

- 同一租户的失效广播要有界并发，短暂连接异常可做有限次数重试；
- 持续故障的日志应按时间窗口汇总，但不得静默吞掉一致性告警；
- 每个租户可能使用不同 Redis，订阅初始化状态不得用一个全局 `static bool` 共享；
- 等待发布只解决回压，业务写入和缓存失效仍需保持 `OsClient` 隔离及可重试幂等。
