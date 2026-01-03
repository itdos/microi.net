# 所有表单组件
>* 本篇对所有表单组件进行介绍

## 单行文本 Text
>* 若要限制单行文本只允许输入数字、身份证号、手机号、纯字母等等，可通过字段的值变更V8事件、表单提交前V8事件来进行限制
```js
//Phone字段属性的【值变更V8事件】
V8.Form.Phone = V8.Form.Phone.replace(/\D/g, '');//输入框只能输入数字

//表单提交前V8事件（前后端V8事件均可）
if(V8.Form.Phone.length != 11){
  return { Code : 0,  Msg : '请输入正确的手机号码' };
}
```

## 多行文本 Textarea
>* 多行文本，不限制字数

## 富文本 RichText
>* 富文本编辑器，支持图片上传

## 文本联想 Autocomplete
>* 输入联想查询下拉选择，也可自定义输入

## 关联Id Guid
>* 一般用于存储string类型的guid值

## 数字 NumberText
>* 默认int类型，如果开启了小数点，记得手动将类型修改为decimal类型，如果4位小数点就是decimal(12,4)，2位小数点就是decimal(12,2)

## 单选框 Radio
>* 常用的单选框

## 复选框 Checkbox
>* 数据库存储为json字符串

## 下拉单选 Select
>* 常用的下拉选择

## 下拉复选 MultipleSelect
>* 数据库存储为json字符串

## 开关 Switch
>* 开关组件默认为int类型，打开1，关闭0（很老的版本默认是bit类型，建议更换为int类型）
>* __<font color="red">开关组件不能是varchar类型，否则不管数据库存的是"1"或者"0"，都会显示打开</font>__

## 日期时间 DateTime
>* 建议使用varchar类型，主要原因是日期支持各种格式设置

## 图片上传 ImgUpload
>* 默认不允许匿名访问

## 文件上传 FileUpload
>* 默认不允许匿名访问

## 评分 Rate
>* 评分组件，默认int类型，数据库存储为int类型

## 颜色选择 ColorPicker
>* 颜色选择组件，默认varchar类型，数据库存储为rgb颜色值

## 分割线 Divider
>* 分割表单，不产生物理字段

## 按钮 Button
>* 按钮组件，支持V8代码

## HTML
>* 暂未发布

## 自动编号 AutoNumber
>* 自带分布式锁的自动编号，支持自定义前缀

## 子表格 TableChild
>* 非常常用的子表

## 地图(点) Map
>* 地图画点

## 地图(区域) MapArea
>* 地图画区域

## 级联选择器 Cascader
>* 自定义级联选择器

## 组织机构 Department
>* 平台组织机构选择

## 地址 Address
>* 省市区联动

## 手机验证码 PhoneSMS
>* 暂未发布

## 进度条 Progress
>* 显示进度，数据库存储数字

## 时间线 Timeline
>* 暂未发布

## 图标库 FontAwesome
>* 集成FontAwesome

## 定制组件 DevComponent
>* 自定义定制开发的组件嵌入到表单中

## 弹出表格 OpenTable
>* 弹出数据列表，选择数据提交后触发事件
>* 弹出前V8引擎代码
```js
//设置查询条件，[V8.Field.XuanzeGLSP]为[弹出表格]控件的[字段名]
V8.OpenTableSetWhere(V8.Field.XuanzeGLSP, [
  ['ShangpinMC', 'Like', '商用直饮机']
]);
```
>* 提交事件V8引擎代码
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

## 关联表单 JoinForm
>* 一般用于自定表单模板

## 代码编辑器 CodeEditor
>* 支持代码联想、代码缩进、语法高亮、代码折叠等等

## 下拉树 SelectTree
>* 这是一个非常强大的组件

## JSON表格 JsonTable
>* 暂未发布