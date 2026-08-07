# 🌐 SaaS 引擎

> **承载所有租户的核心独立开发配置，一套程序驱动 N 个租户**

---

## 📌 介绍

- SaaS 引擎作为平台的亮点之一，承载所有租户的核心独立开发配置
- 平台默认是 SaaS 模式，部署时必须指定 `OsClient`、`OsClientType`、`OsClientNetwork`
- 每个租户一个独立数据库，可在主库 `sys_osclients` 表中配置独立的数据库连接、MongoDB、Redis、MQ、阿里云、MinIO 等
>* 一套程序驱动N个租户数据库，而不必每个租户再部署一套docker程序
>* 本地二次开发`一键切换租户数据库`、`环境`
>* `主库`即部署平台时`环境变量`或`appsettings.json`中配置的`数据库连接字符串[OsClientDbConn]`
>* 所有的 **SaaS 路由与部署控制面配置** 以主库 `sys_osclients` 为准，租户库不维护第二份 `sys_osclients` 数据；当前租户自己的业务设置则保存在其租户库的 `sys_config` / `mci_system_setting`，不要与控制面混为一谈

## `OsClient`
>* OsClient 值即为 `SaaS引擎Key`，用于确定租户，值可自定义，建议使用全小写字母，例如 `tenant_a`、`tenant_demo`、`demo01`。

## `OsClientType`
>* OsClientType值为`SaaS引擎环境类型`，值自定义，如`正式环境`、`测试环境`、`外帐环境`等
>* 如填写`Product`，代表`正式环境`，那么此条数据的`数据库连接字符串`、`MongoDB`、`Redis`均应填写`正式环境`的配置
>* 如填写`Dev`，代表`测试环境`，那么此条数据的`数据库连接字符串`、`MongoDB`、`Redis`均应填写`测试环境`的配置

## `OsClientNetwork`
>* OsClientNetwork值为`SaaS引擎网络类型`，值自定义，如`内网`、`外网`等
>* 如填写`Internal`，代表`内网环境`，那么此条数据的`数据库连接字符串`、`MongoDB`、`Redis`中的IP均应填写`内网环境`的IP
>* 如填写`Internet`，代表`公网环境`，那么此条数据的`数据库连接字符串`、`MongoDB`、`Redis`中的IP均应填写`公网环境`的IP

## 程序必须指定以上3个参数
>* 本地二次开发修改`OsClient` `OsClientType` `OsClientNetwork`三个值轻松切换`不同租户`的`不同环境`
>* 在主库`sys_osclients`表中，`OsClient` + `OsClientType` + `OsClientNetwork`三个字段同时唯一，如同时存在以下3条数据是支持的：
>* 当`OsClient`="microi"，`OsClientType`="Product"，`OsClientNetwork`="Internal，`DbConn`="Data Source=192.168.1.11;Database=microi"时，代表使用了`内网IP`+`正式环境数据库`
>* 当`OsClient`="microi"，`OsClientType`="Dev"，`OsClientNetwork`="Internal"，`DbConn=`"Data Source=192.168.1.11;Database=microi_dev"时，代表使用了`内网IP`+`测试环境数据库`
>* 当`OsClient`="microi"，`OsClientType`="Dev"，`OsClientNetwork`="Internet"，`DbConn`="Data Source=59.110.139.95;Database=microi_dev"时，代表使用了`公网IP`+`测试环境数据库`

## 安全、脱敏与平台级配置

`sys_osclients` 包含数据库、认证、Redis、对象存储、MQ/MQTT、搜索等基础设施机密，不能通过普通 FormEngine、前端 V8 或接口返回整行数据。

- `V8.OsClientModel` / `V8.ClientModel` 是当前租户的独立脱敏副本，不包含数据库连接、`AuthSecret`、Redis、对象存储、MQ/MQTT、搜索凭据。
- `V8.SysConfig` 同样是脱敏副本，不包含 `ClientSecrets`、`PwdV8`、`GlobalServerV8Code` 和疑似 Password/Secret/Token/Key/Connection 字段。
- 存量项目可能在 `sys_osclients` 扩展微信、支付、ERP 等业务密钥；新增配置应迁移到当前租户库的 `mci_system_setting`，由受控后端使用，禁止把整个配置对象或具体密钥返回前端。
- 普通帐号即使拥有 Token 或错误配置了菜单/高级表权限，也不能通过通用 FormEngine 访问 SaaS 配置、接口引擎、菜单角色、任务、数据源等管理员专用平台表。相关控制面管理接口会用当前租户主库复核活动用户及有效管理员角色，要求 `Level >= 9999`；请求体自报管理员身份无效。
- 主租户由运行环境中的 `OsClient` 或 `AppSettings:OsClient` 决定，不应在业务代码中写死为 `master`、`iTdos` 或其它固定值。

数据库、Redis、主租户标识等启动基础设施仍由安装编排中的少量基础参数提供；普通业务和运行参数统一由 SaaS 引擎主租户或系统设置管理，未填写时使用代码安全默认值。子租户只能在平台允许的字段上配置自身额度，不能抬高节点级硬边界。文件上传业务值按当前租户 `sys_osclients` → 代码默认值解析，最终仍受 API 固定接收硬顶和反向代理边界保护。配置保存后应走 SaaS 引擎的共享缓存刷新流程并回读验证，不依赖逐节点重启。

### 主库控制面与租户业务设置的分工

子租户运行时不是“所有配置都从主租户数据库读取”。平台先用主库 `sys_osclients` 找到目标租户的数据库、Redis、MongoDB、MinIO、MQ 等部署路由；建立租户上下文以后，`sys_config` 与 `mci_system_setting` 都从目标租户自己的数据库读取。

| 配置类型 | 事实源 | 子租户能否自行维护 |
|---|---|---|
| 数据库连接、Redis、MongoDB、MinIO、MQ/MQTT、搜索、签名与部署信任链 | 主库 `sys_osclients` | 否，只能由平台控制面维护 |
| 系统标题、主题、公开地址等传统系统配置 | 子租户库 `sys_config` | 按系统设置权限维护 |
| OAuth ClientId/ClientSecret、租户业务开关、第三方业务参数 | 子租户库 `mci_system_setting` | 是，仅租户超级管理员维护 |

`mci_system_setting` 的公开性是每条记录动态配置的：普通设置可选择进入 `V8.SysConfig.PublicSettings`；Secret 只保存租户绑定的认证密文。平台不是固定指定“哪些字段可以公开”，而是固定一组永远不能公开的敏感 Key 规则——Password、Secret、Token、Credential、PrivateKey、AccessKey、ApiKey、ConnectionString、DbConn、Redis、MinIO、ClientSecret 等名称即使勾选公开也会被后端拒绝。这样既允许租户和低代码开发者随时增加公开/私有业务设置，又不会让一个错误开关泄露基础设施或第三方密钥。

Secret 的列表接口只返回“已配置”状态；显示原文需要租户超级管理员先完成 Passkey、Authenticator 或严格人脸二次验证，原文响应禁止缓存并在前端 30 秒后清除，审计只记录 Key/记录 Id/结果，不记录明文。登录方式的完整配置见 [登录方式、Passkey、Authenticator、第三方登录与严格人脸验证](../more/identity-verification)。

### 微信小程序内容安全配置

在 SaaS 引擎当前租户的【微信】Tab 配置以下字段：

| 字段 | 用途 |
|---|---|
| `WeChatMiniProgramAppId` | 小程序 AppId |
| `WeChatMiniProgramAppSecret` | 小程序 AppSecret |
| `WeChatMiniProgramMessageToken` | 微信消息推送 Token（令牌） |
| `WeChatMiniProgramAESKey` | 微信消息推送 EncodingAESKey（消息加密密钥，43 位） |

Token 与 AESKey 必须和微信公众平台填写的值完全一致。推荐在微信后台使用不含 QueryString 的地址：

```text
https://你的API域名/api/WeChatContentSecurity/Callback--OsClient--你的OsClient--
```

服务端也支持 `/api/WeChatContentSecurity/Callback?OsClient=你的OsClient`，但不使用历史缩写 `?o=`。C# 只读取上述敏感配置完成协议验签/解密，解密后的脱敏事件交给应用商城“微信小程序内容安全”中的官方核心接口；租户业务写入和附加日志维护在 `mci-wechat-content-callback-extension`，保存即生效。

### CORS 兼容规则

主租户 `sys_osclients.CorsAllowOrigins` 为空时，平台默认允许任意来源跨域，兼容本地开发、独立前端、H5 和存量租户；只有配置来源后才按精确来源或 `https://*.example.com` 这类通配符收紧。SaaS 引擎主租户字段 `CorsAllowAnyWhenUnconfigured` 可调整未配置时的兼容开关，默认值为允许。

CORS 不是鉴权边界。即使默认允许跨域，服务端仍会校验 Token、`OsClient`、菜单/表权限、数据范围和保护表基线。平台会暴露 `authorization`、`osclient`、`did` 等续签所需响应 Header。

### 租户文件上传配置

Upgrade16 会在 `sys_osclients` 增加以下可空字段：

| 字段 | 说明 |
|---|---|
| `FileUploadEnabled` | 是否允许当前租户交互式上传；空值按启用 |
| `FileUploadMaxFileMB` | 单文件上限 MB |
| `FileUploadMaxRequestMB` | 单次全部文件上限 MB |
| `FileUploadMaxCount` | 单次文件数 |
| `FileUploadDailyUserQuotaMB` | 单帐号 UTC 日额度 MB |
| `FileUploadDailyTenantQuotaMB` | 单租户 UTC 日额度 MB |

这些字段未填写时使用平台代码默认值，可以按租户提高或降低；平台固定灾难保护、API HTTP/Multipart 接收硬顶以及反向代理上限不接受租户覆盖。帐号与租户日额度由共享 Redis 原子统计，Redis 不可用时上传失败关闭。完整说明见 [分布式存储与文件安全](../more/hdfs)。

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
::: details 展开查看 Shell 命令（88 行）
```shell
proxy_cache_path /www/wwwroot/static.example.com/proxy_cache_dir levels=1:2 keys_zone=static_example_com_cache:20m inactive=1d max_size=5g;
server {
    listen 80;
    listen 443 quic;
    listen 443 ssl;
    http2 on;
    server_name static.example.com;
    index index.php index.html index.htm default.php default.htm default.html;
    root /www/wwwroot/static.example.com;
    #CERT-APPLY-CHECK--START
    # 用于SSL证书申请时的文件验证相关配置 -- 请勿删除
    include /www/server/panel/vhost/nginx/well-known/static.example.com.conf;
    #CERT-APPLY-CHECK--END
    #SSL-START SSL相关配置，请勿删除或修改下一行带注释的404规则
    #error_page 404/404.html;
    ssl_certificate    /www/server/panel/vhost/cert/static.example.com/fullchain.pem;
    ssl_certificate_key    /www/server/panel/vhost/cert/static.example.com/privkey.pem;
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
    access_log  /www/wwwlogs/static.example.com.log;
    error_log  /www/wwwlogs/static.example.com.error.log;
    #LOG END
}
```
:::


![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/1efac36d0af04dd58b79723e2c850070.png#pic_center)

## Redis配置
>* 支持哨兵模式

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/d67c8649dc444e508238410c36b746ee.png#pic_center)

### SaaS 运行缓存刷新与扩展库加载

`sys_osclients` 配置只应在平台启动、管理员保存 SaaS 配置或显式调用租户刷新能力时同步到进程内存与共享 Redis。普通表单查询、V8 执行、字段设计器保存不代表 SaaS 配置发生变化，不应持续输出“更新 OsClient / 缓存 OsClient 配置到 Redis”。

- `microi_database` 的扩展库列表使用三态处理：尚未加载、已加载且为空、已加载且有数据。空列表是有效结果，不会在每次 V8 执行时重复查询或发布租户配置。
- 创建数据库会话、初始化 `V8.Dbs` 等运行态动作只更新当前节点的可丢失本地对象，不向 Redis 发布配置变更；真正的配置更新才发布共享缓存通知。
- 多节点收到共享缓存失效通知后只清理本节点缓存并按需回源，不能把收到的通知再次发布。配置更新仍须在数据库事务完成后发布，并按 `OsClient` 精确失效。
- 表单设计器批量保存字段会在外层完成一次平台管理员授权，在同一事务内更新字段元数据，结束后只清理一次字段/授权缓存。字段数量较多但没有物理列改名或改类型时，不应出现按字段数重复的 SaaS 刷新日志。

若终端连续出现成百上千条上述日志，先检查是否把“已加载但无扩展库”误判为未加载，或是否在循环内逐条调用完整 FormEngine 更新管线；不要通过关闭 Redis Pub/Sub 掩盖问题。

### Redis 管理器

平台内置 Redis 管理页面：`#/mci-redis-manager`。页面采用连接/数据库树、Key 空间树、SCAN 列表和内容编辑器三栏布局，可查看服务器与内存统计，并维护 String、Hash、List、Set、Sorted Set；Stream 支持分页只读。Hash、集合等内容统一使用吾码代码编辑器展示和格式化 JSON。

- Redis 管理属于平台控制面，只允许 `Level >= 9999` 的平台超级管理员。未登录或普通角色即使知道路由也不能读取统计、扫描 Key 或执行写操作。
- 支持当前租户连接和后端已经保存的连接。额外连接保存于主租户 `mci_redis_connection`，按 `TenantOsClient` 隔离；密码由后端保护且不会返回前端。
- `temporary` 临时连接以及匿名输入任意 Host、用户名、密码直接管理 Redis 的旧模式已经禁止。登录系统不可用时应通过服务器受控运维通道排障，不能重新开放匿名 Redis 管理。
- Key 查询使用非阻塞 `SCAN` 游标分页，支持按模式搜索、类型/TTL/内存查看、单个与批量删除、重命名、TTL 设置和 JSON 内容覆盖；不支持任意命令、Lua、`FLUSHALL` 或 `FLUSHDB`。
- 修改集合内容时，后端会先完整校验 JSON，再替换原 Key；删除和覆盖操作会显示确认提示。生产环境仍应优先按 `Microi:{OsClient}:...` 前缀缩小检索范围。

Microi MCP 同步提供 `microi_redis_statistics`、`microi_redis_list_keys`、`microi_redis_get_key`、`microi_redis_delete_keys`、`microi_redis_replace_value`、`microi_redis_rename_key`、`microi_redis_set_ttl`。MCP 默认操作当前 `OsClient` 的租户 Redis；额外连接只传管理页保存后的 `connectionId`，不得把 Redis 密码写入 MCP 参数或日志。所有写操作都要求 `confirmExecution` 明确确认。

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
>* 2、在访问【/apiengine/test1】接口时，没有token就是匿名访问，则通过增加Url参数来区别，如：/apiengine/test1?OsClient=tenant_demo
>* 3、某些特殊情况可能无法使用Url参数，如微信支付回调，则可以通过特殊格式来实现传入OsClient值以区分saas租户数据库，如：/apiengine/test1--OsClient--tenant_demo--

::: warning Token 不能跨租户继承身份
当 URL 指定的目标 `OsClient` 与 Token 所属租户不一致时，平台不会把原登录身份带到目标租户。目标接口只有明确开启匿名调用时才能按匿名边界执行；不能通过修改 QueryString 或特殊 URL 格式，把租户 A 的管理员身份带入租户 B。
:::

```js
//示例代码
var appid = V8.OsClientModel.MiniProgramAppId;//小程序 appid
var privateKey = V8.OsClientModel.WxPayPrivateKey;//私书私有key
var notify_url = V8.SysConfig.ApiBase + `/apiengine/wxpay-notify--OsClient--${V8.OsClient}--`;//用户支付成功后回调地址，由接口引擎实现
var jsapiUrl = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';//腾讯官方下单地址，固定url
var jsapiUrlSimple = '/v3/pay/transactions/jsapi';//腾讯官方下单地址，固定url
var currentUser = V8.CurrentUser;
```

示例中的租户业务密钥只允许在后端 V8 中使用，禁止返回前端、写入日志或把整个 `V8.OsClientModel` 作为接口结果。

## 添加SaaS租户、SaaS数据库开库

开库属于高权限、跨数据库操作，建议通过平台受控租户开通流程或接口引擎编排的原子能力完成，并保留操作人、目标 `OsClient`、数据库、执行结果和回读记录。不要在普通业务接口中直接拼接建库 SQL。

### 1、规划租户身份与数据库

- 提前确定唯一的 `OsClient`、`OsClientType`、`OsClientNetwork`，不要复用已有租户 Key。
- 使用官方支持的 empty/demo 模板或受控开库能力创建数据库。目标数据库使用独立最小权限帐号，只授权当前租户库。
- 数据库连接、用户名、密码、`AuthSecret`、Redis、对象存储、MQ/MQTT、搜索等凭据不要写入文档、日志、截图或前端。
- 初始化后暂停模板中的业务 Job，并按新租户实际需要逐个启用；不要让复制来的任务立即影响生产业务。

### 2、在主库 SaaS 引擎创建独立记录

::: danger 不要复制整条主租户配置
主租户记录包含身份、数据库、认证、Redis、对象存储、MQ/MQTT、搜索等机密。直接使用“复制”并只修改 `OsClient`，容易让新租户继承主租户数据库或管理员凭据，造成跨租户访问。
:::

- 优先使用【新增】或受控租户开通流程，显式填写新租户的身份、数据库和域名。
- 即使界面复制仅作为草稿，也必须在保存前清空并重新生成租户身份、数据库、认证、Redis、对象存储、MQ/MQTT、搜索等敏感字段；共享基础设施的管理密钥不能持久化到子租户记录。
- RabbitMQ 使用独立 user/vhost/ACL，MQTT 使用独立帐号，Search 使用只允许 `{osClient}_*` 的 API Key。外部资源尚未创建时保持不可用并失败关闭，不能回退主租户管理员凭据。
- 保存后刷新 SaaS 引擎共享缓存，分别回读 `OsClient`、域名、数据库类型、启用状态和脱敏后的运行配置。不要以“保存成功”或“重启容器”代替回读。
- 通过新租户 `admin` 登录，验证 Token 只属于新租户、基础菜单可见、FormEngine 不会访问主租户数据、文件/缓存/队列/Topic/索引均使用新租户命名空间。

### 3、做反向代理
>* 假设主库的访问地址是【192.168.1.11:1001】，此时需要nginx新增一个反向代理【192.168.1.11:1002】到1001端口，此时则可以直接访问【192.168.1.11:1002】saas库
>* 类似的例子【https://os.itdos.com】就是主库，而【web.microi.net】就是其中saas库之一

完整平台授权、CORS、SSRF、登录 RSA、Token 和升级兼容规则见 [平台安全与兼容基线](../more/security)。
