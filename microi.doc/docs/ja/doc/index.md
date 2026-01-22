# オープンソース低コードプラットフォーム-Microi吾コード

## プラットフォーム概要
> * 技術フレームワーク:. Net9redis MySql/SqlServer/Oracle Vue2/3 element-UI/Element-Plus
> * プラットフォームは2014年 (Avalon.jsに基づく) に始まり、2018年にVue再構築を使用し、2024年11月にオープンした
> * 公式サイト:[https://microi.net/](https://microi.net/)
> * WebOSトライアルアドレス (照会のみ):[https://webos.microi.net](https://webos.microi.net)
> * 従来のインターフェイスの試用アドレス (操作可能なデータ):[https://demo.microi.net/](https://demo.microi.net/)
> * Giteeオープンソース住所:[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
> * GitCodeオープンソース:[https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview)
> * 公式CSDNブログ:[https://microi.blog.csdn.net](https://microi.blog.csdn.net/?type=blog)
> * 技術CSDNブログ:[https://lisaisai.blog.csdn.net/?type=blog](https://lisaisai.blog.csdn.net/?type=blog)

## プレビュー図
<img src="https://static.itdos.com/upload/img/csdn/ee76765ec943d4da0b6f6097c494d8bc.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/9989ec6bfdcd6c0fead567bd79012bc4.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/13c2c7a5e0329f6821eddd3f12c8536f.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/e7cc9aee7486409a40a4a0b72cf5d916.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/Microi20260122.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/ede3b036e9ebbf6de2772bcb3b062790.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/23ca5070e927a7a7cc3687221fe483dd.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/6cf3c31ba0e8da4a124cb1bf8c755b74.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<Div style = "clear:both;"></div>

## プラットフォームのハイライト
* **無制限**：ユーザー数、フォーム数、データ量、データベース数などを制限しません
* **クロスプラットフォーム**：に基づく. NET8、gRPCをサポートして開発言語間通信を実現
* **データベース間**：Mysql 5.5、SqlServer2016、Oracle11gをサポートし、読み書き分離/ライブラリ分割テーブルをサポートし、より多くのデータベースタイプを拡張できます
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
* **Microi.Server**：バックエンドのソースコード
* **Microi.Doc**：公式サイトソース (ドキュメント)
* **Microi.uniapp.tuniao**：図鳥UIに基づくvue3モバイル版ソースコード
* **Microi.uniapp.uview**：Uviewベースのvue2モバイル版ソースコード
* **Microi.web**：フロントエンドPC従来のインターフェースフレームワークソース、vue2 element-ui webパックvuex node 14
* **Microi.web.qiankun**：QiankunベースのPCフロントエンドvue2マイクロサービスフレームワークソース
* **Microi.webos.build**：フロントエンドPC WebOS osフレームワークはコンパイル後に実行できます。
* **Microi.webos**：【個人版】フロントエンドPC WebOS osフレームワークソース、vue3 element-plus vite5pinia node 18

## Microi吾コード-関連ドキュメント
>* **公式文書**：[ https://microi.net](https://microi.net )
>* **CSDNプラットフォームドキュメント**：[ https://blog.csdn.net/qq973702/category_12826294.html](https://blog.csdn.net/qq973702/category_12826294.html )
>* **CSDN成功事例**：[ https://blog.csdn.net/qq973702/category_12828272.html](https://blog.csdn.net/qq973702/category_12828272.html )
>* **CSDNは私のコードに基づくオープンソースのプロジェクトです。**：[ https://blog.csdn.net/qq973702/category_12828230.html](https://blog.csdn.net/qq973702/category_12828230.html )
