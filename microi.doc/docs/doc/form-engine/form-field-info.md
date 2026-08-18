# 📋 表单、字段属性、事件

> **表单属性与字段属性的各类 V8 事件详解**

---

## 字段说明的呈现规则

字段配置了【字段说明】后，表单会按 Label 对齐方式直接呈现说明文字，不再默认只显示一个需要鼠标悬停的 `i` 图标：

- `left`、`right`：说明显示在 Label 与控件整行下方，使用紧凑灰色小字，默认最多两行，避免为了说明文字明显拉大字段间距。
- `top`：说明显示在 Label 右侧，空间不足时单行省略；鼠标停留或键盘聚焦可读取完整说明，不能挤乱标题与控件布局。

字段说明用于解释输入口径、范围或风险提示，不能代替必填、格式、权限与服务器端校验。移动窄屏回落为顶部 Label 时按 `top` 规则显示。

---

## 📄 表单属性

### 前端进入表单 V8 事件

可以做一些默认值处理：
```js
//如果是新增数据
if(V8.FormMode == 'Add'){//FormMode可能的值：Add（新增）、Edit（编辑）、View（预览）
    V8.FormSet('Name', V8.CurrentUser.Name);//设置默认值
}
```

---

### 前端提交表单前 V8 事件

可以做一些表单验证，提升用户体验：
>* __<span class="mci-doc-danger">注意：如果直接通过如Postman调用接口的方式来进行增删改，此前端V8事件事件并“不会执行”（后端V8事件会执行）</span>__
```js
//若代码出现return Code为0时，则会在前端阻止表单继续提交
return { Code : 0, Msg : '错误信息，已阻止表单提交！' };

//表单提交类型，可能的值：Insert、Update、Delete
var submitType = V8.FormSubmitAction;
```

### 前端离开表单后V8事件
>* 一般建议使用【服务器端表单提交后V8事件】
>* 此事件可以做一些特殊业务逻辑处理

### V8 代码版本

表单设计器保存表单/字段 V8、VS Code 推送以及 MCP 修改表单事件、字段事件、接口引擎或工作流节点代码时，服务端会比较保存前后的代码。只有代码内容真实变化才会向 `mic_data_version` 新增版本；仅调整布局、字段标题等非代码配置不会产生空版本。

代码编辑器的【版本】只负责查看、对比和恢复。预览与对比使用 Monaco 只读编辑器；对比左侧为历史版本、右侧为当前代码，行级和字符级差异使用背景色标识，不再需要手动“保存当前版本”。

### 服务器端数据处理V8事件
>* 该事件会在获取列表数据后每一行执行、获取表单数据后执行。
>* 已封装对象：
>* a）V8.RowIndex：列表数据的行索引，0开始
>* b）V8.Form：列表数据每行对象、表单数据对象
>* c）V8.NotSaveField：指定哪些字段在编辑时不保存
>* d）V8.CacheData：用于缓存数据
>* 可以实现某些字段脱敏，如：V8.Form.价格 = "***";此时一定要设置：V8.NotSaveField = ["价格"];否则在修改数据时会将***写到数据库。
>* 示例：
```javascript
// 这里只决定返回值是否脱敏；真正的数据访问权限必须由后端授权策略强制。
// 平台超级管理员阈值为 Level >= 9999。
if(Number(V8.CurrentUser.Level || 0) < 9999){
    V8.Form.Price = "***";//脱敏
    V8.Form.CompanyName = "***";//脱敏
    V8.NotSaveField = ["Price", "CompanyName"];//告诉前端，此字段在编辑时不保存
}
```

### 服务器端表单提交前V8事件
>* 此事件在事务中执行
>* __<span class="mci-doc-danger">注意：如果直接通过Postman调用接口的方式来进行增删改，此V8事件代码“仍会执行”</span>__
>* __<span class="mci-doc-danger">注意：如果是在后端V8事件、接口引擎中调用V8.FormEngine进行增删改，此事件“不会执行”（开发者一般只想做基本的增删改，防止出现意料之外的动作），但可以通过传入_InvokeType:'Client'实现也执行此事件</span>__
::: details 展开查看 JavaScript 代码（28 行）
```js
//表单提交类型，可能的值：Insert、Update、Delete
var submitType = V8.FormSubmitAction;

//若代码出现return，并且未指定Code的值、或Code值不等于1时，则会在后端阻止表单继续提交，并且自动回滚事务，无需手动执行V8.DbTrans.Rollback()
return { Code : 0, Msg : '错误信息，已阻止表单提交！' };

//若代码出现return，并且未指定Code的值，则会在后端阻止表单继续提交，并且自动回滚事务，无需手动执行V8.DbTrans.Rollback()
return { A : 111, B : 222 };
//此时增删改接口会返回数据格式：
{ Code : 0, Data : { A : 111, B : 222 }, Msg : "执行[表单提交前V8事件]失败，V8事件返回结果：{ A : 111, B : 222 }" }

//在事务中操作其它表
var result = V8.FormEngine.UptFormData('other_table', {
    _Where:[]
}, V8.DbTrans);
if(result.Code != 1){
    //此时可无需执行V8.DbTrans.Rollback()回滚事务，平台会自动回滚事务
    return { Code : 0, Msg : 'other_table修改失败，已阻止表单提交！已回滚事务！' };
}

//执行其它接口引擎时，可选传入V8.DbTrans对象。此时一般此接口内部也无需手动提交或回滚事务。
result = V8.ApiEngine.Run('apiengine_key', {
    Form : V8.Form//传入当前表单数据
}, V8.DbTrans);
//防止某些接口引擎未返回数据，而是返回的null导致result.Code报错，所以这里的判断是【result && result.Code != 1】
if(result && result.Code != 1){
    return result;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
```
:::


### 服务器端表单提交后V8事件
>* 此事件仍在事务中执行，如果要获取当前表单提交后的数据，需要使用V8.DbTrans对象来获取
>* __<span class="mci-doc-danger">注意：如果直接通过Postman调用接口的方式来进行增删改，此V8事件代码“仍会执行”</span>__
>* __<span class="mci-doc-danger">注意：如果是在后端V8事件、接口引擎中调用V8.FormEngine进行增删改，此事件“不会执行”（开发者一般只想做基本的增删改，防止出现意料之外的动作），但可以通过传入_InvokeType:'Client'实现也执行此事件</span>__
::: details 展开查看 JavaScript 代码（33 行）
```js
//若代码出现return，并且未指定Code的值、或Code值不等于1时，则会在后端阻止表单继续提交，并且自动回滚事务，无需手动执行V8.DbTrans.Rollback()
return { Code : 0, Msg : '错误信息，已阻止表单提交！' };

//若代码出现return，并且未指定Code的值，则会在后端阻止表单继续提交，并且自动回滚事务，无需手动执行V8.DbTrans.Rollback()
return { A : 111, B : 222 };
//此时增删改接口会返回数据格式：
{ Code : 0, Data : { A : 111, B : 222 }, Msg : "执行[表单提交后V8事件]失败，V8事件返回结果：{ A : 111, B : 222 }" }

//在事务中操作其它表
var result = V8.FormEngine.UptFormData('other_table', {
    _Where:[]
}, V8.DbTrans);
if(result.Code != 1){
    //此时可无需执行V8.DbTrans.Rollback()回滚事务，平台会自动回滚事务
    return { Code : 0, Msg : 'other_table修改失败，已阻止表单提交！已回滚事务！' };
}

//在事务中获取当前数据。也可以使用V8.Form访问前端传入的当前数据，但可能数据字段并不完整
result = V8.FormEngine.GetFormData('this_table', {
    Id : V8.Form.Id
}, V8.DbTrans);//若不传入V8.DbTrans对象，则在修改、删除事件中获取的是老数据。而在新增事件中获取不到数据，因为事务还未提交。

//表单提交类型，可能的值：Insert、Update、Delete
var submitType = V8.FormSubmitAction;

//执行其它接口引擎时，可选传入V8.DbTrans对象。此时一般此接口内部也无需手动提交或回滚事务。
result = V8.ApiEngine.Run('apiengine_key', {
    Form : V8.Form
}, V8.DbTrans);
//防止某些接口引擎未返回数据，而是返回的null导致result.Code报错，所以这里的判断是【result && result.Code != 1】
if(result && result.Code != 1){
    return result;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
```
:::

## 字段属性
### 绑定角色
>* 当字段绑定了角色时，只有该角色在查看表单时才能看到此字段
