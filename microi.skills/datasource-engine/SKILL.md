---
name: datasource-engine
description: Microi 数据源引擎设计、调用与安全规范。用于配置 sys_datasource 的 SQL、V8、JSON 数据源，为表单选项、报表、接口或远程搜索供数，以及通过前后端 V8.DataSourceEngine.Run 调用和验收。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi 数据源引擎

## 适用边界

数据源引擎适合复用“只读或计算型数据获取”，支持 `SQL`、`V8`、`JSON`。需要跨表事务、状态推进、扣减库存或外部副作用时应创建接口引擎，不要把数据源当业务命令。

数据源定义保存在 `sys_datasource`，属于平台控制面：创建、修改、删除、匿名开关和角色配置只允许 `Level >= 9999` 的可信管理链路。普通角色只能调用已经授权的数据源。

## 标准调用

前端 V8：

```js
var result = await V8.DataSourceEngine.Run('product_options', {
  Keyword: V8.Form.Keyword || ''
});
if (result.Code !== 1) V8.Tips(result.Msg || '加载数据失败', false);
```

后端 V8：

```js
var result = await V8.DataSourceEngine.RunAsync({
  DataSourceKey: 'product_options',
  Keyword: V8.Param.Keyword || ''
});
return result;
```

兼容代码可以使用 callback；新代码优先 `await`。`DataSourceKey` 也兼容数据源 Id，但发布配置应使用稳定、可读且租户内唯一的 Key。

## SQL 数据源

- 动态值必须参数化；禁止拼接用户输入、Token、排序字段或原始 `_Where`。
- 默认仅查询当前租户数据库，查询中必须保留 `OsClient` 隔离；扩展库由可信配置引用，不能让客户端传连接串。
- 只选择需要的列并设置结果上限。下拉远程搜索必须分页，不能一次返回整张大表。
- `$CurrentUser.*$` 等平台替换变量只能用于服务端已验证的当前用户，不能把客户端对象当身份。
- 菜单数据范围不是任意数据源 SQL 的自动授权。涉及客户、订单、合同等受限数据时，应在 SQL/V8 中显式应用当前用户范围，或改为受菜单授权的 FormEngine/接口引擎。
- 第三方数据库结构先通过 `microi_inspect_external_database` 发现；数据源只引用已保存的可信 DbKey，不能把浏览器或普通调用者传入的连接字符串交给 `V8.Dbs.Open`。

## V8 与 JSON 数据源

- V8 数据源按接口引擎安全标准处理：校验参数、限制返回字段、避免泄露堆栈和密钥。
- JSON 数据源只存非敏感静态枚举。密钥、连接串和 Token 不得放入 JSON 或返回给浏览器。
- 数据源 V8 在 `V8TenantContext` 中只能使用当前租户。普通租户伪造 `OsClient` 不会获得跨租户权限。
- 匿名数据源必须是无身份、无敏感数据、有限结果且可限流的公开能力；不能因为“只读”就默认匿名。

## 表单字段配置

选择类字段使用数据源引擎时，至少配置：

```json
{
  "DataSource": "DataSource",
  "DataSourceId": "product_options",
  "SelectLabel": "Name",
  "SelectSaveField": "Id",
  "DataSourceSqlRemote": true
}
```

保存后回读 `diy_field.Component/Data/Config`，刷新字段/菜单缓存，再从真实表单验证显示值、保存值、搜索、清空和权限。

## MCP 工作流

1. `microi_get_db_schema` 读取 `sys_datasource`、目标表和菜单关系。
2. 使用 `microi_save_data_source` 保存；写入必须有用户确认。
3. 回读数据源定义，确认 Key、类型、匿名、角色和代码/SQL。
4. 用普通角色、无权限角色和管理员分别调用。
5. 对 SQL 注入、超大分页、跨租户 `OsClient` 和匿名访问做负向测试。

## 缓存与分布式

结果缓存 Key 至少包含 `OsClient + DataSourceKey + 权限主体/角色版本 + 参数哈希`。权限相关结果不能只按数据源 Key 缓存。缓存是优化，不是授权事实源；配置更新后使用共享版本或发布订阅让所有节点失效，不能依赖单机静态字典。

## 验收清单

- [ ] 普通用户不能维护 `sys_datasource`
- [ ] 调用只在当前租户执行，伪造 `OsClient` 失败
- [ ] SQL 参数化、有列清单、分页和上限
- [ ] 敏感数据应用真实业务权限/数据范围
- [ ] 匿名、角色和错误响应不泄露内部配置
- [ ] 字段显示值与保存值真实回读通过
- [ ] 多节点配置更新后无需逐节点重启
