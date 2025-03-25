# 分散ストレージ
## 紹介
>* プラットフォーム分散ストレージは現在、阿里雲OSS/CDN、MinIO、アマゾンs 3をサポートしている
>* 分散ストレージ構成はSaaSエンジンに基づいており、SaaSテナントによって異なる構成を使用できるメリットがあります
>* 分散ストレージ構成はフォームエンジンによって駆動され、フォームエンジンによってより多くの設定可能な項目を自由に拡張できます。
>* ソースコードはすべてMicroi.HDFSプラグインにあり、テンセント雲、華為雲などを拡張することもできる
>* [ソースアドレス:[https://gitee.com/ITdos/microi.net/tree/master/Microi. HDFS](https://gitee.com/ITdos/microi.net/tree/master/Microi.HDFS)

## まず、 [システム設定]-[開発構成] で保存方法を指定します
> システム設定はフォームエンジンによって駆動されるため、フォームデザインでより多くのカスタム保存方式を自由に拡張できます。

![ここに画像の説明を挿入します](https://static.itdos.com/upload/img/csdn/5f7e4c8a6b824c51b1c50de50827abdd.png#pic_center)
## もしalibaba cloud OSS CDN
> 【SaaSエンジン】-【Aliyun】で関連パラメータを設定します。

![ここに画像の説明を挿入します](https://static.itdos.com/upload/img/csdn/dd353af2971c4057b3d47c1f3ad9d81c.png#pic_center)
## MinIOなら
> 「SaaSエンジン」-「MinIO」に関連パラメータを設定します
> MinIOのインストール方法は、記事:[https://microi.blog.csdn.net/article/details/143576299](https://microi.blog.csdn.net/article/details/143576299) を参照してください

![ここに画像の説明を挿入します](https://static.itdos.com/upload/img/csdn/0bde20907de743f5b051036546837afa.png#pic_center)
## アマゾンs 3なら
> まずアマゾンS3:[https://blog.csdn.net/qq973702/article/details/143648974](https://blog.csdn.net/qq973702/article/details/143648974) に精通している必要があります
> プラットフォームはMinIO SDKを使ってアマゾンs 3を駆動し、配置が少し複雑で、紹介が遅れている