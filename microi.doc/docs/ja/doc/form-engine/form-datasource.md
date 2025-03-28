# フォームコントロールデータソース
## フォームコントロールのデータソースは現在、複数のモードをサポートしています

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/04a0857b9c684fa7b2c06d080f3824f7.png#pic_center)

## 一般データソース
> 現在、普通のデータは一時的にValueの形式しかサポートしていません。
> プラットフォームはKey-Value形式の通常のデータソースを拡張しています
> これでは、インタフェースエンジン、データソースエンジン、SqlデータソースでKey-Valueのデータバインディングを実現する必要はありません

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/0083491c8cbe4bdc8fe4c6d22ce3f367.png#pic_center)
## データソースエンジン
> こちらは簡単なので、該当のカスタムのデータソースエンジンを選択すれば

## Sqlデータソース
> * リモート検索機能の有効化をサポートしています
> * データソースで直接フロントエンドのローカル検索がオンになっていません
> * をオンにすると、検索ごとにデータベースからクエリされるため、対応する $ Keyword $ 変数とlimitページングを設定する必要があります
> * SqlデータソースはSqlでの使用をサポートしています. フィールド名 \ $ 】関連変数、例えば【 \ $ current user. Id \ $ 、 \ $ current user. Account \ $ 】など
> * **Sys_userテープルもフォーエムエンジンによこして动かすめ、フォーエムデザインをsys_userテープルに追加しましたいたフェイルドは、【 \ $ current user.フェイルド名 \ $ 」でアクセスします。 [Wife] を追加した场合・【 \ $ current user. Wife \ $ 】アクセ**

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/1f7491f7bb624d7cb87d1e7d68c097bd.png#pic_center)
## 他のフィールドからデータソースを動的にバインドします
> * たとえば、フォームでドロップダウンボックスのコントロール【部門 (Dept)】を選択し、ドロップダウンボックスのコントロール【連絡先 (Contact)】で現在の部門を選択したスタッフデータのみをバインドします
> * この時点では、【連絡先】のデータソースを空白に設定するだけです
> * そして【部門】コントロールの【値変更イベントに以下のv 8エンジンコードを入力】
```javascript
//获取选中部门中的人员数据
var deptId = V8.ThisValue.Id;//或者V8.Form.Dept.Id
if(deptId){//如果选择了部门
	var contactResult = await V8.FormEngine.GetTableData('sys_user', {
		_SelectFields:['Id', 'Name', 'Account'],//只查询哪些字段，提高性能
		_Wherer: [{ Name : 'DeptId', Value : deptId, Type : '=' }]
	});
	if(contactResult.Code != 1){
		V8.Tips('获取部门人员失败！', false);
	}else{
		V8.FieldSet('Contact', 'Data', contactResult.Data);
	}
}else{//如果清空了部门
	V8.FieldSet('Contact', 'Data', []);
}
```
> * もちろん上記はあくまでも基礎例ですが、実際にはそれ以上のプレイ法があります
> * 例えば、インタフェースエンジンV8.ApiEngine.Run() を使用して実現する
> * たとえば、データソースエンジンV8.DataSourceEngine.Run() を使用して実装します
> * 以上の関連知識点:
> * **V8.FormEngineの使用者**:[https://microi.blog.csdn.net/article/details/143623519](https://microi.blog.csdn.net/article/details/143623519)
> * **Where条件の使用者**:[https://microi.blog.csdn.net/article/details/143582519](https://microi.blog.csdn.net/article/details/143582519)
> * **V8.Fieldフロントロンエンドv 8関数**:[https://microi.blog.csdn.net/article/details/143623205](https://microi.blog.csdn.net/article/details/143623205)

## データソースをバインドした後の表示フィールドと保存フィールドについて
> * ドロップダウンボックスで顧客を選択している学生がいます。顧客Idを保存するだけで、顧客名を保存する必要はありません。顧客名が変更される可能性があるからです
> * 実際には、ドロップダウンボックスでデータを選択した後、顧客名を保存する必要があります。隠しフィールドの顧客Idをもう一つドラッグして、ドロップダウンボックス値変更イベントで顧客Idを割り当てる必要があります
> * メリットは履歴名のアーカイブです。たとえば、注文を追加するには商品を選択する必要があります。商品名と商品Idの両方を保存する必要があります。そうしないと、ユーザーはペンを購入しますその後、商品名が本に変更され、ユーザーが注文を見ると、注文中の商品名が本になったことがわかります
> * 顧客名が変更された後、確かに他の関連データに最新の顧客名を表示する必要があります。顧客リストが名前を変更するときは、フォームイベントで関連データを同期的に更新することができます
