# Microi 平台 HTTP 路由索引

本索引用于识别中文官网示例中的平台路由。路由可用不等于当前用户有权限；始终
传当前租户 `OsClient`，使用受支持的 Token/访问密钥，并让服务端重新做菜单、
表单、字段和数据范围校验。

## 接口引擎

| 路由 | 用途 |
|---|---|
| `POST /apiengine/{ApiEngineKey}` | 推荐的稳定接口引擎入口 |
| `POST /api/ApiEngine/Run` | 兼容入口，Body 传 `ApiEngineKey` |
| `/apiengine/{ApiEngineKey}--OsClient--{OsClient}--` | 仅用于确实无法设置 Header/Form/Query 的 GET/HEAD 场景 |

普通请求优先在唯一 `osclient` Header 传租户，也可在 Query/Form/JSON 中冗余；
不要无脑把特殊租户后缀加到每条 URL。官网中的
`/apiengine/test1`、`/apiengine/get-product-list`、打印、支付和 Excel demo
都是业务 `ApiEngineKey` 示例，不是固定平台接口。

## FormEngine

标准 Controller 路由：

| 路由 | 用途 |
|---|---|
| `POST /api/formengine/GetTableData` | 查询列表 |
| `POST /api/formengine/GetFormData` | 查询单条 |
| `POST /api/formengine/AddFormData` | 新增 |
| `POST /api/formengine/UptFormData` | 更新 |
| `POST /api/formengine/DelFormData` | 删除 |
| `POST /api/formengine/UptFormDataByWhere` | 按条件更新 |
| `POST /api/formengine/DelFormDataByWhere` | 按条件删除 |
| `POST /api/formengine/GetTableDataAnonymous` | 表配置允许时匿名查列表 |
| `POST /api/formengine/GetFormDataAnonymous` | 表配置允许时匿名查单条 |
| `POST /api/formengine/AddFormDataAnonymous` | 表配置允许时匿名新增 |

动态路由还支持
`/api/formengine/{operation}-{FormEngineKey}`（兼容无连字符操作名与连字符操作名）。
访问密钥只需获得相应表/页面和 `form:read` 等作用域，不应把每个动态 URL 加入
无条件白名单。完整调用模型见 `v8-formengine-http`。

## 文件、消息、验证码与诊断

| 路由 | 用途与边界 |
|---|---|
| `GET /api/Captcha/getCaptcha` | 获取验证码图片；同时保存响应 `captchaid` |
| `POST /api/Captcha/Recognize` | 受控验证码识别，主要供采集引擎 |
| `POST /api/HDFS/Upload` | 受限文件上传；优先用平台 SDK/V8 Upload |
| `POST /api/HDFS/GetPrivateFileUrl` | 获取当前租户短期私有文件地址 |
| `GET /api/HDFS/OpenPrivateFile` | 受权打开私有文件/Office 代理 |
| `POST /api/DiyChat/SendSystemMessage` | 发送站内消息；前端优先 `V8.SendSystemMessage` |
| `POST /api/mq/sendmsg` | MQ HTTP 兼容入口；业务端优先受控 V8/MQ |
| `GET /api/Diagnostics/health` | 聚合健康状态 |
| `GET /api/Diagnostics/liveness` | 进程存活检查，不代表已就绪接流量 |

`/api/example`、`/api/example/1` 仅用于说明 `V8.Http` 的普通 Controller 地址，
不属于 Microi 固定接口。

## 管理与内部交付接口

下列路由不是普通业务 SDK：

| 路由 | 限制 |
|---|---|
| `POST /api/DiyField/UptDiyFieldList` | 开发设计字段批量保存；需设计权限 |
| `POST /api/FormEngine/ImportDiyTableRow` | 表格/子表导入；后端复核字段、外键和权限 |
| `POST /api/SysUser/GetSysUserPassword` | 仅存量 DES 密码的超级管理员兼容查看；必须审计，访问密钥/普通角色拒绝 |
| `POST /api/V8Engine/UploadApplicationAssetStream` | 管理员应用文件分片流式上传 |
| `POST /api/V8Engine/FinalizeApplicationStreamPublish` | 校验清单并原子切换应用版本 |

应用流式发布必须使用 MCP/平台发布流程：文件逐个校验 SHA-256，版本目录不可变，
同一应用用跨节点锁串行，入口文件最后切换。不得把这两个内部路由包装成匿名上传。

## 安全检查

- URL 不携带长期 Token、密码、连接串、私钥或 Redis 凭据。
- 动态表名、ApiEngineKey、文件路径和 redirect 都先走白名单/授权。
- 匿名路由只对明确开启的表或接口生效，仍要限流、限大小并做业务校验。
- 管理接口必须核验当前租户与管理员身份，写后回读；超时先回读，不能盲目重试。
- 示例 URL 中的租户、表 Key、接口 Key 和 Id 都是占位值，不复制为生产常量。
