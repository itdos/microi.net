# 🔗 类型化接口引擎数据源

> 从 v7.7.2 起，数据源能力统一由 `sys_apiengine` 承载。接口引擎新增 `DataSourceType`，`ApiV8Code` 是唯一源码字段；不再为 V8、SQL、JSON 分别保存代码列。

## 类型与源码语言

| `DataSourceType` | `ApiV8Code` 内容 | 编辑器语言 | 说明 |
|---|---|---|---|
| 留空 / `V8` | 服务端 JavaScript | JavaScript | 普通接口引擎和复杂数据源的默认类型 |
| `SQL` | 当前租户数据库查询 SQL | SQL | 只用于管理员审核过的固定查询 |
| `JSON` | 标准 JSON | JSON | 非敏感静态字典或配置 |
| `API` | 历史 `ApiDataSource` 原文 | Plain Text | 仅用于迁移后人工复核；应改写为 `V8.Http` 并切换为 `V8` |

切换类型时，`ApiV8Code` 的 Monaco 编辑器会同步切换语言；普通接口引擎不填写 `DataSourceType`，继续按服务端 V8 执行。

## 什么时候使用

| 场景 | 推荐能力 |
|---|---|
| 固定枚举、小型静态字典 | `JSON` 类型接口引擎 |
| 当前租户内固定只读查询 | `SQL` 类型接口引擎 |
| 参数校验、权限过滤、组合查询或第三方服务 | `V8` 类型接口引擎 |
| 跨表事务、状态推进、库存/资产等副作用 | 普通 `V8` 接口引擎、Job 或 MQ |

新增数据源直接在接口引擎中配置稳定且租户内唯一的 `ApiEngineKey`。匿名、角色、停用、禁止外部调用、测试参数、日志和响应类型均复用接口引擎原有安全与运行边界。

## 推荐调用

前端或后端 V8 新代码优先直接调用接口引擎：

```js
var result = await V8.ApiEngine.Run('product_options', {
  Keyword: V8.Form.Keyword || ''
});
if (result.Code !== 1) {
  V8.Tips(result.Msg || '加载数据失败', false);
}
```

历史代码无需立即修改，下面的调用仍按原 Key 或 Id 定位迁移后的接口引擎：

```js
var result = await V8.DataSourceEngine.Run('product_options', {
  Keyword: V8.Form.Keyword || ''
});
```

旧移动端使用的以下地址也继续可用，但新版后端实际执行的是 `sys_apiengine`：

- `/api/DataSourceEngine/Run`
- `/api/DataSourceEngine/GetData`
- `/apiengine/platform-data-source-run`

## SQL 类型

SQL 类型保留历史 `$CurrentUser.字段名$` 替换能力，例如：

```sql
SELECT Id, Name
FROM Diy_Product
WHERE IsDeleted = 0
  AND UserId = '$CurrentUser.Id$'
ORDER BY UpdateTime DESC
LIMIT 100
```

`ApiV8Code` 中的 SQL 是管理员维护的原始查询，不得拼接客户端参数、原始 `_Where`、Token 或前端提交的用户对象。需要动态参数、字段白名单或复杂权限时，应切换为 `V8`，使用 `V8.FormEngine + _Where` 或 `V8.Db.FromSql(...).AddInParameter(...)`。菜单数据范围不会自动保护任意 SQL。

## JSON 类型

标准 JSON 必须使用双引号：

```json
[
  { "Id": "enabled", "Name": "启用" },
  { "Id": "disabled", "Name": "停用" }
]
```

JSON 只保存非敏感静态内容。密钥、连接串、Token 和用户隐私不得放入 `ApiV8Code` 或返回浏览器。

## V8 类型

V8 数据源与普通接口引擎使用同一运行时。应校验输入、参数化 SQL、限制结果、脱敏错误并设置合理超时。大量副作用或长任务仍使用 Job、后台任务或 MQ。

匿名接口只能返回有限、公开且不依赖身份的数据，并配置限流；“只读”不等于可以匿名。

## 历史数据迁移

后端升级会在单个数据库事务内完成以下动作：

1. 为每条未删除的 `sys_datasource` 创建一条 `sys_apiengine` 记录；名称增加 `【数据源引擎迁移】` 前缀。
2. 旧 `V8DataSource`、`SqlDataSource`、`JsonDataSource`、`NormalDataSource` 或 `ApiDataSource` 的有效源码复制到唯一字段 `ApiV8Code`，类型归一化到 `V8 / SQL / JSON / API`。
3. 角色、匿名、启用状态、测试参数、Key 和 Id 尽量原样保留；发生 Id/Key 冲突时使用稳定的迁移 Id/Key，并在备注中保留来源映射。
4. 只有新接口写入成功后，旧记录才统一更新为 `IsDeleted=1`；任一步失败都会回滚。

`API` 历史类型没有稳定的服务端执行协议，因此只完整保留源码并明确失败，不会把任意 URL 自动变成后端外连。管理员应将其改写为 `V8.Http`。

## 表单字段配置与验收

新字段优先选择接口引擎数据源并填写目标 `ApiEngineKey`。旧字段仍可保留历史 `DataSourceId`，兼容入口会解析迁移映射。

保存后应分别回读 `diy_field.Component/Data/Config`、刷新字段缓存，并用普通角色验证显示值、保存值、搜索、清空和无权限访问。权限相关缓存 Key 至少包含 `OsClient + ApiEngineKey + 授权版本/用户 + 参数哈希`。

完整 AI 开发规范见源码 `microi.skills/datasource-engine/SKILL.md`；统一安全边界见[平台安全与兼容基线](../more/security)。
