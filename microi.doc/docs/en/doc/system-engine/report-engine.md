# Report Engine
## Introduction
> * report engine is implemented by [data source engine interface engine form engine module engine]. currently, only table display format is supported. for ECharts graphical display format, please use [interface engine]]

## Feature Highlights:
> * 1. Fully customized add, delete, modify, and query are supported: general statistical report data comes from multiple tables, and multiple tables may need to be operated when adding, modifying, and deleting, which can be implemented through interface engine transactions.
> * 2. The report generates virtual diy_table tables and virtual diy_field fields.
> * 3, report support independent form design (virtual field)
> * 4. Support [Module Engine] to configure query columns, editable columns, searchable columns, etc.

## Use steps
> * 1. Create a data source engine. Currently, a report engine requires a data source engine to provide data source support. The data source supports SQL, V8, and JSON (if the data source type of the old version contains Chinese, please modify the three items to uppercase letters)
```js
var _where = [];
var sql = `SELECT ShebeiMC,ShebeiXH,YujiFWSJ,SUM(Shuliang) AS Shuliang FROM diy_huanxinlb A
						WHERE IsDeleted=0 
            AND YujiFWSJ >= '2025-05-01 00:00'
						AND KehuMC LIKE '%宁波%'
						`;
if(V8.Param._Where && V8.Param._Where.length > 0){
  sql += ` AND (`;
  V8.Param._Where.forEach((item, index) => {
    sql += ((index == 0) ? '' : 'AND') + ` ${item.Name} ${item.Type} '${item.Value}' `
  })
  sql += ` )`;
}
sql += `AND (A.TenantId='${V8.CurrentUser.TenantId}' OR ${V8.CurrentUser.Level} >= 999)
        GROUP BY ShebeiMC,ShebeiXH,YujiFWSJ 
        ORDER BY YujiFWSJ,ShebeiMC,ShebeiXH ASC`;
if(V8.Param._PageSize && V8.Param._PageIndex){
  sql += ` LIMIT ${(V8.Param._PageIndex - 1) * V8.Param._PageSize},${V8.Param._PageSize}`;
}
var result = V8.Db.FromSql(sql).ToArray();
return result;
```
> * 2. Create a report engine. Select the corresponding data source, save it and then configure the fields to be displayed.
> * 3. add a module to [module engine DIY] and select [DIY] as the opening method]. and select the virtual report that was just automatically generated
> * 4. in the design of [report engine], modify [query interface replacement, add interface replacement, modify interface replacement, delete interface replacement] to the corresponding implementation interface of the interface engine (for example, replace with:/apiengine/get_webuser_info)

## Upgrading Report Engine Features from an Older Database Version
> * Note: No upgrade steps required to use the latest standard library [2024-05-29]
> * server-side api interface system upgraded to v1.9.5.7 and above; Front-end OS system upgraded to v3.16.21 and above
> * manually in: form design --> search Diy_Table --> add 3 single-line text control fields: ReportName, ReportId, DataSourceId, field type default
> * manually in: form design --> search Sys_Menu --> add 2 text control fields: ReportName, ReportId, field type default
> * Execute the upgrade script: Report Engine Upgrade Script-2024-04-24.txt. Run directly. If there is a missing field reported as an error, go directly to [Form Engine] to find the corresponding table and drag the [Single Line Text] control to name the corresponding field name.
> * Configure new module permissions for the admin role (under the system engine)
> * if you open the report engine and report an error [non-existent data! TableName:Diy_Table. Where:WHERE A.Id = ''AND A.IsDeleted <>]]
> * at this time, you need to enter the database to execute SQL [select * from diy_table where Name = 'Diy_Field] ']
> * assuming that the id value obtained is [d38b0a4c-7d2e-4f15-b9d5-8aa20c30bedf]]
> * and then execute SQL again [update sys_menu set DiyTableId = 'd38b0a4c-7d2e-4f15-b9d5-8aa20c30bedf' where DiyTableId = ''] ']
> * manually reselect the [report engine field configuration] module in: form design --> search Rpt_Report --> select field [field configuration RptFieldList] --> association module. Then re-configure the module design for the field [field configuration RptFieldList]-> [query column, editable column in table] of the data source to re-select Name, Label, Component
> * Continue to the Rpt_Report form design above-> form properties-> form entry event is replaced with the V8 code corresponding to [standard library].

