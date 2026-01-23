# Officeオンライン編集
## 紹介
> * 現在のプラットフォームが統合されているOnlyOffice無料コミュニティ版は、ドキュメント編集、プレビューサービスとして、今後はより多く統合される可能性があります

## 編成によるonlyofficeサービスの導入
> * Onlyoffice/documentserverのタイムアウトが発生した場合は、私のコードを使用してミラーを公開することができます。
```json
version: '3.8'
services:
  documentserver:
    image: onlyoffice/documentserver
    container_name: onlyoffice
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1020:80"
    environment:
      - JWT_ENABLED=false
    volumes:
      - /volume1/docker/onlyoffice/DocumentServer/logs:/var/log/onlyoffice
      - /volume1/docker/onlyoffice/DocumentServer/data:/var/www/onlyoffice/Data
      - /volume1/docker/onlyoffice/DocumentServer/lib:/var/lib/onlyoffice
      - /volume1/docker/onlyoffice/DocumentServer/db:/var/lib/postgresql
```

## リバースプロキシの設定、プラットフォームシステムの設定
> * 私たちのリバースプロキシアドレスが [ https://net.itdos.net:1021](https://net.itdos.net:1021 ) であると仮定します
> * プラットフォームシステム設定で「OnlyOfficeApiBase」フィールド (なければ作成) に「 https://net.itdos.net:1021 」を設定します

## その後、プラットフォームのすべての添付ファイルがppt、excel、word形式のファイルであれば、デフォルトでonlyofficeで開かれます