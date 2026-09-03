# 🔗 接口引擎：类型化数据能力

::: warning 原入口兼容说明
“数据源引擎”已不再作为独立引擎、新建入口或培训专题。从 v7.7.2 起，原有的 V8、SQL、JSON 数据源能力已统一集成到**接口引擎**，由 `sys_apiengine`、`DataSourceType` 与唯一源码字段 `ApiV8Code` 承载。
:::

新项目请直接阅读并使用[接口引擎的类型化数据能力](../v8-engine/api-engine#类型化数据能力v8--sql--json)。本页仅为旧书签、历史项目和升级排查保留，不再出现在官网左侧引擎导航中。

## 现在应该怎么配置

| 业务场景 | 接口引擎配置 | `ApiV8Code` 内容 |
|---|---|---|
| 参数校验、权限过滤、组合查询、第三方服务 | 留空或 `V8` | 服务端 JavaScript |
| 当前租户内、管理员审核过的固定只读查询 | `SQL` | 参数边界明确的查询 SQL |
| 非敏感静态字典或配置 | `JSON` | 标准 JSON |
| 历史 `ApiDataSource` 迁移记录 | `API` | 仅保留原文供复核，应改写为 `V8.Http` |

所有类型都复用接口引擎的 `ApiEngineKey`、角色权限、匿名策略、启停状态、日志、测试参数与调用边界。新代码统一调用：

```js
var result = V8.ApiEngine.Run('product_options', {
  Keyword: V8.Param.Keyword || ''
});
return result;
```

SQL 类型不得直接拼接用户输入、原始 `_Where`、Token 或前端提交的用户对象；需要动态条件、字段白名单或复杂权限时，切换为 V8，并使用 `V8.FormEngine + _Where` 或 `V8.Db.FromSql(...).AddInParameter(...)`。

## 历史项目如何兼容

后端升级会在单个数据库事务内把未删除的 `sys_datasource` 迁移到 `sys_apiengine`：

1. 原 V8、SQL、JSON 源码归一写入 `ApiV8Code`，并设置对应 `DataSourceType`。
2. 角色、匿名、启用状态、测试参数、Key 和 Id 尽量保留；冲突时创建稳定映射。
3. 只有新接口记录全部写入成功，旧记录才标记为删除；任一步失败都会回滚。
4. 旧字段保留的 `DataSourceId`、旧 `V8.DataSourceEngine.Run` 及历史 HTTP 地址继续通过兼容层定位迁移后的接口引擎。

兼容地址包括：

- `/api/DataSourceEngine/Run`
- `/api/DataSourceEngine/GetData`
- `/apiengine/platform-data-source-run`

兼容入口只用于存量系统平滑升级。新表单字段、报表、界面和外部集成都应直接绑定稳定且租户内唯一的 `ApiEngineKey`，并使用 `V8.ApiEngine.Run`。

完整开发方法见[接口引擎](../v8-engine/api-engine)，统一安全边界见[平台安全与兼容基线](../more/security)。
