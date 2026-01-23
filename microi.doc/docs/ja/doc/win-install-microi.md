# Windowsの導入

## 環境インストール

### インストール. NET実行環境
> * Hosting Bundle、ASP.NET Core Runtime 9.x64バージョンの2つのファイルをダウンロードしてインストールします
> * https://dotnet.microsoft.com/en-us/download/dotnet/9.0
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380477367466977006970663.png#pic_center)

### Web配置のダウンロード
> * https://www.iis.net/downloads/microsoft/web-deploy
> * インストールが完了したら、iisモジュールにAspNetCoreModuleV2のモジュールがあるかどうかをチェックすることをお勧めします
> * インストール時に典型的なインストールを選択すればいいです。
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380477378879752132167332.png#pic_center)
> * 次の2つのサービスが [実行中] で、起動タイプが [自動] に構成されていることを保証します (windows server2016システムの中には、この手順をチェックする必要がないものもあります)
> * 注意: サービス起動エラーなどの他の問題が発生する可能性があります。この時点でサーバのオペレーティングシステムを再起動することをお勧めします。
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380485239954922151314394.png#pic_center)

### IISのインストール
> * この手順は基本操作ですが、百度です。

### MySqlデータベースのインストール
> * Mysql 5.5,5.6,5.7,8.0をサポート
> * 公式5.7ダウンロード先: https://dev.mysql.com/downloads/file/?id=514047
> * ページ中の【No thanks, just startmy download. 】テキストリンクをダウンロードします。

> * インストール開始時にアップリケを求めるメッセージが表示されたら【No】をクリックします
> * インストール時に選択してください。

> * インストール手順のスクリーンショット (時間によってダウンロードしたインストールパッケージのインターフェイスは異なるかもしれませんが、ほぼ同じです):
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903514717805320923.png#pic_center)
> * 右の【Add】をクリック
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903553471386628081.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903578114162396094.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903608305376252952.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903728321578376962.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903727997722580803.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903749410369636717.png#pic_center)
> * A) インストールが完了したら、ポート番号をファイアウォールに置いておく必要があります。
> * B) mysqlリモート接続を許可する:
```json
进入C:\Windows\System32\cmd.exe或C:\Program Files\MySQL\MySQL Server 5.7\bin安装目录，执行cmd命令：
#mysql -uroot -p密码 -P端口  （如：mysql -uroot -pmysql5.7.itdos -P3309）
#use mysql;
#update user set host='%' where user ='root';
#FLUSH PRIVILEGES;
#GRANT ALL PRIVILEGES ON *.* TO 'root'@'%'WITH GRANT OPTION;
以上均为mysql常用命令，此时需要在服务器防火墙开放mysql端口，如果是阿里云还需要配置安全组开放端口。
```
> * C) ローカルでNavicatを使用してmysqlに接続し、データベースを作成します (データベースコードはutf8mb4、utf8mb4_ジェネリックciを使用することに注意してください)。 https://os.cyguzi.com 上のデータベースを復元します (Navicatを使用してエクストラネット上のライブラリに接続することをお勧めします) その後、バックアップしてリストアすると、宝塔からデータベースバックアップをダウンロードすることもできます)。Navicat解読版:https://static.itdos.com/soft/Navicat-Premium-15.zip

### Redisキャッシュのインストール
> * Redis msiインストールパッケージのダウンロード: https://github.com/microsoftarchive/redis/releases
> * Githubはたまに遅いです。iTdosリンク: https://static.itdos.com/soft/redis-x64-3.0.504.msi
> * インストール手順は比較的簡単です:
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377615195291607333151.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377615193259492630058.png#pic_center)
> * インストールが完了しましたらサービスでRedisサービスが動作しているのが見えます。
> * インストールディレクトリこのファイルを编集します: D:\ Program Files \ Redis \ redis.windows-service.conf
> * A
> * B) パスワードの設定: たぶん387行目くらい # requirepass foobaredの下に1行追加します: requirepass redis.itdos(redis.itdosはパスワードで、カスタマイズ可能)
> * C) Redisサービスを再起動し、ファイアウォールはポートを開放し、redis接続ツールを使用して接続をテストする必要があります。

### MongoDBデータベースのインストール
> * 現在、私たちが使用しているのは4.913、4.4.17 Windows Server2012 r 2をサポートしていない、6.xはcentosでコマンドが変わった。
> * Msiインストールパッケージのダウンロード: https://www.mongodb.com/try/download/community
> * ITdosダウンロード先: https://static.itdos.com/soft/mongodb-win32-x86_64-2012plus-4.2.23-signed.msi
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377827464317905833519.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377818853432765738119.png#pic_center)
> * Customを選択
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377818884792517096417.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377818904712359053021.png#pic_center)
> * デフォルトのRun service as Network Service userを使用します
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377818932506997802046.png#pic_center)
> * Install MongoDB Compassのチェックを外します。
> * インストールが完了したらアクセス: localhost:27017次のインタフェースが表示され、インストールが成功したことを示し、WindowsサービスでもMongoDBサービスが実行されています。
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377916760887465029633.png#pic_center)
> * アカウントパスワードの設定:
> * A) MongoDBインストールディレクトリに入る: D:\ Program Files \ MongoDB \ Server \ 4.2 \ bin実行cmd
> * B) コマンドを実行する:
```json
#mongo
#use admin
#db.createUser({user: 'root', pwd: 'iTdos.mongo', roles: ['root']})
说明：创建root用户，密码iTdos.mongo（自定义）
#db.auth('root', 'iTdos.mongo')
说明：测试连接，返回1表示正确
```

### MinIO分散ストレージのインストール
> * 公式サイトにアクセスしてインストーラをダウンロードする: https:// min.io/download #/windows
> * Exeプログラム
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380406928638277002335189.png#pic_center)
> * 実行方法:
> * A) minio.exeをD:\ Microi \ Minio \ minio.exeのようなディレクトリにドロップします。
> * B) WinSW-net461.exeをダウンロードします。minio.exeと同じ場所に置いて、ファイル名を https://static.itdos.com/soft/WinSW-net461.exe に変更してminio-server.exe。
> * C) minio.exeディレクトリに新しいminio-server.xmlファイルを作成します。リンク: https://static.itdos.com/soft/minio-server.xml
> * D) cmdはminio.exeがあるディレクトリに入ります (直接マウスをダブルクリックしてexeを実行するわけではないので注意してください)
> * E) コマンドを実行する:
```json
#minio-server.exe install
#minio-server.exe start
其它常用命令：
#minio-server.exe stop
#sc delete minio-server.exe 
服务器需要对应端口。
注意：
Sys_OsClients中的【MinIOEndPoint】需要配置为：{服务器内网IP}:9000
系统设置--开发配置中的【FileServer】需要配置为：http://{服务器外网IP}:9000/itdos-public
```
> * F) localhost:9000にアクセスし、デフォルトアカウントはminioadminです
> * G) 2つのBucket、1つのプライベート、1つのパブリックを作成し、それぞれの名前 (名前のカスタマイズ):itdos-public (必要なインタフェースの構成権限はpublic)、itdos-private

### IIS環境のインストール
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125155877365101931668_origin.png/20230925/iis.png#pic_center)
> * サーバー管理画面を開く
> * 管理 -- 役割と機能の追加 -- デフォルトで次のステップからサーバーの役割へ --- Webサーバー (IIS) をすべてチェックする (FTPサーバーモジュールを除く)
> * インストールが成功するまでデフォルトで次のステップに進みます
> * IIS管理画面を開く
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125179476379767066462_origin.png/20230925/打开iis.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125180836250262781416_origin.png/20230925/IIS管理界面.png#pic_center)



## プログラムの配置

### プログラム2セットをダウンロードして解凍します

### Microi-apiバックエンドインターフェースシステムの導入
> * ルートディレクトリはappsettings.jsonファイルを開いて、 [オスカー、オスカー、オスカー、オスカー、オスカーネットワーク、オスカーの4つのパラメータを編集して修正し、ローカルに対応するものに変更します。
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383124995671143943939168_origin.png/20230925/auth.png#pic_center)
> * 修正が完了したら、同級ディレクトリの下でcmdまたはpowershellを実行して、コマンドを実行します```Dotne t Microi.net.Auth.dll -- urls = http:// 39.0.0: 1051```、プログラムの実行に成功し、lisenceの問題を提示すると、対応するHIDを提供します (HIDはエラーメッセージに出力され、HIDを直接取得できることに注意してください)。システム管理者にフィードバックしますビジネスライセンス取得証明書を取得し、取得した後、クラスのディレクトリの下に置いてカバーした後、再度コマンドを実行すればよい。
> * デプロイ完了後、アクセスが正常かどうか (ポートは1051と仮定):localhost:1051
> * 最後に、サービス変更プログラムをwindows serverサービスに作成して管理することができます。コマンドは以下の通りです```Sc create microi-api binPath = "C:\ Micro i\Microi.net.Auth \ net10.0 \ microi.Net.api.exe"```

### Microi-webフロントエンドアクセスシステムの導入
> * 直接webサイトを作成すればいいです。どのプログラムプールでもいいです。環境変数を配置しなくてもいいです。
> * ただしルートディレクトリ/index.htmlにあるOsClient、ApiBaseに対応する変数の値を変更する必要があります。ここでは参考にしているだけで、実際のclient名とapiアドレスインタフェースで記入してください
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383124964739859058076187_origin.png/20230925/os-html.png#pic_center)
