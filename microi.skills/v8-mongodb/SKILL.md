# Microi V8 MongoDB 操作

你正在开发 Microi 吾码平台的 V8 引擎代码，需要使用 MongoDB 存储非结构化数据（如日志、IoT 数据、大文档等）。

## V8.MongoDb API

| 方法 | 说明 |
|------|------|
| `V8.MongoDb.AddFormData({...})` | 新增文档 |
| `V8.MongoDb.UptFormData({...})` | 修改文档（按 Id） |
| `V8.MongoDb.DelFormData({...})` | 删除文档（按 Id） |
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

## 删除文档

```javascript
V8.MongoDb.DelFormData({
  DbName: 'sys_log_2024',
  TableName: 'log_2024_12',
  Id: V8.Param.id               // 必传
});
```

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
  ]
});
```

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

- MongoDB 参数统一使用**对象格式**：`{ DbName, TableName, Id, _FormData, _Where }`
- `DbName` 是 MongoDB 数据库名，`TableName` 是集合名
- `_Where` 条件语法与 `V8.FormEngine` 一致
- 适合存储日志、IoT 数据、大文档等非结构化 / 海量数据
- 建议按时间分库分表（如 `log_2024_01`），便于清理历史数据
- MongoDB 操作不参与 `V8.DbTrans` 事务
