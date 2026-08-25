---
name: v8-mongodb
description: Microi V8 MongoDB 指南。用于使用 V8.MongoDb AddFormData、UptFormData、UptFormDataByWhere、DelFormData、DelFormDataByWhere、GetFormData、GetTableData、对象过滤和文档 Id。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 MongoDB 操作

你正在开发 Microi 吾码平台的 V8 引擎代码，需要使用 MongoDB 存储非结构化数据（如日志、IoT 数据、大文档等）。

## V8.MongoDb API

| 方法 | 说明 |
|------|------|
| `V8.MongoDb.AddFormData({...})` | 新增文档 |
| `V8.MongoDb.UptFormData({...})` | 修改文档（按 Id） |
| `V8.MongoDb.UptFormDataByWhere({...})` | 按非空 `_Where` 批量修改，禁止修改 `_id` |
| `V8.MongoDb.DelFormData({...})` | 删除文档（按 Id） |
| `V8.MongoDb.DelFormDataByWhere({...})` | 按非空 `_Where` 批量删除 |
| `V8.MongoDb.GetFormData({...})` | 查询单个文档（按 Id） |
| `V8.MongoDb.GetTableData({...})` | 查询文档列表 |
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
