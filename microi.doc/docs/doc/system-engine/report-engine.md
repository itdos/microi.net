# 报表引擎
## 介绍
>* 报表引擎由【数据源引擎+接口引擎+表单引擎+模块引擎】组合实现，目前暂时只支持表格展现形式，ECharts图形展示形式请使用【界面引擎】

## 功能亮点：
>* 1、支持完全自定义的增、删、改、查：一般统计报表数据来源于多张表，在执行新增、修改、删除时可能需要操作多张表，可通过接口引擎事务实现。
>* 2、报表均会生成虚拟diy_table表、虚拟diy_field字段
>* 3、报表支持独立表单设计（虚拟字段）
>* 4、支持【模块引擎】为报表配置查询列、可编辑列、可搜索列等等

## 使用步骤
>* 1、创建一条数据源引擎。目前一个报表引擎均需要一个数据源引擎来提供数据源支撑。数据源支持SQL、V8、JSON（若老版本数据源类型中包含中文，请修改为此三项就大写字母）
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
>* 2、创建一条报表引擎。选择相应的数据源，保存后再配置一下需要显示的字段
>* 3、在【模块引擎DIY】新增一个模块，选择打开方式选择【DIY】。并选择刚刚自动生成的虚拟报表
>* 4、在【报表引擎】设计中，修改【查询接口替换、新增接口替换、修改接口替换、删除接口替换】为接口引擎相应的实现接口（如替换为：/apiengine/get_webuser_info）

## 老版本数据库升级报表引擎功能
>* 注意：使用最新标准库[2024-05-29之后]无需执行升级步骤
>* 服务器端api接口系统升级至 v1.9.5.7 及以上；前端os系统升级至 v3.16.21 及以上
>* 手动在：表单设计 --> 搜索Diy_Table --> 新增3个单行文本控件字段：ReportName、ReportId、DataSourceId，字段类型默认
>* 手动在：表单设计 --> 搜索Sys_Menu --> 新增2个文本控件字段：ReportName、ReportId，字段类型默认
>* 执行升级脚本：报表引擎升级脚本-2024-04-24.txt。直接运行，若遇到报错缺少字段，直接去【表单引擎】找到相应的表，拖【单行文本】控件命名对应的字段名即可。
>* 给admin的角色配置新模块权限（在系统引擎下）
>* 若打开报表引擎报错【不存在的数据！ TableName：Diy_Table。Where：WHERE A.Id='32c49fd3-54e9-4bb3-b9aa-cb9ea6032653' AND A.IsDeleted <> 1】
>* 此时需要进数据库执行sql【select * from diy_table where Name='Diy_Field'】
>* 假设拿到的Id值为【d38b0a4c-7d2e-4f15-b9d5-8aa20c30bedf】
>* 然后再次执行sql【update sys_menu set DiyTableId='d38b0a4c-7d2e-4f15-b9d5-8aa20c30bedf' where DiyTableId='32c49fd3-54e9-4bb3-b9aa-cb9ea6032653'】
>* 手动在：表单设计 --> 搜索Rpt_Report --> 选中字段【字段配置 RptFieldList】 --> 关联模块重新选择一下[报表引擎字段配置]模块。然后重新给字段【字段配置 RptFieldList】配置模块设计 --> 数据源的[查询列、表内可编辑列]重新选择Name、Label、Component
>* 继续在上面的Rpt_Report表单设计 --> 表单属性 --> 表单进入事件 替换为【标准库】对应的V8代码。

