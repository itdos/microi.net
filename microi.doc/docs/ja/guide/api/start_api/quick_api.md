# クイックハンド
このチュートリアルでは、バックエンド・プロジェクトを迅速に実行できます。

## 準備作業

- を使う`Git`ツールはオープンソースのアドレスから最新コード [microi.net](https://gitee.com/ITdos/microi.net) を取得します。
- ダウンロードとインストール`.NET 9 SDK`:[.Net9sdk](https://dotnet.microsoft.com/zh-cn/download)
- プロジェクトを走らせるには、少なくとも【データベース】が必要です`Redis`】二つの環境が欠かせない

## 【Visual Studio Code】を使用してソリューションを開く (推奨)

- ダウンロードとインストール`Vs Code`:[Vs Code](https://code.visualstudio.com)
- 開く`Vs Code`、プラグインのインストール:`C#、C# Dev Kit、.NET Install Tool`3つのコンポーネント
- 歓迎ページで開く`Microi`私はオープンソース版のルートフォルダを持っていて、数秒後に自動的に「ソリューションエクスプローラ」が現れて、待っています`Vs Code`自動復元`Nuget`ライブラリ
- 設定が必要です`/Microi.net.Api/appsettings.json`ファイル

```csharp
  "AppSettings": {
    "OsClient": "iTdos",//【必须】自定义SaaS引擎Key，与数据库【sys_osclient】表的【OsClient】字段值对应
    "OsClientType": "Product",//【必须】自定义程序运行环境，如：Product（正式环境）、Dev（测试环境）等
    "OsClientNetwork": "Internet",//【必须】自定义网络类型，如：Internet（公网）、Internal（内网）等
    "OsClientDbConn": "",//【必须】数据库连接字符串，建议使用源码提供的MySql。SqlServer、Oracle也支持，后期整理后提供数据库demo
    "IS4SigningCredential": "",//【必须】可以直接使用源码中的默认签名
    //Tips：若【OsClient + OsClientType + OsClientNetwork】在【sys_osclient】表中能匹配到数据，且数据中有Redis相关配置，则可以省略以下Redis配置
    "OsClientRedisHost" : "",//Redis Host，如：119.31.116.88
    "OsClientRedisPort" : "",//Redis端口，如：6379
    "OsClientRedisPwd" : ""//Redis密码，如：123456
    //其余配置分布式存储（如阿里云OSS、MinIO）、MQ消息队列、ES搜索引擎等，均在平台【SaaS引擎】中动态配置
  },

```

- 「Microi.net.Api」プロジェクトを右クリックし、デバッグ --> 新しいインスタンスを起動します
- アクセス先:`https://localhost:7266`(ポートは/Microi.net.Api/Properties/launchSettings.jsonで構成されています)
 
## 【Visual Studio 2022】を使ってソリューションを開く
- ダウンロードとインストール`vs2022`: [Vs2022](https://visualstudio.microsoft.com/zh-hans)
- 直接ダブルクリックして開く`/Microi.net.sln`ファイル、開いてしばらく待って右クリックします`Microi.net.Api`プロジェクトの再生成
- 元に戻す場合`nuget`パッケージ失敗。閉じてください。`vs2022`を再度開きます`Microi.net.sln`ファイルは引き続き試してみます。一般的にはインターネットの問題です。携帯電話のホットスポットを使ってみてもいいです。
- 設定が必要です`/Microi.net.Api/appsettings.json`ファイル、説明は同じです

## 環境配置に関する注意事項
- ない場合`MongoDB`環境の場合、システムログ機能を使用できません
- ない場合`MinIO`、Alibaba cloud`OSS`などの分散ストレージ環境では、ファイル/画像アップロード機能は使用できません
- ない場合`RabbitMQ`環境の場合、メッセージキュー機能は使用できません
- ない場合`ES`環境の場合、検索エンジン機能は使用できません。