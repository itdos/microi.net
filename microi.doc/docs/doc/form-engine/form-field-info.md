# 表单、字段属性、事件

## 表单属性

### 前端进入表单V8事件
>* 可以做一些默认值处理
```js
//如果是新增数据
if(V8.FormMode == 'Add'){//FormMode可能的值：Add（新增）、Edit（编辑）、View（预览）
    V8.FormSe('Name', V8.CurrentUser.Name);//设置默认值
}
```

### 前端提交表单前V8事件
>* 可以做一些表单验证，提升用户体验
>* __<font color="red">注意：如果直接通过如Postman调用接口的方式来进行增删改，此前端事件V8事件并“不会执行”（后端V8事件会执行）</font>__
```js
//若代码出现return Code为0时，则会在前端阻止表单继续提交
return { Code : 0, Msg : '错误信息，已阻止表单提交！' };

//表单提交类型，可能的值：Insert、Update、Delete
var submitType = V8.FormSubmitAction;
```

### 前端离开表单后V8事件
>* 一般建议使用【服务器端表单提交后V8事件】
>* 此事件可以做一些特殊业务逻辑处理

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
//如果不是超级管理员，数据脱敏
if(V8.CurrentUser.Level < 999){
    V8.Form.Price = "***";//脱敏
    V8.Form.CompanyName = "***";//脱敏
    V8.NotSaveField = ["Price", "CompanyName"];//告诉前端，此字段在编辑时不保存
}
```

### 服务器端表单提交前V8事件
>* 此事件在事务中执行
>* __<font color="red">注意：如果直接通过Postman调用接口的方式来进行增删改，此事件V8代码“仍会执行”</font>__
>* __<font color="red">注意：如果是在后端V8事件、接口引擎中调用V8.FormEngine进行增删改，此事件“不会执行”（开发者一般只想做基本的增删改，防止出现意料之外的动作），但可以通过传入_InvokeType:'Client'实现也执行此事件</font>__
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
    Form : V8.Form
}, V8.DbTrans);
//防止某些接口引擎未返回数据，而是返回的null导致result.Code报错，所以这里的判断是【result && result.Code != 1】
if(result && result.Code != 1){
    return result;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
```


### 服务器端表单提交后V8事件
>* 此事件仍在事务中执行，如果要获取当前表单提交后的数据，需要使用V8.DbTrans对象来获取
>* __<font color="red">注意：如果直接通过Postman调用接口的方式来进行增删改，此事件V8代码“仍会执行”</font>__
>* __<font color="red">注意：如果是在后端V8事件、接口引擎中调用V8.FormEngine进行增删改，此事件“不会执行”（开发者一般只想做基本的增删改，防止出现意料之外的动作），但可以通过传入_InvokeType:'Client'实现也执行此事件</font>__
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
if(result && result.Code != 1){
    //此时可无需执行V8.DbTrans.Rollback()回滚事务，平台会自动回滚事务
    return { Code : 0, Msg : 'other_table修改失败，已阻止表单提交！已回滚事务！' };
}

//在事务中获取当前数据
result = V8.FormEngine.GetFormData('this_table', {
    Id : V8.Form.Id
}, V8.DbTrans);//若不传入V8.DbTrans事件，则在修改、删除提交中获取的是老数据。在新增提交中则获取不到数据。

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

## 字段属性
### 绑定角色
>* 当字段绑定了角色时，只有该角色在查看表单时才能看到此字段