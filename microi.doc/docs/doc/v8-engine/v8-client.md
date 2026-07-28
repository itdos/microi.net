# 🌐 V8 函数列表 - 前端

> **前端 V8 引擎支持完整 ES6 语法，集成丰富的前端函数库**

---

## 📌 介绍

- 前端 V8 引擎代码与服务器端 V8 的编程语言均为 JavaScript 语法
- 前端 V8 引擎支持完整 ES6 语法
- 前端新 HTTP 代码优先使用与后端参数基本一致的 `V8.Http`；旧 `V8.Post/Get` 继续兼容已有代码
- 若前端直接调用服务器端的通用增删改查接口，浏览器内的 `SubmitFormV8` 等前端事件**不会执行**；服务器端提交前/后事件仍按客户端调用语义执行
- 后端接口引擎、后端表单 V8 调用 `V8.FormEngine` 默认不触发表单事件；只有明确传入 `_InvokeType:'Client'` 才触发客户端式表单事件。`_InvokeType` 不是授权开关
- 主要用于表单属性的前端 V8 事件、模块引擎 V8 按钮代码等

## V8.Form
>* 访问当前表单字段值
```js
var id = V8.Form.Id;//在新增数据时也能访问到，因为 Id 是提前生成的，以备子表使用
var name = V8.Form.UserName;
//如果是下拉框组件，则获取到的是object，可访问到数据源中的所有字段
var selectId = V8.Form.SelectUser.Id;
```

## V8.OldForm
>* 访问当前表单修改前字段值
```js
var oldName = V8.OldForm.UserName;
```

## V8.FormSet
>* 在普通表单 `diy-form` 中给字段赋值，并触发目标字段的值变更事件
>* 下拉框可以赋值对象；对象至少应包含该下拉框配置的存储字段（`SelectSaveField`）和显示字段（`SelectLabel`），字段 V8 还会读取其它业务属性时也要一并传入
>* 直接使用 `V8.Form.UserName = value`（包括对象）同样会响应式更新表单，但不会触发该字段的值变更事件，也不会执行 `FormSet` 的下拉选项注入、修改字段记录和模板通知，适合需要“静默赋值”的场景
>* 前端已阻止字段值变更 V8 同步执行期间再次 `FormSet` 当前字段所造成的直接重入；但异步回写和多字段互相赋值仍可能形成循环，字段自身事件中仍建议直接写 `V8.Form.字段名`
>* 在列表按钮、行内编辑等 `diy-table` 上下文中，`FormSet` 只更新当前行并刷新模板结果，不会递归触发目标字段 V8。不要依赖不同上下文的副作用做业务校验
```js
//给文本框赋值
V8.FormSet('UserName', '张三');
//给下拉框赋值（Id和Name分别对应存储字段、显示字段）
V8.FormSet('SelectUser', { Id : 1, Name : '张三', DeptId : 'dept-1' });

//静默赋值：界面会更新，但不会触发SelectUser的值变更V8
V8.Form.SelectUser = { Id : 1, Name : '张三', DeptId : 'dept-1' };
```

## V8.Field
>* 访问当前表单字段属性
```js
var isReadonly = V8.Field.UserName.Readonly;//UserName字段当前是否是只读
//包含属性：Name、Label、Config、Data(绑定数据源)、Readonly、Visible、Placeholder等等
```

## V8.FieldSet
>* 给当前表单字段属性赋值
>* 普通表单支持 `Config.Button.Loading` 这类 `Config` 点路径；列表和部分全屏按钮上下文目前只保证顶层属性（如 `Visible`、`Readonly`、`Data`）可用。跨上下文代码优先使用顶层属性
```js
//设置UserName字段为只读
V8.FieldSet('UserName', 'Readonly', true);
//其它可设置属性：Readonly、Visible、Placeholder等等
//给某个下拉框动态设置数据源：
V8.FieldSet('字段名', 'Data', [{Id:1}, {Id:2}]);
```

## V8.FormMode
>* 获取当前Form打开的模式，可能的值：Add（新增）、Edit（编辑）、View（预览）
```js
if(V8.FormMode == 'Add'){
  V8.FormSet('ShenqingR', V8.CurrentUser.Name);//默认申请人名称
  V8.FormSet('ShenqingRID', V8.CurrentUser.Id);//默认申请人Id
  V8.FormSet('Bumen', V8.CurrentUser.DeptName);//默认申请人部门名称
}
```

## V8.FormSubmitAction
>* 表单提交类型，可能的值：Insert、Update、Delete
>* 在表单进入事件无法访问到值，只能在表单提交前、提交后访问到值
>* 在表单进入事件要判断当前表单是新增、还是编辑，请使用V8.FormMode（可能的值：Add（新增）、Edit（编辑）、View（预览））

## V8.FormOutAction
>* 获取离开表单的类型，可用于离开表单、提交表单后V8引擎代码中做为判断，可能的值：Update、Insert、Close、Delete

## V8.FormOutAfterAction
>* 获取离开表单后的类型，可用于离开表单/提交表单后V8引擎代码，可能的值：Insert、Update、View、Close

## V8.LoadMode
>* 当前Form的加载模式，要么为空，要么值为Design（string，设计模式），特别注意一些事件中如果使用了V8.FieldSet更改了字段属性，需要判断V8.LoadMode == 'Design'时不执行，否则保存表单设计后会持久化保存字段属性。

## V8.KeyCode
>* 键盘V8事件可获取键盘的code值，如Enter键对应13
```javascript
if(V8.KeyCode == 13){
    V8.Tips('您已经按了Enter键！');
}
//常见KeyCode对照表
8‌：Backspace（退格键） ‌
‌9‌：Tab（表格键） ‌
‌12‌：Clear（清除键） ‌
‌13‌：Enter（回车键） ‌
‌16‌：Shift_L（左Shift） ‌
‌17‌：Control_L（左Control） ‌
‌18‌：Alt_L（左Alt） ‌
‌20‌：Caps_Lock（大小写锁定） ‌
‌27‌：Escape（Esc键） ‌
‌32‌：Space（空格键） ‌
‌46‌：Delete（删除键） ‌
‌37‌：Left（左） ‌
‌38‌：Up（上） ‌
‌39‌：Right（右） ‌
‌40‌：Down（下） ‌
```

## V8.TableId、V8.TableName
>* 获取当前DIY表的Id、Name

## V8.EventName
>* 前端V8事件名称，在全局V8引擎代码中比较好用，可能的值
```js
FormTemplateEngine：表单模板引擎
TableTemplateEngine：表格模板引擎
OpenTableBefore：弹出表格前事件
OpenTableSubmit：弹出表格提交事件
FieldOnKeyup：表单文本框键盘事件
TableFieldOnKeyup：表格行内文本框键盘事件
FieldSlotButtonClick：单行文本插槽按钮点击事件
FormOut：离开表单事件（指表单提交后）
FormSubmitBefore：表单提交前事件
FormIn：进入表单事件
FieldValueChange：字段值变更事件
BtnFormDetailRun：详情按钮V8按钮
V8BtnLimit：V8按钮是否显示事件
V8BtnRun：V8按钮执行事件
TableRowClick：表格行点击V8事件
PageTab：多Tab页签V8事件
WFNodeEnd：流程节点结束V8事件
WFNodeStart：流程节点开始V8事件
```

## V8.CurrentToken
>* 当前登陆身份token
>* Token 可能在每次受保护请求后续签轮换。Microi.Client 以公共 Token 存储为请求发送时的单一事实源，平台请求层收到响应头中的新 `authorization/token` 后会更新公共存储并同步登录状态；不要再用组件或状态库中的副本决定是否携带 Token，也不要把 Token 写入 URL、日志、`V8.Result` 或业务数据，或自行长期缓存旧值

## V8.TableModel
>* 获取当前表的对象，里面包含了Id、Name等表信息。

## V8.ThisValue
>* 当前字段事件的新值。下拉框通常是选中对象，文本/数字等控件可能是原始值；表格行内部分数值控件可能传入 `{ New, Old }`

## V8.OldValue
>* 当前字段旧值，仅在表格行内字段值变更上下文中可靠提供。普通表单字段事件应从 `V8.OldForm` 或业务快照读取，不要假设始终存在

## 常用上下文变量

不同事件只会提供与当前宿主有关的变量，使用前应判空：

| 变量 | 主要上下文 | 说明 |
|------|------------|------|
| `V8.DataAppend` | 表单、列表、弹窗 | 打开宿主时传入的附加业务数据 |
| `V8.SysMenuId` | 标准菜单表单/列表 | 当前真实菜单 Id；只读使用，不要伪造 |
| `V8.SysMenuModel` | 列表、菜单按钮 | 当前菜单模型 |
| `V8.TableRowId` | 表单、子表 | 当前记录 Id 或父子表关联值 |
| `V8.CurrentTableData` | 表单/列表 | 当前页或当前宿主已加载的数据 |
| `V8.TableRowSelected` / `V8.SelectedData` | 列表批量按钮 | 当前勾选行数组，两个名称互为兼容别名 |
| `V8.ClearTableSelection()` | 列表 | 清空勾选 |
| `V8.SearchParam` | 列表 | `{ Keyword, Where }` 当前搜索快照 |
| `V8.Row` / `V8.Rows` / `V8.RowIndex` | 表格行事件 | 当前行、当前页行数组、行索引 |
| `V8.Event` | 插槽按钮等显式传事件的场景 | 原生浏览器事件；键盘 V8 目前请使用 `V8.KeyCode` |
| `V8.Result` | 模板、显隐、字段回调 | 事件/模板的显式输出 |
| `V8.ParentForm` / `V8.ParentV8` | 子表/嵌套表单 | 父级数据与父级 V8 |
| `V8.FormWF` | 带流程表单 | 当前工作流打开状态 |
| `V8.ApiReplace` | 表单 | 当前表单的接口替换配置 |

## V8.Tips
>* 右下角弹出消息提示
```js
V8.Tips(msgContent, true/false, time)
//msgContent为消息内容
//true为成功消息（1秒后消失），false为错误消息（5秒后消失）
//time可传入提示框多少秒后消失
```

## V8.CurrentUser
>* 访问当前登陆用户信息
```js
var id = V8.CurrentUser.Id;
```

## V8.Http

前端现已支持与后端一致的对象参数：`Get/GetResponse`、`Post/PostResponse`、`Patch/PatchResponse`。浏览器请求是异步的，因此前端必须使用 `await`；字符串方法返回原始响应文本，完整响应方法返回 `{ Content, Headers, RawBytes, StatusCode, ErrorMessage }`。

```javascript
var postText = await V8.Http.Post({
  Url: '/api/example',
  PostParam: { Id: 1 },
  ParamType: 'json',
  Timeout: 600, // 秒；默认即 600（10 分钟），可按接口覆盖
  Headers: { 'X-Trace-Id': 'trace-id' }
});
var postResult = JSON.parse(postText);

var getText = await V8.Http.Get({
  Url: '/api/example',
  GetParam: { Id: 1 }
});

var patchResp = await V8.Http.PatchResponse({
  Url: '/api/example/1',
  PatchParamString: JSON.stringify({ profile: { name: '新名字' } }),
  ParamType: 'json'
});
if (patchResp.StatusCode >= 200 && patchResp.StatusCode < 300) {
  var data = JSON.parse(patchResp.Content);
}
```

参数与后端一致：`Url`、`GetParam`、`PostParam/PostParamString`、`PatchParam/PatchParamString`、`ParamType`、`Timeout/TimeOut`、`Headers/Header`、`FilesByteBase64/FilesByteString/FilesByte`。默认超时 `600` 秒（10 分钟）；`GetParam` 可为 GET、POST、PATCH 附加 URL 查询参数。相对地址或当前 `ApiBase` 会自动携带吾码登录头并接收续签 Token；外部绝对地址不会自动携带吾码 Token。浏览器请求第三方域名仍需对方允许 CORS。

浏览器不支持后端的 `FilesStream`；使用 Base64、字符串或字节数组文件参数。更多示例见后端 `V8.Http` 文档及 `v8-http-integration` skill。

## V8.Post
>* 历史兼容方法，继续保留。前端新代码应优先使用参数与后端基本一致的 `V8.Http`；`V8.Post/Get` 不再作为新功能首选，已有代码无需迁移。
```javascript
//发起ajax请求，常规用法，自带token，默认Form Data参数格式（非Request Payload）
V8.Post('api url', { Id : 1 }, function(result){
    if(result.Code == 1){ ... }
})
//完整用法
V8.Post({
  url : '',//接口地址，必传。
  data : {}, //接口参数
  dataType : 'json', //默认空（Form Data），可选json（Request Payload）
  header : {}, //可选参数
  success : function(result){ }, //请求成功的回调函数，常用参数。
  fail : function(result){ }, //请求失败的回调函数，如接口报错404、500，可选参数，也可传入error，与fail一致。
});
```

## V8.Get
>* 历史兼容 GET 方法，继续保留。
```js
V8.Get('api url', {}, function(result){})
```

## V8.ChineseToPinyin
>* 中文转拼音，V8.ChineseToPinyin(chinese, fullPyLen, type)
```js
//fullPyLen: 前几个字转换为全拼音
//type : 1：驼峰（默认），2：全大写，3：全小写
var pinyin = V8.ChineseToPinyin('你好吾码', 2, 1);//结果：NihaoWM
```

## V8.RefreshTable({ _PageIndex : 1 })
>* 刷新表格数据列表，_PageIndex传入-1表示跳转到最后一页。
>* 一般用于页面更多按钮、行更多按钮等刷新当前表格。
>* `V8.RefreshTable` 刷新当前 V8 所属的列表；`V8.TableRefresh(子表字段, 参数)` 用于刷新当前主表单里的指定子表格。

## V8.Router.Push
>* 页面跳转，可以在V8按钮上执行
```js
V8.Router.Push(`/notice`)
```

## V8.Window.Open
>* 打开新页面，如：
```js
V8.Window.Open(`https://microi.net`)
```

## V8.OpenForm(formModel, type)
>* 打开表单，type：'View'/'Edit'/'Add'，如在[行更多V8按钮]事件中：
```js
V8.OpenForm(V8.Form, 'Edit')
```

## V8.OpenFormWF(formModel, type)
>* 打开带流程信息的表单。（目前是获取此数据对应的最后一个流程）

## V8.SelectedData
>* 列表批量按钮中获取已选择的行数组，每行包含当前列表已查询的数据。兼容别名为 `V8.TableRowSelected`；非列表上下文不保证存在
```js
//批量删除数据
var selectData = V8.SelectedData;
if(selectData.length == 0){
  V8.Tips('请选择要删除的数据！', false);
  return;
}
V8.ConfirmTips(`确认批量删除选中的[${selectData.length}]条数据？`, async function(){
  var ids = selectData.map(item => { return item.Id });
  var result = await V8.FormEngine.DelFormData('diy_order', {
    Ids : ids
  });
  if(result.Code != 1){
    V8.Tips('删除失败：' + result.Msg, false);
    return;
  }
  V8.Tips('删除成功！');
  V8.RefreshTable({ _PageIndex : 1 })
});
```

## V8.SearchSet
>* 列表/PageTabs **替换**搜索条件。数组按 `_Where` 处理；对象会转换为各字段的 `Like` 条件
```js
V8.SearchSet([
  ['Age', '>=', 18],
  ['Age', '<', 50]
]);
// 或：
V8.SearchSet({ Status: '待办' });
```

## V8.SearchAppend
>* 列表/PageTabs **追加**搜索条件。数组追加 `_Where`；对象合并到当前搜索模型
```js
V8.SearchAppend([
  ['Age', '>=', 18],
  ['Age', '<', 50]
]);
// 或：
V8.SearchAppend({ OwnerId: V8.CurrentUser.Id });
```

## V8.AppendSearchChildTable【建议使用V8.OpenTableSetWhere】
>* 弹出表格的[弹出前V8事件代码]中为表格指定搜索条件
```js
V8.AppendSearchChildTable(V8.Field.XuanzeGLSP, { ShangpinLXZ: '1'});
```

##  V8.OpenTableSetWhere
>* 弹出表格的[弹出前V8事件代码]中为表格指定搜索条件
```js
V8.OpenTableSetWhere(V8.Field.XuanzeGLSP, [
  ['ShangpinMC', 'Like', '商用直饮机']
]);
```

## V8.IsNull(value)
>* 判断某个值是否为空
>* 当值为null、undefined、''（空字符串）、'null'（null字符串）、'undefined'（undefined字符串），均返回true

## 父表中对子表操作
```javascript
V8.TableSearchAppend(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})

V8.TableSearchSet(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})

V8.TableRefresh(V8.Field.子表Name, { _PageIndex : -1 })
_PageIndex传入-1表示跳转到最后一页。（注意与【V8.RefreshTable】不同的是它一般是用于模块引擎中行更多按钮、页面更多按钮刷新当前表格，将来会优化函数命名）。
```

## V8.FormSubmit
>* 提交表单，注意：此函数会触发`前端表单提交前V8事件`，因此不能在`前端表单提交前V8事件`调用此函数，否则会死循环。
```js
V8.FormSubmit({
  CloseForm: true,  //是否关闭Form表单
  SavedType:'Insert', //保存表单后的操作Insert/Update/View
  Callback: function (result) {
    if (result && result.Code == 1) {
      V8.Tips('保存成功', true);
    }
  }
});
```

## V8.FormClose
>* 强制关闭表单
```js
V8.FormClose();
```

## V8.ParentV8
>* 子表中访问父表的V8对象，可使用父表V8对象的所有功能
```js
var parentForm = V8.ParentV8.Form;//访问父级表单所有字段
V8.ParentV8.FormSet('字段名', '值');
```
## V8.AddSysLog
>* 新增日志
```js
V8.AddSysLog({
  Title : '库存同步', 
  Type : 'SyncStock', 
  Content : '张三调用了库存同步接口，同步后库存为100。'
})
```

## V8.ReloadForm
>* 重新加载当前表单
```js
V8.ReloadForm({ Id : 'xxxx-xxxx-xxxx'}, 'Edit/View' );//以编辑或预览模式重新加载当前表单
```

## V8.HideFormBtn
>* 隐藏编辑、删除、新增按钮
```js
V8.HideFormBtn('Update');
V8.HideFormBtn('Delete');
V8.HideFormBtn('Save');
```

## V8.HideFormTab(tabName)
>* 隐藏某个表单Tab标签页
```js
V8.HideFormTab('tabName（在表单属性中配置的Tab名称）')
```

## V8.ShowFormTab(tabName)
>* 显示某个表单Tab标签页
```js
V8.ShowFormTab('tabName（在表单属性中配置的Tab名称）')
```

## V8.ClickFormTab(tabName)
>* 选中某个表单Tab标签页

## V8.GetFormTabs
>* 获取表单所有Tab标签页。

## V8.ConfirmTips
>* 确认提示框
```javascript
例：V8.ConfirmTips('确认审批？', okCallback, cancelCallback, option)。 

`option` 除了 `Title`、`OkText`、`CancelText`、`Icon` 外，还支持 `CustomClass` 自定义弹窗样式，以及 Element Plus 兼容的 `BeforeClose(action, instance, done)` 关闭前校验。文件上传、表格、Tab、步骤条等复杂交互仍应优先使用 `V8.OpenAppDialog`；`BeforeClose` 主要用于极少量输入或老环境兼容兜底。
//option为可选参数，可配置：{Title:'',OkText:'',CancelText:'',Icon:''}
```
> `ConfirmTips` 内部会按 HTML 渲染 `content`。只有完全可信或经过 HTML 转义的数据才能拼接进去，严禁直接插入用户输入、接口返回文本、数据库富文本或 URL。复杂交互不要拼 HTML，使用 `V8.OpenAppDialog`。
>
>* 自定义 HTML 仅用于简单、一次性的可信展示，如下图所示：
<table>
  <tr>
    <td><img src="https://static.itdos.com/upload/img/v8-confirm-tips.png"/></td>
    <td><img src="https://static.itdos.com/upload/img/v8-confirm-tips-2.png"/></td>
  </tr>
</table>

::: details 动态html参考代码
```JS
// @cham 2026-04-30 快捷报工保存后，完成品弹出确认跳转入库
if (V8.FormOutAction == 'Insert'
  && V8.Form._GongDanLX == '生产工单'
  && V8.Form._LinshiGX != 1) {

  // ConfirmTips 按 HTML 渲染，所有业务值必须先转义
  var escapeHtml = function (value) {
      return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
  };

  // 查询工位任务，判断是否为完成品（末道工序 ShifouMDGX == 1）
  var gwrwRes = await V8.FormEngine.GetFormData('diy_gwrw', {
      Id: V8.Form.GongweiRWID
  });

  if (gwrwRes.Code == 1 && gwrwRes.Data && gwrwRes.Data.ShifouMDGX == 1) {
      // 附带查询条件跳转到本次报工的【快捷报工单】

      // BaoGongD 为服务端自动生成，OutFormV8 的 V8.Form 中可能为空，需回查
      var bgRes = await V8.FormEngine.GetFormData('diy_baogong', {
          Id: V8.Form.Id,
          _SelectFields: ['Id', 'BaoGongD']
      });
      var baoGongDan = (bgRes.Code == 1 && bgRes.Data) ? bgRes.Data.BaoGongD : '';

      // 查询本次报工生成的箱码列表
      var xmRes = await V8.FormEngine.GetTableData('diy_kjbgxm', {
          _Where: [['DangqianBGDID', '=', V8.Form.Id], ['IsDeleted', '=', 0]],
          _SelectFields: ['Xiangma', 'CunhuoMC', 'Tuhao', 'ZhuangxiangSL', 'RukuZT']
      });
      var xmList = (xmRes.Code == 1 && xmRes.Data) ? xmRes.Data : [];

      // 构建箱码明细表格 HTML
      var tdStyle = 'style="padding:4px 8px;border:1px solid #ddd;white-space:nowrap"';
      var thStyle = 'style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5;white-space:nowrap"';
      var rows = xmList.map(function(item, idx) {
          return '<tr>'
              + '<td ' + tdStyle + '>' + (idx + 1) + '</td>'
              + '<td ' + tdStyle + '>' + escapeHtml(item.Xiangma || '') + '</td>'
              + '<td ' + tdStyle + '>' + escapeHtml(item.CunhuoMC || '') + '</td>'
              + '<td ' + tdStyle + '>' + escapeHtml(item.Tuhao || '') + '</td>'
              + '<td ' + tdStyle + ' style="text-align:center">' + escapeHtml(item.ZhuangxiangSL || 0) + '</td>'
              + '<td ' + tdStyle + '>' + escapeHtml(item.RukuZT || '-') + '</td>'
              + '</tr>';
      }).join('');

      var html = '<div>'
          + '<div style="margin-bottom:8px">报工单号：<b>' + escapeHtml(baoGongDan) + '</b>，共生成 <b>' + xmList.length + '</b> 个箱码，是否跳转到快捷报工单进行入库？</div>'
          + '<div style="max-height:260px;overflow-y:auto">'
          + '<table style="width:100%;border-collapse:collapse;font-size:13px">'
          + '<thead><tr>'
          + '<th ' + thStyle + '>序号</th>'
          + '<th ' + thStyle + '>箱码</th>'
          + '<th ' + thStyle + '>存货名称</th>'
          + '<th ' + thStyle + '>图号</th>'
          + '<th ' + thStyle + '>装箱数量</th>'
          + '<th ' + thStyle + '>入库状态</th>'
          + '</tr></thead>'
          + '<tbody>' + rows + '</tbody>'
          + '</table>'
          + '</div></div>';

      V8.ConfirmTips(
          html,
          function () {
              V8.Router.Push('/baogongdan?Keyword=' + encodeURIComponent(baoGongDan));
          },
          function () { /* 用户取消 */ },
          {
              Title: '入库提示',
              OkText: '前往入库',
              CancelText: '稍后处理',
              Icon: 'icon-exclamation-circle'
              // Width: '780px'
          }
      );
  }
}
```
:::

## V8.ShowTableChildHideField
>* 将子表已隐藏的字段强制显示出来，并且刷新子表。
```js
V8.ShowTableChildHideField('子表fieldName',['fieldName','fieldName']);
V8.RefreshChildTable(fieldModel, V8.Row);//刷新子表
V8.RefreshChildTable(V8.Field.子表列名, V8.Row);//第二个参数可传入parentFormModel。
```

## V8.GetChildTableData
```js
var data = V8.GetChildTableData('子表字段名称');
```

## V8.CurrentTableData
>* 获取当前表当页的数据

## 表格/表单 V8 模板引擎

- 表格模板逐行同步执行，`V8.EventName='TableTemplateEngine'`，`V8.Form`/`V8.Row` 是当前行。输出优先级为 `V8.Result` → JavaScript `return` → 原字段值。
- 表单模板异步执行，`V8.EventName='FormTemplateEngine'`，使用 `V8.Result` 输出；空值会回退到原字段值。
- 模板能访问的字段取决于当前菜单查询列。缺字段应补模块查询列或在后端 `DataFilterV8` 预处理，不要在逐行模板中调用 FormEngine 造成 N+1。
- 模板结果最终通过 `v-safe-html`/DOMPurify 净化后渲染。`script`、`iframe`、`on*` 事件属性、`javascript:` 等危险内容会被移除，因此不要依赖 `onclick` 等内联事件。
- 输出建议显式转换为字符串，并对业务文本做 HTML 转义。模板只负责展示；权限、校验、金额/状态写入等业务逻辑必须放后端。

```js
var escapeHtml = function (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

V8.Result = '<span class="badge badge-success">'
  + escapeHtml(V8.Form.Status)
  + '</span>';
```

## V8.WF.StartWork
>* 发起流程
```javascript
V8.WF.StartWork({        
    FlowDesignId:'',//流程图Id，必传        
    FormData:JSON.stringify({}),//可选，也可以传入{} object类型，内部会自动序列化        
    TableRowId:'',//关联的数据Id，必传        
    NoticeFields:JSON.stringify([]),//通知数据，可选，格式：[{Id:'字段Id',Name:'字段名',Label:'字段名称',Value:'值'}]，如果是数组类型，内部会自动序列化        
    //还可以传入选择的下一步审批人、添加的审批人、审批意见 等等    
}, function(result){//这是回调函数处理，result返回了Receivers、ToNodeName等
  if(result.Code == 1){
    V8.Tips('发起流程成功！');
  }
});
```

## V8.SendSystemMessage
>* 发送系统消息、消息提醒
::: details 展开查看 JavaScript 代码（25 行）
```js
//消息内容
var msgContent = '测试v8发送系统消息！' + new Date().toString();

//内容增加路由跳转
msgContent += '<a href="/#/microi-upt-log?Keyword=v3.5.27&Tab=测试Tab3">测试页面跳转</a>';

//发送系统消息
V8.SendSystemMessage({
	Content: msgContent,
  	ToUserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',//admin  //'c19e70d1-b7b3-4eaa-933d-e8f59c85562f' anderson
}, function(result){
	V8.Tips(JSON.stringify(result), true, 20);
});

//后端接口引擎可以这样使用：
return V8.Http.Post({
  Url : V8.SysConfig.ApiBase + '/api/DiyChat/SendSystemMessage',
  PostParam : {
    Content : `测试接口引擎通过https发送系统消息！<a href="/#/microi-upt-log?Keyword=v3.5.27&Tab=测试Tab3">测试页面跳转</a> 发送时间：${V8.Action.GetDateTimeNow()}`,
    ToUserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03'//给admin帐号发送一条消息
  },
  Headers : {
    authorization : 'Bearer ' + V8.Method.GetCurrentToken().Token
  }
});
```
:::

## V8.FormWF
>* 访问当前是否打开了带流程界面的表单，返回值：
```js
{
    IsWF:true/false, //是否打开了带流程界面的表单
    WorkType:'',//StartWork、ViewWork
    FlowDesignId:'流程图Id'
}
```

## V8.Base64
>* Base64 编码/解码（不是加密，不能用于保护密码或密钥）
```js
V8.Base64.encode('待编码字符串');//编码
V8.Base64.decode('待解码Base64');//解码
V8.Base64.isValid('待判断字符串');//判断是否是有效 Base64
```

## V8.OpenDialog
>* 打开一个定制组件对话框
::: details 展开查看 JavaScript 代码（28 行）
```javascript
V8.OpenDialog({    
    ComponentName:'NodeColConfig',//必传，其余参数可选。组件名称，二次开发必须提前预注册。    
    Title: '测试定制组件标题',    
    OpenType:'',//可传：Drawer    
    TitleIcon: 'fas fa-plus',//标题左侧的图标   
    Width: '70%',   
    DataAppend:{//传入自定义附加数据，DataAppend为固定参数名称        
        Abc:123,        
        Name:'张三'    
    }
});
//在定制组件内props接收V8对象：
props: {    
    DataAppend:{        
        type: Object,        
        default: () => {}    
    }},
    mounted() {    
        //this.DataAppend.V8包含了绝大部分可使用的V8内置函数，可以使用V8事件一样的写法。    
        //获取已打开的表单中（或已选中的一条表格数据）的Title字段值。    
        var title = this.DataAppend.V8.Form.Title;    
        //访问传过来的自定义数据    
        var name = this.DataAppend.Name;//张三    
        //刷新diy表格    
        this.DataAppend.V8.RefreshTable();    
        //关闭当前对话框    
        this.DataAppend.V8.CloseThisDialog();
    }
```
:::
>* 通用打开iframe
```js
V8.OpenDialog({    
    ComponentName:'OpenIframe',//必传，其余参数可选。组件名称，二次开发必须提前预注册。    
    Title: '打印',    
    OpenType:'Drawer',//可传：Drawer    
    TitleIcon: 'fas fa-plus',//标题左侧的图标   
    Width: '800px',   
    DataAppend:{//传入自定义附加数据，DataAppend为固定参数名称
        Url:'/autoprint/#/doprint',        
        PrintId:'27833304-caeb-4665-b722-808fd3663bb1',
        DataApi: `${V8.SysConfig.ApiBase}/apiengine/print_xm?OsClient=${V8.SysConfig.OsClient}&Id=${ids}`
    }
});
```

## V8.OpenAppDialog
>* 在表格、表单、页面按钮等前端 V8 代码中，以标准 Dialog/Drawer 打开一个已经发布的在线微服务应用。适合复杂交互页面，可避免把大量 HTML、CSS、JavaScript 直接写进按钮 V8 代码。

```js
V8.OpenAppDialog({
    AppKey: 'saas_tenant_creator',
    RoutePath: '/create',
    Title: '创建空数据库 SaaS 租户',
    TitleIcon: 'fas fa-database',
    Width: 'min(960px, calc(100vw - 32px))',
    OpenType: 'Dialog',
    Data: {
        source: 'osclients',
        osClientNetwork: 'Internal'
    },
    OnSuccess: function (data) {
        V8.Tips('创建任务已提交', true);
        V8.RefreshTable({ _PageIndex: -1 });
    },
    OnCancel: function (data) {
        console.log('用户取消', data);
    },
    OnError: function (error) {
        V8.Tips(error.message || '应用加载失败', false);
    }
});
```

### 参数说明

| 参数 | 类型 | 必传 | 默认值 | 说明 |
|------|------|------|--------|------|
| `AppKey` | `string` | 是 | - | 在线微服务的唯一标识，对应 `sys_microiservice.MsKey`。应用必须已经编译发布。 |
| `RoutePath` | `string` | 否 | `/` | 微服务内部路由，例如 `/create`。未以 `/` 开头时会自动补齐。 |
| `MicroRoute` | `string` | 否 | `/` | `RoutePath` 的兼容别名；两者同时传入时优先使用 `RoutePath`。 |
| `Version` | `string` | 否 | 当前发布版本 | 缓存版本标识，例如 `v1.0.2`。宿主始终访问固定的 `/{AppKey}/index.html?v={Version}` 入口；不传时自动读取 `sys_microiservice.BuildVersion`。 |
| `Title` | `string` | 否 | `应用` | 弹窗或抽屉标题。 |
| `TitleIcon` | `string` | 否 | `fas fa-window-maximize` | 标题左侧图标 class。 |
| `Width` | `string` | 否 | `min(920px, calc(100vw - 32px))` | 弹窗/抽屉宽度，支持 `px`、`%`、`vw`、`min(...)` 等 CSS 宽度值。 |
| `OpenType` | `string` | 否 | `Dialog` | 打开方式：`Dialog` 或 `Drawer`。 |
| `Data` | `object` | 否 | `{}` | 传给子应用的业务数据。应使用可序列化的普通对象，不要在其中放回调函数。 |
| `OnSuccess` | `function(data)` | 否 | - | 子应用提交成功时执行；执行后宿主会自动关闭弹窗。 |
| `OnCancel` | `function(data)` | 否 | - | 子应用主动取消时执行；执行后宿主会自动关闭弹窗。 |
| `OnError` | `function(error)` | 否 | - | 应用加载失败或子应用上报错误时执行；错误不会自动关闭弹窗。 |

### 子应用获取宿主参数

宿主会自动向微服务传入当前环境，不需要把 Token 拼接到 URL：

```js
var hostData = window.microApp.getData();

// 当前环境
console.log(hostData.apiBase);
console.log(hostData.osClient);
console.log(hostData.token);

// OpenAppDialog 参数
console.log(hostData.appKey);
console.log(hostData.version);
console.log(hostData.microRoute);
console.log(hostData.dialog);       // true
console.log(hostData.dialogData);   // 即宿主传入的 Data
```

| 子应用字段 | 说明 |
|------------|------|
| `apiBase` | 当前吾码后端地址。 |
| `osClient` | 当前租户标识。 |
| `token` | 当前登录 Token，供子应用请求吾码接口时使用。 |
| `appKey` | 当前微服务 AppKey。 |
| `version` | 实际加载的构建版本。 |
| `microRoute` | 实际打开的微服务内部路由。 |
| `dialog` | 固定为 `true`，用于让应用识别弹窗运行模式。 |
| `dialogData` | `V8.OpenAppDialog` 的 `Data` 参数。 |
| `route` | 路由兼容对象，包含 `microRoute`、`microRoutePath`。 |

### 子应用返回结果

微服务通过 micro-app 的数据通信协议向宿主派发结果：

```js
// 成功：触发 OnSuccess，并自动关闭
window.microApp.dispatch({
    type: 'app-dialog:success',
    data: { taskId: '01H...', osClient: 'customer_a' }
});

// 取消：触发 OnCancel，并自动关闭
window.microApp.dispatch({
    type: 'app-dialog:cancel',
    data: { reason: 'user-cancel' }
});

// 失败：触发 OnError，弹窗保持打开，便于用户修改后重试
window.microApp.dispatch({
    type: 'app-dialog:error',
    data: { message: 'OsClient 已存在' }
});
```

同时兼容简写类型 `success`、`cancel`、`error`。

### 与 V8.OpenDialog 的区别

| API | 适用场景 |
|-----|----------|
| `V8.OpenAppDialog` | 按 `AppKey` 动态加载在线 AI 应用/微服务；应用可以独立维护、AI 生成、编译和发布。 |
| `V8.OpenDialog` | 打开 Microi.Client 源码中已经注册的 Vue 组件，需要前端二次开发和重新发布主站。 |

复杂定制界面优先使用 `V8.OpenAppDialog`；按钮 V8 代码只负责传参、接收结果和刷新页面，数据校验及业务事务仍应放在接口引擎或后端服务中。

## V8.NewGuid
>* 生成一个前端Guid值
```js
var newGuid = V8.NewGuid();
```

## await V8.NewServerGuid
>* 生成一个服务器端Guid值
```js
var newGuid = await V8.NewServerGuid();
```

## V8._
>* 访问underscore对象，常用的js实用库
```js
//underscore用法见：https://underscorejs.org/   https://underscorejs.net/ 
V8._.where(...)
```

## V8.ModuleEngine
>* 当前标准前端 V8 运行时没有公开挂载 `V8.ModuleEngine`。模块关联查询应配置为接口引擎/数据源引擎，或使用后端受控查询；不要仅因后端存在同名能力就在前端调用

## V8.ApiEngine
>* 接口引擎
```javascript
// 推荐：ApiEngineKey + 参数，返回 Promise
var result = await V8.ApiEngine.Run('ApiEngineKey', {
    Param1 : '1',
});

// 对象参数形式
var result2 = await V8.ApiEngine.Run({
  ApiEngineKey: 'ApiEngineKey',
  Param1: '1'
});

// 历史回调形式继续兼容
V8.ApiEngine.Run('ApiEngineKey', { Param1: '1' }, function (r) {
  V8.Tips(r.Code == 1 ? '执行成功' : r.Msg, r.Code == 1);
});

// 长任务：返回 Promise；第 4 个参数是持久化任务选项，第 5 个可传 callback
await V8.ApiEngine.RunBackground(
  'ApiEngineKey',
  { Param1: '1' },
  '后台任务标题',
  {
    IdempotencyKey: 'import:' + V8.Form.Id,
    ConcurrencyKey: 'customer-import',
    BusinessTable: 'biz_import',
    BusinessId: V8.Form.Id,
    BusinessStatusField: 'TaskStatus',
    BusinessTaskIdField: 'BackgroundTaskId',
    BusinessProgressField: 'TaskProgress',
    BusinessEtaField: 'EstimatedEndTime'
  }
);
```

预计超过 2 分钟、500 条、1000 个扇出子操作、100 次外部调用，或安装/初始化/迁移/备份类动作，应使用后台任务。未知总量不要伪造百分比；超过 10 分钟必须由后端按 checkpoint 分片。详见[任务调度与后台任务](../system-engine/job)。

## V8.DataSourceEngine
>* 数据源引擎。`Run` 返回 Promise，并兼容回调；旧 `GetData` 已弃用
```js
var result = await V8.DataSourceEngine.Run('DataSourceKey', {
  Keyword: '测试'
});

var result2 = await V8.DataSourceEngine.Run({
  DataSourceKey: 'DataSourceKey',
  Keyword: '测试'
});

V8.DataSourceEngine.Run('DataSourceKey', {}, function (r) {
  console.log(r);
});
```

## V8.OpenAnyForm
>* 打开一个任意表单
::: details 展开查看 JavaScript 代码（26 行）
```javascript
V8.OpenAnyForm({
  TableName: "Diy_BizOrder", //必传。打开哪张表。
  FormMode: "Edit", //必传。打开的模式：Add、Edit、View
  Id: V8.Form.Id, //当FormMode为Edit、View时，必传Id。
  DialogType: "Dialog", //可选。打开的方式，不传则默认为表单属性设置的打开方式。
  SelectFields: ["ZhipaiXX", "ShouhouRY"], //可选。只查询、显示哪些字段。不传则默认显示。
  Width: "765px", //可选。弹出层的宽度。不传则默认为表单属性设置的弹出宽度。
  DataAppend: {
    //传入自定义附加数据，DataAppend为固定参数名称。可在指定的打开表单V8事件中使用V8.DataAppend访问。
    Abc: 123,
    Name: "张三",
  },
  //替换掉提交事件。可选。
  EventReplace: {
    //这3个参数一定会接收到，必须执行callback(DosResult)
    Submit: async function (v8, param, callback) {
      //调用指派接口
      var result = await V8.ApiEngine.Run('shouhoudd_zhipai',{
        Id: v8.Form.Id,
        ShouhouRY: v8.Form.ShouhouRY,
      });
      callback(result);
      V8.RefreshTable({ _PageIndex: 1 });
    },
  },
});
```
:::

`OpenAnyForm` 负责发起打开动作，不是“等待用户关闭后返回结果”的 Promise。需要替换保存行为时使用 `EventReplace.Submit(v8, param, callback)`，其中小写 `v8` 是被打开的子表单上下文；外层 `V8` 仍是发起打开动作的父上下文。替换提交后必须调用 `callback(DosResult)`。

## V8.OpenAnyTable
>* 打开一个任意列表
::: details 展开查看 JavaScript 代码（28 行）
```javascript
V8.OpenAnyTable({   
  SysMenuId: "69a9c7a9-7130-414e-a4f8-9f3690075d22", //SysMenuId、ModuleEngineKey必传一个，打开哪个菜单。   
  //ModuleEngineKey: "modelKey",
  DialogType: "Drawer", // 可选：Dialog / Drawer，默认 Dialog
  Width: "80vw", // 可选：支持 80%、80vw、960px、960，数字会按 px 处理
  Direction: "rtl", // 可选：Drawer 方向，支持 rtl/ltr/ttb/btt，默认 rtl
  MultipleSelect: true, // 是否多选   
  PropsWhere : [
    ['FkId', '=', V8.Form.Id]
  ],//查询条件
  ShowLeftSelectionList: true, //左侧选中列表是否显示，选true时下面这5条信息配置可用
  ShowPrefix: true, //是否显示前缀
  ShowTitleName: 'PeijianBH', //主标题
  ShowSubTitleList: ['PeijianMC'], //副标题
  ShowPageSize: 10, //显示条数
  NoPullDown: false, //是否禁用下拉
  SubmitEvent : async function (selectData,callback){//当前选择器提交按钮必传
    var addList = [];
    if (selectData.length == 0) {
      V8.Tips('请选择数据');
      V8.Result = false;
    } else {
		//调用指派接口
      var result = await V8.ApiEngine.Run('ApiKeyName', {
        Name: V8.Form.Name,
      })
	  callback(result);
      V8.RefreshTable({ _PageIndex: 1 });
    }
  }
})
```
:::

`DialogType` 不传时继续使用弹窗模式；传 `"Drawer"` 时使用抽屉模式。`Width` 同时作用于弹窗宽度和抽屉尺寸，支持百分比、`vw` 和固定 `px`，纯数字会按 `px` 处理。列表型子表建议使用 `"80vw"` 或 `"80%"`，窄表单类选择可使用 `"960px"`。

- `SysMenuId` 与 `ModuleEngineKey` 必须传一个，用于加载真实菜单/模块上下文；不要传与目标表无关的菜单 Id。
- `SubmitEvent(selectData, callback)` 在当前选择器提交模式中必须提供，调用 `callback(...)` 后宿主关闭。
- `ContinuousSelection` 控制跨页连续选择，`TableMultipleSelection` 可传入初始选中行，`ShowDiyFieldList` 可限制选择列表显示列。
- `TableChildImportContext`、父子表外键、`_TableChildAuth` 等属于平台内部关系上下文，不要在业务 V8 中手工构造。

## 表单按钮防重复点击
```js
V8.FieldSet('YijianSCFBMX', 'Config.Button.Loading', true); 
var result = await V8.ApiEngine.Run('ApiKeyName', {});
V8.FieldSet('YijianSCFBMX', 'Config.Button.Loading', false); 
```
## V8.ClientType
>* 访问当前客户端类型
```js
//可能的值：PC、IOS、Android、H5、WeChat
var clientType = V8.ClientType;
```

## V8.SysConfig
>* 访问当前租户允许公开给浏览器的系统设置脱敏投影
```js
var sysTitle = V8.SysConfig.SysTitle;
var apiBase = V8.SysConfig.ApiBase;
```

`V8.SysConfig` 不是 `sys_config`/SaaS 配置整行。数据库、Redis、对象存储、MQ、搜索、密码、Secret、Token、Key、Connection、`ClientSecrets`、`GlobalServerV8Code` 等敏感字段不会注入浏览器。需要业务密钥的逻辑必须放到后端接口引擎或受控服务中，禁止尝试从前端读取。

## V8.FormEngine
>* 前端表单引擎 facade，用于受权限约束的单表 CRUD。完整查询参数见：[FormEngine用法](https://microi.net/doc/v8-engine/form-engine.html)

### 前端真实方法

前端 `V8.FormEngine` 不是后端方法的一比一映射。当前标准运行时公开：

| 方法 | 常用签名 | 返回 |
|------|----------|------|
| `GetFormData` | `(table, params, callback?)` / `(params, callback?)` | `Promise<DosResult>` |
| `GetFormDataAnonymous` | 同上 | `Promise<DosResult>` |
| `GetTableData` | 同上 | `Promise<DosResult>` |
| `GetTableTree` | 同上 | `Promise<DosResult>` |
| `AddFormData` | 同上 | `Promise<DosResult>` |
| `AddFormDataBatch` | `(rows, callback?)` | `Promise<DosResult>` |
| `UptFormData` | `(table, params, callback?)` / `(params, callback?)` | `Promise<DosResult>` |
| `UptFormDataBatch` | `(rows, callback?)` | `Promise<DosResult>` |
| `UptFormDataByWhere` | `(table, params, callback?)` / `(params, callback?)` | `Promise<DosResult>` |
| `DelFormData` | `(table, params, callback?)` / `(params, callback?)` | `Promise<DosResult>` |
| `DelFormDataBatch` | `(rows, callback?)` | `Promise<DosResult>` |
| `DelFormDataByWhere` | `(table, params, callback?)` / `(params, callback?)` | `Promise<DosResult>` |

前端没有公开 `GetTableDataCount`、`GetTableDataTree`（前端名称为 `GetTableTree`）、`AddTableData`、`UptTableData`、`DelTableData`、`AddField`。这些名字可能存在于后端 V8，但不能直接复制到前端代码。

```js
// 推荐 Promise/await
var listResult = await V8.FormEngine.GetTableData('Diy_Product', {
  _Where: [['Status', '=', 1]],
  _SelectFields: ['Id', 'Name', 'Status'],
  _PageIndex: 1,
  _PageSize: 20
});

// 历史回调形式继续兼容
V8.FormEngine.GetFormData('Diy_Product', { Id: V8.Form.ProductId }, function (r) {
  if (r.Code == 1) {
    V8.FormSet('ProductName', r.Data.Name);
  }
});

// 对象参数形式
var rowResult = await V8.FormEngine.GetFormData({
  FormEngineKey: 'Diy_Product',
  Id: V8.Form.ProductId
});
```

### 菜单上下文、跨表兼容与性能

- 当前 V8 目标表就是当前菜单绑定表时，前端 scoped facade 自动注入真实 `_SysMenuId`，历史项目不需要逐个补参数。
- 跨表调用不会错误继承当前主表菜单。未显式传菜单时，后端根据当前用户有效角色可访问的目标表菜单授权快照推断权限，兼容大量历史前端 V8。
- 显式传 `_SysMenuId`（或兼容的 `ModuleEngineKey`）会进入严格菜单校验；传错、伪造或借用其它表菜单必须失败，不能退回兼容推断。
- 授权快照按 `OsClient` 隔离，使用共享 Redis 版本号和带 TTL 的授权快照，并允许平台普通两级缓存加速；每次外部授权检查先读取共享版本，角色、菜单、表权限变更会递增版本使旧快照不可达。Redis 不可用时回源数据库，不能继续使用陈旧快照。
- 菜单 `SqlWhere`、关联限制和数据范围由后端强制追加。前端 `_Where` 只能缩小结果，不能覆盖服务端范围。
- 平台敏感表对普通客户端硬拒绝；不要用通用 FormEngine 读写 SaaS、接口引擎、表/字段元数据、菜单角色、用户、任务、数据源、工作流等控制面表。
- 后端接口引擎、后端表单 V8 属于服务端受信任调用，不要求 `_SysMenuId`；浏览器不能通过提交 `_TrustedServerInvocation` 或 `_InvokeType:'Server'` 把自己变成受信任调用。
- Import/Export 使用独立端点和专项权限，必须携带目标模块的真实菜单上下文；它们不是 `V8.FormEngine` facade 方法。

### TableChild 委托授权

标准 `TableChild` 会自动携带内部 `_TableChildAuth` 关系提示。该对象不是授权令牌，浏览器中的值不能被信任；服务端仍会重新加载父/子表、父/子菜单和 `TableChild` 字段配置，校验父记录数据范围、父键唯一性和子表外键，并强制写入真实外键条件。

业务 V8 不得手工构造、缓存、跨父记录复用或向其它表传播 `_TableChildAuth`。存量项目也不需要给每个隐藏子表菜单逐角色补权限，合法子表访问由上述父记录范围内的委托授权完成。

## 移动端函数
### 蓝牙打印
::: details 展开查看 JavaScript 代码（143 行）
```js
//单条打印
if(V8.ClientType == 'PC'){
    var ids = JSON.stringify([V8.Form.Id]);
    var Dydz = 'f606ae5e-1ada-45d0-971c-53533b70a461';
    V8.OpenDialog({    
        ComponentName:'OpenIframe',//必传，其余参数可选。组件名称，二次开发必须提前预注册。    
        Title: '打印',    
        OpenType:'Drawer',//可传：Drawer    
        TitleIcon: 'fas fa-plus',//标题左侧的图标   
        Width: '800px',   
        DataAppend:{//传入自定义附加数据，DataAppend为固定参数名称
            Url:'/autoprint/#/doprint',        
            PrintId:Dydz,
            DataApi: `${V8.SysConfig.ApiBase}/apiengine/print_bgxm?OsClient=${V8.SysConfig.OsClient}&Id=${ids}`
        }
    });
}else{
    console.log('Microi：移动端蓝牙打印准备开始！');
    //如果没有连接，则打开蓝牙连接页面
    if(!V8.Print || !V8.Print.BLEInformation || !V8.Print.BLEInformation.deviceId){
        console.log('Microi：移动端准备蓝牙连接！');
        V8.Print.OpenBluetoothPage();
        console.log('Microi：移动端已打开蓝牙连接页面！');
    }else{//如果已连接，直接开始打印
        console.log('Microi：移动端准备开始打印！');
        var command = V8.Print.createNew();
        command.setSize(75, 65);//设置页面大小，单位mm
        command.setGap(2);//传感器
        command.setCls();//清除打印机缓存
        command.setText(0, 30, "TSS24.BF2", 1, 1, "图片");//打印文字
        command.setQR(40, 120, "L", 5, "A", "www.baidu.com佳博");//打印二维码
        command.setText(60, 90, "TSS24.BF2", 1, 1, "佳博");//打印文字
        command.setText(170, 50, "TSS24.BF2", 1, 1, "小程序测试");//打印文字
        command.setText(170, 90, "TSS24.BF2", 1, 1, "测试数字12345678");//打印文字
        command.setText(170, 120, "TSS24.BF2", 1, 1, "测试英文abcdefg");//打印文字
        command.setText(170, 150, "TSS24.BF2", 1, 1, "测试符号/*-+!@#$");//打印文字
        command.setBarCode(170, 180, "EAN8", 64, 1, 3, 3, "1234567");//打印条形码
        command.setPagePrint();//打印页面
        V8.Print.prepareSend(command.getData());//准备发送，根据每次发送字节数来处理分包数量
        console.log('Microi：移动端打印结束！');
    }
}

//批量打印
if (V8.ClientType == 'PC') {
    var ids = JSON.stringify([V8.Form.Id]);
    var Dydz = '38fa78e7-a5c6-4311-8e5d-2879e7e4b45a';
    V8.OpenDialog({
        ComponentName: 'OpenIframe', //必传，其余参数可选。组件名称，二次开发必须提前预注册。    
        Title: '打印',
        OpenType: 'Drawer', //可传：Drawer    
        TitleIcon: 'fas fa-plus', //标题左侧的图标   
        Width: '800px',
        DataAppend: { //传入自定义附加数据，DataAppend为固定参数名称
            Url: '/autoprint/#/doprint',
            PrintId: Dydz,
            // DataApi: `${V8.SysConfig.ApiBase}/apiengine/print_bgxm?OsClient=${V8.SysConfig.OsClient}&Id=${ids}`
            DataApi: `${V8.SysConfig.ApiBase}/apiengine/print-demo?OsClient=${encodeURIComponent(V8.OsClient)}&Id=${ids}`
        }
    });
} else {
    //2025-01-04 Anderson：实现批量打印
    //如果没有连接，则打开蓝牙连接页面
    if(!V8.Print || !V8.Print.BLEInformation || !V8.Print.BLEInformation.deviceId){
        console.log('Microi：移动端准备蓝牙连接！');
        V8.Print.OpenBluetoothPage();
        console.log('Microi：移动端已打开蓝牙连接页面！');
    }else{
        var bgdId = V8.Form.DangqianBGDID;
        var resXMlist = await V8.FormEngine.GetTableData('diy_kjbgxm', {
            _Where: [
                ['DangqianBGDID', '=', bgdId]
            ],
            _SelectFields: [
                'Xiangma', // 箱码（二维码内容）
                'Cunhuo', // 物料代码
                'CreateTime', // 生产日期
                'ShengchanPH', // 批次
                'ZhuangxiangSL', // 数量
                'GuigeXH' // 图号
            ]
        });
        if (resXMlist.Code != 1) {
            V8.Tips(resXMlist.Msg, false);
            return;
        }
        var dataXMList = resXMlist.Data;
        //2025-01-04 Anderson：for循环太快，改为3秒执行一次
        var index = 0;
        console.log(`Microi：移动端准备批量打印：共[${dataXMList.length}]条！`);
        V8.Tips(`移动端准备批量打印：共[${dataXMList.length}]条！`);
        if(dataXMList.length >= 100){
            V8.Tips(`条数【${dataXMList.length }】过多！`, false);
            return;
        }
        function forPrint(row){
            if(index >= dataXMList.length){
                console.log(`Microi：移动端批量打印结束！`);
                V8.Tips(`移动端批量打印结束！`);
                return;
            }
            console.log(`Microi：移动端开始批量打印：第[${index + 1}]条！`);
            V8.Tips(`移动端开始批量打印：第[${index}]条！`);
            //--打印内容
            {
                var cmd = V8.Print.createNew();
                cmd.setSize(75, 65);
                cmd.setGap(2);
                cmd.setCls();
                /* 标题 */
                cmd.setText(220, 10, "TSS24.BF2", 1, 1, "【试运行】产品标识卡");
                /* 左侧字段 */
                cmd.setText(10, 60, "TSS24.BF2", 1, 1, "物料代码");
                cmd.setText(10, 100, "TSS24.BF2", 1, 1, "物料名称");
                cmd.setText(10, 140, "TSS24.BF2", 1, 1, "生产日期");
                cmd.setText(10, 180, "TSS24.BF2", 1, 1, "批次");
                cmd.setText(10, 220, "TSS24.BF2", 1, 1, "数量");
                cmd.setText(10, 260, "TSS24.BF2", 1, 1, "图号");
                /* 右侧数据：用当前行数据 */
                cmd.setText(180, 60, "TSS24.BF2", 1, 1, row.Cunhuo || '');
                cmd.setText(180, 100, "TSS24.BF2", 1, 1, row.Cunhuo || ''); // 物料名称如不同字段再改
                cmd.setText(180, 140, "TSS24.BF2", 1, 1, row.CreateTime || '');
                cmd.setText(180, 180, "TSS24.BF2", 1, 1, row.ShengchanPH || '');
                cmd.setText(180, 220, "TSS24.BF2", 1, 1, row.ZhuangxiangSL || '');
                cmd.setText(180, 260, "TSS24.BF2", 1, 1, row.GuigeXH || '');
                /* 右侧二维码：当前箱码 */
                cmd.setQR(420, 300, "L", 5, "A", row.Xiangma || '');
                cmd.setPagePrint();
                /* 3. 一次性发送 */
                V8.Print.prepareSend(cmd.getData());
            }
            index++;
            setTimeout(function(){
                forPrint(dataXMList[index])
            }, 3000);
        }
        forPrint(dataXMList[0]);
        /* 2. 拼打印数据 */
        // for (var i = 0; i < dataXMList.length; i++) {
        //     var row = dataXMList[i];
        // }
    }
}
```
:::

### 二维码、条形码扫码 V8.Method?.ScanCode
>* 支持H5、小程序、APP
```js
if (V8.Method?.ScanCode) {
  await V8.Method?.ScanCode();//同步等待扫码成功
  if(V8.ScanCodeRes){//获取到的扫码值
    V8.FormSet('SaomaValue', V8.ScanCodeRes);//赋值
  }else{
    V8.Tips('扫码结束，未扫到值！', false)
  }
}else{
  V8.Tips('非移动端环境，暂不支持扫码！', false)
}
```
