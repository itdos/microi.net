# クイックハンド
このチュートリアルでは、バックエンド・プロジェクトを迅速に実行できます。

## 準備作業

-オープンソースのアドレスから最新のコード [microi.net](https://gitee.com/ITdos/microi.net) を取得するには、 'git 'ツールを使用します。
-ダウンロードとインストール '. Net9sdk':[.Net9sdk](https://dotnet.microsoft.com/zh-cn/download)
-プロジェクトを走らせるには、少なくとも【データベース 'Redis' 】という2つの環境が必要です。

## 【Visual Studio Code】を使用してソリューションを開く (推奨)

-'Vs Code 'をダウンロードしてインストールします:[Vs Code](https://code.visualstudio.com)
-'Vs code 'を开き、プラグインをインストールします: 'C # 、C # devkit、. NET Install tool 'の3つのコンポーネント
-歓迎ページで「microi」吾コードオープンソース版ルートフォルダを開き、数秒後に自動的に「ソリューションエクスプローラ」が表示され、「vs code」が自動的に「nuget」ライブラリを復元するのを待っています
-'/Microi.net.Api/appsettings.Json' ファイルを構成する必要があります

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

-「Microi.net.Api」プロジェクトを右クリックし、デバッグ --> 新しいインスタンスを起動します
-アクセスアドレス: 'https:// localhost:7266' (ポートは/Microi.net.Api/Properties/launchSettings.jsonで構成されています)
 
## 【Visual Studio 2022】を使ってソリューションを開く
-'Vs2022' をダウンロードしてインストールします:[vs2022](https://visualstudio.microsoft.com/zh-hans)
-直接ダブルクリックして '/Microi.net.sln' ファイルを開き、開いてしばらくして「microi.net.Api」プロジェクトを右クリックして再生成します
-「Nuget」パッケージの復元に失敗した場合は、「vs2022」を閉じ、「microi.net.Sln」ファイルを再度開いて試してください。一般的にはネットワークの問題で、携帯電話のホットスポットを使ってみてもいいです
-'/Microi.net.Api/appsettings.Json' ファイルを設定する必要があります。説明は同じです

## 環境配置に関する注意事項
-'MongoDB' 环境がない场合、システムログ机能を使用できません
-'MinIO' 、alibaba cloud 'OSS' などの分散ストレージ环境がない场合、ファイル/画像アップロード机能は使用できません
-'RabbitMQ' 环境がない场合は、メッセージキュー机能を使用できません
-'ES' 环境がないと検索エンジン机能が使用できません