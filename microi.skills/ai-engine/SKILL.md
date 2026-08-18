---
name: ai-engine
description: Microi AI 引擎、模型代理、NL2SQL/NL2V8 与知识库规范。用于模型路由、密钥和订阅配额、Schema/Skill 关键词检索与可选向量融合、提示词安全、流式响应、租户隔离和验收。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi AI Engine

平台视频生成的受控 HTTP 入口为 `/api/Ai/CreateMiniMaxVideo`、`/api/Ai/GetMiniMaxVideoTask`、`/api/Ai/GetMiniMaxVideoFile`、`/api/Ai/PersistMiniMaxVideoFile`；AI 工作流入口统一位于 `/api/AIWorkFlow/*`。调用方只提交业务参数和模型选择，供应商密钥、租户配额、任务归属和文件读取权限由服务端判定。`PersistMiniMaxVideoFile` 只能将当前登录用户所属、且已成功完成的 MiniMax 视频任务文件持久化到当前租户 HDFS；禁止把该入口作为任意 URL 搬运器，任务归属、文件来源和租户边界必须由服务端重新校验。

## 能力

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

安全数据分析必须继续调用 `/api/Ai/NL2SQL`，由服务端从当前用户权限生成表白名单；通用 AI 包装接口不得接受客户端自报的表名作为授权。

## 代码分层

AI 业务统一实现在 `Microi.Server/Microi.AI`。`Microi.Server/Microi.net.Api` 只是 HTTP、SSE 与 SignalR 传输层，可以做路由、请求绑定、读取认证中间件产生的可信用户/租户、传递取消信号和写响应，但不能承载模型选择、Schema/Skill 检索、NL2SQL 授权与执行、提示词编排、代理路由、供应商密钥、额度计量、订阅支付状态或 AI 工作流。

- Controller、Hub 只调用 `IMicroiAI`、`AiProxyService`、`SubscriptionService`、`AiWorkflowService` 等 `Microi.AI` 门面，不直接查询 `mic_ai` / `mic_sub_order`，不接触上游密钥和向量基础设施。
- “授权 + 执行”必须由领域门面原子完成，不能让接口层先生成可伪造的 `AllowedTables` 或遗漏某一步。
- AI 的 Qdrant/Ollama/Embedding 配置、Schema 初始化和其它生命周期任务由 `AddMicroiAI()` 在模块内自注册；API 的 `Program.cs` 只负责调用模块注册。
- `Microi.Core` 只承载跨模块契约和模型。新增入口时先扩展 AI 领域服务，再添加薄 Controller/Hub 适配，禁止复制业务流程。

## 模型与密钥

- 模型 Provider、Endpoint、ApiKey、AuthPrefix 和上游模型 Id 只保存在服务端受保护配置。
- 普通用户使用平台签发的受限 API Key/订阅身份，不能枚举或读取上游密钥。
- MiniMax 视频生成属于可复用供应商原子能力，应实现在 `Microi.AI`，Controller 只读取可信用户/`OsClient`、绑定参数并传递取消信号。理由是上游密钥隔离、异步 `task_id → file_id → download_url` 协议、订阅额度和跨节点幂等都不是某个可编辑接口引擎应复制的业务逻辑；具体文章、提示词和分发编排仍可留在 Job/接口引擎/发布 Skill。
- MiniMax Token Plan Key 与按量 API Key 是相互独立的凭据，必须复用现有服务器端 Provider/ApiKey 受保护配置，不新增 API `AppSettings`、`MICROI_*` 环境变量或浏览器可见 Key。视频创建、查询和下载仅允许官方 HTTPS Host `api.minimaxi.com`。
- 视频创建必须要求调用方稳定 `RequestId`，先在当前租户共享 Redis 以 `OsClient + 用户 + RequestId` 原子 `NX` 占位；Redis 不可用时失败关闭。相同 RequestId/参数回放返回原任务，不同参数冲突拒绝；上游 POST 超时或结果不确定时禁止自动换 RequestId 重试。查询不再次扣生成额度。
- 原始 MiniMax `task_id`/`file_id` 不下发。服务端返回由供应商 Key 签名、绑定当前用户和用途的短句柄；查询/下载验签后才还原。Key 轮换会使旧句柄失效，应先完成或重新登记在途任务。
- 当前官方模型边界必须实时校准：`MiniMax-Hailuo-2.3` 支持文生/图生，`MiniMax-Hailuo-2.3-Fast` 仅图生且必须有首帧，首尾帧使用 `MiniMax-Hailuo-02`。Hailuo 2.3 的画质优先上限与平台默认值是 6 秒 / 1080P，时长优先上限是 10 秒 / 768P，两者不能同时最大；API 不提供 fps 参数，必须用媒体探针记录真实帧率，禁止把插帧/画布规格冒充模型原生能力。当前 Token Plan 使用统一用量条、5 小时固定窗口和周窗口，控制台是剩余额度事实源，不再把固定“每天 N 条”写成官方配额。需要自动生成时，在 `Microi.AI` 增加只读、脱敏、管理员限定的 `https://www.minimaxi.com/v1/token_plan/remains` 安全原子能力；不得由浏览器或可编辑 V8 读取 Provider Key，也不得把客户端今日计数当成供应商权威额度。
- MiniMax 视频任务返回静音画面。需要人物对白时，男/女语音必须通过 `Microi.AI` 的 `GenerateMiniMaxSpeech` 受保护原子能力生成：固定 `speech-2.8-hd`、固定男女系统音色、稳定 RequestId、共享 Redis 幂等，并直接转存租户 HDFS；再由可靠 Worker 按时间轴混音、加准确字幕。无法证明口型同步时使用画外音或反打镜头。背景音乐使用 `GenerateMiniMaxMusic` 并在人声下压低。运行节点尚未部署 Speech 能力、额度未核实或母版混音/探针证据缺失时失败关闭，禁止静音、仅配乐、浏览器直连供应商或伪称模型原生带声。
- 使用 Microi.AI 中转站时，租户侧 AI Bootstrap 通过官方 `official_ai_relay_models` 发现可用运行模型。该接口是跨租户只读公共契约，必须保持启用、允许匿名 HTTP 调用，并且只返回模型标识、展示名等公开白名单字段，绝不能返回中转密钥或上游 Endpoint。消费者不得把 `NoAuth` 静默伪装为“没有配置模型”；应返回可诊断错误，同时前端显示明确空态。
- PC、UniApp 和其它客户端通过 `POST /apiengine/{key}` 发送的 JSON Body 必须完整进入 `V8.Param`；兼容入口 `/api/ApiEngine/Run` 的 JSON Body 还必须包含 `ApiEngineKey`。API 层只负责请求绑定和清除客户端伪造的可信字段，模型选择、权限策略与对话逻辑仍全部位于 `Microi.AI` 或受控 AI 接口引擎中。
- 当前计量记录除问题摘要外还可能持久化完整 `Question`、`Answer`，部分诊断日志也会输出问题或摘要。处理现有版本时必须把这些字段视为敏感业务数据，限制查询权限和留存；不要声称已经全面脱敏。
- 发布目标是日志只记录 trace id、模型、耗时、token 计数和状态，Prompt/Answer 按租户策略脱敏，密码、Token、连接串和完整业务数据不落日志。该目标必须用源码和真实数据回读证明。
- OpenAI 代理流式接口会传递 HTTP 请求取消信号；普通 `ChatStream` 与 `NL2V8` 当前主要使用内部超时 Token。不要声称浏览器断开一定立即终止上游调用或计费。

## 跨端 AI 助手与商城交付

- PC 与移动端复用 `mci_ai_data_assistant`。`Bootstrap` 返回的 `Enabled`、`Models`、`AllowedDomains` 和 `Prompts` 是跨端共同事实源；快捷问题来自启用的 `mci_ai_data_domain.PromptExamples`，前端不能维护另一套固定文案。
- 普通角色必须匹配启用的 `mci_ai_role_policy`。只有后端可信的 `V8.CurrentUser.Level >= 9999` 可以在新安装租户缺少角色策略时获得安全兜底：从目标租户动态读取已启用业务域和模型，范围为 `All`，仍保持 `AllowRawSql=false`、敏感字段默认关闭。不得相信客户端提交的 Level、角色名或账号名。
- 当租户要求“所有角色均可使用 AI 助手”时，必须为 `sys_role` 中每个目标角色建立显式启用策略；受限角色使用 `Self`/`Department` 与最小业务域，管理角色才可使用经确认的 `All`。禁止把“人人可打开助手”实现成普通角色默认全库可读。
- `Sys_Config.DisableAiAssistant` 是负向开关：缺失、空值或 `0/false` 都显示 AI 助手，只有显式 `1/true` 才关闭图标。商城升级应复用旧 `IsShowAiAssistant` 的字段元数据 Id 就地改名；兼容读取可以保留旧物理列，但旧字段元数据必须在 PC 与移动端隐藏，禁止同时暴露正向、负向两个开关。关闭该开关前后都要做策略覆盖验收：回读 `sys_role` 与 `mci_ai_role_policy`，断言每个目标角色都有唯一启用策略，`AllowedDomains`、`AllowedModels` 均非空且模型仍处于启用状态；再至少用超级管理员、普通员工和客户身份分别调用 `Bootstrap`，确认 `Enabled=true` 且返回范围符合角色。仅看到入口图标不算可用。
- 角色策略存在但 `AllowedModels` 为空时，客户端最终仍会得到无可用模型；不得把它误判为前端角色拦截。应补齐当前租户启用模型白名单并回读，而不是删除 `mci_ai_role_policy` 校验或在客户端强制把 `Enabled` 改成 `true`。
- 商城包不能携带发布租户的角色 Id、模型 Id 或密钥；应携带业务域定义和接口引擎，由安装后的目标租户动态发现自己的启用模型。发布后回读 `sys_microistore.AppVersion/AppPakcet`，并真实执行 `Bootstrap` 验证超级管理员可用、模型非空、快捷问题存在。

## Schema 检索双模式

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
