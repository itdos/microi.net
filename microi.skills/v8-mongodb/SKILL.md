---
name: v8-mongodb
description: Microi V8 MongoDB 指南。用于使用 V8.MongoDb 文档读写、GetPartitionedTableData 跨年跨月游标分页、对象过滤和原生 ObjectId。
---

> **Microi吾码基础规范（强制）：** 任何 AI 模型与宿主每次新建或接续吾码任务，先完整读取 `../workspace-conventions/SKILL.md`，必须执行版本播报、`@microi.net/cli` 后台自动升级、Skills/MCP 同步和进度播报。安装与诊断读取 `../microi-codex-installer/SKILL.md`；更新失败延后重试，不阻断当前工作。

# Microi V8 MongoDB 操作

你正在开发 Microi 吾码平台的 V8 引擎代码，需要使用 MongoDB 存储非结构化数据（如日志、IoT 数据、大文档等）。

## V8.MongoDb API

### 存量 MongoDB 兼容诊断

- `reports wire version 6 ... requires at least 9` 是驱动与服务端不兼容，不是日志为空，也不是 Token 失效。先记录原始错误和服务端真实协议，不能把 wire version 6 推断成 MongoDB 4.2。
- 平台兼容镜像以含安全修复的驱动 3.11.2 构建，恢复平台 CRUD/日志所需的 MongoDB 3.6 协议路径；不是降级至 2.30，也不声明上游继续维护 3.6。来源、单文件补丁和摘要维护在 `Microi.Server/Microi.MongoDB.Driver/`。
- 普通开发与全部默认测试先从当前 MCP 同源只读诊断发现真实 MongoDB 版本，沿已授权隔离范围执行认证、BSON、读写、索引、幂等重放、游标和租户隔离断言；不为旧版或其它版本重复询问、建库或新增服务。配置标签和 wire version 不能冒充实际版本回读。
- 只有任务明确修改或验证存量兼容层、旧版本缺陷或跨版本升级时，才按该兼容目标扩展真实矩阵（例如需支持的 3.6 协议端与当前 MCP 实际版本），不固定假设当前端是 7.x。每个版本必须独立回读和实际执行，未执行记未覆盖；不得只验证编译或 ping，也不得把驱动兼容当作修复旧数据库服务端自身漏洞。
- C# 驱动改动需要更新后端镜像才生效。镜像更新后通过 `microi_query_system_observability` 回读日志、队列持久化和错误状态；查询失败应原样报错，禁止返回成功空表。

| 方法 | 说明 |
|------|------|
| `V8.MongoDb.AddFormData({...})` | 新增文档 |
| `V8.MongoDb.UptFormData({...})` | 修改文档（按 Id） |
| `V8.MongoDb.UptFormDataByWhere({...})` | 按非空 `_Where` 批量修改，禁止修改 `_id` |
| `V8.MongoDb.DelFormData({...})` | 删除文档（按 Id） |
| `V8.MongoDb.DelFormDataByWhere({...})` | 按非空 `_Where` 批量删除 |
| `V8.MongoDb.GetFormData({...})` | 查询单个文档（按 Id） |
| `V8.MongoDb.GetTableData({...})` | 查询文档列表 |
| `V8.MongoDb.GetPartitionedTableData({...})` | 当前租户年度库、月度集合及旧年度集合的有界游标分页 |
| `V8.MongoDb.NewId()` | 生成 MongoDB Id |

## 新增文档

```javascript
var newId = V8.MongoDb.NewId();
V8.MongoDb.AddFormData({
  DbName: 'sys_log_2024',       // 数据库名
  TableName: 'log_2024_12',     // 集合（表）名
  Id: newId,                     // 可选，不指定自动生成
  _FormData: {
    UserId: V8.CurrentUser.Id,
    Action: '登录',
    IP: '192.168.1.1',
    CreateTime: DateNow('yyyy-MM-dd HH:mm:ss')
  }
});
```

## 修改文档

```javascript
V8.MongoDb.UptFormData({
  DbName: 'sys_log_2024',
  TableName: 'log_2024_12',
  Id: V8.Param.id,              // 必传
  _FormData: {
    Action: '更新操作',
    UpdateTime: DateNow('yyyy-MM-dd HH:mm:ss')
  }
});
```

### 按条件批量修改

```javascript
var result = V8.MongoDb.UptFormDataByWhere({
  DbName: 'diy_chat_' + V8.OsClient.toLowerCase(),
  TableName: 'chat_' + DateNow('yyyy'),
  _Where: [
    ['FromUserId', '=', V8.Param.PeerUserId],
    ['ToUserId', '=', V8.CurrentUser.Id],
    ['IsRead', '=', false]
  ],
  _FormData: { IsRead: true }
});
```

`_Where` 缺失、为空或包含无效条件时必须返回失败，不得执行全集合更新。`_FormData` 禁止设置 `_id` 或 `_id.*`。返回值的 `Data` 包含 `MatchedCount` 和 `ModifiedCount`。

## 删除文档

```javascript
V8.MongoDb.DelFormData({
  DbName: 'sys_log_2024',
  TableName: 'log_2024_12',
  Id: V8.Param.id               // 必传
});
```

### 按条件批量删除

```javascript
var result = V8.MongoDb.DelFormDataByWhere({
  DbName: 'diy_chat_' + V8.OsClient.toLowerCase(),
  TableName: 'chat_last_contact',
  _Where: [
    ['UserId', '=', V8.CurrentUser.Id],
    ['ContactUserId', '=', V8.Param.PeerUserId]
  ]
});
```

删除条件必须包含当前权威用户/资源边界，不能只用可伪造的前端参数。返回值的 `Data` 包含 `DeletedCount`。

## 查询单个文档

```javascript
var result = V8.MongoDb.GetFormData({
  DbName: 'sys_log_2024',
  TableName: 'log_2024_12',
  Id: V8.Param.id               // 必传
});
```

`GetFormData` 的原生不存在结果是 `{ Code: 1, Data: null }`；只有 `Code=1` 且 `Data` 是文档时才表示找到记录。不要套用 `V8.FormEngine.GetFormData` 的 `Code=2` 约定。查询失败、异常、空响应或缺失 `Data` 字段不能当作记录不存在并继续新增。兼容旧适配器时，仅接受 `Code=2` 且没有正文的明确不存在结果。

聊天等幂等写入先使用固定业务标识定位分区；首次不存在时才新增。Mongo 写入结果未知时只回读同一 `_id` 并比对完整载荷摘要，禁止换 Id 或月份盲重发。正文已持久化但联系人、实时推送或后置 Hook 失败时保留已提交事实；业务层分别返回投影警告，不能宣称消息没有写入。

## 查询文档列表

```javascript
var result = V8.MongoDb.GetTableData({
  DbName: 'sys_log_2024',
  TableName: 'log_2024_12',
  _Where: [
    ['Type', '=', '访问菜单'],
    ['OR', 'Type', '=', '点击V8按钮']
  ],
  _OrderBy: 'CreateTime',
  _OrderByType: 'DESC',
  _PageIndex: 1,
  _PageSize: 20
});
```

`GetFormData` 和 `GetTableData` 属于 dynamic 无模式读取。服务端会在 MongoDB 投影阶段过滤 BSON 内部 `_t` CLR 类型判别字段，避免存量强类型 C# 写入留下的旧类型名称触发反序列化失败。`_t` 不是 V8 业务契约；业务需要类型标记时应使用自有字段（例如 `DocumentType`），不得读取、筛选或依赖 `_t`。强类型 C# MongoDB 模型仍按自身的多态映射处理。

### 原生 `_id` 过滤

`_Where: [['_id', 'In', ids]]` 支持原生 ObjectId 的数组或逗号分隔字符串，每次 1–1000 项。`=`、`!=`、范围比较与 `NotIn` 同样使用原生 ObjectId；每项必须是合法的 24 位十六进制标识。无效值返回失败，不能忽略条件后退化成全表查询。普通业务字符串 Id 应使用自有字段，不要伪装成原生 `_id`。

## 跨年跨月游标分页

海量聊天/日志不要只查当前月份，不要逐月 `Count + Skip` 或一次加载全历史。使用 `GetPartitionedTableData` 存储原子，接口引擎继续负责 DiyToken、成员资格、消息双方、业务权限与公开 DTO。平台 SignalR 聊天必须继续调用应用商城拥有的 `platform-chat-runtime`，不能另写业务 Controller。

```javascript
// 必须先完成业务权限校验；身份来自当前 V8 上下文，前缀来自可信代码。
var result = V8.MongoDb.GetPartitionedTableData({
  DatabasePrefix: 'audit_log', TablePrefix: 'event',
  _Where: [['UserId', '=', V8.CurrentUser.Id]],
  IndexFields: ['UserId'],
  PageSize: 30, MaxPartitions: 64,
  Cursor: V8.Param.Cursor || ''
});
if (result.Code !== 1) return result;
// result.Data: { Rows, HasMore, NextCursor, ScannedPartitions }
// 对外返回前显式选择业务字段，不能透传内部 _PartitionDb / _PartitionTable。
return { Code: 1, Data: {
  Rows: result.Data.Rows.map(function(row) {
    return { Id: row._id, CreateTime: row.CreateTime, Action: row.Action };
  }),
  HasMore: result.Data.HasMore, NextCursor: result.Data.NextCursor
}};
```

- 命名：只发现当前租户的 `{DatabasePrefix}_{tenant小写}_{yyyy}` 和兼容旧库 `{DatabasePrefix}_{tenant小写}`；集合为 `{TablePrefix}_{yyyyMM}`、`{TablePrefix}_{yyyy_MM}` 或旧 `{TablePrefix}_{yyyy}`。年度库与集合年份必须一致。不能传任意库/集合列表，不能用普通用户输入控制前缀或索引。
- `PageSize` 默认 30，范围 1–100（不是 `_PageSize`）；`MaxPartitions` 默认 64，范围 1–128。目录最多 200 个租户库、2400 个有效集合。总调用限时 20 秒，单个集合查询限时 10 秒；超限/存储故障返回失败，不能冒充历史结束。
- `_Where` 必须非空且有效；双向聊天可用 `_WhereAny` 传 1–4 组非空条件，组内 AND、组间 OR。指定 `_WhereAny` 时不再合并 `_Where`，每个分支都必须独立包含权威身份/资源边界。
- `IndexFields` 可选，最多 3 个互异安全字段；按这些字段升序加 `CreateTime DESC, _id DESC` 创建复合索引。文档必须使用 BSON 日期 `CreateTime` 和原生 ObjectId `_id`。稳定排序按两者倒序，页内旧/新分区重复 `_id` 合并；普通页不执行 Count。
- `Cursor` 是服务端返回、绑定租户/前缀/过滤条件的 opaque 字符串，最大 2048 字符。它是翻页位置而非鉴权凭据，禁止客户端解析或替换为页码。查询条件改变必须清空游标。即使 `Rows=[]`，只要 `HasMore=true` 仍需用新的 `NextCursor` 继续；跨空月、跨年和旧年度表不能提前截止。
- `CountOnly:true` 返回 `{ Count }`，仍执行权限条件，扫描范围超过 `MaxPartitions` 直接失败而不返回部分总数。它计数物理行，迁移时不要复制未读事实到多个分区；需要业务去重计数时由权威索引另行维护。
- 新消息按原始发生时间选择年度库/月度集合。`AddFormData` 的可选顶层 `OccurredAt` 用于可信后端重放保持 `CreateTime`，不得直接信任客户端时间；默认仍使用服务端当前时间。跨月重试必须用稳定业务 Id 和持久分区定位复用原始事实，不能在新月份再写一条。
- 前端采用滚动异步加载、稳定 Id 合并、请求代际隔离和向前插入锚点补偿。实时消息只增量合并；已读回执读取有界最新页，不能重置旧历史游标或把未展示的全历史标为已读。

该原子需部署相应 Core/MongoDB/API 组件并更新 Managed 应用运行时。源码测试不等于线上 MongoDB、SignalR 或浏览器验收；至少覆盖跨月、跨年、空月、同时间多消息、旧年度集合、重复迁移数据、跨租户拒绝、断线重试和滚动位置。

## 实战模式

### IoT 设备日志存储

```javascript
// 接收 MQTT 消息后存入 MongoDB
var eventName = V8.EventName;
if (eventName === 'MessageReceived') {
  V8.MongoDb.AddFormData({
    DbName: 'iot_data',
    TableName: 'device_log_' + DateNow('yyyy_MM'),
    _FormData: {
      DeviceId: V8.MQTT.ClientId,
      Topic: V8.MQTT.Topic,
      Payload: V8.MQTT.Payload,
      Timestamp: DateNow('yyyy-MM-dd HH:mm:ss')
    }
  });
}
```

### 操作审计日志

```javascript
// 在 SubmitAfterServerV8.js 中记录审计日志到 MongoDB
V8.MongoDb.AddFormData({
  DbName: 'audit_log',
  TableName: 'form_audit_' + DateNow('yyyy'),
  _FormData: {
    TableName: V8.TableModel.Name,
    Action: V8.FormSubmitAction,
    DataId: V8.Form.Id,
    UserId: V8.CurrentUser.Id,
    UserName: V8.CurrentUser.Name,
    OldData: V8.FormSubmitAction === 'Update' ? JSON.stringify(V8.OldForm) : null,
    NewData: JSON.stringify(V8.Form),
    CreateTime: DateNow('yyyy-MM-dd HH:mm:ss')
  }
});
```

### 按月分表查询

```javascript
// 查询指定月份的日志
var month = V8.Param.month || DateNow('yyyy_MM');
var result = V8.MongoDb.GetTableData({
  DbName: 'sys_log_2024',
  TableName: 'log_' + month,
  _Where: [
    ['UserId', '=', V8.CurrentUser.Id]
  ]
});

return { Code: 1, Data: result };
```

## 注意事项

- MongoDB 参数统一使用**对象格式**：`{ DbName, TableName, Id, _FormData, _Where, _OrderBy, _OrderByType }`
- `DbName` 是 MongoDB 数据库名，`TableName` 是集合名
- `_Where` 条件语法与 `V8.FormEngine` 一致
- 批量写入仅接受安全字段名、已知操作符和非空条件；条件中的租户、用户和资源 Id 应来自 `V8.OsClient` / `V8.CurrentUser` / 权威回查，不得信任 `V8.Param` 中的同名身份字段
- 非主库 V8 运行时会把 MongoDB 操作绑定到当前租户；显式传入其它 `OsClient` 不能跨租户
- 适合存储日志、IoT 数据、大文档等非结构化 / 海量数据
- 建议按时间分库分表（如 `log_2024_01`），便于清理历史数据
- MongoDB 操作不参与 `V8.DbTrans` 事务。批量写入 `Code=1` 后即是已提交事实；后续 Hook/投递失败应返回警告或进入补偿，不得返回“未发生”导致盲目重试，重试必须有稳定业务 Id 幂等
