インターフェースエンジンプロフィール* インターフェースエンジンはプラットフォームのハイライトの一つとして、非常に複雑な業務ロジックを解決し、カスタムインターフェースを統一的に管理することができます。
* インターフェースエンジンはフォームエンジンによって駆動されます
![ここに画像の説明を挿入](https://static.itdos.com/upload/img/csdn/QQ20250311-213524 @ 2x.Png)


すべてのバックエンドV8関数をサポート記事を参照:[Microi吾コード-v 8関数リスト-バックエンド](https://microi.blog.csdn.net/article/details/143623433)

Get、Postリクエストに対応Getでもpostでも、インタフェースエンジンが正常に要求されました

Form-data、payload-jsonリクエストのサポート要求がform-dataかpayload-jsonかに関係なくサポートされています

V8.Paramはform-data、payload/json、urlの3つのパラメータタイプを受信できます```javascript
//支持接收3种类型的参数，均使用V8.Param.***访问
var id = V8.Param.Id;
```


戻りデータデータをフロントエンドに返すには、JSON、文字列、Html、ファイルなどがあります```javascript
//新版返回方式
return { Code : 1, Data : [] }
return '直接返回字符串';
//旧版返回方式
//V8.Result = { Code : 1, Data : [] }
```


インターフェース設定名前、Key、カスタムインターフェースアドレス、有効化4つの基本構成、名前は自由、keyは自由、カスタムインターフェースアドレスは/apiengine/先頭を統一的に使用することを推奨しますもちろん【/api111/b2222/c333/d444】にカスタマイズしてもいいですが、【有効にする】は必ずチェックしてください

分散ロック* 一部のシーンのインタフェースは、注文の出荷承認後に在庫を差し引いて、在庫がマイナスにならないようにするなど、分散ロックを使用する必要があります。 (もちろんメッセージキューを使ってもいいです。この方式は他の文章で説明します。)
* 分散ロックをオンにすると、分散ロックKeyを設定することができます。例えば、商品Aに在庫の増減をする場合、分散ロックKeyは商品AのIdに設定でき、この場合、異なる商品は異なる分散ロックKey、列が異なる同時処理スループットを大幅に向上させます。
* 分散ロックKeyを設定しないと、1000人が同時にこのインタフェースを呼び出し、キューに入れなければならない

匿名呼び出しを許可する* インタフェースエンジンはデフォルトでtokenを呼び出す必要があります。
* 匿名呼び出しの許可をオンにすると、tokenをインポートする必要はありませんが、v 8エンジンで ** v8.current user ** にアクセスするのはnullであることに注意してください

応答ファイルテストアクセスインタフェースのエンジンアドレスは、画像を直接ダウンロードします:[https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos](https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos)```javascript
var downResult = V8.Http.GetResponse({
  Url : 'https://static.itdos.com/itdos/img/20230623/WechatIMG21753.png'
});
var imgByte = downResult.RawBytes;
V8.Result = {
  Code : 1,
  Data : {
    FileName : '测试响应文件.png',
    ContentType : 'image/png',
    FileByteBase64 : System.Convert.ToBase64String(imgByte)
  }
};
```

インターフェーステストインターフェイスエンジンフォームは、インターフェースがテストを実行する機能を提供します (フォームエンジンによって駆動されます)



