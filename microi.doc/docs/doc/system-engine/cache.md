# ⚡ 分布式缓存（L1/L2）

Microi.Cache 是吾码后端的租户级分布式缓存模块。它以 Redis 作为共享的
L2 缓存，并在每个 API 进程内使用 `ConcurrentDictionary` 提供 L1 热点缓存，
再通过 Redis Pub/Sub 通知其它节点清理旧值。

::: tip 培训重点：L1 + L2 多级缓存
L1 用进程内存换取热点数据的极低延迟，L2 用租户 Redis 保障多节点共享，再由 Pub/Sub 主动失效其它节点的 L1 副本；这不是单层 Redis 的简单封装。
:::

<div class="mci-doc-grid">
  <article class="mci-doc-card">
    <span class="mci-doc-chip">L1</span>
    <h3>进程内快速命中</h3>
    <p>热点 String/对象直接从当前节点内存读取，减少序列化、网络往返和 Redis 压力。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">L2</span>
    <h3>租户 Redis 共享</h3>
    <p>Redis 是所有节点共享的缓存层；每个租户使用自己的连接和数据库上下文。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">Pub/Sub</span>
    <h3>跨节点主动失效</h3>
    <p>写入或删除成功后广播 Key，让其它节点及时移除对应 L1 副本。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">SaaS</span>
    <h3>安全运维边界</h3>
    <p>V8 只能访问当前租户逻辑 Key；Redis 连接、扫描和维护只开放给控制面。</p>
  </article>
</div>

## 应该使用哪一种能力

| 场景 | 推荐入口 | 说明 |
| --- | --- | --- |
| 平台 C# 热点配置、表元数据、接口路由 | `MicroiEngine.CacheTenant.Cache(osClient)` | 返回 L1 + L2 两级缓存 |
| 接口引擎或后端 V8 的业务缓存 | `V8.Cache` | 自动绑定当前 `OsClient`，不暴露 Redis 连接 |
| 原子计数、同一对象的多个字段 | `V8.Cache.HashIncrement/HashSet` | Hash 操作直接进入 Redis |
| 查看 Key、TTL、内存和服务器统计 | Redis 管理器 | 仅当前租户超级管理员可用 |
| 分布式锁、金额额度、可靠幂等 | 平台锁、唯一约束、状态机或 inbox/outbox | 不要用普通缓存调用拼装 |

::: info L1/L2 不会自动查询业务数据库
Microi.Cache 自身的读取链路是“L1 → Redis → 未命中”。如果业务采用
Cache-Aside，Redis 未命中后的数据库查询与缓存回填由调用方完成；不能把数据库
误认为缓存组件内置的第三级。
:::

## 架构与数据流

```text
接口引擎 / FormEngine / 平台服务
               │
               ├─ V8TenantCache：规范化当前租户 Key
               │
               ▼
   IMicroiCacheTenant.Cache(osClient)
               │
               ▼
      MicroiTwoLevelCache
        │              │
        │ L1 命中       │ L1 未命中
        ▼              ▼
ConcurrentDictionary   MicroiCacheRedis ──► Redis（L2）
                               │
设置/删除成功：Redis → 更新/清理本节点 L1 → Pub/Sub 广播
                                                   │
                                                   ▼
                                      其它 API 节点清理对应 L1
```

L1 是单个进程的可丢失优化，不是平台事实源。节点重启后可以为空；多节点之间
也不会复制 L1 内容，只共享 Redis 和失效消息。Redis 写入已经成功但 Pub/Sub
短暂失败时，业务写入仍会返回，其它节点的旧 L1 最迟依靠本地 TTL 淘汰。

## 源码组成

| 源码 | 职责 |
| --- | --- |
| `MicroiCacheExtensions` | 注入 Redis 缓存、租户缓存工厂和 Redis 管理器 |
| `MicroiCacheTenant` | 按 `OsClient` 缓存并返回独立的两级缓存实例 |
| `MicroiCacheRedis` | Redis 连接、String、Hash、普通/哨兵模式和模式删除 |
| `MicroiTwoLevelCache` | L1 读写、容量控制、Pub/Sub 失效、统计与后台清理 |
| `MicroiTwoLevelCacheConfig` | L1 开关、TTL、容量、匹配模式、频道和预设模式 |
| `V8TenantCache` | V8 安全代理，固定当前租户命名空间并隐藏底层连接 |
| `MicroiRedisManager` | 受控连接、统计、SCAN、内容查看和白名单维护操作 |

`AddMicroiCache()` 直接注入的 `IMicroiCache` 是 Redis 实现。需要 L1/L2 的平台
代码应通过租户工厂获取实例：

```csharp
builder.Services.AddMicroiCache();

var cache = MicroiEngine.CacheTenant.Cache(osClient);
await cache.SetAsync(
    $"Microi:{osClient}:Product:Detail:{productId}",
    product,
    TimeSpan.FromMinutes(10));

var cached = await cache.GetAsync<ProductModel>(
    $"Microi:{osClient}:Product:Detail:{productId}");

await cache.RemoveAsync(
    $"Microi:{osClient}:Product:Detail:{productId}");
```

平台 C# 代码必须显式构造带租户前缀的 Key，并保留准确的 `osClient`。不要根据
Redis 数据库编号反推租户连接：不同租户可能在不同 Redis 服务器上使用相同编号。

## L1 与 L2 的真实读写语义

| 操作 | 当前实现 |
| --- | --- |
| `Get/GetAsync` | 先读有效 L1；未命中后读 Redis，并把非空结果回填 L1 |
| `Set/SetAsync` | 先写 Redis；成功后更新本节点 L1，再等待失效广播的有界结果 |
| `Remove/Delete/Del` | 删除 Redis、广播单 Key 失效，并清理本节点 L1 |
| `RemoveParentAsync` | 在当前租户的准确连接上按模式 SCAN/删除，再广播模式失效 |
| `KeyExist` | 直接查询 Redis，不以 L1 是否存在作为判断 |
| Hash 系列 | 直接委托给 Redis，不进入 L1 |
| `GetIDatabase/Db/AddConnection` | 仅后端可信代码使用，不向 V8 暴露 |

String 和对象支持同步/异步读取、写入、删除、泛型 JSON 序列化以及可选 TTL。
Hash 支持单个/批量字段写入、读取全部字段或键、删除、存在判断、长度和原子增减。

::: warning 模式删除不是日常查询接口
`RemoveParentAsync` 会在 Redis 端点上使用 SCAN 枚举匹配 Key。它比 `KEYS *`
安全，但大范围模式仍可能产生明显负载。生产环境应使用精确租户前缀、缩小模式，
并等待每次异步删除完成，禁止在循环里 fire-and-forget。
:::

## V8.Cache：当前租户的安全缓存代理

V8 不会得到 `IDatabase`、连接管理、服务器扫描或任意 Redis 命令。逻辑 Key 会
自动转换为 `Microi:{V8.OsClient}:{逻辑Key}`；已经带当前租户前缀的历史写法
继续兼容，任何其它租户的 `Microi:` 前缀都会被拒绝。

### 常用方法

| 方法 | 用途 |
| --- | --- |
| `Set/Get` | 写入和读取 String/JSON；TTL 可用秒数、`TimeSpan` 或 `d.HH:mm:ss` |
| `Remove/Delete/Del` | 删除当前租户 Key，三个名称是兼容别名 |
| `KeyExist/Exists` | 判断 Key 是否存在；跨旧版本优先使用 `KeyExist` |
| `SetIfNotExists` | Redis `SET NX` 语义，只在 Key 不存在时写入并设置正数秒 TTL |
| `Expire` | 为整个 Redis Key 设置正数秒 TTL |
| `HashSet/HashGet/HashGetAll` | 写入或读取 Hash |
| `HashGetAllKeys/HashGetAllValues` | 读取 Hash 的字段名或反序列化值 |
| `HashDelete/HashRemove` | 删除一个或多个 Hash 字段 |
| `HashExists/HashLength/HashIncrement` | 字段存在、长度与原子增减 |

### Cache-Aside 示例

```javascript
var productId = String(V8.Param.ProductId || '');
if (!productId) return { Code: 0, Msg: '缺少 ProductId' };

var cacheKey = 'Product:Detail:' + productId;
var cached = V8.Cache.Get(cacheKey);
if (cached !== null) {
  if (String(cached) === 'null') {
    return { Code: 0, Msg: '产品不存在' };
  }
  return { Code: 1, Data: JSON.parse(String(cached)) };
}

var result = V8.FormEngine.GetFormData('Product', {
  _Where: [['Id', '=', productId]]
});
if (!result || result.Code !== 1 || !result.Data) {
  // 空值只做短缓存，避免不存在的 Id 持续穿透到数据库。
  V8.Cache.Set(cacheKey, 'null', 60);
  return { Code: 0, Msg: '产品不存在' };
}

V8.Cache.Set(cacheKey, JSON.stringify(result.Data), 300);
return { Code: 1, Data: result.Data };
```

如果使用字符串 `"null"` 作为空值占位，读取端必须先识别它，不能直接把它当作
正常对象返回。缓存时间应根据数据变化频率设置，不要默认永久保存业务快照。

### Hash 原子计数与整 Key TTL

```javascript
var key = 'ApiDailyCount:' + V8.CurrentUser.Id + ':' + DateNow('yyyy-MM-dd');
var count = V8.Cache.HashIncrement(key, 'Requests', 1);

// Expire 作用于整个 Hash Key，不是单个字段。
V8.Cache.Expire(key, 86400);

return { Code: 1, Data: { Count: count } };
```

`SetIfNotExists` 可以用于短期去重窗口，但它没有唯一持有者令牌、续租和仅持有者
释放语义，不能据此宣称实现了分布式锁。可靠互斥仍应使用平台锁；副作用还必须
依靠稳定幂等键、数据库唯一约束、条件更新或状态机。

::: warning `Expire` 与 L1 的当前边界
`Expire` 直接修改 Redis TTL，不会同步缩短已经存在的 String L1 副本。对于可能
进入 L1 的 String/对象，优先用带 TTL 的 `Set` 重写，或先删除再写入；Hash 不进入
L1，可以直接为整个 Hash Key 设置 TTL。
:::

完整后端 V8 API 入口见 [后端 V8：缓存操作](../v8-engine/v8-server#缓存操作-v8-cache)。

## L1 配置与容量保护

当前源码的静态初始值和预设模式不是同一件事。只有代码显式调用预设方法后，
对应预设才会生效。

| 配置 | 静态初始值 | 作用 |
| --- | --- | --- |
| `Enabled` | `true` | `false` 时只使用 Redis |
| `LocalCacheTTL` | 1 天 | Pub/Sub 失败时 L1 最终一致性的兜底上限 |
| `MaxLocalCacheSize` | 10,000 | 当前进程 L1 最大条目数 |
| `CleanupInterval` | 12 小时 | 后台扫描过期 L1 的间隔 |
| `EvictionPercentage` | 10% | 达到容量上限时一次清理的比例 |
| `VerboseLogging` | `false` | 是否输出详细缓存操作日志 |
| `LogStatistics` | `false` | 是否周期记录命中率与清理统计 |

| 预设方法 | L1 TTL | 容量 | 清理间隔 |
| --- | ---: | ---: | ---: |
| `UseHighPerformanceMode()` | 60 分钟 | 20,000 | 2 分钟 |
| `UseBalancedMode()` | 30 分钟 | 10,000 | 1 分钟 |
| `UseConservativeMode()` | 10 分钟 | 5,000 | 30 秒 |
| `UseRedisOnlyMode()` | 不使用 L1 | — | — |

达到容量上限时，当前实现按最早过期时间清理指定比例的条目。
`CurrentEvictionPolicy` 中的 LRU/LFU/FIFO 目前只是预留枚举，不能当作已经实现。

黑名单 `DisabledPatterns` 的优先级高于启用模式。当前 `ShouldUseLocalCache` 对未命中
黑名单的 Key 默认返回 `true`，因此 `EnabledPatterns` 不是严格的“只有白名单才进入
L1”开关。Token、会话、在线状态、锁、配额和频繁变化数据应明确加入禁用模式，
或直接使用 Redis-only 模式。

## 跨节点失效与故障边界

单 Key 和模式失效分别使用：

```text
microi:cache:invalidate
microi:cache:invalidate:pattern
```

消息携带 `MachineName + ProcessId + GUID` 组成的进程实例标识。发布节点已经更新
自己的 L1，因此忽略自己的消息；其它节点收到后只清除本地副本，不会再次广播。
GUID 可以避免多个容器都使用 PID 1 时互相误判为同一节点。

同一租户的发布经过 `SemaphoreSlim` 串行化，单次等待上限为 3 秒；短暂 Redis
连接异常最多重试一次，发布停滞后进入 15 秒冷却，并按时间窗口合并重复告警。
这些保护避免批量导入把同一 `ConnectionMultiplexer` 的待发送队列无限堆高。

::: danger Pub/Sub 不是持久消息总线
Redis Pub/Sub 丢失或订阅断开时不会补发历史失效消息。L1 TTL 是最终兜底；安全
敏感事实还应使用版本号/epoch，让旧快照变得不可达。不要把 L1 或 Pub/Sub 当作
权限、余额、库存、任务完成状态的唯一事实源。
:::

## Redis 连接与管理器

`MicroiCacheRedis` 按租户维护延迟创建、线程安全的 `ConnectionMultiplexer`。普通
模式支持 Host、端口、密码和数据库编号；`CacheConnectionParam` 还支持 Redis
Sentinel 的节点、服务名、密码和数据库。租户基础连接统一在
[SaaS 引擎](./saas-engine#redis配置)维护，凭据不得写入 V8、前端、日志或文档。

平台 Redis 管理器路由为 `#/mci-redis-manager`，当前控制器只允许已登录且
`Level >= 9999` 的当前租户超级管理员使用 `tenant` 或 `saved` 连接模式；公网
`temporary` 模式已拒绝。密码由后端保护，列表和错误响应不会回传明文。

管理器支持：

- 测试连接，查看端点、Ping、Key 数量、内存、客户端和命中率；
- 使用 SCAN 游标分页检索 Key，查看类型、TTL 和内存估算；
- 分页读取 String、Hash、List、Set、Sorted Set 和 Stream；
- 创建或覆盖 String/Hash/List/Set/Sorted Set；
- 单次删除最多 500 个 Key、不覆盖重命名、设置永久/删除/正数秒 TTL；
- 对连接和写操作记录租户、来源 IP 与脱敏后的目标信息。

它不接受任意 Redis 命令、Lua、`FLUSHALL` 或 `FLUSHDB`。生产排障应先缩小到
`Microi:{OsClient}:...`，再确认连接、数据库、Key 和操作类型。

### 缓存控制接口

| 接口 | 作用 | 边界 |
| --- | --- | --- |
| `GET /api/cache/statistics` | 当前 API 进程的 L1/L2 命中统计 | 不是集群或单租户汇总 |
| `POST /api/cache/invalidate` | 删除单个 Key 并广播失效 | 超级管理员 |
| `POST /api/cache/invalidate-pattern` | 按模式删除并广播 | 超级管理员，谨慎使用 |
| `/api/cache/redis/*` | Redis 连接、统计、SCAN、内容和白名单写操作 | 超级管理员、受控连接 |

`MicroiTwoLevelCache` 的 L1 字典和命中计数是当前进程静态数据，因此某个节点的
统计接口只能用于该节点诊断。平台级命中率需要聚合所有节点，不能把负载均衡随机
命中的一次响应当作全集群事实。

## 生产使用建议

1. Key 固定使用 `Microi:{OsClient}:{Category}:{BusinessKey}`；V8 推荐只传逻辑后缀。
2. 缓存内容可重建，数据库或其它权威存储仍是业务事实源。
3. 数据库提交成功后再失效缓存；批量操作必须 `await` 删除与广播。
4. 读多写少、体积可控的数据适合 L1；Token、锁、实时计数和频繁变更数据直读 Redis。
5. 对不存在数据使用短空值缓存，防止缓存穿透；TTL 要明显短于正常数据。
6. 热点 Key 冷加载应做有界合并，防止大量节点同时击穿 Redis/数据库。
7. Redis 故障不能依赖旧 L1 继续完成高风险业务；按业务风险选择失败关闭或只读降级。
8. 不通过清空整个 Redis、重启所有容器来完成日常刷新，应使用精确保存/失效入口。

## 常见问题

| 现象 | 优先检查 |
| --- | --- |
| 一个节点仍读取旧值 | Pub/Sub 订阅、实例标识、失效日志、该 Key 的 L1 TTL |
| 批量导入出现 `outstanding`、`SocketClosed` | 是否在循环中未等待 `RemoveAsync/RemoveParentAsync` |
| L1 内存持续增长 | `MaxLocalCacheSize`、清理间隔、值体积和是否缓存高基数数据 |
| 修改 TTL 后仍读到旧 String | 是否只调用了 `Expire` 而未重写/清理已有 L1 |
| 模式删除影响错误租户 | 是否绕开租户实例、根据 Redis DB 编号错误推断连接 |
| 单节点命中率与预期不符 | 是否误把进程统计当作租户或集群统计 |

## 最低验收清单

- 两个 API 节点连接同一租户 Redis，节点 A 写入后节点 B 的旧 L1 被清理；
- 单 Key 删除和精确模式删除同时清理 Redis 与各节点 L1；
- Pub/Sub 短暂故障不会无限阻塞业务，旧 L1 最终按 TTL 淘汰；
- 不同租户即使 Redis DB 编号相同，也不会扫描或删除对方 Key；
- 容量达到上限后按比例清理，节点重启后可从 Redis 重新预热；
- Redis 管理器拒绝未登录、普通角色和 `temporary` 模式，密码不回传；
- 统计结果明确标记为当前节点数据，不冒充集群级监控。

V8 设计模式与更多示例见 `microi.skills/v8-cache-pattern/SKILL.md`。
