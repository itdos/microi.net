# Forms, field properties, events

## Form Properties

### Front End Entry Form V8 Event
> * can do some default value processing
```js
//如果是新增数据
if(V8.FormMode == 'Add'){//FormMode可能的值：Add（新增）、Edit（编辑）、View（预览）
    V8.FormSe('Name', V8.CurrentUser.Name);//设置默认值
}
```

### Front-end V8 event before form submission
> * Can do some form validation to improve user experience
> *_<font color = "red"> note: if you directly call the interface by Postman to add, delete, this front-end V8 event will not be executed (the back-end V8 event will be executed)</font>__
```js
//若代码出现return Code为0时，则会在前端阻止表单继续提交
return { Code : 0, Msg : '错误信息，已阻止表单提交！' };

//表单提交类型，可能的值：Insert、Update、Delete
var submitType = V8.FormSubmitAction;
```

### V8 event after front-end leaves form
> * it is generally recommended to use [V8 event after server-side form submission]]
> * This event can do some special business logic processing

### Server-side data processing V8 events
> * This event will be executed every row after obtaining the list data and after obtaining the form data.
> * Encapsulated object:
> * a)V8.RowIndex: the row index of the list data, starting from 0
> * B) V8.Form: list data row object, form data object
> * c)V8.NotSaveField: Specify which fields are not saved when editing
> * d)V8.CacheData: for caching data
> * Some fields can be desensitized, such as V8.Form. Price = "***"; Be sure to set: V8.NotSaveField = ["Price"]; Otherwise*** will be written to the database when modifying the data.
> * Example:
```javascript
//如果不是超级管理员，数据脱敏
if(V8.CurrentUser.Level < 999){
    V8.Form.Price = "***";//脱敏
    V8.Form.CompanyName = "***";//脱敏
    V8.NotSaveField = ["Price", "CompanyName"];//告诉前端，此字段在编辑时不保存
}
```

### Server-side form pre-submit V8 event
> * This event is executed in a transaction
> *_<font color = "red"> Note: This V8 event code "will still be executed" if additions, deletions and changes are made directly by Postman calling the interface </font>__
> *_<font color = "red"> note: if V8.FormEngine is called in the back-end V8 event and interface engine for addition, deletion and modification, this event "will not be executed" (developers generally only want to do basic addition, deletion and modification to prevent unexpected actions), but this event can also be executed by passing in_InvokeType:'Client' </font>__
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


### V8 event after server-side form submission
> * This event is still executed in the transaction. If you want to obtain the data after the current form is submitted, you need to use the V8.DbTrans object to obtain
> *_<font color = "red"> Note: This V8 event code "will still be executed" if additions, deletions and changes are made directly by Postman calling the interface </font>__
> *_<font color = "red"> note: if V8.FormEngine is called in the back-end V8 event and interface engine for addition, deletion and modification, this event "will not be executed" (developers generally only want to do basic addition, deletion and modification to prevent unexpected actions), but this event can also be executed by passing in_InvokeType:'Client' </font>__
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

## Field Properties
### Binding Role
> * When the field is bound to a role, only the role can see this field when viewing the form