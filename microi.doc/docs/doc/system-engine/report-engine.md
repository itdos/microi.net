# 📊 报表引擎

> 报表引擎由数据源引擎、接口引擎、表单引擎和模块引擎组合实现，适合虚拟表格；ECharts 图表与仪表盘使用界面引擎。

---

## 组成

- `Rpt_Report`：报表定义；
- 报表字段：虚拟 `diy_table/diy_field` 设计，支持查询、排序、格式和表内编辑；
- 数据源引擎：SQL、V8 或 JSON 查询；
- 接口引擎：查询替换及新增/修改/删除等多表事务；
- 模块引擎：菜单、列、筛选、按钮和权限。

报表字段是虚拟字段，不应假设存在同名物理列。

## 建模流程

1. 明确指标口径、时间范围、时区、维度、精度、数据权限和导出上限。
2. 创建只读数据源并使用稳定 `DataSourceKey`。
3. 创建报表、绑定数据源并配置字段。
4. 通过模块引擎配置查询列、可编辑列、搜索列、排序和按钮。
5. 写操作分别绑定专用接口引擎。
6. 用真实普通角色、无权限角色和另一租户验收。

## 查询安全

禁止把 `V8.Param._Where`、字段名、排序或用户输入直接拼接 SQL。动态值使用 `.AddInParameter`，可选维度和排序由白名单映射：

```js
var tenantId = V8.CurrentUser.TenantId;
var keyword = String(V8.Param.Keyword || '');
var pageSize = Math.min(Math.max(Number(V8.Param._PageSize || 20), 1), 100);

var rows = V8.Db.FromSql(`
SELECT ShebeiMC, ShebeiXH, SUM(Shuliang) AS Shuliang
FROM diy_huanxinlb
WHERE OsClient = @osClient
  AND TenantId = @tenantId
  AND ShebeiMC LIKE @keyword
GROUP BY ShebeiMC, ShebeiXH
ORDER BY ShebeiMC ASC
LIMIT @pageSize`)
  .AddInParameter('@osClient', V8.OsClient)
  .AddInParameter('@tenantId', tenantId)
  .AddInParameter('@keyword', '%' + keyword + '%')
  .AddInParameter('@pageSize', pageSize)
  .ToArray();
return { Code: 1, Data: rows };
```

不同数据库的分页语法不同；正式接口按当前数据库适配。菜单数据范围不会自动保护任意聚合 SQL，数据源/接口必须在真实查询中应用当前用户范围。聚合结果也可能泄露敏感信息，必要时设置最小样本或脱敏。

## 写入型报表

多表新增、修改、删除必须由接口引擎在事务中重新校验：

- 当前用户和记录范围；
- 当前业务状态与并发版本；
- 金额、数量、状态迁移；
- 幂等键与唯一约束。

前端隐藏按钮、只读字段或当前行数据不能作为授权。资产、库存、审批和批量副作用不得由前端直接调用通用 FormEngine 修改。

## 性能与导出

- 默认分页并限制最大每页、聚合桶和导出行数。
- 大聚合使用索引、预聚合表或专用统计接口。
- 缓存 Key 包含 `OsClient + ReportId + 授权版本/用户 + 参数哈希`。
- 大导出使用后台任务；文件放私有桶并按菜单、记录、字段签发访问。

## 老版本升级

旧库缺少 `ReportName/ReportId/DataSourceId` 或报表字段关联时，使用当前版本 Upgrade/表单设计补齐并回读；不要直接复制其它租户的报表、数据源或连接配置。升级后重新选择字段数据源和菜单权限，并做真实 UI 验收。

完整规范见 `microi.skills/report-engine/SKILL.md`、[数据源引擎](./datasource-engine)与[平台安全与兼容基线](../more/security)。
