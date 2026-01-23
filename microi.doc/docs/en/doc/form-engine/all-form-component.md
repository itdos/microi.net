# All form components
> * This article introduces all form components

## Single Line Text
> * if you want to restrict a single line of text to only allow input of numbers, id numbers, mobile phone numbers, pure letters, etc., you can change the V8 event by changing the value of the field and the V8 event before the form is submitted.
```js
//Phone字段属性的【值变更V8事件】
V8.Form.Phone = V8.Form.Phone.replace(/\D/g, '');//输入框只能输入数字

//表单提交前V8事件（前后端V8事件均可）
if(V8.Form.Phone.length != 11){
  return { Code : 0,  Msg : '请输入正确的手机号码' };
}
```

## Multi-line text Textarea
* Multiple lines of text with no word limit

## Rich Text RichText
> * Rich text editor, support image upload

## text association Autocomplete
> * input Lenovo query drop-down selection, can also customize the input

## Association Id Guid
> * generally used to store guid values of the string type

## Digital NumberText
> * default int type. if decimal point is turned on, remember to manually change the type to decimal type. if 4 decimal points are decimal(12,4),2 decimal points are decimal(12,2)

## Radio
> * Commonly used radio box

## Check Box Checkbox
The database is stored as a json string.

## Pull-down radio Select
> * Commonly used drop-down selection

## Drop-down check MultipleSelect
The database is stored as a json string.

## Switch
> * The switch component defaults to the int type, turning on 1 and turning off 0 (the very old version defaults to the bit type, and it is recommended to replace it with the int type)
> * __< font color = "red"> The switch component cannot be of varchar type, otherwise it will be turned on regardless of whether the data inventory is "1" or "0" </font>__

## Date Time DateTime
> * It is recommended to use varchar type, the main reason is that the date supports various formatting

## Image upload ImgUpload
> * Anonymous access is not allowed by default

## File Upload FileUpload
> * Anonymous access is not allowed by default

## Rating
> * scoring component, default int type, database storage is int type

## Color selection ColorPicker
* Color selection component, default varchar type, database stored as rgb color value

## Split line Divider
* Split the form, no physical fields are generated

## Button
* Button component that supports V8 code

## HTML
> * Not yet published

## Automatic Numbering AutoNumber
> * Automatic numbering of self-distributed lock, support custom prefix

## Sub-table TableChild
> * Very commonly used subtables

## Map (Point) Map
> * Map Draw Points

## Map (area) MapArea
> * Map drawing area

## Cascade Selector Cascader
> * Custom Cascade Selector

## Organization Department
> * Platform organization selection

## Address Address
> * provincial and municipal linkage

## Mobile phone verification code PhoneSMS
> * Not yet published

## Progress bar Progress
* Show progress, database stores numbers

## Timeline Timeline
> * Not yet published

## Icon Library FontAwesome
> * Integrated FontAwesome

## Custom Component DevComponent
> * custom custom development of components embedded in the form

## Pop-up table OpenTable
> * Pop up the data list, select the trigger event after data submission
> * V8 engine code before popping
```js
//设置查询条件，[V8.Field.XuanzeGLSP]为[弹出表格]控件的[字段名]
V8.OpenTableSetWhere(V8.Field.XuanzeGLSP, [
  ['ShangpinMC', 'Like', '商用直饮机']
]);
```
> * Submit V8 event engine code
```js
//-------前端代码-------
var selectData = V8.TableRowSelected;//获取选中的数据
var selectIds = selectData.map(item => item.Id);//接口引擎只要Id
var result = await V8.ApiEngine.Run('add-gylx-rwz', {
    GongyiLCID: V8.Form.Id, //关联主表Id
    RenwuZIds: selectIds
});
if(result.Code == 1){
    V8.Tips('添加成功！');
    V8.TableRefresh(V8.Field.GongxuLB, {});//刷新子表
}else{
    V8.Tips('添加失败：' + result.Msg, false);
}

//-------接口引擎[add-gylx-rwz]代码-------
if(!V8.Param.GongyiLCID || !V8.Param.RenwuZIds || V8.Param.RenwuZIds.length == 0){
  return { Code : 0, Msg : '参数错误！' };
}
//先查询任务栈列表数据
var renwuzhanList = V8.FormEngine.GetTableData('diy_APSsczx', {
  Ids : V8.Param.RenwuZIds
});
if(renwuzhanList.Code != 1 || renwuzhanList.Data.length == 0){
  return { Code : 0, Msg : '未查询到任务栈列表数据！'  + (renwuzhanList.Msg || '') };
}
//循环插入
for(var i = 0; i < renwuzhanList.Data.length; i++){
  var item = renwuzhanList.Data[i];
  var addResult = V8.FormEngine.AddFormData('diy_APSgylxsczx', {
    ...item,
    Id : '', //重置子表Id
    GongyiLCID : V8.Param.GongyiLCID //关联主表Id
  }, V8.DbTrans);//带事务
  if(addResult.Code != 1){
    return addResult;//会自动回滚事务，因为Code != 1
  }
}
return { Code : 1 };//会自动提交事务，因为Code == 1
```

## Associate Form JoinForm
> * Generally used for custom form templates

## Code Editor CodeEditor
> * Support code association, code indentation, syntax highlighting, code folding and so on

## Drop-down tree SelectTree
> * This is a very powerful component

## JSON table JsonTable
> * Not yet published