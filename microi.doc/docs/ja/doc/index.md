# オープンソース低コードプラットフォーム-Microi吾コード

## 平台简介
>* 技术框架：.NET9 + Redis + MySql/SqlServer/Oracle + Vue2/3 + Element-UI/Element-Plus
> * プラットフォームは2014年 (Avalon.jsに基づく) に始まり、2018年にVue再構築を使用し、2024年10月29日にオープンした
> * 公式サイト:[https://microi.net/](https://microi.net/)
> * WebOSトライアルアドレス (照会のみ):[https://webos.microi.net](https://webos.microi.net)
>* 传统界面试用地址（可操作数据）：[https://demo.microi.net/](https://demo.microi.net/)
> * Giteeオープンソース住所:[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
> * GitCodeオープンソース:[https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview)
> * 公式CSDNブログ:[https://microi.blog.csdn.net](https://microi.blog.csdn.net/?type=blog)
> * 技術CSDNブログ:[https://lisaisai.blog.csdn.net/?type=blog](https://lisaisai.blog.csdn.net/?type=blog)

## プレビュー図
<img src="https://static.itdos.com/upload/img/csdn/ee76765ec943d4da0b6f6097c494d8bc.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/9989ec6bfdcd6c0fead567bd79012bc4.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/13c2c7a5e0329f6821eddd3f12c8536f.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/e7cc9aee7486409a40a4a0b72cf5d916.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/e71c4d8a982989c0750dd7be3036bfd4.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/ede3b036e9ebbf6de2772bcb3b062790.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/23ca5070e927a7a7cc3687221fe483dd.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/6cf3c31ba0e8da4a124cb1bf8c755b74.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<Div style = "clear:both;"></div>


## プラットフォームのハイライト
* **无限制**：ユーザー数、フォーム数、データ量、データベース数などを制限しません
* **クロスプラットフォーム**：に基づく. NET8、gRPCをサポートして開発言語間通信を実現
* **データベース間**：支持MySql5.5+、SqlServer2016+、Oracle11g+，支持读写分离/分库分表，可扩展更多数据库类型
* **分散**：分散配置をサポートしています。
* **分散キャッシュ**：Redisホイッスルをサポート
* **分散ストレージ**：[阿里雲OSS、MinIO、アマゾンS3をサポートし、より多くのストレージメディアを拡張できる](https://microi.blog.csdn.net/article/details/143763937)
* **统合メッセジキュー (RabbitMQ),検索エンジン (ES),MongoDB**
* **インターフェースエンジン**：[インターフェースのカスタマイズ](https://microi.blog.csdn.net/article/details/143972924)
* **印刷エンジン**：[印刷テンプレートをオンラインで作成](https://microi.blog.csdn.net/article/details/143973593)
* **SaaSエンジン**：3つのSAASモデルは、データベースレベルでのマルチテナント隔離、TenantIdテナント隔離、独立した組織データ隔離をサポートします
* **フォームエンジン**：[拡張コンポーネントのサポート、カスタムvueコンポーネント埋め込みフォームのサポート、二次開発コールフォームエンジンのサポート、v 8エンジンイベントのサポート、複雑なビジネスロジックの柔軟な実現](https://microi.blog.csdn.net/article/details/143671179)
* **インターフェースエンジン**：[Google v 8エンジンを統合し、JavaScriptを使用してバックエンドインタフェースをオンラインで作成し、get、post要求をサポートし、ファイルへの応答、ファイルの読み取りなどをサポートします](https://microi.blog.csdn.net/article/details/143968454)
* **モジュールエンジン**：[複数テーブルの関連付け、列のクエリ、列の表示しない、列の統計、列の検索可能、列のソート可能、列の動的v 8ボタン、複雑なwhere条件、インタフェースアドレスの置換、複数の埋め込みモードのサポート: iframe、マイクロサービス、コンポーネント、組み込みインタフェーステンプレートなど](https://microi.blog.csdn.net/article/details/143775484)
* **テンプレートエンジン**：フォーム/フォームはオンラインhtmlテンプレートレンダリングをサポートしています
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
* **チャットシステム**：オンラインチャット、メッセージ通知をサポートします
* **収集エンジン**：全能の収集エンジンは、インタフェースエンジンでwebページ、mvvmレンダリング前、mvvmレンダリング後、すべてのインタフェース要求を収集することができる
* **本を飛ばす**：インターフェースエンジンを使って本のインターフェースを通し、メッセージ通知などをサポートします。
* **多言語**：前後とも多言語管理をサポートし、オンラインで多言語を設定します。

## バージョンの違い
>* **オープンソース版**：プラットフォームの伝統的なインターフェースのフロントエンドの100% 完全なソースコード、プラットフォームのバックエンドの90% 以上のソースコードは商用で、自由に修正できます。
>* **個人版**：￥999; 追加には【vue3 WebOSオペレーティングシステムインタフェース100% 完全ソースコード】などが含まれており、機能は企業版と何の違いもない開発者は1つのライセンスを持っていて、実行時のライセンスは制限されていません
>* **企業版**：￥10w (頭金 ￥2w) 追加には「モバイル端末uniappuniun-ui 100% 完全ソースコード」が含まれていますより多くのトレーニング、コンサルティングなどのアフターサービスを提供するプラットフォームのアップグレードのニーズに優先的に対応する開発者のライセンスは10個で、実行時ライセンスは制限されません

## 成功事例
* 2018 ~ 2024はMicroi吾コードプラットフォームが提供したソフトウェア100セットに基づいて、お客様300を応用した
* 不動産インターネットプラットフォーム (大量の前後のマイクロサービスのカスタマイズ)
* 大型電気機器ERP(300表、100モジュール)
* 複数の服装ERP(100表、1人1ヶ月で完成)(純低コードプラットフォームが実現する服装ERPシステム)
* モノのインターネットのスマートホーム (億級データ量処理) 、植物工場のスマートハードウェア制御
* 複数セットのグループ、国有企業oaシステム
* 駐車場、潮汐検査、固定資産、CRMなどのプラットフォーム
* 合作大学研修コース
* [100余りのケースが継続的に更新中](https://microi.blog.csdn.net/category_12828272.html)

## ソースディレクトリの説明
* **Dos.ORM**：データベースコンポーネントのソースコード
* **Dos.Common**：よく使う開発クラスのソースコード
* **Microi.net.Api**：.NET8バックエンドapiインタフェースシステムフレームワークソース
* **Microi.AI**：AIエンジンプラグインのソースコード
* **Microi.Cache**：バックエンド分散キャッシュプラグインのソースコード
* **Microi.HDFS**：バックエンド分散ストレージプラグインのソースコード
* **Microi.Job**：バックエンドタスクスケジューリングプラグインのソースコード
* **Microi.MQ**：バックエンドメッセージキュープラグインのソースコード
* **Microi.Office**：バックエンドoffice関連処理プラグインのソースコード
* **Microi.ORM**：バックエンドデータベース差別化処理ソースコード
* **Microi.Search engine**：バックエンド検索エンジンのソースコード
* **Microi.Spider**：バックエンド収集エンジンプラグインのソースコード
* **Microi.V8Engine**：バックエンドv 8エンジン拡張ソースコード
* **Microi.SystemBase**：バックエンドシステムの基礎管理は、FormEngineフォームエンジンに全面的に置き換えられます。
* **Microi.gRPC.Client**：バックエンドgRPCクライアントテストソース
* **Microi.gRPC.Java**：バックエンドgRPCクライアントjavaテストソース
* **Microi.gRPC.Server**：バックエンドgRPCサービス側ソースコード
* **Microi.web**：フロントエンドPC従来のインターフェースフレームワークソース、vue2 element-ui webパックvuex node 14
* **Microi.web.qiankun**：QiankunベースのPCフロントエンドvue2マイクロサービスフレームワークソース
* **Microi.webos**：フロントエンドPC osフレームワークソース (個人版)
* **Microi.webos.build**：フロントエンドPC osフレームワーク (非個人版)
* **Microi.uniapp.tuniao**：図鳥UIに基づくvue3モバイル版ソースコード
* **Microi.uniapp.uview**：Uviewベースのvue2モバイルバージョン

## Microi吾コード-シリーズドキュメント
>* **プラットフォームの紹介**：[ https://microi.blog.csdn.net/article/details/143414349](https://microi.blog.csdn.net/article/details/143414349 )
>* **ワンクリックでインストールして使用します**：[ https://microi.blog.csdn.net/article/details/143832680](https://microi.blog.csdn.net/article/details/143832680 )
>* **クイックスタート**：[ https://microi.blog.csdn.net/article/details/143607068](https://microi.blog.csdn.net/article/details/143607068 )
>* **ソースローカル実行-バックエンド**：[ https://microi.blog.csdn.net/article/details/143567676](https://microi.blog.csdn.net/article/details/143567676 )
>* **ソースコードローカル実行-フロントエンド**：[ https://microi.blog.csdn.net/article/details/143581687](https://microi.blog.csdn.net/article/details/143581687 )
>* **Dockerデプロイ**：[ https://microi.blog.csdn.net/article/details/143576299](https://microi.blog.csdn.net/article/details/143576299 )
>* **フォームエンジン**：[ https://microi.blog.csdn.net/article/details/143671179](https://microi.blog.csdn.net/article/details/143671179 )
>* **モジュールエンジン**：[ https://microi.blog.csdn.net/article/details/143775484](https://microi.blog.csdn.net/article/details/143775484 )
>* **インターフェースエンジン**：[ https://microi.blog.csdn.net/article/details/143968454](https://microi.blog.csdn.net/article/details/143968454 )
>* **ワークフローエンジン**：[ https://microi.blog.csdn.net/article/details/143742635](https://microi.blog.csdn.net/article/details/143742635 )
>* **インターフェースエンジン**：[ https://microi.blog.csdn.net/article/details/143972924](https://microi.blog.csdn.net/article/details/143972924 )
>* **印刷エンジン**：[ https://microi.blog.csdn.net/article/details/143973593](https://microi.blog.csdn.net/article/details/143973593 )
>* **V 8関数リスト-フロントエンド**：[ https://microi.blog.csdn.net/article/details/143623205](https://microi.blog.csdn.net/article/details/143623205 )
>* **V 8関数リスト-バックエンド**：[ https://microi.blog.csdn.net/article/details/143623433](https://microi.blog.csdn.net/article/details/143623433 )
>* **V8.FormEngineの使い方**：[ https://microi.blog.csdn.net/article/details/143623519](https://microi.blog.csdn.net/article/details/143623519 )
>* **Where条件の使用法**：[ https://microi.blog.csdn.net/article/details/143582519](https://microi.blog.csdn.net/article/details/143582519 )
>* **DosResultの説明**：[ https://microi.blog.csdn.net/article/details/143870540](https://microi.blog.csdn.net/article/details/143870540 )

>* **分散ストレージ構成**：[ https://microi.blog.csdn.net/article/details/143763937](https://microi.blog.csdn.net/article/details/143763937 )
>* **Excelのカスタムエクスポート**：[ https://microi.blog.csdn.net/article/details/143619083](https://microi.blog.csdn.net/article/details/143619083 )
>* **フォームエンジン-カスタムコンポーネント**：[ https://microi.blog.csdn.net/article/details/143939702](https://microi.blog.csdn.net/article/details/143939702 )
>* **フォームコントロールのデータソースバインディング設定**：[ https://microi.blog.csdn.net/article/details/143767223](https://microi.blog.csdn.net/article/details/143767223 )
>* **フォームとモジュールを他のデータベースにコピーします**：[ https://microi.blog.csdn.net/article/details/143950112](https://microi.blog.csdn.net/article/details/143950112 )
>* **伝統的なカスタム開発と低コード開発の長所と短所について**：[ https://microi.blog.csdn.net/article/details/143866006](https://microi.blog.csdn.net/article/details/143866006 )
>* **オープンソース版、個人版、企業版の違い**：[ https://microi.blog.csdn.net/article/details/143974752](https://microi.blog.csdn.net/article/details/143974752 )
>* **パートナーになる**：[ https://microi.blog.csdn.net/article/details/143974715](https://microi.blog.csdn.net/article/details/143974715 )

>* **Microiベースのオープンソースプロジェクト**：[ https://microi.blog.csdn.net/category_12828230.html](https://microi.blog.csdn.net/category_12828230.html )
>* **成功事例**：[ https://microi.blog.csdn.net/category_12828272.html](https://microi.blog.csdn.net/category_12828272.html )

>* **インターフェースエンジン実戦-第三者のショートメッセージを送信します。**：[ https://microi.blog.csdn.net/article/details/143990546](https://microi.blog.csdn.net/article/details/143990546 )
>* **インターフェースエンジン実戦-阿里雲メールの送信**：[ https://microi.blog.csdn.net/article/details/143990603](https://microi.blog.csdn.net/article/details/143990603 )
>* **インターフェースエンジン実戦-微信小プログラム許可携帯電話番号登録**：[ https://microi.blog.csdn.net/article/details/144106817](https://microi.blog.csdn.net/article/details/144106817 )
>* **インターフェースエンジン実戦-マイクロレターv 3支払いJSAPI注文**：[ https://microi.blog.csdn.net/article/details/144156119](https://microi.blog.csdn.net/article/details/144156119 )
>* **インターフェースエンジン実戦-マイクロレター支払いコールバックインターフェース**：[ https://microi.blog.csdn.net/article/details/144168810](https://microi.blog.csdn.net/article/details/144168810 )
>* **インターフェースエンジン実戦-MongoDB関連操作**：[ https://microi.blog.csdn.net/article/details/144434527](https://microi.blog.csdn.net/article/details/144434527 )