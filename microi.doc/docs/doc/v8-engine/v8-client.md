# V8函数列表-前端
## 介绍
>* 前端V8引擎代码与服务器端V8的编程语言均为Javascript语法
>* 前端V8引擎支持完整ES6语法
>* 前端V8引擎集成了很多函数直接通过http调用后端接口，与V8.Post()写对应的接口地址效果一样
>* 前端V8引擎代码在前端执行，若是直接通过调用服务器端的低代码平台通用增删改查接口，前端V8事件不会执行（服务器端V8事件会执行）
>* 前端V8函数主要用于表单属性的前端V8事件、模块引擎V8按钮代码等

## V8.Form
>* 访问当前表单字段值
```js
var id = V8.Form.Id;//在新增数据时也能访问到，因为id是提前后成，以备可能有子表要使用
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
>* 给当前表单字段赋值，并且会触发被赋值字段的值变更事件
>* 使用V8.Form.UserName = '张三'; 则不会触发UserName字段的值变更事件
>* 强烈不建议在字段的值变更事件中使用FormSet再次对此字段赋值，否则有可能会死循环，此时一定要使用V8.Form.UserName = '张三';这种方式赋值。
```js
//给文本框赋值
V8.FormSet('UserName', '张三');
//给下拉框赋值（其中Id和Name就是下拉框组件中字段属性配置的存储字段与显示字段名称）
V8.FormSet('UserName', { Id : 1, Name : '张三' });
```

## V8.Field
>* 访问当前表单字段属性
```js
var isReadonly = V8.Form.UserName.Readonly;//UserName字段当前是否是只读
//包含属性：Name、Label、Config、Data(绑定数据源)、Readonly、Visible、Placeholder等等
```

## V8.FieldSet
>* 给当前表单字段属性赋值
```js
//设置UserName字段为只读
V8.FieldSet('UserName', 'Readonly', false);
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
>* 键盘事件V8可获取键盘的code值，如Enter键对应13
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
FieldOnKeyup：文本框键盘事件
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

## V8.TableModel
>* 获取当前表的对象，里面包含了Id、Name等表信息。

## V8.ThisValue
>* 访问下拉框选择后的值对象，如V8.ThisValue.Id

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

## V8.Post
>* 注意后端V8的post是V8.Http.Post()，目前暂时写法不一致，后期会统一。
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
>* 发起ajax请求
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
>* 注意与【V8.TableRefresh】不同的是它是刷新当前主表单里面的子表格（将来会优化函数命名）。

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
>* 获取已选择的行数组，每行包含了所有数据
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
>* 表格Tabs**设置**搜索条件
```js
V8.SearchSet([
  ['Age', '>=', 18],
  ['Age', '<', 50]
]);
```

## V8.SearchAppend
>* 表格Tabs**追加**搜索条件
```js
V8.SearchAppend([
  ['Age', '>=', 18],
  ['Age', '<', 50]
]);
```

## V8.AppendSearchChildTable【建议使用V8.OpenTableSetWhere】
>* 弹出表格的[弹出前事件V8代码]中为表格指定搜索条件
```js
V8.AppendSearchChildTable(V8.Field.XuanzeGLSP, { ShangpinLXZ: '1'});
```

##  V8.OpenTableSetWhere
>* 弹出表格的[弹出前事件V8代码]中为表格指定搜索条件
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
>* 提交表单。
```js
V8.FormSubmit({
  CloseForm:true, 
  SavedType:'Insert', 
  Callback : function
});
//CloseForm：是否关闭Form表单；
//SavedType：保存表单后的操作Insert/Update/View
//Callback：回调函数
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
V8.HideFormTab('tabName（在表单属性中配置的Tab名称）')
```

## V8.ClickFormTab(tabName)
>* 选中某个表单Tab标签页

## V8.GetFormTabs
>* 获取表单所有Tab标签页。

## V8.ConfirmTips
>* 确认提示框
```javascript
例：V8.ConfirmTips('确认审批？', okCallback, cancelCallback, option)。 
//option为可选参数，可配置：{Title:'',OkText:'',CancelText:'',Icon:''}
```

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
>* Base64加解密
```js
V8.Base64.endcode('待加密字符串');//加密
V8.Base64.dedcode('待解密字符串');//解密
V8.Base64.isValid('已加密字符串');//判断是否是已加密的base64格式
```

## V8.OpenDialog
>* 打开一个定制组件对话框
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
>* 模块引擎相关

## V8.ApiEngine
>* 接口引擎
```javascript
//调用方式：
var result = await V8.ApiEngine.Run('ApiEngineKey', { 
    Param1 : '1',
});
```

## V8.DataSourceEngine
>* 数据源引擎

## V8.OpenAnyForm
>* 打开一个任意表单
```javascript
V8.OpenAnyForm({
  TableName: "Diy_ShouhouDD", //必传。打开哪张表。
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
        ShouhouRY: V8.Form.ShouhouRY,
      });
      callback(result);
	  V8.RefreshTable({ PageIndex: 1 });
    },
  },
});
```

## V8.OpenAnyTable
>* 打开一个任意列表
```javascript
V8.OpenAnyTable({   
  SysMenuId: "69a9c7a9-7130-414e-a4f8-9f3690075d22", //SysMenuId、ModuleEngineKey必传一个，打开哪个菜单。   
  //ModuleEngineKey: "modelKey",
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
  SubmitEvent : async function (selectData,callback){//提交事件    
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
      V8.RefreshTable({ PageIndex: 1 });
    }
  }
})
```

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
>* 访问系统设置信息
```js
//可以访问到系统设置sys_config表的任意字段
var sysTitle = V8.SysConfig.SysTitle;
```

## V8.FormEngine
>* 见平台文档：[FormEngine用法](/doc/v8-engine/form-engine.html)

## 移动端函数
### 蓝牙打印
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
            DataApi: `${V8.SysConfig.ApiBase}/apiengine/print_bgxm?0sClient=${V8.SysConfig.OsClient}&Id=${ids}`
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
            // DataApi: `${V8.SysConfig.ApiBase}/apiengine/print_bgxm?0sClient=${V8.SysConfig.OsClient}&Id=${ids}`
            DataApi: 'https://api.chongstech.com/apiengine/print_bgxm?OsClient=qiqiang&Id=' + ids
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