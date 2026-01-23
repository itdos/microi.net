# ソースローカル実行-バックエンド

## ビデオチュートリアル
> * 再録画してアップロードします。
> * 履歴ビデオチュートリアル:[https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

## ソースコードと. NET環境
* Gitツールを使ってオープンソースのアドレスから最新コードをプルします:[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* ダウンロードとインストール. Net10sdk:[https://dotnet.microsoft.com/zh-cn/download](https://dotnet.microsoft.com/zh-cn/download)

## 「Visual Studio Code」を使用してソリューションを開く (Mac推奨)
* Vs codeをダウンロードしてインストールします:[https://code.visualstudio.com/](https://code.visualstudio.com/)
* Vscodeを開いて、プラグイン: C # 、C # devkit、. NET Install Toolの3つのコンポーネント
* 歓迎ページでMicroi吾コードオープンソース版【/Microi. Server】ディレクトリフォルダは、数秒後に自動的に「ソリューションエクスプローラ」が表示され、vs codeがnugetライブラリを自動的に復元するのを待っています
* 【/Microi.net.Api/appsettings.json】ファイルを設定する必要があります
```json
  "AppSettings": {
    "OsClient": "iTdos",//【必须】自定义SaaS引擎Key，与数据库【sys_osclient】表的【OsClient】字段值对应
    "OsClientType": "Product",//【必须】自定义程序运行环境，如：Product（正式环境）、Dev（测试环境）等
    "OsClientNetwork": "Internet",//【必须】自定义网络类型，如：Internet（公网）、Internal（内网）等
    "OsClientDbType": "MySql",//默认MySql，可选SqlServer、Oracle
    //【必须】数据库连接字符串，建议使用源码提供的MySql。同时支持SqlServer、Oracle
    "OsClientDbConn": "Data Source=192.168.31.1;Database=microi_empty;User Id=roo;Password=password123456;Port=3306;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;Min Pool Size=5;Connection Lifetime=300;Connection Timeout=30;Pooling=true;sslmode=None;",
    //SqlServer连接字符串示例：Server=192.168.31.1,1434;Database=microi_empty;User Id=sa;Password=password123456;
    //Oracle连接字符串示例：User Id=MICROI;Password=password123456;Data Source=192.168.31.1:1521/xe;
    //Tips：若【OsClient + OsClientType + OsClientNetwork】在【sys_osclient】表中能匹配到数据，且数据中有Redis相关配置，则可以省略以下Redis配置
    "OsClientRedisHost" : "",//Redis Host，如：119.31.116.88
    "OsClientRedisPort" : "",//Redis端口，如：6379
    "OsClientRedisPwd" : "",//Redis密码，如：123456
    "OsClientRedisDataBase" : ""//Redis库，如：0、5
    //其余配置分布式存储（如阿里云OSS、MinIO）、MQ消息队列、ES搜索引擎等，均在平台【SaaS引擎】中动态配置
  },
```
* _ _ <Font color = "red"> ソースコードを取得したら、Microi.net.dllを優先的に最新バージョンに更新してください。
* _ _ <Font color = "red"> nugetの自動復元に失敗し、プロジェクトのロードに失敗してコンパイルに失敗した場合は、vs codeを再起動してプロジェクトを再ロードし、nugetの復元を待つことができます。
* 「Microi.net.Api」プロジェクトを右クリックし、デバッグ --> 新しいインスタンスを起動します
* アクセス先:`https://localhost:7266`(ポートは/Microi.net.Api/Properties/launchSettings.jsonで構成されています)

## 【Visual Studio 2022】を使用してソリューションを開く (Windows推奨)
* Vs2022をダウンロードしてインストールします:[https://visualstudio.microsoft.com/zh-hans/](https://visualstudio.microsoft.com/zh-hans/)
* 「/Microi.net.sln」ファイルを直接ダブルクリックして開き、開いてしばらくして「Microi.net.Api」プロジェクトを右クリックして再生成します
* Nugetパッケージの復元に失敗した場合は、vs2022を閉じてMicroi.net.slnファイルを再度開いて試してください。一般的にはネットワークの問題で、携帯電話のホットスポットを使ってみてもいいです
* 【/Microi.net.Api/appsettings.json】ファイルを設定する必要があります。説明は同じです

## 必須パラメータの設定
* プロジェクトを走らせるには、少なくとも「データベースRedis」という2つの環境が必要で、欠かせない

## 環境配置に関する注意事項
* MongoDB環境がないとシステムログ機能を使用できません
* MinIO、阿里雲OSSなどの分散ストレージ環境がないと、ファイル/画像アップロード機能を使用できない
* RabbitMQ環境がない場合、メッセージキュー機能は使用できません
* ES環境がないと検索エンジン機能が使用できません

