---
name: ai-engine
description: Microi AI 引擎、MiniMax 图片/音乐/视频生成与预览、模型代理、NL2SQL/NL2V8 和知识库规范。用于媒体生成、模型路由、密钥与订阅配额、Schema/Skill 检索、流式响应、租户隔离和验收。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi AI Engine

平台媒体生成的受控 HTTP 入口包括 `/api/Ai/GenerateMiniMaxImage`、`/api/Ai/GenerateMiniMaxMusic`、`/api/Ai/CreateMiniMaxVideo`、`/api/Ai/GetMiniMaxVideoTask`、`/api/Ai/GetMiniMaxVideoFile`、`/api/Ai/PersistMiniMaxVideoFile`；AI 工作流统一调用 Managed 接口引擎 `/apiengine/platform-ai-workflow`，通过 `Action` 选择概览、节点详情、生成、列表、读取、保存或删除。调用方只提交业务参数和模型选择，供应商密钥、租户配额、任务归属和文件读取权限由服务端判定。生成结果必须先进入当前租户 HDFS 或受控临时句柄，浏览器不接触供应商密钥、图片 Base64、音频十六进制或原始视频任务 Id。`PersistMiniMaxVideoFile` 只能转存当前登录用户所属且已完成的任务，禁止作为任意 URL 搬运器。

## 能力

### 媒体模型目录与中转（2026-09）

- 媒体选择以当前租户 `mic_ai.Id` 和实际媒体 `Model` 为准，图片、音乐、视频及配音请求携带 `AiModelId`。显式记录不可用时不得静默切换其它账号、主租户密钥或聊天模型。
- `MediaProtocol` 与 `MediaModels` 由 AI助手应用包交付。目录项为 `{ Id, Name, Capability, Protocol }`，能力支持 `image/music/video/speech`；协议与模型名称分离，未知协议明确不可选。新增供应商协议仍须真实后端适配器和契约测试，不能只改模型名称。
- `/api/Ai/GetMediaModels` 返回当前登录租户的可选目录，官方中转 `/v1/microi/media_models` 只返回安全投影，不含 Key、Endpoint 或供应商记录 Id。中转接收端按本机 `IsRelayModel=1` 的供应商目录选实际模型，不接受外部租户记录 Id。
- 图片生成继续使用持久任务；等待中转结果与执行供应商请求的 Worker 必须分开调度并预留执行容量，避免同节点循环等待。中断后查询原 TaskId，不能把 HTTP 524、Uncertain 或 Token Plan 使用状态猜测为关键词违规或扣费。
- 必须区分 MiniMax 开放平台 `image-01` 的 `subject_reference` 人物参考协议、MiniMax Code 的 `connector__matrix__generate_image` / `input_urls` 图像编辑工具，以及 OpenAI Images edits 协议。某个接口编辑失败，不能推断整个 MiniMax Code 不支持编辑；聊天界面选择 M3 也不证明实际图像工具的底层模型就是 M3。验收须看输出原图。
- MiniMax Code 图像编辑使用独立 `mic_ai` 行：`MediaProtocol=minimax-connector-image`，逻辑模型 `minimax-code-image`，Endpoint 为官方 `https://agent.minimaxi.com` 或 `https://agent.minimax.io`。工具未开放底层 model 字段，不能伪造。只接受服务器发现的固定图像/上传/文件 URL 工具，不增加任意工具执行入口。
- Connector 使用独立 OAuth 授权，不能复用 Token Plan API Key，也不能复制桌面 `electron` 登录态的 refresh_token。管理员通过连接账户或导入独立授权绑定引擎；凭据按租户和记录加密，续期使用共享锁与 CAS，目录、日志和响应不含 Token。应用包只扩展协议选项和凭据字段容量，不复制账号。
- 原图先通过当前租户私有 HDFS 校验，再取得供应商临时上传凭证。Multipart 文件分段须先写 Content-Disposition 再写 Content-Type，避免供应商 OSS 返回 MalformedPOSTRequest。生成结果先保存 node_id 回执，再调用 get_asset_url 并转存 HDFS；已有节点时只恢复下载，不重新生成。临时 URL 不作为永久结果，也不携带 OAuth 头访问文件域名。失败状态提供 CanRecoverResult 时，可通过 RecoverMiniMaxImageTask 或中转任务 recover 入口显式恢复原 TaskId；恢复 Worker 必须再次检查节点，节点失效时禁止重新生图。4K 图片下载允许最大 64 MiB，并继续执行租户存储限额。每次工具调用前重新取得当前连接授权；明确 401 才可刷新后重试一次，超时不重发生成。
- 升级要求包括 AI助手 v7.6.9、平台后端 v8.1.11 或更高版本、平台前端和中转节点程序；应用包只升级字段/受管资源，不复制租户密钥或替换运行二进制。媒体存储必须保留真实用户的上传开关、载荷和配额检查，仅可信后端能授权固定的私有参考图与公有生成结果目录，不能放宽普通用户上传策略。
- MiniMax 参考图以已校验原始字节的 data URI 发送，仍须先执行租户私有 HDFS 上传与配额检查；参考图请求关闭 prompt_optimizer。人物主体参考重绘不能等同局部精确编辑，验收必须同时检查任务结果和图片实际内容。
- 图片工具须按操作匹配模型能力：MiniMax 人物参考最多一张，不得用于消除、扩图、线稿还原、多图合成等结构编辑；前端过滤与后端校验必须一致。兼容媒体协议的型号由当前租户 mic_ai 目录验证，参数规范层不得再次把音乐、视频、配音固定为单一历史型号；未实现的供应商协议仍明确标为不可用。

平台 AI 包含聊天/流式聊天、模型代理、模型路由、订阅配额、NL2SQL、NL2V8、数据库 Schema 关键词检索、可选向量融合和 V8 Skill 文档检索。AI 输出是建议，不是授权；执行 SQL、V8 或 MCP 写入前仍走平台权限与确认。

当前入口并不共用一条检索链路：普通 `Chat/ChatStream` 使用服务端会话上下文和固定核心规范 Prompt；`NL2SQL` 使用当前租户 Schema 双模式检索；`NL2V8` 使用 Skill 镜像与当前租户 Schema 双模式检索。默认模式不依赖 Ollama、`nomic-embed-text` 或 Qdrant；只有显式开启向量数据库时才增加向量通道。`Microi.Server/Microi.AI` 不是 MCP Host，没有注册 MCP Tools，也没有处理 `tool_calls` 的代理循环。MCP Server 目前由 Codex、Copilot、Cursor、Claude Code 等外部宿主调用。禁止仅凭 Prompt 中出现“使用 MCP”就声称在线 AI 已经执行工具。

未来若给平台在线 AI 增加工具调用，优先在 `Microi.AI` 内建立受限 Tool Gateway，复用 FormEngine、V8McpLogic 等后端服务的授权入口；不要让后端使用超级管理员 Token 再请求自己的 MCP。每次工具调用必须继承当前用户、`OsClient`、Token/权限快照和审计上下文，模型只能提出调用建议，服务端仍负责参数白名单、写操作确认、幂等、步数/时长/结果大小上限和权威回读。工具返回的数据继续按不可信内容处理，不能反向覆盖系统规则。

## 商业授权与调用入口

内置在线 AI 有两套不能混淆的授权：

- `Chat/ChatStream/NL2SQL/NL2SQLStreaming/NL2V8Engine` 统一读取宿主 `IMicroiFeatureLicense`。未修改的官方发布物只有本机通过官方 RSA 公钥、当前 HID 和有效期验证的 `Personal/Enterprise` License 才能继续推理；客户自建私钥/公钥不能替换内嵌官方信任根。验签在本机完成，`api.itdos.com` 只负责签发和周期性作废查询，不是每次调用的在线依赖。
- `MicroiAI` 与 `AiProxyService` 会拒绝宿主替换的 `IMicroiFeatureLicense` 实现，统一回到 `Microi.net` 的封闭校验器；签发地址固定为 `https://api.itdos.com`，签发私钥目录不得进入构建、NuGet 或发布包。拥有服务器管理员权限的人仍可能篡改本地二进制或机器指令，纯本地 DRM 无法从理论上阻止这种物理控制；但没有官方私钥就不能生成可被未修改吾码节点接受、并可转发给其它正常节点使用的有效 License。
- 官方中转站另用 `sk-microi-*` ApiKey 和账号 Token 额度鉴权。服务器 License 不能代替中转 ApiKey，中转 ApiKey 也不能把本地核心 AI 入口变成已授权。
- `AiProxyService` 的 `ProxyChat/ProxyChatStream`、头像生成与 `/v1/chat/completions` 在领域层读取同一服务器 License，并继续执行登录态或平台 ApiKey/订阅链路。模型清单、套餐、订单和用量属于不触发模型推理的发现/账户接口，可以在未授权时用于配置与购买流程。

跨端调用必须按现有事实描述：

| 调用方 | 当前入口 | 关键边界 |
|---|---|---|
| 前端 V8 | `await V8.AI.Chat(...)` / `V8.AI.ChatGet(...)` | 自动使用当前 ApiBase、登录 Token 与租户；清除客户端身份、Endpoint、ApiKey；普通返回为 `DosResult` |
| 浏览器流式 UI | `await V8.AI.ChatStream(..., onChunk, {Signal})` | 内置解析 `message/result/error/done` SSE、Token 轮换和取消；`onChunk` 接收真实增量 |
| 后端 V8 | `await V8.AI.Chat(...)` / `ChatStream(...)` | 对象创建时绑定当前 `OsClient` 与认证用户；匿名上下文拒绝，不需要自请求 HTTP |
| MCP | `microi_chat` | 使用 MCP 已登录 Token 和绑定租户；只接受对话白名单参数，返回最终 `DosResult`，不冒充逐 token 流 |
| OpenAI 兼容客户端 | `POST /v1/chat/completions` | 使用 `Bearer sk-microi-*`，请求体 `stream` 控制普通/流式 |

`Chat/ChatStream` 虽声明 GET/POST，含问题、附件和会话上下文的业务调用默认使用 POST，避免敏感内容进入 URL 日志。Controller 和 `V8.AI` 必须从可信执行上下文覆盖当前用户和 `OsClient`，并清除客户端提交的 `ApiKey/Endpoint`。所谓打字机效果必须来自真实 SSE 增量块；`microi_chat` 只返回最终结果，不能被描述成逐 token MCP 流。

安全数据分析的新客户端调用 `/apiengine/platform-ai-runtime` 并固定 `Action=NL2SQL`；旧 `/api/Ai/NL2SQL` 只保留兼容转发。最终都由租户/用户绑定的 `V8.AI.NL2SQL` 从当前用户权限生成表白名单；任何通用包装接口都不得接受客户端自报的表名作为授权。

## 代码分层

AI 业务统一实现在 `Microi.Server/Microi.AI`。`Microi.Server/Microi.net.Api` 只是 HTTP、SSE 与 SignalR 传输层，可以做路由、请求绑定、读取认证中间件产生的可信用户/租户、传递取消信号和写响应，但不能承载模型选择、Schema/Skill 检索、NL2SQL 授权与执行、提示词编排、代理路由、供应商密钥、额度计量、订阅支付状态或 AI 工作流。

- Controller、Hub 只调用 `IMicroiAI`、`AiProxyService`、`SubscriptionService`、`AiWorkflowService` 等 `Microi.AI` 门面，不直接查询 `mic_ai` / `mic_sub_order`，不接触上游密钥和向量基础设施。
- “授权 + 执行”必须由领域门面原子完成，不能让接口层先生成可伪造的 `AllowedTables` 或遗漏某一步。
- AI 的 Qdrant/Ollama/Embedding 配置、Schema 初始化和其它生命周期任务由 `AddMicroiAI()` 在模块内自注册；API 的 `Program.cs` 只负责调用模块注册。
- `Microi.Core` 只承载跨模块契约和模型。新增入口时先扩展 AI 领域服务，再添加薄 Controller/Hub 适配，禁止复制业务流程。
- AI 账户统一入口是 Managed 接口引擎 `/apiengine/platform-ai-account`；套餐、订阅和订单由 V8 编排。支付宝回调 C# 只做可信租户选择/归一化、该租户配置验签和一次性 Managed 调用；`CompletePayment` 在同一接口引擎事务内完成订单条件认领、金额校验、订阅续期/新建与平台/供应商 API Key 分配。供应商协议、密钥隔离、分布式额度原子、任务句柄和受控媒体落盘仍由绑定原子完成。
- 非流式 `UpdateConversationTitle / RecognizeIntent / Chat / NL2SQL / NL2V8EngineSync` 与精确图片 `ProcessImage` 统一进入 Managed `/apiengine/platform-ai-runtime`，旧 Controller 同名路由只做兼容转发；SSE/流式、Provider Proxy、生成式媒体、文件和策略元数据保持原生。`platform-ai-runtime` 只调用绑定当前租户和当前用户的 `V8.AI` / `V8.Image` 原子，不接收客户端伪造的租户、用户、Endpoint、ApiKey、表白名单或管理员标记。
- AI 官方应用只有一个应用级租户扩展点 `platform-ai-custom-hook`，策略为 `CreateIfMissing`。`mci_ai_data_assistant` 与 `platform-ai-runtime` 只传 `Stage`、`SourceApiEngineKey`、`Action`；支付动作最多增加 `EventId`、`Provider`，账户其它动作只增加白名单资源元数据。Hook 禁止接收订单号、交易号、金额、标题、SQL、模型、附件、提示词或问题原文及其摘要、回答、供应商/平台密钥、供应商任务号、文件句柄或媒体内容。匿名发现接口不调用 Hook，`/v1/usage` 继续由 C# 凭据网关直接校验，使 `Authorization` 永不进入 V8。
- 9 张 `mic_sub_*` 订阅表与 `mci_ai_token_account`、`mci_ai_token_log` 由官方 `app.microi.ai-engine` 应用升级提供，必须同时声明 DDL、PhysicalColumns、DiyTables、DiyFields；`PromptPreview` 属于日志表正式字段。`mci_ai_token_recharge` 当前不在该运行时实体闭包内，禁止根据线上残留自行扩包。运行时发现缺失时失败关闭，禁止在请求路径自动建表、加列或修改业务 Schema。
- `Sys_User.AiApiKey` 归官方 `app.microi.sys_user`，由系统账号包同时维护建表 DDL、PhysicalColumns 和隐藏只读 DiyField；AI助手包不得重复声明 `Sys_User`。缺列错误必须提示升级系统账号应用，不能误导用户升级 AI助手。

## 模型与密钥

存量模型配置的兼容验收组合包括 `GenerateMiniMaxImage + image-01`、`GenerateMiniMaxMusic + music-2.6`。这些组合只适用于服务端已配置且供应商账号仍有权限的旧路由；新路由仍遵循下列实时能力选择规则。验收必须同时检查实际返回的模型标识、媒体类型与 HDFS 读取，不能仅凭兼容接口名称判断底层模型。

- 模型 Provider、Endpoint、ApiKey、AuthPrefix 和上游模型 Id 只保存在服务端受保护配置。
- 普通用户使用平台签发的受限 API Key/订阅身份，不能枚举或读取上游密钥。
- MiniMax 对话媒体必须区分意图模型与生成工具：`MiniMax-M3` 是对话与工具编排模型；图片入口兼容名仍为 `GenerateMiniMaxImage`，实际模型由 `mic_ai.MediaProtocol / MediaModels` 与当前媒体选择决定，不能固定为 `image-01`。MiniMax Code 的 `generate_image + input_urls` 使用 `minimax-connector-image` 协议和逻辑路由 `minimax-code-image`；供应商未公开底层图像模型名，不得把界面选择的 M3 当成图片生成底模。纯音乐优先使用所配置且可用的 `music-3.0`，兼容 `music-2.6`；托管音乐只有明确返回 410 退役终态时才允许切到官方开源 `MiniMax-Music3`，不得把超时、5xx、额度不足当作回退条件。目标账号能力必须实时校准，不得用文本说明冒充生成产物。
- `GenerateMiniMaxImage` 使用稳定 `RequestId` 持久入队，返回 `Code=2 + Data.TaskId` 后只通过 `GET /api/Ai/GetMiniMaxImageTask?taskId=...` 查询。只有 `Code=1 + Images` 才表示原图已写入 HDFS；浏览器超时、刷新或停止等待不能取消后台生成，也不能换请求号自动重发。图片任务复用 `mci_background_task` 的租户/用户隔离、数据库唯一键、分布式租约和 fencing，原生 Worker Key 为 `__microi_native_ai_image__`，不可由租户 V8 覆盖。请求参数只保存在服务端私有任务列，状态接口不返回提示词或参考图。
- `GenerateMiniMaxImage` 可接收最多 4 张 JPEG/PNG/WebP 参考图；先写当前租户私有 HDFS，由可信适配器上传原图或提供短时签名 URL，浏览器与响应均不得得到供应商上传票据和签名地址。`image-01` 的 `subject_reference` 是人物参考重绘，不能据此声称所有 MiniMax 工具都不支持消除。消除、换背景等操作须选择目录中声明对应编辑能力的协议：MiniMax Code 使用 `input_urls`，OpenAI Images 兼容模型使用 edits；实际效果必须逐张检查，生成式身份保持、发丝边缘与像素不变不能仅凭接口成功判为通过。黑白、纯色背景抠除、缩放、裁剪、旋转、翻转、格式转换和拼图使用 `platform-ai-runtime/ProcessImage + V8.Image` 精确处理。
- MiniMax Code 媒体连接使用管理员独立 OAuth 授权，不读取或复用桌面客户端凭据。令牌在可信后端按租户及引擎记录绑定加密保存，刷新使用共享锁与旧值比较；明确 401 可刷新后重试一次，不确定生成请求不得重发。生成结果节点须先保存到共享存储；下载或 HDFS 失败且存在节点时，通过同一 TaskId 的 `RecoverMiniMaxImageTask` 或 `/v1/microi/image_tasks/{taskId}/recover` 恢复已有图片，不再次生成。目录只公开能力元数据。`MediaModels` 可扩展同协议模型；新的供应商协议仍需适配器、商城字段及真实中转验收，不能只填名称就宣称已接通。
- 吾码节点之间的图片中转使用 `POST /v1/microi/image_tasks` 与 `GET /v1/microi/image_tasks/{taskId}`，服务端平台 API Key 鉴权，提交必须有稳定 `Idempotency-Key`。查询不占用生成额度；接收节点只能使用已启用且公布的供应商媒体模型，禁止自调用中转环路。MiniMax 官方适配器调用同步 `/v1/image_generation`，其它供应商由对应协议适配器处理。消费者、官方中转节点和前端必须更新到同一持久任务协议；应用包更新不能代替平台二进制与前端更新。
- HTTP 524、连接取消或空响应仅说明传输状态不确定，不能断言提示词违规、Token Plan 不可用或已扣费。明确供应商拒绝保留 `UpstreamHttpStatus`、`UpstreamCode` 和错误消息；`Failed/Uncertain` 不能在回读时合并成“仍在生成”。MiniMax 同步接口没有本任务可用的结果查询号时，不得伪造回查成功或盲目重发；相同 RequestId 参数冲突必须拒绝。
- 图片与音乐都使用稳定 `RequestId` 和共享幂等；相同参数回放、参数冲突拒绝，上游结果不确定时禁止换 Id 盲重试。音乐当前仅向平台管理员开放且固定无人声；托管结果为 MP3，开源回退为 32kHz 立体声 WAV、10～60 秒。成功内容由服务端校验后直接写入当前租户公有 HDFS。
- 聊天附件的公有媒体 URL 优先按当前运行租户 `FileServer + FilePath` 解析，禁止写死域名或沿用其它租户的前缀。图片使用 Element Plus `el-image` 的 `preview-src-list` 原页放大，不能套 `target="_blank"`；音乐使用 `<audio controls preload="metadata">` 在线播放。媒体是结构化附件，文本才走安全 Markdown 渲染，禁止拼接任意 HTML 绕过 URL/类型校验。
- MiniMax 自 2026-08-20 起不再向新用户开放付费 Music/Lyrics API，并停止旧免费 Music 模型。既有 `music-3.0` 账号仍可优先直连；官方开源 `MiniMax-Music3` Space 可作为明确 410 后的回退，但公开 ZeroGPU 配额不是生产 SLA。需要专属额度时只在既有服务端 `mic_ai` 模型路由中保存官方 Space Endpoint 与受保护 Hugging Face Token，不新增 API `AppSettings`、环境变量或前端密钥。Provider/中转账号未开通、额度不足或上游停用时必须返回可诊断失败，不生成占位音频、不伪报成功。图片、音乐和视频的真实可用性都需用目标租户登录态调用及媒体 GET/播放回读证明，源码存在或接口 HTTP 200 不能替代生成成功。
- MiniMax 视频生成属于可复用供应商原子能力，应实现在 `Microi.AI`，Controller 只读取可信用户/`OsClient`、绑定参数并传递取消信号。理由是上游密钥隔离、异步 `task_id → file_id → download_url` 协议、订阅额度和跨节点幂等都不是某个可编辑接口引擎应复制的业务逻辑；具体文章、提示词和分发编排仍可留在 Job/接口引擎/发布 Skill。
- MiniMax Token Plan Key 与按量 API Key 是相互独立的凭据，必须复用现有服务器端 Provider/ApiKey 受保护配置，不新增 API `AppSettings`、`MICROI_*` 环境变量或浏览器可见 Key。视频创建、查询和下载仅允许官方 HTTPS Host `api.minimaxi.com`。
- 视频创建必须要求调用方稳定 `RequestId`，先在当前租户共享 Redis 以 `OsClient + 用户 + RequestId` 原子 `NX` 占位；Redis 不可用时失败关闭。相同 RequestId/参数回放返回原任务，不同参数冲突拒绝；上游 POST 超时或结果不确定时禁止自动换 RequestId 重试。查询不再次扣生成额度。
- 原始 MiniMax `task_id`/`file_id` 不下发。服务端返回由供应商 Key 签名、绑定当前用户和用途的短句柄；查询/下载验签后才还原。Key 轮换会使旧句柄失效，应先完成或重新登记在途任务。
- 当前官方模型边界必须实时校准：`MiniMax-Hailuo-2.3` 支持文生/图生，`MiniMax-Hailuo-2.3-Fast` 仅图生且必须有首帧，首尾帧使用 `MiniMax-Hailuo-02`。Hailuo 2.3 的画质优先上限与平台默认值是 6 秒 / 1080P，时长优先上限是 10 秒 / 768P，两者不能同时最大；API 不提供 fps 参数，必须用媒体探针记录真实帧率，禁止把插帧/画布规格冒充模型原生能力。当前 Token Plan 使用统一用量条、5 小时固定窗口和周窗口，控制台是剩余额度事实源，不再把固定“每天 N 条”写成官方配额。需要自动生成时，在 `Microi.AI` 增加只读、脱敏、管理员限定的 `https://www.minimaxi.com/v1/token_plan/remains` 安全原子能力；不得由浏览器或可编辑 V8 读取 Provider Key，也不得把客户端今日计数当成供应商权威额度。
- 当前 Hailuo 2.3 视频适配器返回静音画面；其它视频协议是否含声以实际模型能力和音轨探针为准。需要人物对白时，男/女语音通过 `Microi.AI` 的 `GenerateMiniMaxSpeech` 受保护原子能力生成：由当前租户 mic_ai 选择 speech 模型与受支持音色，`speech-2.8-hd` 是现有默认值；保持稳定 RequestId、共享 Redis 幂等，并直接转存租户 HDFS；再由可靠 Worker 按时间轴混音、加准确字幕。无法证明口型同步时使用画外音或反打镜头。背景音乐使用 `GenerateMiniMaxMusic` 并在人声下压低。运行节点尚未部署 Speech 能力、额度未核实或母版混音/探针证据缺失时失败关闭，禁止静音、仅配乐、浏览器直连供应商或伪称模型原生带声。
- 管理端【AI视频】应按 `TaskHandle` 轮询任务，成功后优先转存 HDFS，并用 `<video controls preload="metadata">` 原页预览和明确下载按钮消费同一个已校验地址。临时 URL、生成完成、HDFS 转存、媒体可播放和外部平台发布是五个不同事实，必须分别验收。
- 使用 Microi.AI 中转站时，租户侧 AI Bootstrap 通过官方 `official_ai_relay_models` 发现可用运行模型。该接口是跨租户只读公共契约，必须保持启用、允许匿名 HTTP 调用，并且只返回模型标识、展示名等公开白名单字段，绝不能返回中转密钥或上游 Endpoint。消费者不得把 `NoAuth` 静默伪装为“没有配置模型”；应返回可诊断错误，同时前端显示明确空态。
- PC、UniApp 和其它客户端通过 `POST /apiengine/{key}` 发送的 JSON Body 必须完整进入 `V8.Param`；兼容入口 `/api/ApiEngine/Run` 的 JSON Body 还必须包含 `ApiEngineKey`。API 层只负责请求绑定和清除客户端伪造的可信字段，模型选择、权限策略与对话逻辑仍全部位于 `Microi.AI` 或受控 AI 接口引擎中。
- 当前计量记录除问题摘要外还可能持久化完整 `Question`、`Answer`，部分诊断日志也会输出问题或摘要。处理现有版本时必须把这些字段视为敏感业务数据，限制查询权限和留存；不要声称已经全面脱敏。
- 发布目标是日志只记录 trace id、模型、耗时、token 计数和状态，Prompt/Answer 按租户策略脱敏，密码、Token、连接串和完整业务数据不落日志。该目标必须用源码和真实数据回读证明。
- OpenAI 代理流式接口会传递 HTTP 请求取消信号；普通 `ChatStream` 与 `NL2V8` 当前主要使用内部超时 Token。不要声称浏览器断开一定立即终止上游调用或计费。

## 跨端 AI 助手与商城交付

- PC 与移动端复用 `mci_ai_data_assistant`。`Bootstrap` 返回的 `Enabled`、`Models`、`AllowedDomains` 和 `Prompts` 是跨端共同事实源；快捷问题来自启用的 `mci_ai_data_domain.PromptExamples`，前端不能维护另一套固定文案。
- 官方 AI助手应用归 `app.microi.ai-engine`。v6.3.6 的接口引擎必须严格只有 Managed `mci_ai_data_assistant`、Managed `platform-ai-account`、Managed `platform-ai-runtime` 和 CreateIfMissing `platform-ai-custom-hook` 四项，并声明 `V8.Method.ManageAiPlatform`、`V8.Method.RequireManagedProtocolContext` 与所需 `V8.AI` 能力；后端缺少任一能力时安装预检失败关闭。
- `ai_app_list`、`ai_app_detail`、`ai_app_get_file`、`ai_app_save_file`、`ai_app_create`、`ai_app_build`、`ai_app_preview`、`ai_app_download_source_zip`、`ai_app_download_build_zip`、`ai_app_moveobject_probe`、`ai_app_moveobject_exec_probe`、`ai_app_publish_store` 这 12 个 `ai_app_*` 归 `app.microi.store` 维护。AI助手包移除它们的资源选择和所有权声明，但不会删除目标租户既有运行时接口记录；既有记录继续由应用商城包升级。
- v6.3.6 还必须保持 AI助手包的 DDL、PhysicalColumns、DiyTables、DiyFields、DataSets 全层不再包含重复的 `mci_ai_app_version`、`mci_ai_app_file`、`sys_microistore`，这些表交回 Store/SaaS 既有平台包维护；当前仅 AI助手包拥有的 `app_mic_aiapp`、`mci_ai_app` 继续保留。
- 普通角色读取业务数据必须匹配启用的 `mci_ai_role_policy`，这不是常规对话的前置条件。只有后端可信的 `V8.CurrentUser.Level >= 9999` 可以在新安装租户缺少角色策略时获得数据分析安全兜底：从目标租户动态读取已启用业务域和模型，范围为 `All`，仍保持 `AllowRawSql=false`、敏感字段默认关闭。不得相信客户端提交的 Level、角色名或账号名。
- 所有已登录账号默认可使用 AI 常规对话，包括未分配任何角色、未申请业务身份、没有数据域、策略禁用或原模型已失效的账号。官方 AI助手 v7.7.1 在 `mic_ai` 的“基础配置”提供 `AllowAllRolesChat`（所有角色可常规对话），默认 `1`；存量缺失/null/空值兼容开启，显式 `0/false/'0'/'false'` 关闭该模型的公共对话使用权，启用值兼容 `1/true/'1'/'true'`。此开关不授予业务数据、SQL、菜单或管理权限，也不绕过登录、供应商额度和模型启用状态。
- 历史“所有角色使用助手都必须逐个建策略”的经验只适用于授予这些角色业务分析权限，不再适用于打开助手或常规对话。需要分析数据的目标角色仍应有显式策略；受限角色使用 `Self`/`Department` 与最小业务域，管理角色才可使用经确认的 `All`。禁止把“人人可打开助手”实现成普通角色默认全库可读。
- `Sys_Config.DisableAiAssistant` 是负向开关：缺失、空值或 `0/false` 都显示 AI 助手，只有显式 `1/true` 才关闭图标。历史包曾复用旧 `IsShowAiAssistant` 的字段元数据 Id 就地改名；因此清理旧开关必须按当前表名和字段名回读定位，不能只按历史 Id 删除，避免误删已复用该 Id 的新开关。官方母版必须通过标准 MCP 删除旧字段元数据，不能仅隐藏；新版包的 DiyFields、PhysicalColumns、DDL 及生成器均不得重新创建旧开关。平台删除字段可保留存量物理列兼容，但新前端只读取 DisableAiAssistant，不得重建正向开关或改写租户现有配置值。关闭该开关前后都要做权限分层验收：回读 `sys_role` 与 `mci_ai_role_policy`，需要业务分析的角色应有明确启用策略，`AllowedDomains`、`AllowedModels` 有效且模型仍处于启用状态；无策略账号仍可常规对话。至少用无角色、超级管理员、普通员工和客户身份分别调用 `Bootstrap`，确认 `Enabled=true`，并独立验证 `CanQueryData` 与数据范围符合角色。仅看到入口图标不算可用。
- 提审要求关闭 AI 入口时，必须把“关闭AI助手图标”设为 `DisableAiAssistant=1`，从数据库、客户端实际配置接口和入口逐层验收，不能用旧正向字段为 `0` 代替。官方包发布与其他租户安装是两个独立动作；未执行目标租户安装或字段清理时，不得宣称全体存量租户已移除旧元数据。
- 角色策略存在但 `AllowedModels` 为空或只引用已删除模型时，业务分析不可用，常规对话仍动态使用当前租户启用且开放的对话模型。要恢复原业务分析能力，应经管理员授权补齐当前租户模型白名单并回读，保留原 `DataScope/AllowedDomains`，不能静默把任何新模型当作已获准接收业务数据。禁止删除角色策略校验或在客户端强制 `Enabled=true`。
- 商城包不能携带发布租户的角色 Id、模型 Id 或密钥；应携带业务域定义和接口引擎，由安装后的目标租户动态发现自己的启用模型。发布后回读 `sys_microistore.AppVersion/AppPakcet`，并真实执行 `Bootstrap` 验证超级管理员可用、模型非空、快捷问题存在。

### 常规对话与业务数据权限分离（强制）

- `Bootstrap.Enabled` 表示登录账号可进入助手，`ChatEnabled` 表示存在可用对话模型，`CanQueryData` 独立表示可分析已授权业务数据。无数据权限时返回空 `AllowedDomains` 和“常规对话”；模型列表为空时返回 `MODEL_UNAVAILABLE`，客户端提示检查模型，不得再显示“当前角色未开通 AI助手”。入口的 `DisableAiAssistant`、模型的 `AllowAllRolesChat` 和业务数据策略是三种不同含义，不能互相替代。
- 多角色权限必须按“数据域 + 当前模型”分别合并。A 域的 `All` 不能提升 B 域的 `Self`，其它模型的白名单不能授权本轮模型读取数据。没有适用授权、范围无法落到固定业务字段、敏感字段未开放时，业务读取失败关闭。
- 普通问候、写作与知识问答不自动查询全部业务域。常规对话路径不查询业务表、不提供 Schema/SQL/工具，也不把历史数据模式消息重新送入无数据权限的模型上下文。客户端伪造 Mode、RoleIds、Level、AllowedDomains 或模型 Id 不能扩大范围。
- 对话模型发现必须按当前模型和媒体目录判断能力，纯图片/音乐/视频/配音型号不能成为默认文本模型；中转目录只暴露安全投影，不返回供应商 ApiKey 或 Endpoint。远端 HTTP 可能返回 Promise，必须等待真实模型结果，不能把 Promise 当字符串或用统计兜底冒充常规对话成功。
- 打开助手和身份变更时重新获取 Bootstrap；请求结果按用户与请求代次隔离，旧角色/旧账号请求不能覆盖新状态。模型缺失、网络失败、会话失效分别处理，并保留重试。
- 欢迎语、输入提示与等待状态也必须区分常规对话和业务分析；无数据权限时不得声称已连接业务数据、正在汇总业务记录。前端定时动画不能冒充服务端实际执行进度。
- 官方 AI助手 v7.7.2 的 `mci_ai_data_assistant.ApiRole` 显式使用平台支持的 `["$authenticated"]`，`AllowAnonymous=0`，让 `OnlyGet` 只读角色也能调用助手和保存自己的对话。不能通过清空角色 `BaseLimit`、给账号添加管理员角色或放开其它业务接口解决聊天入口受阻；必须用真实只读客户账号验证 Bootstrap、Chat、会话记录与原业务限制仍成立。
- 最低验收：无角色、客户、员工、管理、多角色账号分别执行 Bootstrap 和真实 Chat；确认无数据账号 `UsedAi=true/Mode=chat/Domains=[]`，有数据账号按本人/部门范围查询。测试禁用策略、旧模型、显式关闭公共对话模型、纯媒体模型、跨账号历史、伪造权限和模型故障。管理员单账号成功、仅图标截图或本地 mock 成功都不能代替普通账号真实验收。

## Schema 检索双模式

### 启动、租户与存储边界

- SaaS 引擎启动时挂载 `sys_osclients` 中符合节点条件的租户运行配置到 `OsClientExtend.ClientList`；这是配置、数据库访问对象和基础设施运行态，不是 AI Schema 预热。不得根据 `ClientList` 数量声称主租户和全部子租户的表字段均已加载。
- `AiSchemaInitializationHostedService` 只对 `GetConfigOsClient()` 返回的配置主租户执行启动预热，空值时回退默认租户；`InitializeSchemaCache` 还受在线 AI License 门禁。子租户必须在其首次 NL2SQL/NL2V8 Schema 请求中按可信 `OsClient` 惰性加载，禁止启动时无界遍历所有租户、所有表和字段。
- 在线 AI Schema 的事实源是当前租户未删除的 `diy_table`、`diy_field` 及绑定表的 `sys_menu`，不是 `INFORMATION_SCHEMA`，也不是开发者本地 `.microi-db-schema.md`。只存在于物理数据库、未登记低代码元数据的表字段不能宣称已被在线 AI 发现。
- 关键词索引的 Redis L2 Key 为 `Microi:{OsClient}:AiSchemaKeywordIndex:{FormEngineAuthzVersion}`，保存原始 `List<TableSchemaInfo>`，TTL 为 10 分钟；进程内 L1 保存预构建倒排索引，TTL 为 2 分钟。版本来自 `Microi:{OsClient}:FormEngineAuthz:Version`；无法读取 Redis 版本时必须回源租户数据库，不得沿用版本未知的旧索引。
- 标准 FormEngine 元数据/权限变更必须推进版本或显式刷新。绕过 FormEngine 直接执行 SQL 可能不会立即失效，应明确提示缓存到期、重启或手动刷新边界。
- Qdrant 只在 `EnableVectorDatabase=1` 时保存租户隔离的 Schema 向量和元数据 Payload，不能保存业务行数据、充当事实源或绕过表权限。NL2SQL 的业务结果始终在完成授权和只读 SQL 校验后实时查询当前租户数据库。

### 默认关键词模式

`mic_ai.EnableVectorDatabase` 缺失、`null`、空值或 `0` 均表示关闭；只有显式启用才进入向量模式。旧数据库没有该字段时必须保持可用，不能因为读取不到开关而尝试连接历史向量配置。

关闭时必须完整跳过 Embedding/Ollama/Qdrant 的客户端创建、连接、初始化、同步和搜索；初始化、刷新或同步 Schema 的入口只维护关键词索引。不能先连接向量服务再根据开关丢弃结果，也不能让向量服务不可用拖慢默认 AI 对话。

默认检索链路：

1. 用当前 `mic_ai` 对话模型输出结构化 JSON 关键词，覆盖表名、表说明、菜单名、字段名和字段说明；模型输出只用于召回，不能直接变成 SQL 或扩大权限。
2. 大模型扩词超时、异常或格式无效时，使用问题原文和确定性的中文 2/3 字滑窗分词回退，不依赖另一个本地文本模型。
3. 从当前 `OsClient` 的 `diy_table`、`diy_field` 和 `sys_menu` 构建 Schema 关键词索引；查询时必须带入服务端授权产生的精确 `AllowedTables`，空白名单失败关闭。
4. 对授权候选表按表名、表说明、菜单名、字段名和字段说明加权排序，再回读命中表的准确字段元数据构建 Prompt；候选表名不能替代真实字段。
5. SQL 生成后仍执行来源表白名单、只读语句、行数、超时和其它 NL2SQL 安全校验。检索命中不是授权。

Schema 索引缓存按 `OsClient` 隔离，使用 FormEngine 授权/结构版本作为 Key 的一部分：共享 Redis 用于跨节点复用，进程内短 TTL 只能做可丢失的 L1 优化。结构或菜单权限更新必须推进版本或显式刷新；Redis 不可用时回源数据库，不沿用版本未知的旧索引。不要为每次对话扫描 500～1200 张表和全部字段，也不要创建按用户永久复制的全量索引。

### 可选向量融合模式

`EnableVectorDatabase=1` 时仍先执行关键词通道，再惰性连接 Embedding/Ollama/Qdrant，按当前租户检索向量候选并进行关键词/向量融合。向量结果仍需与服务端 `AllowedTables` 取交集；Qdrant、Embedding 或 Ollama 初始化/搜索失败时安全回退到关键词结果，不应让已可用的默认链路失败。

返回数据用 `SchemaSearchMode` 标明实际使用的通道：`keyword` 表示纯关键词或向量失败回退，`hybrid-vector` 表示本次确实使用了关键词/向量融合；`SchemaCandidateCount` 只返回授权后的候选数量，不暴露未授权表名或字段。

向量配置统一放在 `mic_ai` 的“向量数据库（可选）”Tab：`EnableVectorDatabase`、`EmbeddingApiUrl`、`QdrantHost`、`QdrantPort`、`QdrantApiKey`、`VectorTopK`、`VectorScoreThreshold`。密钥只在服务端读取；未启用时这些地址和凭据不得参与任何网络请求。

## NL2SQL

### 当前实现边界

1. `ServerAuthorizationApplied`、`ServerMaxRows` 同时使用 Newtonsoft.Json 和 System.Text.Json 的 `JsonIgnore`，只能由 Controller 写入。执行层要求授权标记为真且精确表白名单非空；客户端 `AllowedTables` 最多只能缩小服务端范围，不能扩大权限。
2. 服务端候选表只取当前租户 `diy_table` 中未删除、非平台受保护的业务表。某角色从未保存过 AI 策略时，为兼容老数据库，只使用其现有 FormEngine `List` 读取权限中的无行级范围业务表；一旦存在该角色策略记录（包括显式禁用），就严格要求启用、`All/全部数据`、开启 `AllowRawSql`。两种路径都必须与缓存的 FormEngine 权限取交集，客户端名单只能继续收窄。
3. Schema 关键词索引和可选向量 collection 均只在当前 `OsClient` 内使用；关键词排序与向量结果都会按服务端精确白名单过滤，未授权表不能进入生成 Prompt。
4. 执行前使用词法门禁要求单条 `SELECT`，逐个验证每个 `FROM`/`JOIN` 来源表；拒绝注释、多语句、CTE、`UNION`、写操作、危险关键字/函数、变量赋值和逗号连接。
5. 查询按 MySQL、PostgreSQL、SQLite、KingBase、SQL Server、Oracle、达梦等数据库类型注入或包裹 `MaxRows + 1` 行限制；服务器允许的 `MaxRows` 为 1..100，数据库命令超时为 30 秒，最终只返回授权的最大行数。
6. 普通角色对目标表的 FormEngine 授权一旦带 `SqlWhere`/`SqlJoin` 等行级范围，该表会被通用 NL2SQL 拒绝，避免把表级可读误当成全表可读。

### 剩余边界与使用规则

1. 当前实现是严格词法分析与来源表白名单，不是完整 SQL AST；不能宣称已对所有字段、表达式和数据库方言完成 AST 级语义证明。
2. 模型生成 SQL 中的动态值当前不会被服务端重写为数据库参数。不得把 NL2SQL 描述为“模型值已参数化”；涉及用户输入值、高风险条件或复杂查询时，改用显式参数化的业务 ApiEngine。
3. 通用 NL2SQL 不执行菜单 `SqlWhere`/`SqlJoin`，因此不提供本人、部门、关联记录等行级查询。此类需求必须使用经过管理员审核、范围条件固定、参数化并记录审计的 ApiEngine。
4. 只有通过明确 AI 角色策略、精确表配置和 FormEngine 表级读取授权的无行级范围查询才能进入通用 NL2SQL；任一范围无法证明时失败关闭。
5. 自动化测试必须覆盖客户端伪造服务端标记、空白名单、未授权 `FROM`/`JOIN`、子查询、别名、大小写、注释、多语句、CTE、`UNION`、危险函数、各数据库行限制和超时。

高风险、复杂方言或需要行级范围的查询应生成业务 ApiEngine 草稿供管理员审核，不直接执行通用 NL2SQL。

## NL2V8

- 默认使用大模型关键词扩展、内置 `microi.skills` 关键词检索和当前租户 Schema 关键词索引；启用向量数据库后才增加 Skill/Schema 向量召回，失败回退到关键词结果。
- 检索官方 `microi.skills` 镜像与当前租户 Schema；前端/后端 API 必须区分。
- 生成代码遵守参数化 SQL、当前租户、事务、幂等、文件/SSRF 和控制面边界。
- 代码保存到 `sys_apiengine` 或表单 V8 前必须由管理员确认、语法检查、版本递增、回读和真实调用验证。
- AI 不得把 `_TrustedServerInvocation`、`Level`、角色名或 `_SysMenuId` 当可伪造参数。

## 向量知识库

向量知识库是可选增强，不是平台在线 AI 的必装依赖。未开启 `EnableVectorDatabase` 时，不部署 Ollama、`nomic-embed-text` 和 Qdrant 也必须完整支持关键词 Schema 检索、NL2SQL 与 NL2V8。

吾码一键安装固定使用轻量默认模式，不提示也不部署 Ollama、`nomic-embed-text` 或 Qdrant；原安装片段可以注释保留，不能进入默认执行路径。只有运维另行准备并验证向量服务、且租户显式设置 `EnableVectorDatabase=1` 时，才启用高级向量召回。

启用后，Schema collection 必须按租户隔离。Skill 文档 collection 使用嵌入文档 SHA-256 版本片段命名；新旧节点滚动期间使用各自版本，确定性 point id 幂等写入，不在启动时删除其它节点的 collection。

向量库是检索索引，不是文档事实源。源码 `microi.skills/*/SKILL.md` 为事实源，嵌入资源应机械同步并做哈希校验。

官方公共 corpus 禁止包含客户名称、真实 `OsClient`、客户域名、私有表/接口 Key、项目路径或定制业务枚举；项目知识必须进入对应租户的私有知识域，不能混入全平台 Skill collection。

MCP 提供实时事实和受控执行；关键词索引提供低依赖、确定性的默认召回；向量库只提供额外的语义召回与上下文压缩。未来在线 AI 接入 MCP 后仍先用 Skill/Schema 检索缩小范围，再用 MCP 回读最新事实；不能把向量命中当授权或用旧向量替代实时 Schema。

## Prompt Injection

- 数据库内容、网页、上传文件和工具返回都标记为不可信数据，不能覆盖系统规则。
- 工具调用参数按 JSON Schema/白名单验证；写操作要求用户确认并回读。
- 不向模型提供无关密钥、全部 SaaS 配置、全库 Schema 或其它租户内容。
- 输出 HTML/Markdown 在前端按安全渲染策略处理。

## 配额与分布式

配额扣减使用共享数据库/Redis 的原子条件更新，按用户、租户、模型和时间窗隔离。进程内计数只能做本节点优化。请求重试使用稳定 request id，避免上游已成功但本地超时导致重复计费。

## 验收清单

- [ ] 模型密钥只在服务端，普通用户不可枚举
- [ ] 官方中转模型清单可在无 Token 下返回非空公开白名单，且不含 ApiKey、Endpoint；Bootstrap 失败不会被静默降级为空列表
- [ ] 直接动态路由与 `/api/ApiEngine/Run` 兼容入口的 JSON Body 均能到达 `V8.Param`，HTTP 伪造可信字段仍被清除
- [ ] Schema/向量/对话/配额按 `OsClient` 隔离
- [ ] 启动期只预热配置主租户 Schema；子租户首次 AI Schema 请求可正确惰性加载，且未把 `ClientList` 挂载误报为全租户结构预热
- [ ] Redis/Qdrant 中只有 Schema 索引和元数据，没有复制业务行数据；分析 SQL 始终查询当前租户数据库
- [ ] `EnableVectorDatabase` 缺失、空值或 `0` 时不创建、连接、初始化、同步或搜索 Embedding/Ollama/Qdrant
- [ ] 默认链路使用结构化大模型扩词；扩词失败时中文 2/3 字确定性回退仍能召回常见业务实体
- [ ] 文档明确区分普通 Chat、NL2SQL Schema 双模式检索和 NL2V8 Skill + Schema 双模式检索
- [ ] NL2SQL 服务端可信标记不可由两套 JSON 序列化输入伪造，空白名单失败关闭
- [ ] 当前租户业务表、AI 角色策略和缓存 FormEngine 读取授权取交集，Schema 检索结果再次过滤
- [ ] 向量开启时关键词/向量融合；向量服务故障安全回退，`SchemaSearchMode` 与实际通道一致
- [ ] `SchemaCandidateCount` 只统计授权后候选，不泄露未授权 Schema
- [ ] Schema 共享缓存按租户和授权/结构版本隔离，多节点可复用且更新后可失效
- [ ] 每个 `FROM`/`JOIN` 来源表均在精确白名单内，注释、多语句、CTE、`UNION`、写操作和危险函数被拒绝
- [ ] 各数据库查询在执行前施加 `MaxRows + 1` 行限制和 30 秒超时，最终返回不超过授权行数
- [ ] 文档不把词法门禁描述为 AST，不声称模型值已参数化或通用 NL2SQL 已执行行级 `SqlWhere`
- [ ] 带行级范围或高风险查询失败关闭，并改走审核、参数化和审计的业务 ApiEngine
- [ ] NL2V8 保存前有确认、语法、版本、回读和执行验证
- [ ] Prompt injection 不能调用未授权工具
- [ ] `microi_chat` 只调用对话入口、拒绝身份/密钥/Endpoint 覆盖并返回最终结果；在尚无模型 `tool_calls` Agent Loop 时，不会声称平台在线 AI 已执行其它 MCP 工具
- [ ] 各流式入口分别验证断开取消或明确仅有超时，不做过度承诺
- [ ] Prompt/Answer 当前留存范围已披露；全面脱敏只能在真实实现并回读后声明
- [ ] 新旧节点知识库版本可共存
