# フォーム、フィールド属性、イベント

## フォーム属性

### フロントエンド進入フォームv 8イベント
> * いくつかデフォルト値の処理をすることができます
```js
//如果是新增数据
if(V8.FormMode == 'Add'){//FormMode可能的值：Add（新增）、Edit（编辑）、View（预览）
    V8.FormSe('Name', V8.CurrentUser.Name);//设置默认值
}
```

### フロントエンドフォーム送信前のv 8イベント
> * フォーム検証を行い、ユーザー体験を向上させることができます
> * _ _ <Font color = "red">注意: Postmanがインタフェースを呼び出すように直接追加削除するとこのフロントエンドv 8イベントイベントは「実行されません」 (バックエンドv 8イベントは実行されます)</Font> _ _ _
```js
//若代码出现return Code为0时，则会在前端阻止表单继续提交
return { Code : 0, Msg : '错误信息，已阻止表单提交！' };

//表单提交类型，可能的值：Insert、Update、Delete
var submitType = V8.FormSubmitAction;
```

### フロントエンドがフォームを離れた後、v 8イベント
> * 一般的には【サーバー側フォーム送信後v 8イベント】を使用することをお勧めします
> * このイベントは特別なビジネスロジック処理が可能です

### サーバー側データ処理v 8イベント
> * このイベントは、リストデータの取得後に1行ずつ、フォームデータの取得後に実行されます。
> * カプセル化されたオブジェクト:
> * A) V8.RowIndex: リストデータの行インデックス,0スタート
> * B) V8.Form: リストデータ各行オブジェクト、フォームデータオブジェクト
> * C) V8.NotSaveField: 編集時に保存しないフィールドを指定します
> * D) V8.CacheData: キャッシュデータ用
> * いくつかのフィールドの脱感作を実現できます。例えば、V8.Formです。価格 = "***"; こののときは必ず設定してください。V8.NotSaveField = ["価格"]; そうしないと、データーを修正すると*** がデータベースに書き込まれます。
> * 例:
```javascript
//如果不是超级管理员，数据脱敏
if(V8.CurrentUser.Level < 999){
    V8.Form.Price = "***";//脱敏
    V8.Form.CompanyName = "***";//脱敏
    V8.NotSaveField = ["Price", "CompanyName"];//告诉前端，此字段在编辑时不保存
}
```

### サーバー側フォーム送信前のv 8イベント
> * このイベントはトランザクションで実行されます
> * _ _ <Font color = "red">注意: Postman呼び出しインタフェースを介して直接追加削除すると、このv 8イベントコードは「実行されます」 </Font> _ _ _
> * _ _ <Font color = "red">注意: バックエンドv 8イベント、インタフェースエンジンでV8.FormEngineを呼び出して追加削除するとこのイベントは「実行しない」 (開発者は通常、基本的な添削をして、予想外の動作を防止したい) が、 _ invoketype: 'client 'をインポートすることで、このイベントを実行することもできます。</Font> _ _ _
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


### サーバー側フォーム送信後のv 8イベント
> * このイベントはトランザクションで実行されたままですが、現在のフォーム送信後のデータを取得するには、V8.DbTransオブジェクトを使用して取得する必要があります
> * _ _ <Font color = "red">注意: Postman呼び出しインタフェースを介して直接追加削除すると、このv 8イベントコードは「実行されます」 </Font> _ _ _
> * _ _ <Font color = "red">注意: バックエンドv 8イベント、インタフェースエンジンでV8.FormEngineを呼び出して追加削除するとこのイベントは「実行しない」 (開発者は通常、基本的な添削をして、予想外の動作を防止したい) が、 _ invoketype: 'client 'をインポートすることで、このイベントを実行することもできます。</Font> _ _ _
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

## フィールド属性
### ロールの紐付け
> * フィールドにロールがバインドされている場合、このフィールドはフォームを表示しているときにのみ表示されます