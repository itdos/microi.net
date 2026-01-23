# V 8関数リスト-フロントエンド
## 紹介
> * フロントエンドv 8エンジンコードとサーバー側v 8のプログラミング言語はJavascript文法です。
> * フロントエンドv 8エンジンは完全なES6文法をサポートしています。
> * フロントエンドv 8エンジンは、多くの関数がhttpを介してバックエンド・インタフェースを直接呼び出すことを統合しており、V8.Post() に対応するインタフェース・アドレスを書く効果と同じである
> * フロントエンドv 8エンジンコードはフロントエンドで実行され、サーバ側のローコードプラットフォームを直接呼び出すことでインタフェースを追加変更すると、フロントエンドv 8イベントは実行されない (サーバ側v 8イベントは実行される)。
> * フロントエンドv 8関数は主にフォーム属性のフロントエンドv 8イベント、モジュールエンジンv 8ボタンコードなどに使用されます。

## V8.Form
> * 現在のフォームフィールド値にアクセス
```js
var id = V8.Form.Id;//在新增数据时也能访问到，因为id是提前后成，以备可能有子表要使用
var name = V8.Form.UserName;
//如果是下拉框组件，则获取到的是object，可访问到数据源中的所有字段
var selectId = V8.Form.SelectUser.Id;
```

## V8.OldForm
> * 現在のフォームにアクセスして前のフィールド値を変更します
```js
var oldName = V8.OldForm.UserName;
```

## V8.FormSet
> * 現在のフォームフィールドに値を割り当てると、割り当てられたフィールドの値変更イベントがトリガーされます
> * V8.Form.UserName = '張三' を使用しますUserNameフィールドの値変更イベントはトリガーされません
> * フィールドの値変更イベントでFormSetを使用してこのフィールドに再度割り当てることは強く推奨しません。そうしないと、デッドサイクルになる可能性があります。この場合は必ずV8.Form.UserName = '張三' を使用してくださいこの方式は代入します。
```js
//给文本框赋值
V8.FormSet('UserName', '张三');
//给下拉框赋值（其中Id和Name就是下拉框组件中字段属性配置的存储字段与显示字段名称）
V8.FormSet('UserName', { Id : 1, Name : '张三' });
```

## V8.Field
> * 現在のフォームフィールドプロパティにアクセス
```js
var isReadonly = V8.Form.UserName.Readonly;//UserName字段当前是否是只读
//包含属性：Name、Label、Config、Data(绑定数据源)、Readonly、Visible、Placeholder等等
```

## V8.FieldSet
> * 現在のフォームフィールドの属性に値を割り当てる
```js
//设置UserName字段为只读
V8.FieldSet('UserName', 'Readonly', false);
//给某个下拉框动态设置数据源：
V8.FieldSet('字段名', 'Data', [{Id:1}, {Id:2}]);
```

## V8.FormMode
> * 現在Formが開いているモードを取得します。可能な値はAdd (新規追加) 、Edit (編集) 、View (プレビュー) です
```js
if(V8.FormMode == 'Add'){
  V8.FormSet('ShenqingR', V8.CurrentUser.Name);//默认申请人名称
  V8.FormSet('ShenqingRID', V8.CurrentUser.Id);//默认申请人Id
  V8.FormSet('Bumen', V8.CurrentUser.DeptName);//默认申请人部门名称
}
```

## V8.FormSubmitAction
> * フォーム送信タイプ。可能な値: Insert、Update、Delete
> * フォームが入ったイベントでは値にアクセスできず、フォームが送信される前、送信された後にのみ値にアクセスできます
> * フォームでイベントに入って、現在のフォームが追加されたか編集されたかを判断するには、V8.FormMode(可能な値: Add (追加) 、Edit (編集) 、View (プレビュー)) を使用します

## V8.FormOutAction
> * フォームを離れるタイプを取得し、フォームを離れる、フォームを提出した後のv 8エンジンコードで判断することができます。可能な値: Update、Insert、Close、Delete

## V8.FormOutAfterAction
> * フォームを離れた後のタイプを取得します。フォームを離れたり、フォームを送信したりした後のv 8エンジンコードに使用できます。

## V8.LoadMode
> * 現在のFormのロード・モードは、空白か、値がDesign(string、デザイン・モード) のいずれかで、V8.FieldSetを使用してフィールド・プロパティが変更されたイベントに特に注意してくださいv8.LoadMode = = 'design 'で実行しないと判断する必要があります。そうしないと、フォームデザインを保存するとフィールド属性が永続化されます。

## V8.KeyCode
> * キーボードv 8イベントはキーボードのcode値を取得できます。Enterキーが13に対応しています
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
> * 現在のDIYテーブルのId、Nameを取得

## V8.EventName
> * フロントエンドv 8イベント名は、グローバルv 8エンジンコードで使いやすく、可能な値です
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

## V8.current token
> * 現在ログインしているtoken

## V8.TableModel
> * Id、Nameなどのテーブル情報を含む現在のテーブルのオブジェクトを取得します。

## V8.this value
> * ドロップダウンボックスの選択後の値オブジェクト (v8.this value.Idなど) にアクセスします

## V8.Tips
> * 右下にメッセージのヒントが表示されます
```js
V8.Tips(msgContent, true/false, time)
//msgContent为消息内容
//true为成功消息（1秒后消失），false为错误消息（5秒后消失）
//time可传入提示框多少秒后消失
```

## V8.current user
> * 現在ログインしているユーザー情報にアクセスします
```js
var id = V8.CurrentUser.Id;
```

## V8.Post
> * バックエンドv 8のpostはV8.Http.Post() であることに注意してください。現在、一時的な書き方が一致せず、後期に統一されます。
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
> * Ajaxリクエストを開始
```js
V8.Get('api url', {}, function(result){})
```

## V8.china topinyin
> * 中国語ピンイン、v8.china topinyin (china、full pylen、type)
```js
//fullPyLen: 前几个字转换为全拼音
//type : 1：驼峰（默认），2：全大写，3：全小写
var pinyin = V8.ChineseToPinyin('你好吾码', 2, 1);//结果：NihaoWM
```

## V8.RefreshTable({ _ pageindex: 1 })
> * テーブルデータのリストを更新します。_ pageindexインポート-1は最後のページにジャンプすることを示しています。
> * 一般的に、ページのボタン、行のボタンなど、現在のテーブルを更新するために使用されます。
> * 注意【V8.TableRefresh】とは異なり、現在のメインフォームのサブテーブルを更新することです (将来は関数命名が最適化されます)。

## V8.Router.Push
> * ページジャンプは、v 8ボタンで実行できます。
```js
V8.Router.Push(`/notice`)
```

## V8.Window.Open
> * 新しいページを開くには、次のようにします
```js
V8.Window.Open(`https://microi.net`)
```

## V8.OpenForm(formModel, type)
> * フォームを開くには、type:'View'/'Edit'/'add 'を使用します。
```js
V8.OpenForm(V8.Form, 'Edit')
```

## V8.OpenFormWF(formModel, type)
> * フロー情報付きのフォームを開きます。 (現時点で、このデータを取得する最後のフローです)

## V8.SelectedData
> * 選択された行の配列を取得します。各行にはすべてのデータが含まれています
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

## V8.search set
> * テーブルTabs **設定** 検索条件
```js
V8.SearchSet([
  ['Age', '>=', 18],
  ['Age', '<', 50]
]);
```

## V8.search append
> * テーブルTabs **追加** 検索条件
```js
V8.SearchAppend([
  ['Age', '>=', 18],
  ['Age', '<', 50]
]);
```

## V8.appendsearch dtable【V8.OpenTableSetWhereを推奨】
> * ポップアップテーブルの [ポップアップ前のv 8イベントコード] で、テーブルの検索条件を指定します。
```js
V8.AppendSearchChildTable(V8.Field.XuanzeGLSP, { ShangpinLXZ: '1'});
```

## V8.OpenTableSetWhere
> * ポップアップテーブルの [ポップアップ前のv 8イベントコード] で、テーブルの検索条件を指定します。
```js
V8.OpenTableSetWhere(V8.Field.XuanzeGLSP, [
  ['ShangpinMC', 'Like', '商用直饮机']
]);
```

## V8.IsNull(value)
> * ある値が空白かどうかの判断
> * 値がnull、未定、「」 (空の文字列) 、「null文字列」

## 親テーブルで子テーブル操作
```javascript
V8.TableSearchAppend(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})

V8.TableSearchSet(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})

V8.TableRefresh(V8.Field.子表Name, { _PageIndex : -1 })
_PageIndex传入-1表示跳转到最后一页。（注意与【V8.RefreshTable】不同的是它一般是用于模块引擎中行更多按钮、页面更多按钮刷新当前表格，将来会优化函数命名）。
```

## V8.form既読
> * フォームを送信します。注意: この関数は`前端表单提交前V8事件`を選択しますので、`前端表单提交前V8事件`この関数を呼び出します。そうしないと、ループが死んでしまいます。
```js
V8.FormSubmit({
  CloseForm: true,  //是否关闭Form表单
  SavedType:'Insert', //保存表单后的操作Insert/Update/View
  Callback : function //回调函数
});
```

## V8.FormClose
> * フォームを強制的に閉じる
```js
V8.FormClose();
```

## V8.parentv 8
> * 子テーブルから親テーブルのv 8オブジェクトにアクセスすると、親テーブルv 8オブジェクトのすべての機能を利用できます。
```js
var parentForm = V8.ParentV8.Form;//访问父级表单所有字段
V8.ParentV8.FormSet('字段名', '值');
```
## V8.add syslog
> * ログの追加
```js
V8.AddSysLog({
  Title : '库存同步', 
  Type : 'SyncStock', 
  Content : '张三调用了库存同步接口，同步后库存为100。'
})
```

## V8.ReloadForm
> * 現在のフォームを再ロードします
```js
V8.ReloadForm({ Id : 'xxxx-xxxx-xxxx'}, 'Edit/View' );//以编辑或预览模式重新加载当前表单
```

## V8.HideFormBtn
> * 編集・削除・新規追加のボタンを非表示にする
```js
V8.HideFormBtn('Update');
V8.HideFormBtn('Delete');
V8.HideFormBtn('Save');
```

## V8.HideFormTab(tabName)
> * フォームTabタブを非表示にする
```js
V8.HideFormTab('tabName（在表单属性中配置的Tab名称）')
```

## V8.ShowFormTab(tabName)
> * フォームTabタブを表示します
```js
V8.HideFormTab('tabName（在表单属性中配置的Tab名称）')
```

## V8.ClickFormTab(tabName)
> * フォームTabタブを選択します

## V8.GetFormTabs
> * フォームのすべてのTabタブページを取得します。

## V8.ConfirmTips
> * 確認メッセージボックス
```javascript
例：V8.ConfirmTips('确认审批？', okCallback, cancelCallback, option)。 
//option为可选参数，可配置：{Title:'',OkText:'',CancelText:'',Icon:''}
```

## V8.ShowTableChildHideField
> * サブテーブルが非表示になっているフィールドを強制的に表示し、サブテーブルを更新します。
```js
V8.ShowTableChildHideField('子表fieldName',['fieldName','fieldName']);
V8.RefreshChildTable(fieldModel, V8.Row);//刷新子表
V8.RefreshChildTable(V8.Field.子表列名, V8.Row);//第二个参数可传入parentFormModel。
```

## V8.GetChildTableData
```js
var data = V8.GetChildTableData('子表字段名称');
```

## V8.current tabledata
> * 現在のテーブルのページのデータを取得します

## V8.WF.StartWork
> * 開始プロセス
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
> * システムメッセージ、メッセージリマインダーの送信
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
> * 現在、フローインタフェース付きフォームを開いているかどうかにアクセスします。戻り値:
```js
{
    IsWF:true/false, //是否打开了带流程界面的表单
    WorkType:'',//StartWork、ViewWork
    FlowDesignId:'流程图Id'
}
```

## V8.Base64
> * Base64と復号化
```js
V8.Base64.endcode('待加密字符串');//加密
V8.Base64.dedcode('待解密字符串');//解密
V8.Base64.isValid('已加密字符串');//判断是否是已加密的base64格式
```

## V8.OpenDialog
> * 「コンポーネントのカスタマイズ」ダイアログを開きます
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
> * 汎用オープンiframe
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
> * フロントエンドGuid値を生成します
```js
var newGuid = V8.NewGuid();
```

## Await V8.NewServerGuid
> * サーバー側Guid値を生成します
```js
var newGuid = await V8.NewServerGuid();
```

## V 8 _
> * アンダースコアオブジェクトにアクセスし、よく使われるjsユーティリティライブラリ
```js
//underscore用法见：https://underscorejs.org/   https://underscorejs.net/ 
V8._.where(...)
```

## V8.ModuleEngine
> * モジュールエンジン関連

## V8.ApiEngine
> * インターフェースエンジン
```javascript
//调用方式：
var result = await V8.ApiEngine.Run('ApiEngineKey', { 
    Param1 : '1',
});
```

## V8.DataSourceEngine
> * データソースエンジン

## V8.OpenAnyForm
> * 任意のフォームを開きます
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
> * 任意のリストを開く
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

## フォームボタンの重複クリック防止
```js
V8.FieldSet('YijianSCFBMX', 'Config.Button.Loading', true); 
var result = await V8.ApiEngine.Run('ApiKeyName', {});
V8.FieldSet('YijianSCFBMX', 'Config.Button.Loading', false); 
```
## V8.client type
> * 現在のクライアントタイプにアクセスします
```js
//可能的值：PC、IOS、Android、H5、WeChat
var clientType = V8.ClientType;
```

## V8.SysConfig
> * システム設定情報へのアクセス
```js
//可以访问到系统设置sys_config表的任意字段
var sysTitle = V8.SysConfig.SysTitle;
```

## V8.FormEngine
> * プラットフォームドキュメントを参照:[FormEngineの使い方](/doc/v8-engine/form-engine.html)

## 移動側関数
### ブルートゥース印刷
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

### 二次元コード、バーコードスキャンコードV8.Method?. ScanCode
> * H5、アプレット、APPに対応
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