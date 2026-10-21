# 🔗 表单控件数据源

数据源决定下拉、单选、复选等控件如何取值与回显；本页按普通数据源、类型化接口引擎和 SQL 数据源三种方式说明适用场景与配置入口。

> **表单控件数据源目前支持多种模式**

![表单控件数据源配置总览](https://file.microi.net/upload/img/csdn/04a0857b9c684fa7b2c06d080f3824f7.png#pic_center)

## 普通数据源
>目前普通数据暂时只支持Value一种形式
>平台正在扩展Key-Value形式的普通数据源
>这样就不需要一定用接口引擎、Sql数据源来实现Key-Value的数据绑定了

![普通数据源配置](https://file.microi.net/upload/img/csdn/0083491c8cbe4bdc8fe4c6d22ce3f367.png#pic_center)
## 类型化接口引擎

新版本已将原数据源引擎合并到接口引擎。创建接口引擎时选择 `DataSourceType`（V8、SQL、JSON 或 API），并统一在 `ApiV8Code` 中维护内容；代码编辑器会随类型切换 JavaScript、SQL、JSON 或纯文本语言模式。

表单字段继续使用原有“数据源引擎”配置入口时，平台会调用对应的类型化接口引擎。新代码也可以直接使用 `V8.ApiEngine.Run('ApiEngineKey', params)`。升级程序会迁移旧数据并保留旧调用地址，旧版移动端无需同时升级。

## Sql数据源
>* 支持开启远程搜索功能
>* 未开启直接在数据源中前端本地搜索
>* 开启后每次搜索均从数据库查询，因此必须配置相应的$Keyword$变量以及limit分页
>* Sql数据源支持在Sql中使用【\$CurrentUser.字段名\$】相关变量，如【\$CurrentUser.Id\$、\$CurrentUser.Account\$】等
>* **由于sys_user表也由表单引擎驱动，因此您在表单设计中为sys_user表新增的任何字段，均能在【\$CurrentUser.字段名\$】中访问，如您添加了一个字段[Wife]，可以【\$CurrentUser.Wife\$】访问**

![SQL 数据源配置](https://file.microi.net/upload/img/csdn/1f7491f7bb624d7cb87d1e7d68c097bd.png#pic_center)
## 通过其它字段来动态绑定数据源
>* 比如说您在表单中先选择了下拉框控件【部门（Dept）】，然后在下拉框控件【联系人（Contact）】仅绑定选择当前部门的人员数据
>* 此时只需要给【联系人】的数据源配置为空即可
>* 然后在【部门】控件的【值变更事件中输入以下V8引擎代码】
```javascript
//获取选中部门中的人员数据
var deptId = V8.ThisValue.Id;//或者V8.Form.Dept.Id
if(deptId){//如果选择了部门
	var contactResult = await V8.FormEngine.GetTableData('sys_user', {
		_SelectFields:['Id', 'Name', 'Account'],//只查询哪些字段，提高性能
		_Where: [
			['DeptId', '=', deptId]
		]
	});
	if(contactResult.Code != 1){
		V8.Tips('获取部门人员失败！', false);
	}else{
		V8.FieldSet('Contact', 'Data', contactResult.Data);
	}
}else{//如果清空了部门
	V8.FieldSet('Contact', 'Data', []);
}
```
> * 当然以上只是基础示例，实际上还有更多玩法
> * 比如说使用接口引擎V8.ApiEngine.Run()实现
> * 历史代码中的V8.DataSourceEngine.Run()仍可兼容，实际执行的是迁移后的类型化接口引擎
> * 以上用到的相关知识点：
> * **V8.FormEngine的使用方法**：[https://microi.blog.csdn.net/article/details/143623519](https://microi.blog.csdn.net/article/details/143623519)
> * **Where条件的用法**：[https://microi.blog.csdn.net/article/details/143582519](https://microi.blog.csdn.net/article/details/143582519)
> * **V8.Field前端V8函数**：[https://microi.blog.csdn.net/article/details/143623205](https://microi.blog.csdn.net/article/details/143623205)

## 显示字段、存储字段与已选值回显

`SelectSaveField` 可以保存稳定 Id，`SelectLabel` 显示当前名称；不必为回显修改已保存 Id。订单商品等需要保留历史名称的业务，应另外保存名称快照，不能用实时名称替代历史凭证。

配套升级支持此能力的 API 与 PC 前端后，标准 Select、MultipleSelect、Radio、Checkbox、Autocomplete 在列表、编辑和只读详情中，共用已选值补查。候选分页和已选值回显是两次不同的读取：搜索仍只加载候选页；回显只查询本页记录实际保存、且当前选项缺失的值。普通数据及 Key-Value 在本地匹配，不发额外请求；树形控件继续使用自身树节点/祖先回显机制。

### SQL 数据源

平台从服务端字段配置读取 SQL，验证所属表和字段权限，保留原 `WHERE`、`JOIN`、当前用户及表单条件。仅对可识别的单条 SELECT 移除最外层候选 `ORDER BY/LIMIT`，在外层用参数化 `IN` 查询配置的保存键，只返回键和显示字段；不会追加一个绕过原条件的 `OR Id IN (...)`。例如 `SELECT Id,Name FROM biz_contact WHERE IsDeleted=0 AND Name LIKE '%$Keyword$%' LIMIT 0,20` 可以补查首屏外仍满足条件的联系人。

含 UNION、CTE、注释、未知分页或不唯一保存键的复杂 SQL 不自动猜测；列表中依赖 `$V8.Form.*` 的逐行 SQL 不混用某一行上下文。这些情形需提供受控解析接口。已删除、被原条件排除或无权访问的值继续显示原 Id，不扩大可选范围。旧 API 未返回回显协议标识时也保留原 Id，不能把第一页结果误认成补查成功。

### 接口引擎、数据源引擎与自定义 API

平台不能推断任意接口内部 SQL、分页与权限含义。引擎实现下列批量契约后，在字段配置中开启 **支持已选值回显**（`Config.SelectedValueLookup=true`）；MCP 的 `microi_build_field_config` 可通过 `selectedValueLookup:true` 生成 ApiEngine/DataSource 配置。

请求包含 `_ResolveSelectedValues:true`、`_SelectedValues:["id1","id2"]`、`_FieldId` 以及当前表单/菜单上下文。引擎必须验证长度上限、真实登录身份、租户、资格及数据权限，只处理请求中的键，不得把客户端字段 Id 或菜单 Id 当成授权结果。响应示例：

```json
{"Code":1,"Data":[{"Id":"id1","Name":"可访问的名称"}],"DataAppend":{"SelectedValuesResolved":true}}
```

未实现契约时不要开启开关，也不要扫描所有分页作为替代。纯 SQL 类型引擎若不能返回该协议，应以受控 V8 包装明确实现。

### 性能与兼容边界

- 同页按字段合并并去重，不按行或逐个 Id 请求。单字段最多 200 个值，单 SQL 批次最多 20 个字段、500 个值，客户端补查并发最多 2。
- 相同页面字段、会话、配置和记录上下文的重复请求合并，短期去重 30 秒；不建立跨用户或永久全量名称缓存。换租户、用户、会话或记录后丢弃迟到响应。
- 补查只更新显示选项，不改表单保存值、不触发值变更事件，不清空失败关联。保存键需有合适索引；复杂 SQL 仍需按实际执行计划优化，数量上限不代表任意 SQL 都能快速执行。
- 标准列表、详情及编辑路径应一起验收；自定义 V8 页面、外部前端及未实现契约的任意接口不会因升级自动获得通用解析能力。
- 框架自动化门禁覆盖单选/多选、普通/历史普通/Key-Value/对象/SQL/数据源引擎/接口引擎/自定义 API、关闭/本地/远程搜索、存储/显示字段组合、Text/Json、只读、清空及实际提交转换。列表仅补实际展示列，同字段多个 JOIN 别名合并；没有独立存储键（直接保存显示字段）时不做无意义的补查。
