# SaaSエンジン
## 紹介
>* SaaSエンジンはプラットフォームのハイライトの一つとして、すべてのテナントの中核的な独立開発配置を担っている
>* プラットフォームはデフォルトでSaaSモードなので、導入プラットフォームでは、microi、iTdos、andersonなどのOsClient値をカスタマイズして指定する必要があります
>* テナントごとに独立したデータベースがあり、メインライブラリでテナントごとに独立したRedis、MQ、検索エンジン、阿里雲、MinIOなどが構成されています
>* 一セットのプログラムはN個のテナントデータベースを駆動します。部屋を借りるごとにdockerプログラムをもう一セット配備する必要はありません。

## OsClient
>* OsClient値はSaaSエンジンKeyで、値はカスタマイズされています。microi、iTdos、andersonなどのすべての小文字を推奨します
>* Sys_osclientsテーブルでは、次の3つのデータがサポートされている場合、オスカーlienttypeオスカーネットワークの3つのフィールドが同時に一意になります
>* OsClient = "microi" 、オスクリエントタイプ = "Product" 、オスクリエントネットワーク = "Internal、dbcom =" Data Source = 192.168.1.11; データベース = microi "は、イントラネットIPの正式な環境データベースを使用しています
>* OsClient = "microi" 、オスクリエントタイプ = "Dev" 、オスクリエントネットワーク = "Internal" 、dbcom = "Data Source = 192.168.1.11; データベース = microi _ Dev" は、イントラネットIPテスト環境データベースを使用しています
>* OsClient = "microi" 、オスクリエントタイプ = "Dev" 、オスクリエントネットワーク = "Internet" 、dbcom = "Data Source = 59.110.139; データベース = microi _ Dev" は、パブリックネットワークIPテスト環境データベースを使用しています

## OsClientType
>* OsClientType値はSaaSエンジン環境タイプで、正式な環境、テスト環境、外貨環境などの値がカスタマイズされています

## OsClientNetwork
>* オスクリエントネットワーク値はSaaSエンジンのネットワークタイプで、値はイントラネット、エクストラネットなどのカスタマイズされています

## プログラムは上記の3つのパラメータを指定する必要があります。
>* を選択します。


## 基本構成
>* データベースの読み書き分離をサポートし、指定されたストレージメディアをサポートします

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/de7982df51cc41afa7e0dbc2c5389c89.png#pic_center)

## Alibaba cloudの設定
>* MinIOを使用していない場合は、阿里雲のOSS CDNを使用できます

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/0e4da43b35394de7867cfa5425697476.png#pic_center)

## MinIO設定
>* Alibaba cloud OSSを使用していない場合は、MinIOを使用できます

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/1efac36d0af04dd58b79723e2c850070.png#pic_center)

## Redis設定
>* 歩哨モードをサポート

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/d67c8649dc444e508238410c36b746ee.png#pic_center)

## MQメッセージキュー設定
>* クラスタモード対応

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/c171c8510a2b452980c3f020048b9d53.png#pic_center)

## 検索エンジン設定
>* 現在はES検索エンジンのみをサポートし、分詞検索をサポートしています。将来は他の検索エンジンを拡張する可能性があります。

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/637ce005054d43c2b6177f3b00693fc3.png#pic_center)

