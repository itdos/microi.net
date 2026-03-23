# Microi V8 Redis 缓存模式

你正在开发 Microi 吾码平台的 V8 引擎代码，需要使用 Redis 缓存提升性能。

## V8.Cache API

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `V8.Cache.Set(key, value, expire)` | 设置缓存 | `boolean` |
| `V8.Cache.Get(key)` | 获取缓存 | `string \| null` |
| `V8.Cache.Remove(key)` | 删除缓存 | `boolean` |
| `V8.Cache.Exists(key)` | 是否存在 | `boolean` |

**过期时间格式：** `d.HH:mm:ss` 字符串
- `'0.00:00:59'` = 59 秒
- `'0.01:00:00'` = 1 小时
- `'0.12:00:00'` = 12 小时
- `'1.00:00:00'` = 1 天
- `'7.00:00:00'` = 7 天
- 不传则**永久缓存**

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
