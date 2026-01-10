# SaaS引擎
## 介绍
>* SaaS引擎作为平台的亮点之一，承载了所有租户的核心独立开发配置
>* 平台默认就是SaaS模式，因此部署平台必须自定义指定一个OsClient值：如microi、iTdos、anderson
>* 每个租户一个独立数据库，并且在主库中为每个租户配置独立的Redis、MQ、搜索引擎、阿里云、MinIO等
>* 一套程序驱动N个租户数据库，而不必每个租户再部署一套docker程序

## OsClient
>* OsClient值即为SaaS引擎Key，值自定义，建议全小写字母，如microi、iTdos、anderson
>* 在sys_osclients表中，OsClient + OsClientType + OsClientNetwork三个字段同时唯一，如同时存在以下3条数据是支持的：
>* OsClient="microi"，OsClientType="Product"，OsClientNetwork="Internal，DbConn="Data Source=192.168.1.11;Database=microi"，使用了内网IP+正式环境数据库
>* OsClient="microi"，OsClientType="Dev"，OsClientNetwork="Internal"，DbConn="Data Source=192.168.1.11;Database=microi_dev"，使用了内网IP+测试环境数据库
>* OsClient="microi"，OsClientType="Dev"，OsClientNetwork="Internet"，DbConn="Data Source=59.110.139.95;Database=microi_dev"，使用了公网IP+测试环境数据库

## OsClientType
>* OsClientType值为SaaS引擎环境类型，值自定义，如正式环境、测试环境、外帐环境等

## OsClientNetwork
>* OsClientNetwork值为SaaS引擎网络类型，值自定义，如内网、外网等

## 程序必须指定以上3个参数
>* 以确定读取该OsClient租户对应的环境+网络类型各项其它配置


## 基础配置
>* 支持数据库读写分离，支持指定存储介质

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/de7982df51cc41afa7e0dbc2c5389c89.png#pic_center)

## 阿里云配置
>* 如果未使用MinIO，即可使用阿里云的OSS+CDN

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/0e4da43b35394de7867cfa5425697476.png#pic_center)

## MinIO配置
>* 如果未使用阿里云OSS，则可以使用MinIO
>* 值得注意的是，MinIO在做反向代理的时候，必须要设置【proxy_set_header Host $http_host】，而阿里云OSS、CDN、负载均衡默认配置情况下均不会有问题。
>* 比如说博主的反向代理配置文件
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

## Redis配置
>* 支持哨兵模式

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/d67c8649dc444e508238410c36b746ee.png#pic_center)

## MQ消息队列配置
>* 支持集群模式

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/c171c8510a2b452980c3f020048b9d53.png#pic_center)

## 搜索引擎配置
>* 目前仅支持ES搜索引擎，支持分词搜索，将来可能扩展其它搜索引擎

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/637ce005054d43c2b6177f3b00693fc3.png#pic_center)

## 接口引擎区分saas租户
>* 用户访问一个接口引擎的自定义接口地址，如：(https://api.itdos.com/apiengine/test1)[https://api.itdos.com/apiengine/test1]，默认是走主库的接口引擎
>* 假设租户A和租户B均有一个【/apiengine/test1】接口，则有多种方式来区分访问：
>* 1、在访问【/apiengine/test1】接口时，传入对应用户的token，平台会根据token识别到OsClient值以访问对应的saas租户数据库
>* 2、在访问【/apiengine/test1】接口时，没有token就是匿名访问，则通过增加Url参数来区别，如：/apiengine/test1?OsClient=veken
>* 3、某些特殊情况可能无法使用Url参数，如微信支付回调，则可以通过特殊格式来实现传入OsClient值以区分saas租户数据库，如：/apiengine/test1--OsClient--veken--
```js
//示例代码
var appid = V8.OsClientModel.MiniProgramAppId;//小程序 appid
var privateKey = V8.OsClientModel.WxPayPrivateKey;//私书私有key
var notify_url = V8.SysConfig.ApiBase + `/apiengine/wxpay-notify--OsClient--${V8.OsClient}--`;//用户支付成功后回调地址，由接口引擎实现
var jsapiUrl = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';//腾讯官方下单地址，固定url
var jsapiUrlSimple = '/v3/pay/transactions/jsapi';//腾讯官方下单地址，固定url
var currentUser = V8.CurrentUser;
```

## 添加SaaS租户、SaaS数据库开库
>* 开启saas模式前，必须要确认主库PC前端程序的环境变量OsClient值为空，也就是对应的主库访问地址如[【https://os.itdos.com】](https://os.itdos.com/)的源码打开后【var OsClient = '';】是一个空值。若不满足，需要手动重新docker run安装PC前端程序，并保证环境变量OsClient的值为空字符串。

### 1、准备SaaS数据库
>* 建议使用[gitee上面的demo或empty数据库](https://gitee.com/ITdos/microi.net/tree/master/%E6%95%B0%E6%8D%AE%E5%BA%93%E3%80%81%E6%A1%88%E4%BE%8B%E3%80%81%E6%96%87%E6%A1%A3%E3%80%81%E8%B5%84%E6%96%99)，假设新的数据库连接字符串为：Data Source=59.110.139.96;Database=microi_demo;User Id=microi_demo;Password=password123456;Port=1306;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;Min Pool Size=5;Connection Lifetime=300;Connection Timeout=30;Pooling=true;sslmode=None;
>* 提前想好该SaaS数据库的Key值，也就是OsClient值，如：saas1
>* 若源服务器数据库是MySql8，而目标服务器数据库是MySql5.7，会导致无法直接还原，可以在目标服务器创建空数据库，然后使用Navicat的数据传输功能实现还原数据库
>* 还原成功后，建议执行以下sql：
```sql
-- 1、修改【sys_config】表中的【SysTitle】字段为新系统名称
update sys_config set SysTitle='新系统名称';
-- 2、修改【sys_osclients】表中的【OsClient】字段为新系统key，修改【RedisHost、RedisPort、RedisPwd】字段为空
update sys_osclients set OsClient='新系统key',RedisHost='',RedisPort='',RedisPwd='';
-- 3、为了防止部分定时任务影响原有业务，建议执行sql停止所有定时任务
update diy_schedule_job set Status='暂停';
update microi_job_triggers set TRIGGER_STATE='PAUSED';
```

### 2、在主库[SaaS引擎](https://web.microi.net/#/osclients)中添加数据
>* 为了能快速添加并引用主库的一些配置，建议直接使用SaaS引擎中的【复制】功能，比如说我们复制【iTdos、Product、Internal】这条数据，然后填写新的【saas1、Product、Internal】并添加
>* 修改上面添加的那条数据中【数据库连接字符串】的值为上面准备的SaaS数据库的连接字符串，并且修改域名为您想访问的域名或IP:端口，比如说【web.microi.net】就是一个saas库，或者您也可以填写如【192.168.1.11:1002】
>* 此时必须要重启一下后端api镜像的docker容器（之后的版本会修复此问题而不用再重启）

### 3、做反向代理
>* 假设主库的访问地址是【192.168.1.11:1001】，此时需要nginx新增一个反向代理【192.168.1.11:1002】到1001端口，此时则可以直接访问【192.168.1.11:1002】saas库
>* 类似的例子【https://os.itdos.com】就是主库，而【web.microi.net】就是其中saas库之一
