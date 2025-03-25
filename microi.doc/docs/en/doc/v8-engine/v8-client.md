V8 Function List-Front EndIntroduction* The front-end V8 engine code and the server-side V8 programming language are Javascript syntax.
* Front-end V8 engine supports full ES6 syntax
* The front-end V8 engine integrates many functions to directly call the back-end interface through http, which has the same effect as V8.Post() writing the corresponding interface address.
* The front-end V8 engine code is executed at the front-end. If the server-end low-code platform general addition, deletion, modification and query interface is directly called, the front-end V8 event will not be executed (the server-end V8 event will be executed).

V8.FormAccess current form field values
Example: var name = V8.Form.UserName;
If it is a drop-down box component and the binding display field is set, it can be: V8.Form. The field name. Display Fields

V8.OldFormAccess field values before modification of the current form
Example: var oldName = V8.OldForm.UserName;

V8.FormSetAssign a value to the current form field
Example: V8.FormSet('UserName', 'Zhang San');
You can also use the regular js writing method (but it may not take effect in some special cases):V8.Form.UserName = 'Zhang San ';

V8.FieldAccess the current form field properties
Example: var isReadonly = V8.Form.UserName.Readonly;// UserName whether the field is currently read-only
Contains properties: Name, Label, Config, Data (binding data source), Readonly, Visible, Placeholder, and so on

V8.FieldSetAssign a value to the current form field property
Example: V8.FieldSet('UserName', 'Readonly', false);// Set the UserName field to read-only

V8.FormOutActionGets the type of leaving the form, which can be used as a judgment in V8 engine code after leaving the form and submitting the form. Possible values: Update/Insert/Close/Delete

V8.FormOutAfterActionGets the type after leaving the form, which can be used for V8 engine code after leaving the form/submitting the form, possible values: Insert/Update/View/Close

V8.FormSubmitActionForm submission type (Insert/Update/Delete), you can assign V8.Result = false in V8 Engine Code Before Form Submission; to prevent form submission.

V8.FormModeGet the mode opened by the current Form, with possible values: Add (new), Edit (edit), View (preview)

V8.LoadModeThe loading mode of the current Form is either empty or has a value of Design(string, design mode). Pay special attention to some events. If V8.FieldSet is used to change the field properties, it is necessary to judge that V8.LoadMode = = 'Design' will not be executed, otherwise the field properties will be saved persistently after the form design is saved.

V8.TableRowIdGet the Id of the current Form, or use V8.Form.Id

V8.KeyCodeKeyboard event V8 can obtain the code value of the keyboard, such as the Enter key corresponding to 13```javascript
if(V8.KeyCode == 13){
    V8.Tips('您已经按了Enter键！');
}
```


V8.TableId, V8.TableNameObtain the ID and Name of the current DIY table.

V8.EventNameThe name of the front-end V8 event, which is relatively easy to use in the global V8 engine code. Possible values:
FormTemplateEngine: Form Template Engine
TableTemplateEngine: Table Template Engine
OpenTableBefore: Pop-up Form Pre-Event
OpenTableSubmit: Pop-up form submission event
FieldOnKeyup: Text Box Keyboard Events
FormOut: Leave form event (refers to after form submission)
FormSubmitBefore: Pre-Form Submission Events
FormIn: Enter Form Event
FieldValueChange: Field Value Change Event
BtnFormDetailRun: Details Button V8 Button
V8BtnLimit: whether the V8 button shows an event
V8BtnRun:V8 button execution event
TableRowClick: Table row click V8 event
PageTab: Multi Tab V8 Event
WFNodeEnd: Process Node End V8 Event
WFNodeStart: Process Node Start V8 Event

V8.CurrentTokencurrent login identity token

V8.TableModelGets the object of the current table, which contains table information such as Id and Name.

V8.ThisValueAccess the value object after the drop-down box selection, such as V8.ThisValue.Id

V8.TipsIn the lower right corner, a message prompt pops up. Usage: V8.Tips(msgContent, true/false, time)
msgContent to message content
true is a success message (disappears after 1 second),false is an error message (disappears after 5 seconds)
Time can be passed into the prompt box for how many seconds before it disappears.

V8.CurrentUserAccess current login user information
Example: V8.CurrentUser.Id/Name/Role/Dept and so on

V8.Post```javascript
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


V8.GetTo initiate an ajax request, V8.Get('api url', {}, function(result){})

V8.ChineseToPinyin(chinese, fullPyLen, type)Chinese to Pinyin
fullPyLen: 2 (default), the first few words are all pinyin; type : 1 hump (default),2 all uppercase, 3 all lowercase

V8.RefreshTable({ _PageIndex : -1 })Refresh the table data list. If -1 is passed in_PageIndex, it means to jump to the last page.
It is generally used to refresh the current table with more buttons on pages, more buttons on rows, etc.
Note that unlike [V8.TableRefresh], it refreshes the sub-table in the current main form (function naming will be optimized in the future).

V8.Router.Push(url): Page JumpV8.Window.Open(url): Open a new pageV8.OpenForm(formModel, type)Open the form, type:'View'/'Edit'/'Add', as in the [Row More V8 button] event: V8.OpenForm(V8.Form, 'Edit')

V8.OpenFormWF(formModel, type)Open the form with the process information. (Currently the last process to get this data)

V8.TableRowSelectedGets an array of selected rows, each row containing all the data

V8.SearchSetTable Tabs **Set** search conditions, for example: V8.SearchSet({FieldName : value, FieldName2 : value})
2024-12-14 Add [_Where Condition](https://microi.blog.csdn.net/article/details/143582519), usage: V8.SearchSet([{ Name : 'Age', Value : 18, Type : '>' }]);

V8.SearchAppendTable Tabs **Append** search criteria, for example: V8.SearchAppend({FieldName : value, FieldName2 : value})
2024-12-14 Add [_Where Condition](https://microi.blog.csdn.net/article/details/143582519), usage: V8.SearchAppend([{ Name : 'Age', Value : 18, Type : '>' }]);

V8.AppendSearchChildTable [V8.OpenTableSetWhere is recommended]]Specify the search criteria for the table in the [Pop-up Pre-Event V8 Code] of the pop-up table, for example: V8.AppendSearchChildTable(V8.Field.XuanzeGLSP, { ShangpinLXZ: '1'});V8.OpenTableSetWhereSpecify the search criteria for the table in the [Pop-up Pre-Event V8 Code] of the pop-up table
For example: V8.OpenTableSetWhere(V8.Field.XuanzeGLSP, [{ Name : 'ShangpinMC', Value: 'Commercial direct drinking machine ', Type : 'Like' }]);V8.IsNull(value): Determine if a value is emptyReturns true if the value is null, undefined, ''(empty string), 'null'(null string), or 'undefined'(undefined string)

The parent table operates on the child table:```javascript
V8.TableSearchAppend(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})

V8.TableSearchSet(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})

V8.TableRefresh(V8.Field.子表Name, { _PageIndex : -1 })
_PageIndex传入-1表示跳转到最后一页。（注意与【V8.RefreshTable】不同的是它一般是用于模块引擎中行更多按钮、页面更多按钮刷新当前表格，将来会优化函数命名）。
```


V8.FormSubmitSubmit the form.
V8.FormSubmit({CloseForm:true, SavedType:'Insert', Callback : function})
CloseForm: whether to close the Form form;
SavedType: action after saving the form Insert/Update/View
Callback: callback functions

Action on parent in child table:V8.ParentForm: Access all fields of the parent form
Support for assigning values to parent tables in child tables of child tables using the V8.ParentForm.ParentForm.

[repealed] V8.ParentFormSet ('field nay', 'value'): Assign a value to a field of the parent form
Please use V8.ParentForm.FormSet ('field name', 'value')


V8.AddSysLogAdd Log
Example: V8.AddSysLog({Title: 'Inventory Synchronization', Type:'SyncStock', Content:'Zhang San called the inventory synchronization interface, and the inventory after synchronization is 100. ')
Parameter values are custom.

V8.ReloadForm: Reload the current formExample: V8.ReloadForm({Id: 'xxxx-xxxx-xxxx}, 'Edit/View');// Reload the current form in edit or preview mode

V8.HideFormBtnHide Edit/Delete button
V8.HideFormBtn('Update/Delete'):

V8.HideFormTab(tabName)Hide a form tab, Usage: V8.HideFormTab('tabName (Tab name configured in form properties) ')

V8.ShowFormTab(tabName)Display a form tab, Usage: V8.HideFormTab('tabName (Tab name configured in form properties) ')

V8.ClickFormTab(tabName)Select a form tab

V8.GetFormTabsGets all tab pages of the form.

V8.ConfirmTipsConfirm prompt box```javascript
例：V8.ConfirmTips('确认审批？', okCallback, cancelCallback, option)。 
//option为可选参数，可配置：{Title:'',OkText:'',CancelText:'',Icon:''}
```


V8.ShowTableChildHideFieldForce the hidden fields of the child table to be displayed and refresh the child table.

V8.ShowTableChildHideField ('child table fieldName',['fieldName','fieldName']);
V8.RefreshChildTable(fieldModel, V8.Row): Refresh child table
Example: V8.RefreshChildTable(V8.Field. child table column name, V8.Row), the second parameter can be passed in parentFormModel.

V8.GetChildTableData ('Subtable Field Name');V8.CurrentTableDataV8.WF.StartWork: Initiation Process:```javascript
V8.WF.StartWork({        
    FlowDesignId:'',//流程图Id，必传        
    FormData:JSON.stringify({}),//可选，也可以传入{} object类型，内部会自动序列化        
    TableRowId:'',//关联的数据Id，必传        
    NoticeFields:JSON.stringify([]),//通知数据，可选，格式：[{Id:'字段Id',Name:'字段名',Label:'字段名称',Value:'值'}]，如果是数组类型，内部会自动序列化        
    //还可以传入选择的下一步审批人、添加的审批人、审批意见 等等    
}, function(result){//这是回调函数处理，result返回了Receivers、ToNodeName等

});
```


V8.SendSystemMessageSend system messages

// Message content var msgContent = 'Test v8 to send system messages! 'new Date().toString();//Content added route jump msgContent = '<a href = "/#/diy-xmxx?Keyword = seagull"> test page jump </a>';//Send system message V8.SendSystemMessage({ Content: msgContent, ToUserId: 'c19e70d1-b7b3-4eaa-933d-e8f59c85562f}, function(result){ V8.Tips(JSON.stringify(result));});
V8.FormWF: Access whether the form with process interface is currently open, return value:
{
IsWF:true/false, // whether the form with process interface is open
WorkType:'',// StartWork, ViewWork
FlowDesignId: 'Flowchart Id'
}

V8.Base64:base64 encryption and decryptionV8.Base64.endcode ('string to be encrypted');// encryption
V8.Base64.dedcode ('string to be decrypted');// Decrypt
V8.Base64.isValid ('encrypted string');// Determine whether it is in encrypted base64 format

V8.OpenDialog(param): Open a custom component dialogExamples;```javascript
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


V8.NewGuid()Generate a front-end Guid value

await V8.NewServerGuid()Generate a server-side Guid value

V8._Access to underscore objects, commonly used js utility libraries, such as: V8._.where(...). underscore usage see: https://underscorejs.org/ https://underscorejs.net/

V8.ModuleEngine:Module Engine Related

V8.ApiEngine:Interface Engine

V8.DataSourceEngine:Data Source Engine

V8.OpenAnyForm:Open an arbitrary form```javascript
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
      var result = await V8.ApiEngine.Run({
        ApiEngineKey: "shouhoudd_zhipai",
        Id: v8.Form.Id,
        ShouhouRY: V8.Form.ShouhouRY,
        ShouhouRYID: V8.Form.ShouhouRYID,
        ShouhouRYDH: V8.Form.ShouhouRYDH,
      });
      callback(result);
    },
  },
});
```

