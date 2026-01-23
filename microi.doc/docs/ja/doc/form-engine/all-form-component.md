# すべてのフォームコンポーネント
> * すべてのフォームコンポーネントについて紹介する

## 単一行テキストText
> * 1行のテキストを制限するには、数字、身分証明書番号、携帯電話番号、アルファベットなどのみを入力できます。フィールドの値変更v 8イベント、フォーム送信前v 8イベントで制限できます
```js
//Phone字段属性的【值变更V8事件】
V8.Form.Phone = V8.Form.Phone.replace(/\D/g, '');//输入框只能输入数字

//表单提交前V8事件（前后端V8事件均可）
if(V8.Form.Phone.length != 11){
  return { Code : 0,  Msg : '请输入正确的手机号码' };
}
```

## 複数行のテキストbase
> * 複数行のテキスト。文字数に制限はありません。

## リッチテキストRichText
> * 画像アップロードをサポートするリッチテキストエディタ

## テキスト連想
> * 連想クエリのドロップダウン選択を入力しても、カスタマイズして入力できます

## 関連Id Guid
> * 一般的にstring型のguid値を格納するために使用されます

## 数字number text
> * デフォルトint型、小数点がオンになっている場合は、手動で型をdecimal型に変更することを覚えています。小数点が4桁 (12、4) 、小数点が2桁 (12、2) です

## チェックボックスRadio
> * よく使うチェックボックス

## チェックボックスのチェックボックス
> * データベースはjson文字列として格納されます

## ドロップダウンの単一選択
> * よく使うドロップダウン選択

## ドロップダウンチェックMultipleSelect
> * データベースはjson文字列として格納されます

## スイッチSwitch
> * スイッチコンポーネントのデフォルトはint型で、1をオンにして0をオフにします (古いバージョンのデフォルトはbit型なので、int型に置き換えることをお勧めします)
> * _ _ <Font color = "red"> スイッチコンポーネントはvarchar型にすることはできません。そうしないと、データ在庫が「1」または「0」であるにもかかわらず、オン/font _ _ _ が表示されます

## 日時DateTime
> * Varchar型をお勧めしますが、日付がさまざまなフォーマットをサポートしていることが主な理由です

## 画像アップロードImgUpload
> * デフォルトでは匿名アクセスは許可されていません

## ファイルアップロードFileUpload
> * デフォルトでは匿名アクセスは許可されていません

## スコアレート
> * 評価コンポーネント、デフォルトint型、データベースはint型として格納されます

## カラー選択ColorPicker
> * カラー選択コンポーネント、デフォルトのvarcharタイプ、データベースはrgbカラー値として格納されます

## 分割線Divider
> * フォームを分割し、物理フィールドを生成しない

## ボタンButton
> * ボタンコンポーネント、v 8コードをサポートします。

## HTML
> * 一時的に公開されていません

## 自動番号AutoNumber
> * 分散ロックの自動番号が付属しており、カスタムプレフィックスをサポートしています

## サブテーブルTableChild
> * 非常によく使われるサブテーブル

## 地図 (点) Map
> * 地図画点

## 地図 (エリア) MapArea
> * 地図画エリア

## カスケードセレクタCascader
> * カスタムカスケードセレクタ

## 組織部門
> * プラットフォーム組織の選択

## アドレスAddress
> * 省市区連動

## 携帯電話認証コードphone esms
> * 一時的に公開されていません

## プログレスバーProgress
> * 進行状況を表示し、データベースに数字を格納します

## タイムラインTimeline
> * 一時的に公開されていません

## ライブラリFontAwesome
> * 統合FontAwesome

## カスタムコンポーネントDevComponent
> * カスタムカスタム開発したコンポーネントをフォームに組み込む

## ポップアップフォームOpenTable
> * データリストが表示され、データ送信を選択するとイベントがトリガーされます
> * ポップアップ前v 8エンジンコード
```js
//设置查询条件，[V8.Field.XuanzeGLSP]为[弹出表格]控件的[字段名]
V8.OpenTableSetWhere(V8.Field.XuanzeGLSP, [
  ['ShangpinMC', 'Like', '商用直饮机']
]);
```
> * V 8イベントエンジンコードを送信します。
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

## 関連フォームJoinForm
> * 一般的にフォームテンプレートをカスタマイズするために使用されます

## コードエディターCodeEditor
> * コード連想、コードインデント、文法ハイライト、コード折り畳みなどをサポートしています

## ドロップツリーselect tree
> * これは非常に強力なコンポーネントです

## JSONテーブルJSON table
> * 一時的に公開されていません