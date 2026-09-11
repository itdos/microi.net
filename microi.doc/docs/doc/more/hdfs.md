# 📂 分布式存储

> 平台分布式存储支持 **阿里云 OSS/CDN**、**MinIO**、**亚马逊 S3**，基于 SaaS 引擎配置，不同租户可使用不同存储方案。

---

## 📖 介绍

| 特性 | 说明 |
|---|---|
| 支持存储 | 阿里云 OSS/CDN、MinIO、亚马逊 S3 |
| 配置驱动 | 基于 SaaS 引擎，不同租户可独立配置 |
| 可扩展 | 由表单引擎驱动，可自由扩展腾讯云、华为云等 |
| 源码位置 | [GitHub · Microi.HDFS](https://github.com/itdos/microi.net/tree/master/Microi.Server/Microi.HDFS) / [Gitee · Microi.HDFS](https://gitee.com/ITdos/microi.net/tree/master/Microi.Server/Microi.HDFS) |

---

## 🔐 上传与私有文件安全

::: warning 登录不等于文件授权
Token 只用于确认用户和租户。普通帐号不能因为持有 Token 就任意选择公有桶、列目录、读取私有桶裸路径或调用文件管理接口；标准表单字段是否写入公有桶，由服务端回读该字段的“禁止匿名访问”配置后决定。
:::

### 表单字段如何决定公有桶或私有桶

表单设计器中 `ImgUpload`（图片上传）、`FileUpload`（文件上传）和 `RichText`（富文本）的 **禁止匿名访问** 是字段级存储策略，不是超级管理员专属权限：

| 字段权威配置 | 服务端实际策略 | 典型用途 |
|---|---|---|
| 未勾选“禁止匿名访问”（`Limit=false`） | 公有桶，可通过稳定公共地址访问 | 商品图片、官网内容、公开附件 |
| 勾选“禁止匿名访问”（`Limit=true`） | 私有桶，读取时重新校验业务权限并签发短效地址 | 合同、内部资料、个人文件 |

普通用户只要拥有当前菜单和表对应的新增或编辑动作权限，也可以按字段配置上传到公有桶。2026 年 7 月曾有一版安全加固把所有非超级管理员的交互式上传统一改成私有桶，这会覆盖字段设计器的合法配置，属于过度收紧；现已改为“客户端提供上下文、后端权威回查”。

PC 表单的图片、文件和富文本上传会提交 `FormEngineKey + FieldId + SysMenuId`；编辑已有记录时还会提交 `FormDataId`，TableChild 会附带父子授权上下文。服务端随后：

1. 按新增或编辑动作校验当前用户、角色、菜单、表和动作权限；
2. 从当前租户重新读取 `diy_field.Component` 与 `diy_field.Config`；
3. 只允许 `ImgUpload → img`、`FileUpload → file`、`RichText → editor` 三种对应目录；
4. 用字段中的 `Limit` 覆盖请求值，再返回实际 `Limit` 和可用预览地址。

因此篡改浏览器请求里的 `Limit=false`、`Path`、`FieldId` 或菜单 Id 都不能绕过授权。没有完整、可验证字段上下文的普通 HTTP/旧自定义上传，默认限制到私有安全目录；需要兼容旧客户端的固定业务目录时，由管理员配置下文的目录授权，不要求逐个修改旧客户端。老 `ImgUpload` / `FileUpload` 字段没有保存 `Limit` 时兼容为未勾选，即公有桶；老 `RichText` 字段没有上传配置时默认私有，避免升级后意外公开正文附件。

微信小程序内容安全流程是额外的强制收紧：待审图片即使属于公有字段，也必须先进入私有隔离区，审核通过后才允许写入业务字段；是否最终转为公共发布资产，仍需经过受控发布流程。图片裁剪或压缩保留的 `_origin` 原图也始终写入私有桶。

### 旧移动端、定制页面的目录与角色授权

后端 **v8.2.8+** 支持普通系统设置 `sys_config.HdfsUploadRules`。更新官方“系统设置”应用后，在 **系统设置 → 开发配置 → 接口、文件与运行环境 → 文件上传权限** 中维护规则。这是普通配置，不是后端私有设置或密钥；规则是否能被读取不构成授权，只有管理员维护的规则和后端读取的有效角色才构成授权事实。

| 规则列 | 填写方式 |
|---|---|
| 允许目录 `Path` | 相对业务目录或通配符，如 `files/{inspection,quality}/**`；不要填域名、桶名或租户前缀。区分大小写，兼容首尾 `/`；通配符需后端 v8.2.9+ |
| 授权角色Id数组 `RoleIds` | 如 `["角色Id1","角色Id2"]`；使用角色管理中的真实 Id，不是角色名称 |
| 所有登录用户 `AllAuthenticated` | 仅该目录确需所有有效登录用户上传时打开；打开后可不填角色 |
| 包含子目录 `IncludeSubdirectories` | 默认关闭；打开后也允许已匹配目录下的全部子目录。不改变目录层级边界；规则已用尾部 `/**` 时无需再打开 |
| 允许公有文件 `AllowPublic` | 默认关闭。只有打开且请求明确为 `Limit=false` 才写公有桶；请求私有时始终保持私有 |

例如，只允许指定角色向一个既有目录及其子目录上传公开图片：

```json
[
  {
    "Path": "files/inspection",
    "RoleIds": ["替换为真实角色Id"],
    "AllAuthenticated": false,
    "IncludeSubdirectories": true,
    "AllowPublic": true
  }
]
```

排查“普通用户只能上传到平台预定义的文件目录”时，先在浏览器网络面板查看失败请求实际提交的 `Path`、`Limit`，然后为该目录添加最小授权，保存后重试。系统设置保存沿用共享缓存失效机制，下一次上传重新读取规则，无需重启；已经完成的上传不会被追溯删除。规则为空、未命中或被删除时，恢复原有 `file / img / avatar / editor` 私有安全目录策略。最多 128 条规则，错误规则在新版表单引擎保存时会被拒绝。

规则只适用于**没有表单字段上下文**的已登录交互式上传，不改变标准字段上传的表/菜单/行授权；半套字段上下文仍拒绝。它不授予文件读取、删除、列目录、应用发布或跨租户权限；实际上传路径不能是根目录、包含通配符、穿越路径、`micro-app`、`ai-app*`、`app-store`、数据库备份和 `_origin` 等保留路径。即使管理员配置 `**`，这些保护仍优先执行。访问密钥会话不能借此获取目录权限。租户停用上传、内容检测、大小、数量及每日配额限制仍然生效，头像、待审图片及原图不会因此转为公有。

应用包只增加可空字段与界面，不附带业务授权数据，更新应用不会覆盖租户已经配置的规则。不要为了快速修复而提高普通用户等级，也不要删除后端目录校验。

#### 目录通配符（后端 v8.2.9+）

可组合以下格式，一行即可覆盖一组业务目录。规则只匹配请求的 `Path` 目录，不匹配上传文件名，也不匹配服务端后来追加的年月目录。

| 格式 | 示例 | 匹配含义 |
|---|---|---|
| `*` | `files/inspect*` | 当前层内零个或多个字符，例如 `files/inspection`；不跨 `/` |
| `**` | `files/**` | 零个或多个目录层级，包括 `files` 本身及任意深度子目录 |
| 中间 `**` | `files/**/photos` | 匹配 `files/photos`、`files/a/b/photos`；`**` 必须独占一层 |
| `?` | `workshop/line?` | 当前层内一个字符，例如 `line1`，不匹配 `line12` |
| `[abc]` / `[a-z]` | `files/202[0-9]` | 字符集合或范围，例如 `files/2026` |
| `[!abc]` / `[^abc]` | `files/[!0-9]*` | 首字符不在该集合内，例如 `files/photos`，不匹配 `files/9photos` |
| `{A,B}` | `files/{inspection,quality}/**` | 任一候选分支及其子目录；可嵌套、可与其它格式组合 |

`*` 单独使用只匹配一级业务目录；`**` 单独使用会匹配全部非保留业务目录，范围较大，应优先选择明确的业务前缀并绑定最小角色。多个命中的有效角色规则按授权并集处理：任一匹配规则允许公有且请求 `Limit=false` 时可公开；请求 `Limit=true`、头像、待审图片仍保持私有。

单条规则最多 512 个字符，花括号最多嵌套 4 层、展开 32 个候选、4096 个字符令牌。非法括号、倒序范围、空分支、`ab**`、`***` 会在保存时被拒绝。匹配使用有界动态规划，不执行正则表达式、SQL `%`/`_` 通配或脚本；不支持反斜杠转义。服务端仅对解析后的语法做有界缓存，不缓存权限判定，角色与系统设置仍从当前租户的共享权限/配置缓存读取。

升级顺序：先更新全部后端节点到 v8.2.9+，再启用通配规则；v8.2.8 只支持精确目录和“包含子目录”，与新节点混用时可能拒绝新语法。旧移动端请求格式无需变化。

### 图片默认压缩与私有原图

`ImgUpload`、PC、UniApp/H5/小程序和普通 MCP 图片上传在未传 `Preview` 时默认开启压缩。平台展示图默认控制在约 `500 KB` 以内，最长边不超过 `1920 px`；字段设计器的新图片字段同样默认开启。只有明确传入 `Preview=false` 才关闭压缩，旧移动端漏传参数不会关闭。

压缩前，后端会先把原始字节保存到当前租户 HDFS 私有桶的同名 `_origin` 对象，再使用跨平台图片库生成展示图并写入目标公有或私有位置。因此对外页面加载的是几百 KB 的展示图，原始高清图仍只在私有桶保留。上传结果的 `Size` 表示展示图实际体积，`OriginalSize` 用于管理员审计。

### 表单引擎裁剪原图协议

`ImgUpload.Crop.Enabled=true` 时，PC 前端在同一个 `multipart/form-data` 请求中传入两份同名数据：普通 `file` 是裁剪结果，`MicroiOriginalFile` 是裁剪前未改动原图，并传入 `CropEnabled=true`。该特殊字段是平台内部协议，业务 V8 不应手工伪造。

`Crop.Enabled` 只决定“上传前裁剪”的默认状态。表单用户关闭运行时开关或在裁剪工作台点击“不裁剪直接上传”时，不传 `CropEnabled/MicroiOriginalFile`，继续走普通图片上传协议；若 `Preview` 开启或缺失，普通压缩链路仍会先把原始字节保存在私有 `_origin` 对象中。

后端会核对两者一一同名，并将裁剪图与原图的字节数一起计入单次大小和每日配额。写入顺序固定为“原图写入私有 `_origin` 对象 → 可选压缩裁剪图 → 写入业务展示图”。原图写入失败时必须失败关闭，不得先发布裁剪图。返回的 `Cropped=true` 和 `OriginalStored=true` 只表示服务端执行结果，不暴露原图对象路径。

### 富文本附件的长期引用

`RichText.Limit=false` 用于官网公告、商品详情等公开正文：图片、视频和附件写入公有桶，正文保存可长期访问的公有 URL。`Limit=true` 用于内部内容：正文只保存 `/__microi_richtext_private__/...` 稳定对象标识，不保存对象存储签名 URL、审计代理 Ticket 或 DiyToken。

查看或编辑已有记录时，富文本组件从真实 `img/video/source.src` 和 `a.href` 收集稳定标识，携带 `FormEngineKey + FormDataId + FieldId + SysMenuId` 调用 `/apiengine/platform-private-file-url`。后端重新校验用户、租户、菜单、表、行、字段以及正文中的精确引用，再返回本次页面使用的短效审计代理 URL；关闭后重新打开会换取新地址，因此短效地址过期不会污染数据库内容。历史正文直接保存 FileServer URL 时，后端只对真实媒体属性中的精确同路径引用提供兼容，不把普通文字、`data-href/data-src` 或脚本标签当作授权依据。

::: warning 私有富文本不能直接匿名发布
外部网站没有当前后台记录的菜单与行权限上下文，不能解析私有标识。需要匿名展示的文章应在表单设计器中取消 RichText 的“禁止匿名访问”；有新增或编辑权限的普通用户随后也会按该字段的权威配置上传到公有桶。仅修改请求参数不能改变存储策略。
:::

::: warning 压缩失败不会发布原图
图片解码、压缩或编码失败时接口直接返回错误；平台不会再静默把几十 MB 的未压缩原图上传到公开桶。历史大图迁移也必须先补齐私有原图、上传新展示图、更新并回读全部业务引用，确认无引用后才能删除旧公有对象。
:::

### 微信小程序图片与资料内容安全

微信小程序中的头像及其它用户图片统一通过 `V8.uploadFile` 上传；多图组件使用 `V8.uploadFiles`，最多并发上传 3 张，并通过受管接口引擎 `mci-wechat-content-status-batch` 合并查询本人最多 20 条审核状态。小程序运行时 SDK 为每次上传获取独立的一次性 `wx.login` code，后端把图片保存在私有隔离区，并调用微信 `mediaCheckAsync`；只有异步回调明确返回 `pass` 后，SDK 才把对应文件值写入表单。单张失败不影响其它已通过图片，轮询采用有限次数、总超时和退避间隔，不允许无限请求。`review`、`risky`、回调超时、配置缺失或 Redis 故障均失败关闭。用户侧只提示“你发布的内容含违规信息，请修改后重试”，不得显示命中标签、策略或概率。

个人资料保存还会在服务端再次核对审核记录、图片路径和提交人，并用 `msgSecCheck` 检查姓名、实名和个人简介。因此不能通过跳过前端轮询或直接请求 `UptSysUser` 绕过检测。

SaaS 引擎“微信小程序”Tab 提供以下租户配置；它们属于敏感配置，不得写入 `appsettings.json`、环境变量、UniApp 源码、接口引擎或日志。相关字段应随官方应用商城资源交付，不再为此新增 `Microi.Upgrade` 定制迁移：

| SaaS 引擎字段 | 说明 |
|---|---|
| `WeChatMiniProgramAppId` | 当前小程序 AppId |
| `WeChatMiniProgramAppSecret` | 当前小程序 AppSecret，仅后端读取 |
| `WeChatMiniProgramMessageToken` | 微信消息推送签名 Token |
| `WeChatMiniProgramAESKey` | 可选；兼容／安全模式回调解密密钥（EncodingAESKey，43 位） |

在微信公众平台配置小程序消息推送 URL：

```text
https://<API公网域名>/api/WeChatContentSecurity/Callback--OsClient--<OsClient>--
```

如果第三方设置页确认支持查询参数，也可以使用 `/api/WeChatContentSecurity/Callback?OsClient=<OsClient>`；禁止使用 `?o=`。Token 必须与 `WeChatMiniProgramMessageToken` 完全一致；可先使用明文模式，启用兼容或安全模式时同时填写 EncodingAESKey。API 域名必须是微信可访问的 HTTPS 地址，负载均衡后的所有节点连接同一 Redis。接入依据见微信官方 [`mediaCheckAsync`](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/sec-check/security.mediaCheckAsync.html) 与 [`msgSecCheck`](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/sec-check/security.msgSecCheck.html) 文档。

### 租户动态限制、灾难保护上限与每日配额

普通 HTTP、FormEngine、V8 和移动端上传入口共用服务端限制。上传限制分为三层：租户业务配置、平台独立灾难保护上限、HTTP 请求解析上限。表单字段的“禁止匿名访问”只决定公有桶或私有桶，不能放大文件大小、数量、每日配额或 HTTP 上限。受能力鉴权的 AI 应用资产协议 v3 使用下文独立的断点续传链路。

业务值只按 `sys_osclients` 当前租户 → 代码默认值解析，管理员无需维护额外环境变量或修改 `appsettings.json`：

| SaaS 引擎字段 | 代码默认值 |
|---|---:|
| `DisableFileUpload` | `false`（关闭，即允许上传） |
| `FileUploadMaxFileMB` | 500 MB |
| `FileUploadMaxRequestMB` | 500 MB |
| `FileUploadMaxCount` | 10 |
| `FileUploadDailyUserQuotaMB` | 2048 MB |
| `FileUploadDailyTenantQuotaMB` | 20480 MB |

业务值最终再与平台代码中的固定灾难保护上限取较小值：单文件 2048 MB、单次总量 2048 MB、单次 100 个文件、帐号和租户日额度各 10 TB。这些硬上限不是安装配置项，普通租户不能放大。管理员可以把单文件与单次总量配置为 1024 MB 或 2048 MB；空值使用 500 MB 默认值。

Kestrel HTTP 正文和 Multipart 接收硬顶统一为 2048 MB，普通表单单值硬顶为 128 MB；它们是所有租户共享的安全边界，不要求安装者再配置环境变量。租户业务配置仍负责其自身的最终额度，反向代理还必须允许请求进入 API。

#### nginx 413 与大文件上传

`413 Content Too Large` 如果响应正文是 nginx 的 HTML，表示请求尚未进入吾码 API，SaaS 引擎缓存、HDFS Controller 和全局异常处理都没有机会执行。实际可上传大小是“nginx → Kestrel HTTP → Multipart → 租户单文件/单次额度 → Absolute 灾难保护”各层上限的最小值。禁止只提高 `sys_osclients.FileUploadMaxFileMB`，也禁止用 `client_max_body_size 0` 关闭网关保护。

例如需要让普通 multipart 上传覆盖平台 2 GB 硬顶，应在 **API 域名的 nginx `server` 块**中配置：

```nginx
# 支持平台2GB硬顶，并为multipart封装留出余量；禁止配置为0取消保护
client_max_body_size 2112m;

# 慢速大文件上传的请求体读取空闲超时
client_body_timeout 600s;

# 避免 nginx 先把整个大文件重复缓冲到本机磁盘；HDFS/API 仍执行自身校验。
proxy_request_buffering off;

# 分块请求关闭缓冲时使用HTTP/1.1，并给上游读写保留足够时间
proxy_http_version 1.1;
proxy_connect_timeout 60s;
proxy_send_timeout 600s;
proxy_read_timeout 600s;

# nginx 自己拒绝的请求无法进入 ASP.NET Core，需在代理层保持吾码 DosResult 合约。
error_page 413 = @microi_upload_too_large;
location @microi_upload_too_large {
    default_type application/json;
    charset utf-8;
    add_header Cache-Control "no-store" always;
    # 跨域部署时，此处必须显式复用正常API代理的CORS白名单/include；不能依赖后端补响应头。
    return 200 '{"Code":0,"Data":null,"Msg":"上传请求在进入吾码 HDFS 前已超过反向代理请求体上限。SaaS 引擎上传额度不能放大 nginx/Kestrel/Multipart 上限；请运维同步提高各层上限后重试。","DataAppend":{"ErrorType":"UploadRequestTooLarge","Layer":"ReverseProxy"}}';
}
```

这些 `proxy_*` 指令可放在 API 域名的 `server` 层供代理 `location` 继承，也可合并进现有的 `location ^~ /`；不要新建第二个重复 location。`proxy_request_buffering off` 只关闭 nginx 预缓冲，不能用响应方向的 `proxy_buffering off` 代替，也不会绕过 API/HDFS 校验。

修改 nginx 后先执行 `nginx -t`，成功后再 reload。吾码普通上传 API 已内置 2048 MB HTTP/Multipart 接收硬顶；无需增加上传相关环境变量。普通单请求仍不能突破平台固定的单文件 2048 MB、单次总量 2048 MB 灾难保护上限。AI 应用资产协议 v3 与 SaaS 租户数据库 ZIP 协议每次只发送一个有界原始分片，不继承整文件单请求上限。若前面还有 CDN、WAF、负载均衡或 Ingress，还要同步检查这些上游的请求体和空闲超时限制。

##### 创建租户数据库 ZIP

创建 SaaS 租户时，数据库 ZIP 不再走整包 `/api/HDFS/UniappUpload`：

- 平台先创建与租户、用户、文件大小和摘要绑定的上传会话，再以默认 16 MB（服务端允许 1–32 MB）原始分片上传；每片与整包都做 SHA-256 强回读。
- 刷新页面、网络断开或浏览器重开后，重新选择同一文件会读取服务器状态并只补传缺失分片。单片接口接收上限为 64 MB，所以常见 100 MB 代理上限不会阻断 500 MB、1 GB 或 2 GB 的逻辑文件。
- 完成合并后，租户开通服务从私有 HDFS 临时文件流式解压并执行 SQL，避免 ZIP 与解压后的脚本同时驻留内存；连续 `INSERT` / `REPLACE` 按最多 500 条或 1 MB 使用有界事务批次执行。
- 通知中心不会按数据行写日志，而是限频更新读取量、批次、语句数、吞吐和预计剩余时间，并仅在阶段变化或每 5% 进度追加一条有界执行记录。

请求进入吾码 API 后，如果 Kestrel 或 Multipart 再触发超限，全局异常处理会返回 HTTP 200、`Code=0`、`DataAppend.ErrorType=UploadRequestTooLarge`，并在响应头给出 `X-Microi-Upload-Max-Request-MB` 与 `X-Microi-Upload-Max-Multipart-MB`，方便定位实际生效的 API 启动配置。

Upgrade16/Upgrade35 会在 `sys_osclients` 为每个租户补齐下列现行可空字段：

| SaaS 引擎字段 | 作用 | 空值行为 |
|---|---|---|
| `DisableFileUpload` | 是否关闭当前租户交互式上传 | 空值/无效值/`0` 均为不关闭，即允许上传 |
| `FileUploadMaxFileMB` | 单文件大小 | 使用代码默认值 |
| `FileUploadMaxRequestMB` | 单次全部文件大小 | 使用代码默认值 |
| `FileUploadMaxCount` | 单次文件数量 | 使用代码默认值 |
| `FileUploadDailyUserQuotaMB` | 单帐号每日额度 | 使用平台默认额度 |
| `FileUploadDailyTenantQuotaMB` | 单租户每日额度 | 使用平台默认额度 |

租户配置可以高于代码业务默认值，但普通上传不能突破平台固定灾难保护、HTTP/Multipart/Form 解析上限以及反向代理限制。`DisableFileUpload=1` 会停止该租户普通上传和应用资产断点续传，而不是关闭安全检查；协议 v3 只移除产品级字节上限，不绕过身份、能力、版本、哈希和审计。修改 SaaS 引擎配置后应通过平台现有的租户重载流程刷新共享 Redis 配置，使所有 API 节点生效。

#### “当前租户已停用文件上传”如何处理

新版以 `DisableFileUpload` 为事实源：缺列以外的空值、无法解析或 `0/false` 都表示允许上传，只有 `1/true` 才禁止。仅当运行节点尚未升级、物理表没有新字段时，才回退读取旧 `FileUploadEnabled`。因此看到“当前租户已关闭文件上传”时，先检查实际生效记录的负向开关，不要先把问题归因于 MinIO/HDFS。

1. 在 SaaS 引擎查询目标 `OsClient`，同时核对当前后端进程的 `OsClientType`、`OsClientNetwork`。同一租户存在内网、外网或开发/生产多条记录时，只修改当前服务器实际命中的启用记录，不能凭租户名称批量覆盖其它环境。
2. 将该记录的 `DisableFileUpload` 关闭为 `0` 并保存。返回结果中的 `DataAppend.ConfigField=DisableFileUpload`、`DataAppend.ExpectedValue=0`、`DataAppend.OsClient` 可用于确认目标。
3. 等待 SaaS 配置重载和共享 Redis 发布订阅完成；多 API 节点应全部收到同一版本，不能只清某个节点的进程内缓存。
4. 分别用一个很小的公有图片和一个私有文件做真实上传、读取测试。若错误变成 endpoint、bucket、签名或 `Invalid URI`，再按 MinIO/HDFS 配置排查；不要继续修改开关，也不要删除每日配额 Redis Key。

平台超级管理员也可按下文 MCP 流程精确更新，但写入前后都要回读同一组 `OsClient + OsClientType + OsClientNetwork` 数据。禁止为了消除提示而把所有租户、所有网络环境无差别改为允许。

帐号与租户额度使用共享 Redis 原子预留，适用于多 API 节点；Redis 不可用时上传失败关闭，不会降级成无限上传。额度按 UTC 日期统计，为避免并发重试绕过限制，上传后续失败也不退回已预留额度。反向代理、Ingress/IIS 还应设置不高于平台配置的请求体限制。

每日配额用于阻断短时间滥用，不等于租户全生命周期容量上限。生产对象存储还必须按租户或桶配置独立的总容量/账单告警与生命周期规则，并定期以对象存储实际用量对账；否则用户即使每天都低于应用配额，长期累计仍可能消耗大量空间。应用层 Redis 计数不能代替存储提供方的硬容量边界。

#### 通过 MCP 调整租户上传配额

平台超级管理员可以通过标准 MCP 工具修改 `sys_osclients` 中的六项租户业务配置，无需编写临时 SQL 或清空 Redis。容量字段单位均为 MB，例如 20 GB 应写为 `20480`。

1. 先调用 `microi_get_table_data` 查询 `sys_osclients`，按目标 `OsClient` 和 `IsEnable=1` 筛选，并回读 `Id`、`OsClientType`、`OsClientNetwork` 以及六个 `FileUpload*` 字段。
2. 同一租户可能同时存在 `Internal`、`Internet` 等多条启用记录。对每条记录调用 `microi_update_form_data`，传入 `tableName: "sys_osclients"`、包含 `Id` 的字段补丁以及 `confirmExecution: "sys_osclients"`，避免负载均衡节点读取到不同配置。
3. 再次调用 `microi_get_table_data` 逐条回读。FormEngine 保存 `sys_osclients` 后会触发 SaaS 运行配置重载；等待重载完成后，用一次真实小文件上传验证错误提示中的有效额度或上传结果。

示例字段补丁：

```json
{
  "Id": "<sys_osclients.Id>",
  "FileUploadDailyUserQuotaMB": 20480,
  "FileUploadDailyTenantQuotaMB": 20480
}
```

提高配额不会清零当日已经预留的字节数，而是立即按“新上限减去今日已用量”计算剩余额度。每日计数按 UTC 日期切换（北京时间每日 08:00 进入新的 UTC 统计日）；失败上传为防重试绕过也不会退回预留额度。除非用户明确授权事故处置，AI 不得删除共享 Redis 配额 Key。平台固定灾难保护、Kestrel/Multipart/Form 和反向代理限制不能通过租户侧 `sys_osclients` 或普通 MCP 表单更新突破。

#### AI 应用编译产物流式发布

Web、UniApp 和 MicroService 的真实编译目录应使用 MCP 工具 `microi_publish_application_directory_stream` 发布。该链路不会把文件转为 Base64，也不会让文件体进入接口引擎/Jint：

1. MCP 在本机按文件流计算 SHA-256，先拒绝符号链接、`.git`、`node_modules`、密钥/环境文件和超过 20000 个文件的异常目录；协议 v3 不设置 Microi 产品级文件/目录字节上限。
2. 不超过 128 MiB 的文件兼容旧版单请求；更大文件自动创建确定性断点会话，默认以 16 MiB `application/octet-stream` 分片发送。每片校验精确 `Content-Length`、SHA-256，并从 HDFS 写后回读。
3. 所有文件写完后，MCP 只提交路径、大小和摘要清单到 `/api/V8Engine/FinalizeApplicationStreamPublish`。API 回读版本对象与完整性标记，再使用阿里云 OSS、MinIO 或 S3 的服务端 `CopyObject` 切换稳定地址。
4. 非入口资源先切换，`index.html` 最后切换；同一应用使用跨节点分布式锁串行发布，避免两个版本并发产生混合资源。

```text
历史版本：{tenant}/ai-app-publish/{appKey}/versions/v1.2.3/index.html
稳定地址：{tenant}/ai-app-publish/{appKey}/index.html
latest别名：{tenant}/ai-app-publish/{appKey}/latest/index.html
```

微服务历史目录保持 `{tenant}/micro-app/{appKey}/v1.2.3/`，稳定入口同样不带版本号。数据库只保存路径、大小、SHA-256、版本和路由等元数据。失败后可以用相同版本和摘要安全重试；完整清单确认前不会切换稳定入口。

几十 MB 不是 Jint 的固定内存上限，HDFS 本身也没有这种限制。旧发布流程的问题是先把二进制扩成约 `4/3` 大小的 Base64，再经 JSON、Jint 字符串和多层复制产生累计分配。普通小型 V8 上传可继续使用 `V8.Method.Upload`；真实编译目录和大型资产必须使用协议 v3。5 GiB 文件默认是 320 片，网络或进程重启后查询远端状态并只补缺片。每个会话在 `mci_ai_app_file` 以 `StorageScope=ApplicationAssetMultipartSession` 保留，管理员可从“系统引擎 → 超大文件上传记录”查看字节进度、分片数、心跳、错误与恢复建议。最终能力由协议技术边界、对象存储、磁盘、网关和网络共同决定，而不是普通表单的整文件上限。

调用示例：

```json
{
  "appIdOrKey": "microi-developer-toolbox",
  "versionNo": "v1.1.0",
  "directory": "D:/build/microi-developer-toolbox/dist",
  "entryPath": "index.html",
  "confirmExecution": "microi-developer-toolbox"
}
```

标准表单字段上传按本页前述权威字段配置选择公有桶或私有桶，普通用户无需成为超级管理员；后端会把目录固定为控件对应的 `file`、`img` 或 `editor`。没有可验证字段上下文、也未命中系统设置目录授权的普通交互式上传，仍强制写入私有桶，并且只能使用 `file`、`img`、`avatar`、`editor` 四个安全一级目录。管理员可通过前述 `HdfsUploadRules` 显式授权其它业务目录及公有上传；绝对路径和 `..` 等非法路径始终拒绝。公有上传不等于信任客户端参数，而是服务端确认字段权限或当前用户的目录授权后作出的决定。

接口引擎、后端表单 V8 和平台内部任务调用 `V8.Method.Upload` 属于可信服务端普通上传，可以由业务代码选择安全路径和公私有桶，但仍受全局文件数量、单文件和单次总量硬限制。只有应用资产协议 v3 具有独立断点与无产品字节上限语义；浏览器、移动端和普通 HTTP 客户端不能通过伪造 `_TrustedServerInvocation`、`Limit` 或 `Path` 获得这种信任。

### 私有文件必须绑定业务记录

普通用户调用 `/apiengine/platform-private-file-url` 时，除文件相对路径外必须提交：

| 参数 | 说明 |
|---|---|
| `FormEngineKey` | 文件所属表名或表 Id |
| `FormDataId` | 文件所属业务记录 Id |
| `FieldId` | 保存该文件引用的 `FileUpload` / `ImgUpload` 字段 Id |
| `SysMenuId` | 当前用户实际进入的菜单 Id |

服务端依次校验：Token 与 `OsClient` 一致、用户拥有该菜单、菜单绑定目标表、菜单数据范围允许读取该记录、字段属于该表且是文件字段、字段值确实引用所请求路径。任一步失败都不会退回裸路径签名 URL；普通用户也不能直接获取私有文件的 `Byte` / `Stream`。私有文件链接仍为短期后端票据，不能持久化临时 URL。

接口引擎和后端表单 V8 可以在可信服务端上下文中调用 `V8.Method.GetPrivateFileUrl({ FilePathName })`。这不表示浏览器也能只传路径签名；普通客户端始终必须携带上表中的完整业务上下文。

文件列表、移动、重命名、删除、覆盖上传等管理接口仅允许 `Level >= 9999` 的平台超级管理员。业务用户删除附件应通过受保护的表单/业务接口完成，由服务端核对记录权限和字段引用后处理对象存储，不能直接开放文件管理 API。

富文本编辑器的远程图片抓取 `catchimage` 默认关闭，避免把平台变成任意 URL 下载器或内网探测代理。业务若需要采集远程资源，应使用单独的受控接口，并实现域名白名单、DNS/IP 校验、禁止跳转、超时、响应体上限和文件头校验。

#### 升级兼容说明

- 历史公有文件不会因升级自动迁移；先复制到租户私有桶、回读核验，再停止旧公有访问。数据库继续保存租户内相对路径，不保存对象存储密钥或真实签名 URL。
- 旧页面只传 `FilePathName` 获取私有地址，升级后普通帐号会失败。应补齐 `FormEngineKey`、`FormDataId`、`FieldId`、`SysMenuId`，不要把接口改回匿名或给普通角色开放文件管理权限。
- 旧版标准表单无需修改字段值；升级 PC 前端和 API 后，上传组件会自动补齐字段上下文，后端继续以原字段“禁止匿名访问”配置为准。若只升级 API 而仍使用旧前端，缺少字段上下文且没有管理员目录授权的普通上传会安全降级到私有桶。
- 旧自定义上传若只传 `Limit=false` 和多级 `Path`，可在普通系统设置中按角色配置 `HdfsUploadRules`，无需逐个修改客户端；新代码仍优先补齐可验证的表单字段上下文。无论哪种方式，都不能只把客户端参数当作公开授权。
- 上线前至少用“普通用户 + 超级管理员 × 公有字段 + 私有字段 × 新增 + 编辑”验证实际对象桶、返回 `Limit` 和读取方式，并覆盖越权、配额耗尽、Redis 故障和多节点并发；不能仅以“上传成功”作为安全验收。
- Upgrade16 的六个字段全部可空，空值继续使用平台默认/硬上限，因此老租户升级不会被强制停用上传。升级完成后应回读字段元数据和租户配置，并刷新 SaaS 运行缓存。

完整平台保护表、登录会话、CORS、SSRF 和升级基线见 [平台安全与兼容基线](./security)。

---

## ⚙️ 步骤一：指定存储方式

在 **【系统设置】→【开发配置】** 中指定存储方式。系统设置由表单引擎驱动，可在表单设计中自由扩展更多自定义存储方式。

![存储方式配置](https://static.itdos.com/upload/img/csdn/5f7e4c8a6b824c51b1c50de50827abdd.png#pic_center)

---

## ☁️ 阿里云 OSS + CDN

在 **【SaaS 引擎】→【Aliyun】** 处配置相关参数：

![阿里云OSS配置](https://static.itdos.com/upload/img/csdn/dd353af2971c4057b3d47c1f3ad9d81c.png#pic_center)

---

## 📦 MinIO

在 **【SaaS 引擎】→【MinIO】** 处配置相关参数：

> 💡 安装 MinIO 方法见：[Docker 部署文档](https://microi.blog.csdn.net/article/details/143576299)

![MinIO配置](https://static.itdos.com/upload/img/csdn/0bde20907de743f5b051036546837afa.png#pic_center)

---

## 🌍 亚马逊 S3

> 📌 首先请熟悉亚马逊 S3：[亚马逊 S3 入门](https://blog.csdn.net/qq973702/article/details/143648974)

平台使用 MinIO SDK 驱动亚马逊 S3，后续将补充详细配置说明。
