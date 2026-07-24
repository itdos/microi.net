# AI 引擎与 Microi.AI 中转站

::: tip 推荐部署方式：默认不安装向量组件
Microi 吾码在线 AI 引擎已内置“**大模型关键词扩展 → 当前用户权限范围内的 Schema 关键词检索 → 精确表/字段回读 → SQL 安全校验与执行**”。对常见的 500～1200 张表、1 万～1.5 万个字段，无需部署 **Ollama + nomic-embed-text + Qdrant** 也能完成 AI 数据分析，启动更快、资源占用更低、实时 Schema 更准确。

`Ollama + nomic-embed-text + Qdrant` 继续作为可选的模糊语义召回增强。只有确实需要处理大量别名、行业术语或描述非常模糊的问题时才建议启用。未启用时平台绝不连接、初始化、同步或搜索向量库；显式启用但连接失败时，平台会安全回退到关键词 Schema 检索。
:::

## 后端代码分层

AI 相关业务实现统一归属 `Microi.Server/Microi.AI`，`Microi.Server/Microi.net.Api` 只是 ASP.NET Core 的 HTTP、SSE 与 SignalR 接口层：

- API 层可以完成路由、请求绑定、认证中间件结果读取、可信 `OsClient` / 当前用户上下文传入、取消信号传递、响应头和流式分块输出。
- 模型配置和默认模型选择、会话上下文、Schema/Skill 检索、NL2SQL 授权与执行、提示词安全、模型代理路由、供应商密钥、额度和计量、订阅支付状态、AI 工作流以及 AI 自身启动初始化，必须由 `Microi.AI` 的服务或门面完成。
- API 层不能直接查询 `mic_ai`、`mic_sub_order` 等 AI 表，不能读取供应商密钥，不能自行拼接服务端 `AllowedTables`，也不能把“授权”和“执行”拆成可被其它入口漏调的两个步骤。
- `Microi.Core` 只保存跨模块接口与请求/响应模型。`Microi.AI` 通过 `AddMicroiAI()` 自注册领域服务和生命周期任务；API 宿主不应感知 Ollama、Qdrant、Embedding 或 Schema 索引实现。

这一边界同时适用于 Controller、SignalR Hub、后台初始化和未来 Tool Gateway。新增 AI 入口时应先扩展 `IMicroiAI` 或 `Microi.AI` 内的专用服务，再由接口层做薄委托，不能把业务逻辑复制到 Controller。

## 中转站配置

`mic_ai` 中的 `Microi.AI中转站` 是官方 OpenAI 兼容入口：

- Endpoint：`https://api.itdos.com/v1`
- ApiKey：在吾码官网个人中心生成；创建 SaaS 独立数据库时会自动写入新租户
- 中转模型：由吾码官方 `mic_ai.IsRelayModel = 1` 的启用模型组成，用户在 AI 对话界面选择
- 鉴权与计量：官方服务按 ApiKey 关联官网账号，按每次请求的输入/输出 Token 扣减并记录明细

不要把官方供应商的真实 ApiKey 下发到租户，也不要在租户本地重复扣减。租户只保存用户自己的 `sk-microi-*` ApiKey，供应商密钥仅保留在吾码官方数据库。

AI 对话中的【选择中转模型】始终显示并提交官方目录的模型 Id（例如 `MiniMax-M3`），不能用厂商简称替代模型 Id。AI 引擎列表直接读取模块设计的列表列配置，因此在模块设计中加入【加入AI中转站】后会同步显示，前端不再维护另一份硬编码列清单。

中转站配置行允许 `AiModel` 为空：该行只保存中转站 Endpoint、ApiKey 等接入配置，真正发送给上游的模型 Id 来自【选择中转模型】。前端校验与请求必须使用选中的中转模型 Id，并同时提交中转站配置行的 `AiModelId`。

## 对话归档

左侧对话区可以在【AI对话 / 已归档】之间切换。归档状态保存在 `mic_ai_record.Content.Archived`，同一 `ConversationId` 的所有消息一起归档；归档或还原后只刷新当前列表，不自动切换 Tab。归档不删除历史消息，也不影响审计记录。

鼠标移到对话标题上会显示【修改标题】按钮。保存后会按 `ConversationId` 同步更新该对话的全部记录，切换历史消息时标题保持一致。

授权失败、网络失败等运行期提示只用于当次展示，不会作为有效聊天上下文再次发送给模型。即使旧会话保存过“开源版无法使用在线 AI”等历史提示，授权恢复后继续对话也不会被旧错误污染。

## 个人中心

登录吾码官网后，在【个人中心 → AI 中转站】可以查看：

- API Base 与个人 ApiKey
- 总量、已用、剩余 Token
- 每次调用的时间、模型、用户问题摘要（真实输入前 50 个字符）、输入 Token、输出 Token、扣减量、剩余额度和调用来源
- Token 充值记录，包括充值数量、充值后总量/剩余量、充值类型、状态、来源和备注

调用记录由官方中转服务在上游成功响应后写入：优先采用上游返回的 `usage`，流式响应会请求 `include_usage`；上游失败不扣减。账户扣减和流水写入处于同一数据库事务中，并通过行锁避免并发请求重复透支。个人中心通过登录态接口引擎 `official_ai_usage` 按当前用户分页查询，不能查询其他用户的流水。

个人中心只保留官网导航栏中的一个语言切换器。这里切换的是个人中心 i18n 字典，不改变 `profile.html` 路由；Markdown 文档仍使用独立中英文 URL，以保留 SEO 能力。

个人中心所有受保护请求使用同一份平台 Token。服务端通过响应头 `authorization` 轮换 Token 时，页面会先保存新 Token 再发起后续请求；真正失效时统一清理会话并跳转登录页，不会继续展示旧数据后再在页面底部提示身份过期。

官方后台【系统账号】支持按用户执行【充值Token】。前端按钮只负责收集数量和备注，`official_ai_token_admin` 在后端事务中更新账户并写入 `mci_ai_token_recharge`；`RequestId` 用于防止重复提交。用户详情同时以只读子表显示 Token 消费记录和充值记录。

OpenAI 兼容客户端可使用 `/v1/chat/completions`、`/v1/models`；额度查询使用 `/v1/usage`。

## NL2SQL、NL2V8 与知识库安全

- 默认 Schema 检索链路是：大模型把用户问题扩展为少量关键词、同义词和业务实体；服务端只在当前用户有权访问的 Schema 中检索候选；再从权威 `diy_table` / `diy_field` 元数据精确回读字段，最后生成并校验 SQL。关键词扩展结果不是权限凭据，不能扩大服务端授权范围。
- `mic_ai.EnableVectorDatabase` 缺失、为空或为 `0` 时，必须完全跳过 Embedding、Ollama 和 Qdrant 的连接、初始化、同步与搜索。设置为 `1` 时才把向量召回与关键词结果合并；向量服务异常必须安全回退到关键词模式，不能导致普通聊天或数据分析整体不可用。
- 启用 Schema 向量库时必须按 `OsClient` 隔离；只向模型提供当前任务需要且当前用户有权访问的表/字段。
- 当前 NL2SQL 的可信授权标记和最大返回行数仅由 Controller 写入，`ServerAuthorizationApplied`、`ServerMaxRows` 同时被 Newtonsoft.Json 与 System.Text.Json 忽略，客户端不能伪造。执行层要求服务端授权标记为真且精确表白名单非空，否则失败关闭；客户端提交的 `AllowedTables` 最多只能缩小服务端范围。
- 服务端白名单只包含当前租户 `diy_table` 中未删除、非平台受保护的业务表。为兼容大量老数据库，某角色从未保存过 `mci_ai_role_policy` 时，平台按该用户现有 FormEngine `List` 读取权限生成安全白名单，并排除带行级范围的表，客户端传入范围只能继续收窄；一旦管理员为该角色保存过策略（包括显式禁用），则严格按策略执行。启用的显式策略还必须满足 `All/全部数据`、`AllowRawSql`，并与 FormEngine 权限再次取交集。无论候选来自关键词还是向量召回，都必须再次按该精确白名单过滤，未授权表不会进入生成 Prompt。
- 执行前的词法门禁要求单条 `SELECT`，逐个校验每个 `FROM`/`JOIN` 来源表；拒绝注释、多语句、CTE、`UNION`、写操作、危险关键字/函数、变量赋值和逗号连接。查询按数据库类型包裹或注入 `MaxRows + 1` 行限制，服务端最大返回 100 行，并设置 30 秒数据库命令超时。
- 这些保护是严格的词法白名单，不是 SQL AST 校验，也不等于已对所有字段和表达式完成语义证明。模型生成 SQL 中的动态值当前不会被重写为数据库参数，不能宣称 NL2SQL 已实现模型值参数化。
- 通用 NL2SQL 不执行菜单 `SqlWhere`/`SqlJoin` 行级范围。普通角色对某表的唯一授权路径一旦带行级范围，该表就会从通用 SQL 白名单中拒绝；需要部门、本人、关联记录等行级条件时，应通过经过审核、显式参数化并记录审计的业务 ApiEngine 查询。
- NL2V8 检索官方 Skill 镜像与当前租户 Schema；代码保存前必须由管理员确认、语法检查、版本递增、远端回读和真实调用验证。
- 数据库内容、网页、上传文件和工具返回均属于不可信数据，不能通过 Prompt Injection 覆盖系统规则或调用未授权工具。
- 普通用户不能读取 Provider 密钥、完整 SaaS 配置、其它用户用量或其它租户对话。

启用 Skill 向量知识库时，平台使用文档 SHA-256 版本化 Qdrant collection。新旧节点滚动期间分别使用自己的版本，初始化只做确定性幂等写入，不删除其它节点仍在使用的 collection；旧版本在旧节点全部退出后按运维保留策略清理。未启用向量数据库时不创建、检查或同步这些 collection。

官方公共知识库禁止包含客户名称、真实 `OsClient`、客户域名、私有表/接口 Key、项目路径或定制业务枚举。项目知识必须进入对应租户的私有知识域；构建时对源 Skill、嵌入资源和发布包执行客户标识扫描及 SHA-256 一致性检查。

## 在线 AI、MCP 与向量库的边界

当前能力必须按入口区分：

- 普通 `Chat/ChatStream` 使用服务端会话上下文和固定的 Microi 核心规范 Prompt 调用 OpenAI 兼容模型，不检索完整 Skill 或 Schema 向量库。
- `NL2SQL` 默认使用大模型关键词扩展和权限感知 Schema 搜索；启用 `EnableVectorDatabase` 后叠加 Schema 向量召回。
- `NL2V8` 默认使用官方 Skill 精确/关键词检索和当前租户 Schema 关键词检索；启用向量数据库后才叠加 Skill 与 Schema 向量召回。

当前 `Microi.Server/Microi.AI` 没有注册 MCP Tools，也没有处理模型 `tool_calls` 的代理循环，因此不会因为平台已经提供 MCP Server 就自动调用 MCP。Prompt 中写“优先使用 MCP”只是一条文字说明，不能赋予模型工具能力。

流式取消也要区分入口：OpenAI 代理流式接口会传递 HTTP 请求取消信号；普通 `ChatStream` 和 `NL2V8` 当前主要依赖内部超时 Token，不能宣称浏览器断开后一定立即终止上游调用或计费。

当前中转计量记录除问题摘要外还可能保存完整 `Question` 和 `Answer`，部分诊断日志也会输出问题内容或摘要。它们必须按敏感业务数据保护、限制访问和设置留存策略；在统一脱敏与可配置留存真正实现前，不得宣称 Prompt/Answer 已全面脱敏或不落日志。

Microi MCP 当前服务于 Codex、GitHub Copilot、Cursor、Claude Code 等具备 MCP Host 能力的外部 AI 客户端；读写仍经过平台 Token、租户边界、权限、确认与审计。

未来若让平台在线 AI 调用工具，推荐在 `Microi.AI` 内实现受限 Tool Gateway，复用 FormEngine、V8McpLogic 等后端授权入口，而不是让后端拿超级管理员 Token 再调用自己的 MCP。每次调用必须继承当前用户、`OsClient`、Token/权限快照和审计上下文；模型只负责提出调用，服务端继续执行参数白名单、写操作确认、幂等、步数/时长/结果大小限制和结果回读。工具返回内容仍是不可信数据，不能修改系统规则。

MCP 与向量库解决不同问题：

- MCP 提供实时、权威、可执行的工具访问，适合读取当前 Schema/引擎代码以及受控写入。
- Skill 文档向量库用于从稳定知识中低成本召回相关规范，减少 Prompt 长度；它不是事实源，也不能授权或执行。
- Schema 向量库用于从大量表中语义预选少量候选表；真正读取和执行仍回到当前租户的权威接口。

当前在线 AI 的 Schema 搜索直接复用服务端实时元数据、授权缓存和 SQL 安全执行链，不需要为了读取自己数据库的 Schema 再经过一次外部 MCP 网络调用；它与 MCP Schema 工具共享“实时事实、权限校验、精确回读”的原则。未来若在线 AI 增加通用工具循环，再通过受限 Tool Gateway 暴露 MCP 等能力。

推荐默认采用关键词 Schema 检索；向量检索只负责补充高度模糊的候选表，不能替代实时元数据、权限和执行校验。关闭向量数据库不会删除 NL2SQL 所需的 Schema 检索能力，也不会影响普通 Chat。

### `mic_ai` 向量配置

AI 模型表的【向量数据库（可选）】Tab 集中维护以下字段：

| 字段 | 说明 |
|---|---|
| `EnableVectorDatabase` | 是否启用向量数据库；默认 `0` |
| `EmbeddingApiUrl` | Embedding / Ollama 地址，仅启用时使用 |
| `QdrantHost`、`QdrantPort`、`QdrantApiKey` | Qdrant 连接配置，仅启用时使用 |
| `VectorTopK` | 向量候选数量 |
| `VectorScoreThreshold` | 向量相似度阈值 |

开关关闭、字段缺失或配置为空时，运行时不得探测这些地址。老数据库会由幂等升级程序补字段和 Tab，默认保持关闭，不要求安装额外服务。

完整规范见源码 `microi.skills/ai-engine/SKILL.md`、[AI 编程与 Skills](../v8-engine/ai-apiengine)和[平台安全与兼容基线](../more/security)。
