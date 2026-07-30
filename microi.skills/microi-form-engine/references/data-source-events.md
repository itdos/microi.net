# 字段数据源、属性与事件

## 数据源类型

| 类型 | 适用场景 | 配置要点 |
|---|---|---|
| `Data` | 显示值和保存值相同的固定数组 | 适合少量稳定枚举 |
| `KeyValue` | 保存 Key、显示 Label | 推荐；便于翻译和状态演进 |
| `Sql` | 基于当前库的受控查询 | 参数化、限制条数、选择明确字段 |
| `DataSource` | 复用数据源引擎 | 使用稳定 DataSourceId/Key |
| `ApiEngine` | 复杂权限、跨表或外部数据 | 接口返回稳定的 Label/Value 字段 |

KeyValue 示例：

```text
draft|草稿,enabled|启用,disabled|禁用
```

对应核心语义：

```json
{
  "DataSource": "KeyValue",
  "SelectLabel": "Value",
  "SelectSaveField": "Key"
}
```

动态 SQL 示例只选择必要字段并限制返回量：

```json
{
  "DataSource": "Sql",
  "Sql": "select Id,Name from biz_customer where Name like '%$Keyword$%' limit 0,20",
  "SelectLabel": "Name",
  "SelectSaveField": "Id",
  "DataSourceSqlRemote": true
}
```

SQL 仍必须经过平台受控数据源；不要把用户文本拼成标识符或任意 SQL。复杂权限、
跨库或外部服务使用数据源引擎/接口引擎。

## 动态联动

字段值变化时可用前端 V8 更新另一个字段的数据源：

```javascript
if (V8.LoadMode === 'Design') return;

var result = await V8.FormEngine.GetTableData('biz_contact', {
  _SelectFields: ['Id', 'Name'],
  _Where: [['CustomerId', '=', V8.ThisValue]],
  _PageIndex: 1,
  _PageSize: 100
});

V8.FieldSet('ContactId', 'Data', result.Code === 1 ? result.Data : []);
```

前端联动不能替代后端权限和提交校验。

## 表单生命周期

| 配置 | 运行端 | 用途 |
|---|---|---|
| `InFormV8` | 前端 | 默认值、字段显隐、初始化交互 |
| `SubmitFormV8` | 前端 | 即时校验；HTTP 直调不会触发 |
| `SubmitBeforeServerV8` | 后端事务内 | 最终校验、加工、阻止提交 |
| `SubmitAfterServerV8` | 后端事务内 | 同事务联动其它表 |
| `OutFormV8` | 前端 | 关闭后刷新/跳转 |
| `DataFilterV8` | 后端 | 每行脱敏/展示加工 |

事件代码、版本和表单属性都必须从当前 `diy_table/diy_field` 回读。后端阻止提交：

```javascript
if (!V8.Form.Name) return { Code: 0, Msg: '名称不能为空' };
```

## 字段属性

常用属性包括 `Visible`、`AppVisible`、`Required`、`Readonly`、`Data`、
`Config`、`FormWidth`、`TableWidth`、`Tab`、角色绑定和前端事件代码。

- 除非明确隐藏，`Visible=1`、`AppVisible=1`。
- 角色绑定只缩小界面可见性，不能代替服务器数据权限。
- 修改防抖编辑器/代码字段前必须刷新待保存值，避免最后一次输入未入库。
- `Data/Config` 修改后回读并刷新 schema 缓存。

## DevComponent 定制组件

定制组件至少处理：

- `value/modelValue` 的输入与变更通知；
- 当前字段模型、表单模型、表单模式和只读状态；
- 校验错误、清空、禁用、加载与销毁；
- Add/Edit/View 回显；
- PC、移动端和暗色主题；
- 组件内部请求的 Token/OsClient 传递与错误态。

定制组件需要修改并发布主前端。若只服务单一租户、包含多个字段或复杂页面，
优先创建 MicroService 页面，通过 `V8.OpenAppDialog` 与宿主交互。

历史 Options API 定制组件可通过宿主 facade 调用数据源引擎：

```javascript
this.Microi.DataSourceEngine.Run('customer_summary', { Id: customerId }, (result) => {
  if (this.Microi.CheckResult(result)) {
    this.summary = result.Data;
  }
});
```

`Microi.DataSourceEngine.Run` 是回调式宿主接口，`Microi.CheckResult` 负责按
DosResult 约定判断并展示错误。组件卸载后要阻止迟到回调继续写状态；新页面
优先使用项目现有的组合式 facade，不要假定 `this.Microi` 在任意 Vue 组件中
都存在。
