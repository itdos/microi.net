# SaaSエンジン
## 紹介
> * SaaSエンジンはプラットフォームのハイライトの一つとして、すべてのテナントの中核的な独立開発配置を担っている
> * プラットフォームはデフォルトでSaaSモードなので、配置プラットフォームはカスタマイズして指定する必要があります`OsClient`、`OsClientType`、`OsClientNetwork`
> * テナントごとに1つ`独立数据库`、にできます`主库`の`sys_osclients`表ではテナントごとに独立した`数据库连接字符串`、`MongoDB`、`Redis`、`MQ`、`阿里云`、`MinIO`など
> * 一セットのプログラムはN個のテナントデータベースを駆動し、テナントごとにdockerプログラムをもう一セット配備しなくてもいいです。
> * ローカル二次開発`一键切换租户数据库`、`环境`
> *`主库`つまりプラットフォームを導入する場合`环境变量`または`appsettings.json`に設定された`数据库连接字符串[OsClientDbConn]`
> * すべての`Saas引擎配置`で`主库`テナント倉庫の`Saas引擎配置`テーブルはデータをクリアすればいいです。

## 'OsClient'
> * OsClient値は`SaaS引擎Key`、どのテナントを確定するか、値のカスタマイズ、入力などのすべての小文字を推奨します`microi`、`anderson`、`iTdos`

## 'OsClientType'
> * OsClientType値は`SaaS引擎环境类型`、値のカスタマイズ、例えば`正式环境`、`测试环境`、`外帐环境`など
> * 入力の場合`Product`、代表`正式环境`では、このデータの`数据库连接字符串`、`MongoDB`、`Redis`記入してください`正式环境`の設定
> * 入力の場合`Dev`、代表`测试环境`では、このデータの`数据库连接字符串`、`MongoDB`、`Redis`記入してください`测试环境`の設定

## 'オスクリエントネットワーク'
> * オスクリエントネットワーク値は`SaaS引擎网络类型`、値のカスタマイズ、例えば`内网`、`外网`など
> * 入力の場合`Internal`、代表`内网环境`では、このデータの`数据库连接字符串`、`MongoDB`、`Redis`のIPはすべて入力する必要があります。`内网环境`のIP
> * 入力の場合`Internet`、代表`公网环境`では、このデータの`数据库连接字符串`、`MongoDB`、`Redis`のIPはすべて入力する必要があります。`公网环境`のIP

## プログラムは上記の3つのパラメータを指定する必要があります。
> * ローカル二次開発修正`OsClient` `OsClientType` `OsClientNetwork`3つの値を簡単に切り替える`不同租户`の`不同环境`
> * メインライブラリ`sys_osclients`表中、`OsClient`   `OsClientType`   `OsClientNetwork`3つのフィールドは同時にユニークで、次の3つのデータが同時に存在する場合にサポートされています
> * 当`OsClient`= "Microi",`OsClientType`= "Product",`OsClientNetwork`= "Cny,`DbConn`= "Data Source = 192.168.1.11;Database = microi" の場合、使用されています。`内网IP` `正式环境数据库`
> * 当`OsClient`= "Microi",`OsClientType`= "Dev",`OsClientNetwork`= "Internal",`DbConn=`"Data Source = 192.168.1.11;Database = microi_dev" の場合、使用されています。`内网IP` `测试环境数据库`
> * 当`OsClient`= "Microi",`OsClientType`= "Dev",`OsClientNetwork`= 「Internet」、`DbConn`= "Data Source = 59.110.139; Database = microi _ dev" の場合、使用されています。`公网IP` `测试环境数据库`

## 基本構成
> * データベースの読み書き分離をサポートし、記憶媒体の指定をサポート

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/de7982df51cc41afa7e0dbc2c5389c89.png#pic_center)

## Alibaba cloudの設定
> * MinIOを使用していない場合は、阿里雲のOSS CDNを使用できます

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/0e4da43b35394de7867cfa5425697476.png#pic_center)

## MinIO設定
> * Alibaba cloud OSSを使用していない場合は、MinIOを使用できます
> * 注目すべき点は、MinIOがリバースプロキシを作成する際には、【proxy _ set _ header Host $ http_host】を設定する必要があることです阿里雲OSS、CDN、負荷バランスはデフォルトでは問題ない。
> * 例えばブロガーのリバースプロキシプロファイル
```shell
proxy_cache_path /www/wwwroot/static.chongstech.com/proxy_cache_dir levels=1:2 keys_zone=static_chongstech_com_cache:20m inactive=1d max_size=5g;
server {
    listen 80;
    listen 443 quic;
    listen 443 ssl;
    http2 on;
    server_name static.chongstech.com;
    index index.php index.html index.htm default.php default.htm default.html;
    root /www/wwwroot/static.chongstech.com;
    #CERT-APPLY-CHECK--START
    # 用于SSL证书申请时的文件验证相关配置 -- 请勿删除
    include /www/server/panel/vhost/nginx/well-known/static.chongstech.com.conf;
    #CERT-APPLY-CHECK--END
    #SSL-START SSL相关配置，请勿删除或修改下一行带注释的404规则
    #error_page 404/404.html;
    ssl_certificate    /www/server/panel/vhost/cert/static.chongstech.com/fullchain.pem;
    ssl_certificate_key    /www/server/panel/vhost/cert/static.chongstech.com/privkey.pem;
    ssl_protocols TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_ciphers EECDH+CHACHA20:EECDH+CHACHA20-draft:EECDH+AES128:RSA+AES128:EECDH+AES256:RSA+AES256:EECDH+3DES:RSA+3DES:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    add_header Strict-Transport-Security "max-age=31536000";
    error_page 497  https://$host$request_uri;
    #SSL-END
    #REDIRECT START
    #REDIRECT END
    #ERROR-PAGE-START  错误页配置，可以注释、删除或修改
    #error_page 404 /404.html;
    #error_page 502 /502.html;
    #ERROR-PAGE-END
    #PHP-INFO-START  PHP引用配置，可以注释或修改
    include enable-php-00.conf;
    #PHP-INFO-END
    #IP-RESTRICT-START 限制访问ip的配置，IP黑白名单
    #IP-RESTRICT-END
    #BASICAUTH START
    #BASICAUTH END
    #SUB_FILTER START
    #SUB_FILTER END
    #GZIP START
    #GZIP END
    #GLOBAL-CACHE START
    #GLOBAL-CACHE END
    #WEBSOCKET-SUPPORT START
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
    #WEBSOCKET-SUPPORT END
    #PROXY-CONF-START
    location ^~ / {
      proxy_pass http://localhost:1010;
      proxy_set_header Host $http_host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Real-Port $remote_port;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header X-Forwarded-Host $host;
      proxy_set_header X-Forwarded-Port $server_port;
      proxy_set_header REMOTE-HOST $remote_addr;
      proxy_connect_timeout 60s;
      proxy_send_timeout 600s;
      proxy_read_timeout 600s;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
    }
    #PROXY-CONF-END
    #SERVER-BLOCK START
    #SERVER-BLOCK END
    #禁止访问的文件或目录
    location ~ ^/(\.user.ini|\.htaccess|\.git|\.env|\.svn|\.project|LICENSE|README.md)
    {
        return 404;
    }
    #一键申请SSL证书验证目录相关设置
    location /.well-known{
        allow all;
    }
    #禁止在证书验证目录放入敏感文件
    if ( $uri ~ "^/\.well-known/.*\.(php|jsp|py|js|css|lua|ts|go|zip|tar\.gz|rar|7z|sql|bak)$" ) {
        return 403;
    }
    #LOG START
    access_log  /www/wwwlogs/static.chongstech.com.log;
    error_log  /www/wwwlogs/static.chongstech.com.error.log;
    #LOG END
}
```


![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/1efac36d0af04dd58b79723e2c850070.png#pic_center)

## Redis設定
> * 歩哨モードをサポート

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/d67c8649dc444e508238410c36b746ee.png#pic_center)

## MQメッセージキュー設定
> * クラスタモード対応

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/c171c8510a2b452980c3f020048b9d53.png#pic_center)

## 検索エンジン設定
> * 現在はES検索エンジンのみをサポートし、分詞検索をサポートしています。将来は他の検索エンジンを拡張する可能性があります。

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/637ce005054d43c2b6177f3b00693fc3.png#pic_center)

## インタフェースエンジンはsaasテナントを区別する
> * ユーザーは、 ( https://api.itdos.com/apiengine/test1)[https://api.itdos.com/apiengine/test1 ] など、インタフェースエンジンのカスタムインターフェースアドレスにアクセスし、デフォルトではメインライブラリを歩くインタフェースエンジンです
> * テナントAとテナントBに【/apiengine/test 1】インタフェースがあると仮定すると、アクセスを区別する方法はいくつかあります
> * 1、【/apiengine/test 1】インタフェースにアクセスすると、対応するユーザーのtokenがインポートされ、プラットフォームはtokenに基づいてOsClient値を認識して、対応するsaasテナントデータベースにアクセスします
> * 2、【/apiengine/test 1】インタフェースにアクセスするとき、tokenがないのは匿名アクセスで、Urlパラメータを追加することで区別します
> * 3、一部の特殊な状況はUrlパラメータを使用できない可能性があります。例えば、マイクロレターの支払いコールバックは、次のようなsaasテナントデータベースを区別するために、特別な形式でオスカーに渡された値を実現できます/apiengine/test 1--OsClient--veken--
```js
//示例代码
var appid = V8.OsClientModel.MiniProgramAppId;//小程序 appid
var privateKey = V8.OsClientModel.WxPayPrivateKey;//私书私有key
var notify_url = V8.SysConfig.ApiBase + `/apiengine/wxpay-notify--OsClient--${V8.OsClient}--`;//用户支付成功后回调地址，由接口引擎实现
var jsapiUrl = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';//腾讯官方下单地址，固定url
var jsapiUrlSimple = '/v3/pay/transactions/jsapi';//腾讯官方下单地址，固定url
var currentUser = V8.CurrentUser;
```

## SaaSテナントの追加、SaaSデータベースのオープン
> * Saasモードをオンにする前に、メインライブラリのPCフロントエンドプログラムの環境変数であるOsClient値が空白であることを確認する必要がありますので、つまり、対応するメインリポジトリアクセスアドレス、例えば [【 https://os.itdos.com 】](https://os.itdos.com/) のソースコードが開かれた後、【var OsClient = '';】はnullです。満たされていない場合は、docker runを手動で再インストールし、環境変数OsClientの値が空の文字列であることを確認する必要があります。

### 1.SaaSデータベースの準備
> * 新しいデータベース接続文字列がData Source = 59.110.1396であると仮定して、 [gitee上のdemoまたはemptyデータベース] (データベース、ケース、ドキュメント、資料を https://gitee.com/ITdos/microi.net/tree/master/ ) を使用することをお勧めしますデータベース = microi _ demo; Userid = microi _ demo;Password = password123456;Port = 1306;Convert Zero Datetime = True; Wredate = True; 空欄 = utf8mb4; Maxsize Pool = 500; min Pool Size = 5;Connection Lifetime = 300;Connection Timeout = 30;Pooling = true;sslmode = None;
> * このSaaSデータベースのKey値、つまりOsClient値、例えばsaas1を考えておく
> * ソース・サーバ・データベースがmysql 8で、ターゲット・サーバ・データベースがmysql 5.7であると、直接リストアできなくなり、ターゲット・サーバに空のデータベースを作成し、Navicatのデータ転送機能を使用してデータベースをリストアできます
> * 復元が成功したら、次のsqlを実行することをお勧めします:
```sql
-- 1、修改【sys_config】表中的【SysTitle】字段为新系统名称
update sys_config set SysTitle='新系统名称';
-- 2、修改【sys_osclients】表中的【OsClient】字段为新系统key，修改【RedisHost、RedisPort、RedisPwd】字段为空
update sys_osclients set OsClient='新系统key',RedisHost='',RedisPort='',RedisPwd='';
-- 3、为了防止部分定时任务影响原有业务，建议执行sql停止所有定时任务
update diy_schedule_job set Status='暂停';
update microi_job_triggers set TRIGGER_STATE='PAUSED';
```

### 2.メインライブラリ「SaaSエンジン」 ( https://web.microi.net/#/osclients ) にデータを追加する
> * メインライブラリの構成をすばやく追加して参照できるように、SaaSエンジンの「コピー」機能を直接使用することをお勧めします。例えば、「iTdos、Product、Internal」というデータをコピーすると新しい【saas1、Product、Internal】を入力して追加します
> * 上記に追加したデータの「データベース接続文字列」の値を、上記に用意したSaaSデータベースの接続文字列に変更し、ドメイン名をアクセスしたいドメイン名またはIP: ポートに変更します例えば「web.microi.net」はsaasライブラリであるか、「192.168.1.11:1002」と記入することもできます
> * この場合、バックエンドapiミラーリングのdockerコンテナを再起動する必要があります (その後のバージョンでは、この問題は修正され、再起動する必要はありません)

### 3、リバースプロキシをする
> * メインライブラリのアクセスアドレスが【192.168.1.11:1001】であると仮定すると、nginxにリバースプロキシ【192.168.1.11:1002】を1001ポートに追加する必要があり、この場合は【192.168.1.11:1002】saasライブラリ
> * 似た例【 https://os.itdos.com 】はメインライブラリで、【web.microi.net】はsaasライブラリの一つです
