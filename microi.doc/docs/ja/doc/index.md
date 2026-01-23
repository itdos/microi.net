# オープンソース低コードプラットフォーム-Microi吾コード

## プラットフォーム概要
> * 公式ドキュメント:[https://microi.net](https://microi.net)
> * 技術フレームワーク:[__<font color="red">**低コードAI**</font>__] 開発モデル、サポート`传统开发`,. Net 10 Vue2/3 Redis MySql/SqlServer/Oracle Element-UI/Element-PlusUniApp
> * プラットフォームは2014年 (Avalon.jsに基づく) に始まり、2018年にVue再構築を使用し、2024年11月にオープンソース
> * 強力な [[APIインタフェースエンジン]](https://microi.net/doc/v8-engine/api-engine.html) は、オンラインで使用します`JavaScript`書く`后端api接口`、 [[AI代書v 8エンジンコード](https://microi.net/doc/v8-engine/ai-apiengine.html) をサポートします。`[Get、Post]`リクエスト、サポートリターン`[JSON、字符串、文件、HTML]`など、サポート`[自定义接口地址、分布式锁、权限、自定义扩展函数]`待って。任意の複雑なビジネスシーンを実現できます。究極のパフォーマンスと開発効率は、コンパイルしてリリースする必要がなく、保存すると有効になります
> * WebOS試用住所:[https://webos.microi.net](https://webos.microi.net)
> * 従来のインターフェース試用住所:[https://web.microi.net](https://web.microi.net)
> * Giteeオープンソース住所:[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
> * GitCodeオープンソース:[https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview)
> * 公式CSDNブログ:[https://microi.blog.csdn.net](https://microi.blog.csdn.net/?type=blog)
> * 技術CSDNブログ:[https://lisaisai.blog.csdn.net/?type=blog](https://lisaisai.blog.csdn.net/?type=blog)


## プレビュー図
<img src="https://static.itdos.com/upload/img/csdn/ee76765ec943d4da0b6f6097c494d8bc.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/Microi20260122.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/9989ec6bfdcd6c0fead567bd79012bc4.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/13c2c7a5e0329f6821eddd3f12c8536f.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/e7cc9aee7486409a40a4a0b72cf5d916.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/ede3b036e9ebbf6de2772bcb3b062790.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/23ca5070e927a7a7cc3687221fe483dd.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/6cf3c31ba0e8da4a124cb1bf8c755b74.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<Div style = "clear:both;"></div>

## プラットフォームのハイライト
* **無制限**：ユーザー数、フォーム数、データ量、データベース数などを制限せず、フロントエンド & モバイル端末は100% オープンソース、バックエンドは99% オープンソース
* **インターフェースエンジン**：[Google v 8エンジンを統合し、JavaScriptを使用してバックエンドインタフェースをオンラインで作成し、get、post要求をサポートし、ファイルへの応答、ファイルの読み取りなどをサポートします](/doc/v8-engine/api-engine)
* **クロスプラットフォーム**：現在に基づいている. NET10 (.Netframework/core2.0からアップグレード) 、 [コアライブラリは.Netstandard開発](https://www.nuget.org/packages/Microi.net#versions-body-tab) 、gRPCをサポートして開発言語間通信を実現
* **データベース間**：Mysql 5.5、SqlServer2016、Oracle11gをサポートし、読み書き分離/ライブラリ分割テーブルをサポートし、より多くのデータベースタイプを拡張できます
* **分散**：分散配置をサポートしています。
* **分散キャッシュ**：Redisホイッスルをサポート
* **分散ストレージ**：[阿里雲OSS、MinIO、アマゾンS3をサポートし、より多くのストレージメディアを拡張できる](https://microi.blog.csdn.net/article/details/143763937)
* **MQメッセージキュー**：統合RabbitMQ
* **IoT IoT MQTT**：MQTTサーバを統合し、485、zigbee、bluetooth、Modbusのモノネットワーク機器MQTTゲートウェイをサポートし、インタフェースエンジンはビジネスロジックコードをオンラインで作成し、IoTモノネットワークの開発効率を10倍に向上させます
* **検索エンジン (ES)**：ES検索エンジンを統合し、大規模なインターネットアプリケーションの分詞検索を簡単に実現
* **MongoDB**：MongoDBを統合し、インタフェースエンジンはMongoDBに直接アクセスでき、ログシステムはMongoDBを採用し、億級データミリ秒級ページングを採用している
* **インターフェースエンジン**：[インタフェースのカスタマイズ](https://microi.blog.csdn.net/article/details/143972924)【<span color = "red">Tips: このモジュールはオープンソースではなく、機能は無制限に </span>】
* **印刷エンジン**：[オンラインで印刷テンプレートを作成する](https://microi.blog.csdn.net/article/details/143973593)【<span color = "red">Tips: このモジュールはオープンソースではなく、機能は無制限に </span>】
* **SaaSエンジン**：3つのSAASモデルは、データベースレベルでのマルチテナント隔離、TenantIdテナント隔離、独立した組織データ隔離をサポートします
* **フォームエンジン**：[拡張コンポーネントのサポート、カスタムvueコンポーネント埋め込みフォームのサポート、二次開発コールフォームエンジンのサポート、v 8エンジンイベントのサポート、複雑なビジネスロジックの柔軟な実現](https://microi.blog.csdn.net/article/details/143671179)

* **モジュールエンジン**：[複数テーブルの関連付け、列の照会、; をサポートします。固定列、列を表示しない、統計列、検索可能列、ソート可能列、動的v 8ボタン、複雑なwhere条件、インタフェースアドレスの置換、さまざまな埋め込みモードをサポートしますiframe、マイクロサービス、コンポーネント、組み込みインタフェーステンプレートなど](https://microi.blog.csdn.net/article/details/143775484)
* **テンプレートエンジン**：フォーム/フォームはオンラインhtmlテンプレートレンダリングをサポートしています
* **AIエンジン**：AIモデル (DeepSeekなど) を統合し、AIコード検査、インタフェースエンジンv 8コード生成を実現
* **データベース管理**：サードパーティのデータベースをワンクリックでロードし、インタフェースエンジンで任意のデータベースにアクセスできます
* **Officeエンジン**：Officeテンプレートをローカルに設計し、テンプレートに基づいてエクスポート、印刷します
* **ワークフローエンジンv4**：[V 1はマイクロソフトWWF、v 2はccflow、v 3はマイクロソフトの最新WWF、v 4に基づいて完全に自主的に開発し、フォームエンジン、インターフェースエンジンによって駆動される](https://microi.blog.csdn.net/article/details/143742635)
* **細粒度権限制御**：各テーブル、各フィールド、各メニュー、各V8ボタン、各インタフェースの権限制御に細分化されています
* **シングルサインオン**：左側、上部の非表示をサポートします。サードパーティシステムのシングルサインオン低コードプラットフォーム、低コードプラットフォームのシングルサインオン第三者システムをサポートします。
* **Wechat公式プラットフォーム**：複数の公開番号の設定 (異なるグループの支社のユーザーが異なる公開番号を結び付けてテンプレートメッセージを送信する) 、複数のアプレットの設定、テンプレートメッセージの設定
* **モバイル端末 (uni-app)**：100% ソースコードをオープンし、アプレット、h5、アンドロイド、iosをパッケージ化できます
* **レポートエンジン**：仮想テーブル、echartsレポートをサポートし、レポートはカスタム追加変更をサポートします。
* **マイクロサービス**：フロントエンドのマイクロサービスをサポートします。
* **タスクスケジューリング**：カスタム定時タスクは、インタフェースエンジン、カスタム開発dllを実行できます。
* **チャットシステム**：自己開発のオンラインチャット、メッセージ通知をサポートし、同時にテンセントIMチャットシステムを統合しました。
* **収集エンジン**：全能の収集エンジンは、インタフェースエンジンでwebページ、mvvmレンダリング前、mvvmレンダリング後、すべてのインタフェース要求を収集することができる
* **本を飛ばす**：インターフェースエンジンを使って本のインターフェースを通し、メッセージ通知などをサポートします。
* **多言語**：前後とも多言語管理をサポートし、オンラインで多言語を設定します。
* **統合goViewデータ大画面**：GoViewデータの大画面を統合して、データの可視化を迅速に実現できます。詳細紹介: https://lisaisai.blog.csdn.net/article/details/149858192?spm=1001.2014.3001.5502
* **WebGL内蔵3Dモデルレンダラー**： WebGL 3Dモデルレンダラー内蔵なので、3Dモデルの可視化を素早く実現できます。Three.jsに基づいて、モデル.gltf、obj、glb、fbx、stlフォーマットをサポートします。体験住所: https:// www.nbweixin
* **テンセントIM**: 腾讯IMを統合すると、簡単な構成で、豊富なUIコンポーネントを使ってソーシャルチャット、コールセッション、ライブ弾幕などの能力を迅速に統合することができる。

## オープンソース版、個人版、企業版の違い
>* **オープンソース版**：PC従来のインターフェイスは100% 完全なソースコード、モバイル端末は100% 完全なソースコード、バックエンドは99% ソースコードで、商用で、自由に修正できる。 <Font color = "red"> プロセスのみを設計、保存でき、ワークフローを開始できません。 </Font>
>* **個人版**：￥999; 追加にはfont color = "red">【WebOS 100% 完全ソースコード】/font> が含まれており、機能、オープンソースの程度は「企業版」と完全に一致しているバックエンド永久開発者ライセンスは1つで、バックエンド永久実行時ライセンスは制限されません。 <Font color = "red"> 制限なしでワークフローを開始できます。
>* **企業版**：￥10w (頭金 ￥2.5w) より多くのトレーニング、コンサルティングなどのアフターサービスを提供するプラットフォームのアップグレードのニーズに優先的に対応するバックエンドの永続的な開発者ライセンスは10個で、バックエンドの永続的な実行時ライセンスは制限されません

## 成功事例
* 2018 ~ 2025はMicroi吾コードプラットフォームが提供したソフトウェア200セットに基づいて、すでにお客様500を応用している
* 不動産インターネットプラットフォーム (大量の前後のマイクロサービスのカスタマイズ)
* 大型MES(500テーブル、500インタフェースエンジン)
* 大型電気機器ERP(300表、100モジュール)
* 複数の服装ERP(100表、1人1ヶ月で完成)(純低コードプラットフォームが実現する服装ERPシステム)
* モノのインターネットのスマートホーム (億級データ量処理) 、植物工場のスマートハードウェア制御
* 複数セットのグループ、国有企業oaシステム
* 駐車場、潮汐検査、固定資産、CRMなどのプラットフォーム
* 合作大学研修コース
* [100余りのケースが継続的に更新中](https://microi.blog.csdn.net/category_12828272.html)

## ソースディレクトリの説明
* **Microi.Doc**：公式サイトのソースコード (公式文書)
* **Microi.Server**：バックエンド99% ソースコード (.NET10)
* **Microi.uniapp.uni-ui**：モバイル端末100% 完全ソースコード (uniapp + uni-ui + vue3)
* **Microi.web**：PC従来のインターフェイス100% 完全ソースコード (vue2 + element-ui + webパック + vuex)
* **Microi.webos.build**：WebOSコンパイル後 (配備実行可能)
* **Microi.webos**：【個人版】WebOS 100% 完全ソース (vue3 + element-plus + vite + pinia)

## Microi吾コード-関連ドキュメント
>* **公式文書**：[ https://microi.net](https://microi.net )
>* **CSDNプラットフォームドキュメント**：[ https://blog.csdn.net/qq973702/category_12826294.html](https://blog.csdn.net/qq973702/category_12826294.html )
>* **CSDN成功事例**：[ https://blog.csdn.net/qq973702/category_12828272.html](https://blog.csdn.net/qq973702/category_12828272.html )
>* **CSDNは私のコードに基づくオープンソースのプロジェクトです。**：[ https://blog.csdn.net/qq973702/category_12828230.html](https://blog.csdn.net/qq973702/category_12828230.html )

