# 🔗 数据源引擎

> 数据源引擎用于复用只读/计算型数据获取，支持 `SQL`、`V8`、`JSON`，可为表单选项、远程搜索、报表和接口供数。

---

## 什么时候使用

| 场景 | 推荐能力 |
|---|---|
| 固定枚举、小型静态字典 | JSON 数据源 |
| 当前租户内参数化查询 | SQL 数据源 |
| 需要参数校验、组合查询或调用其它服务 | V8 数据源 |
| 跨表事务、状态推进、库存/资产等副作用 | 接口引擎，不使用数据源 |

数据源定义保存在受保护的 `sys_datasource`。创建、修改、删除、匿名和角色配置只允许 `Level >= 9999` 的可信管理链路；普通用户只能调用已经授权的数据源。

## 前端 V8 调用

```js
var result = await V8.DataSourceEngine.Run('product_options', {
  Keyword: V8.Form.Keyword || ''
});
if (result.Code !== 1) {
  V8.Tips(result.Msg || '加载数据失败', false);
}
```

也支持对象和 callback 形式：

```js
V8.DataSourceEngine.Run({
  DataSourceKey: 'product_options',
  Keyword: ''
}, function (result) {
  // result.Code / result.Data / result.Msg
});
```

## 后端 V8 调用

```js
var result = await V8.DataSourceEngine.RunAsync({
  DataSourceKey: 'product_options',
  Keyword: V8.Param.Keyword || ''
});
return result;
```

`DataSourceKey` 兼容数据源 Id；正式配置推荐使用租户内唯一、稳定且可读的 Key。V8 调用会绑定当前 `V8TenantContext`，普通租户即使在参数中伪造其它 `OsClient` 也不能跨租户执行。

## SQL 数据源

SQL 数据源不是把客户端值直接替换进 SQL 的模板。动态值必须参数化，字段、排序和表名只能来自服务端白名单；禁止拼接用户输入、原始 `_Where`、Token 或前端提交的用户对象。

```sql
SELECT Id, Name
FROM Diy_Product
WHERE OsClient = @OsClient
  AND Status = @Status
  AND Name LIKE @Keyword
ORDER BY UpdateTime DESC
```

数据源实现负责把当前租户和经过验证的参数绑定到 `@OsClient/@Status/@Keyword`。查询必须：

- 只选择需要的列；
- 设置分页和最大结果数；
- 保留当前租户条件；
- 对客户、订单、合同等数据应用服务端业务范围。

菜单数据范围不会自动保护任意 SQL 数据源。无法可靠表达权限时，改用受菜单授权的 FormEngine 或专用接口引擎。

## JSON 数据源

标准 JSON 必须使用双引号：

```json
[
  { "Id": "enabled", "Name": "启用" },
  { "Id": "disabled", "Name": "停用" }
]
```

JSON 数据源只存非敏感静态内容。密钥、连接串、Token 和用户隐私不得放入配置或返回浏览器。

## V8 数据源

V8 数据源按接口引擎的安全标准处理：校验输入、参数化 SQL、限制结果、脱敏错误、设置超时。大量副作用、可靠后台执行和跨表事务仍应使用接口引擎、Job 或 MQ。

匿名数据源只能返回有限、公开且无身份的数据，并配置限流。只读不等于可以匿名。

## 表单字段配置

选择类字段可配置：

```json
{
  "DataSource": "DataSource",
  "DataSourceId": "product_options",
  "SelectLabel": "Name",
  "SelectSaveField": "Id",
  "DataSourceSqlRemote": true
}
```

保存后回读 `diy_field.Component/Data/Config`，刷新字段缓存，再从真实普通角色表单验证显示值、保存值、搜索、清空和无权限访问。

## 缓存与验收

权限相关缓存 Key 至少包含 `OsClient + DataSourceKey + 授权版本/用户 + 参数哈希`。配置更新使用共享版本或发布订阅让所有节点失效，不能把单机静态缓存当事实源。

完整的 AI 开发规范见源码 `microi.skills/datasource-engine/SKILL.md`；统一安全边界见[平台安全与兼容基线](../more/security)。
