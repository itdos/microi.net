# V 8関数リスト-フロントエンド
## 紹介
> * フロントエンドv 8エンジンコードとサーバー側v 8のプログラミング言語はJavascript文法です。
> * フロントエンドv 8エンジンは完全なES6文法をサポートしています。
> * フロントエンドv 8エンジンは、多くの関数がhttpを介してバックエンド・インタフェースを直接呼び出すことを統合しており、V8.Post() に対応するインタフェース・アドレスを書く効果と同じである。
> * フロントエンドv 8エンジンコードはフロントエンドで実行され、サーバー側のローコードプラットフォームを直接呼び出すことでインターフェースを追加変更すると、フロントエンドv 8イベントは実行されない (サーバー側v 8イベントは実行される)。

## V8.Form
> 現在のフォームフィールド値へのアクセス
例:var name = V8.Form.UserName;
ドロップダウンボックスのコンポーネントで、バインド表示フィールドが設定されている場合は、V8.Formとすることができます. フィールド名. 表示フィールド

## V8.OldForm
> 現在のフォームにアクセスして前のフィールド値を変更します
例:var olonname = v8.olonform.UserName;

## V8.FormSet
> 現在のフォームフィールドに値を割り当てる
例:V8.FormSet('username', '張三');
通常のjsを使って書くこともできます (ただし、特殊な状況では有効ではない可能性があります):V8.Form.UserName = '張三';

## V8.Field
> 現在のフォームフィールドプロパティへのアクセス
例:var isReadonly = V8.Form.UserName.Readonly;// UserNameフィールドは現在読み取り専用ですか?
属性:Name、Label、Config、Data (バインドされたデータソース) 、Readonly、空欄、プラスティックなどを含む

## V8.FieldSet
> 現在のフォームフィールドの属性に値を割り当てる
例:V8.FieldSet('UserName' 、 'readonly' 、false) // UserNameフィールドを読み取り専用に設定します

## V8.FormOutAction
> フォームを離れるタイプを取得し、フォームを離れる、フォームを提出した後、v 8エンジンコードで判断することができます。可能な値: Update/Insert/Close/Delete

## V8.FormOutAfterAction
> フォームを離れた後のタイプを取得します。フォームを離れたり、フォームを送信したりした後のv 8エンジンコードに使用できます。

## V8.FormSubmitAction
> フォーム送信タイプ (Insert/Update/Delete) は、「フォーム送信前v 8エンジンコード」にV8.Result = falseを割り当てることができますフォームが送信されないようにします。

## V8.FormMode
> 現在Formが開いているモードを取得します。可能な値はAdd (新規追加) 、Edit (編集) 、View (プレビュー) です

## V8.LoadMode
> 現在のFormのロードモードは、空白か、値がDesign(string、デザインモード) で、V8.FieldSetを使用してフィールド属性が変更されたイベントに特に注意してくださいv8.LoadMode = = 'design 'で実行しないと判断する必要があります。そうしないと、フォームデザインを保存するとフィールド属性が永続化されます。

## V8.TableRowId
> 现在のFormのIdを取得しますが、V8.Form.Idを使うこともできます

## V8.KeyCode
> キーボードイベントv 8はキーボードのcode値を取得できます。例えば、Enterキーが13に対応しています。
```javascript
if(V8.KeyCode == 13){
    V8.Tips('您已经按了Enter键！');
}
```

## V8.TableId、V8.TableName
> 現在のDIYテーブルのId、Nameを取得

## V8.EventName
> フロントエンドv 8イベント名は、グローバルv 8エンジンコードで使いやすい、可能な値:
FormTemplateEngine: フォームテンプレートエンジン
TableTemplateEngine: テーブルテンプレートエンジン
OpenTableBefore: ポップアップテーブル前イベント
Opentablefind: ポップアップフォーム送信イベント
ピールドンキーアップ: テキストボックスのキーボードイベント
FormOut: フォームを離れるイベント (フォームが送信された後を指す)
FormSubmitBefore: フォーム送信前イベント
FormIn: フォームイベントに入る
FieldValueChange: フィールド値変更イベント
Btnform517run: 詳細ボタンv 8ボタン
V8BtnLimit: v 8ボタンにイベントを表示するかどうか
V8BtnRun: v 8ボタン実行イベント
TableRowClick: テーブル行クリックv 8イベント
PageTab: マルチタブタブv 8イベント
Wfnodeエンド: フローノード終了v 8イベント
WFNodeStart: プロセスノードがv 8イベントを開始します。

## V8.current token
> 現在ログインしているtoken

## V8.TableModel
> Id、Nameなどのテーブル情報を含む現在のテーブルのオブジェクトを取得します。

## V8.this value
> ドロップダウンボックスで選択した値オブジェクト (v8.this value.Idなど) にアクセスします

## V8.Tips
> 右下にメッセージが表示されます。使用法:V8.Tips(msgContent、true/false、time)
MsgContentはメッセージの内容です
Trueは成功メッセージ (1秒後に消える) 、falseはエラーメッセージ (5秒後に消える)
Timeはヒントボックスに何秒後に消えますか?

## V8.current user
> 現在ログインしているユーザー情報にアクセスします
例: v8.current user.Id/Name/Role/Deptなど

## V8.Post
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
> Ajaxリクエストを開始します。V8.Get

## V8.china topinyin (china、full pylen、type)
> 中国語ピンイン
Full pylen: 2 (デフォルト) 、最初のいくつかの字は全部ピンインします。type: 1キャメルケース (デフォルト) 、2は全部大文字、3は全部小文字です。

## V8.RefreshTable({ _ pageindex: -1 })
> テーブルデータリストを更新します。_ pageindexインポート-1は最後のページにジャンプすることを示しています。
一般的に、ページのボタンや行のボタンなど、現在のテーブルを更新するために使用されます。
注意【V8.TableRefresh】とは異なり、現在のメインフォームのサブテーブルを更新することです (将来は関数命名が最適化されます)。

## V8.Router.Push(url): ページジャンプ

## V8.Window.Open(url): 新しいページを開く

## V8.OpenForm(formModel, type)
> フォームを開く、type:'View'/'Edit'/'add '、 [行のより多くのv 8ボタン] イベントでは、V8.OpenForm(V8.Form、 'Edit')

## V8.OpenFormWF(formModel, type)
> フロー情報付きのフォームを開きます。 (現時点で、このデータを取得する最後のフローです)

## V8.tablerow.com
> 選択した行の配列を取得します。各行にはすべてのデータが含まれています

## V8.search set
> テーブルTabs **設定** 検索条件、例えば: v8.search set
> 2024-12-14新規追加は [_ where条件](https://microi.blog.csdn.net/article/details/143582519) 、使用法: v8.search set ([{ Name : 'Age' 、Value: 18、Type: '>' }]) を渡すことができます。

## V8.search append
> テーブルTabs **追加** 検索条件、例えば: v8.search append
> 2024-12-14新規追加は [_ where条件](https://microi.blog.csdn.net/article/details/143582519) 、使用法: v8.search append ([{ Name : 'Age' 、Value: 18、Type: '>' }]) を渡すことができます。

## V8.appendsearch dtable【V8.OpenTableSetWhereを推奨】
> ポップアップ表の「ポップアップ前イベントv 8コード」では、表の検索条件を指定します。例えば、v8.appendsearchdtable (V8.Field.XuanzeGLSP、 {ShangpinLXZ: '1'});
## V8.OpenTableSetWhere
> ポップアップテーブルの [ポップアップ前イベントv 8コード] でテーブルの検索条件を指定します。
> 例えば、V8.OpenTableSetWhere
## V8.IsNull(value): 値が空白かどうかを判断します
> 値がnull、undefined、 ''(空の文字列) 、 'null'(null文字列) 、 'undefined'(undefined文字列) の場合は、すべてtrueを返します

## 親テーブルで子テーブル操作:
```javascript
V8.TableSearchAppend(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})

V8.TableSearchSet(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})

V8.TableRefresh(V8.Field.子表Name, { _PageIndex : -1 })
_PageIndex传入-1表示跳转到最后一页。（注意与【V8.RefreshTable】不同的是它一般是用于模块引擎中行更多按钮、页面更多按钮刷新当前表格，将来会优化函数命名）。
```

## V8.form既読
> フォームを送信します。
> V8.form既読 ({close form: true, SavedType:'Insert',func: function})
Close Form: Formフォームを閉じますか?
SavedType: フォーム保存後の操作Insert/Update/View
Func: コールバック関数

## 子テーブルの親に対する操作:

> V8.ParentForm: 親フォームのすべてのフィールドにアクセスします
子テーブルの子テーブルで、V8.ParentForm.ParentFormを使用して親テーブルに値を割り当てることがサポートされています。

> [廃止されました] V8.ParentFormSet('フィールド名', '値'): 親フォームのフィールドに値を割り当てます。
V8.ParentForm.FormSet('フィールド名', '値') を使用してください


## V8.add syslog
> ログの新規追加
例:V8.AddSysLog({Title: '在庫同期' 、Type:'syncstock' 、Content:' 張三は在庫同期インタフェースを呼び出し、同期後在庫は100。 ')
パラメータ値はすべてカスタムです。

## V8.ReloadForm: 現在のフォームを再ロードします
> 例:V8.ReloadForm({Id: 'xxxx-xxxx-xxxx-xxxx '} 、 'Edit/View') // 編集またはプレビューモードで現在のフォームを再ロードします

## V8.HideFormBtn
> 編集・削除ボタンを非表示にする
V8.HideFormBtn('Update/Delete'):

## V8.HideFormTab(tabName)
> フォームTabタブを非表示にします。使用方法: V8.HideFormTab('tabName (フォームプロパティに設定されているTab名) ')

## V8.ShowFormTab(tabName)
> フォームTabタブを表示します。使用方法: V8.HideFormTab('tabName (フォームプロパティに設定されているTab名) ')

## V8.ClickFormTab(tabName)
> フォームTabタブを選択します

## V8.GetFormTabs
> フォームのすべてのTabタブページを取得します。

## V8.ConfirmTips
> 確認メッセージボックス
```javascript
例：V8.ConfirmTips('确认审批？', okCallback, cancelCallback, option)。 
//option为可选参数，可配置：{Title:'',OkText:'',CancelText:'',Icon:''}
```

## V8.ShowTableChildHideField
> サブテーブルが非表示になっているフィールドを強制的に表示させて、サブテーブルを更新します。

> V8.showtableグリッドhidefield ('サブテーブルフィールドメイ',['フィールドメイ','フィールドメイ']);
V8.RefreshChildTable(fieldModel、V8.Row): サブテーブルを更新します
例:V8.RefreshChildTable(V8.Field.サブテーブルカラム名、V8.Row) 、2番目のパラメータはparentFormModelに渡されます。

## V8.GetChildTableData('サブテーブルフィールド名');

## V8.current tabledata

## V8.WF.StartWork: 開始プロセス:
```javascript
V8.WF.StartWork({        
    FlowDesignId:'',//流程图Id，必传        
    FormData:JSON.stringify({}),//可选，也可以传入{} object类型，内部会自动序列化        
    TableRowId:'',//关联的数据Id，必传        
    NoticeFields:JSON.stringify([]),//通知数据，可选，格式：[{Id:'字段Id',Name:'字段名',Label:'字段名称',Value:'值'}]，如果是数组类型，内部会自动序列化        
    //还可以传入选择的下一步审批人、添加的审批人、审批意见 等等    
}, function(result){//这是回调函数处理，result返回了Receivers、ToNodeName等

});
```

## V8.SendSystemMessage
> システムメッセージの送信

> // メッセージ内容var msgContent = 'テストv 8はシステムメッセージを送信します! 'Newdate ().toString();// コンテンツ追加ルートジャンプmsgContent = '<a href = "/#/diy-xm xx?Keyword = カモメ"> テストページジャンプ </a>';// 送信システムメッセージV8.SendSystemMessage({ Content: msgContent、ToUserId: '197e70d1-b7b3-4eaa-933d-e8f59c85562f '} function(result){ V8.Tips(JSON.stringify(result));});
V8.FormWF: 現在、フローインタフェース付きフォームを開いているかどうかにアクセスします。戻り値:
{
IsWF:true/false、 // プロセスインタフェース付きフォームを開いたかどうか
WorkType:'',// StartWork,ViewWork
Flow design id: 'フローチャートid'
}

## V8.Base64:base64と復号化
> V8.Base64.endcode('暗号化する文字列');// 暗号化
V8.Base64.de dcode('暗号化文字列');// 復号化
V8.Base64.isValid('暗号化された文字列');// 暗号化されたbase64フォーマットかどうかを判断する

## V8.openに関しましては、カスタムコンポーネントのダイアログを開きます。
> 例;
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

## V8.NewGuid()
> フロントエンドGuid値を生成します

## Await V8.NewServerGuid()
> サーバー側Guid値を生成します

## V 8 _
> アンダースコアのオブジェクトにアクセスし、V8. _.where(...) などの一般的なjsユーティリティライブラリ。アンダースコアの使用方法: https://underscorejs.org/ https://underscorejs.net /

## V8.ModuleEngine:
> モジュールエンジン関連

## V8.ApiEngine:
> インターフェースエンジン

## V8.DataSourceEngine:
> データソースエンジン

## V8.OpenAnyForm:
> 任意のフォームを開く
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
