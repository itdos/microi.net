# AI 引擎与 Microi.AI 中转站

::: tip 推荐部署方式：默认不安装向量组件
Microi 吾码在线 AI 引擎已内置“**大模型关键词扩展 → 当前用户权限范围内的 Schema 关键词检索 → 精确表/字段回读 → SQL 安全校验与执行**”。对常见的 500～1200 张表、1 万～1.5 万个字段，无需部署 **Ollama + nomic-embed-text + Qdrant** 也能完成 AI 数据分析，启动更快、资源占用更低、实时 Schema 更准确。

`Ollama + nomic-embed-text + Qdrant` 继续作为可选的模糊语义召回增强。只有确实需要处理大量别名、行业术语或描述非常模糊的问题时才建议启用。未启用时平台绝不连接、初始化、同步或搜索向量库；显式启用但连接失败时，平台会安全回退到关键词 Schema 检索。
:::

::: tip 两个独立培训专题
- [AI 数据分析](./ai-data-analysis)：自然语言提问、权限感知 Schema、NL2SQL、经营结论与真实移动端预览。
- [AI 创作中心](./ai-creative-studio)：AI 图片、视频、声音与音乐创作，以及完整 29 项图像工具。
:::

## 📸 预览图

<div class="mci-doc-screenshot-grid mci-doc-screenshot-grid--single">
  <figure>
    <img src="/images/product-screenshots/ai-engine-creation-center.jpg" alt="Microi吾码 AI 创作中心，展示智能助手、视觉创作、声音创作及完整图像工具目录" data-fancybox="ai-engine-preview">
    <figcaption>AI 创作中心：从自然语言想法出发，统一进入对话、图像、视频、声音与模型能力。</figcaption>
  </figure>
</div>

## 后端代码分层

AI 相关业务实现统一归属 `Microi.Server/Microi.AI`，`Microi.Server/Microi.net.Api` 只是 ASP.NET Core 的 HTTP、SSE 与 SignalR 接口层：

- API 层可以完成路由、请求绑定、认证中间件结果读取、可信 `OsClient` / 当前用户上下文传入、取消信号传递、响应头和流式分块输出。
- 模型配置和默认模型选择、会话上下文、Schema/Skill 检索、NL2SQL 授权与执行、提示词安全、模型代理路由、供应商密钥、额度和计量、订阅支付状态、AI 工作流以及 AI 自身启动初始化，必须由 `Microi.AI` 的服务或门面完成。
- API 层不能直接查询 `mic_ai`、`mic_sub_order` 等 AI 表，不能读取供应商密钥，不能自行拼接服务端 `AllowedTables`，也不能把“授权”和“执行”拆成可被其它入口漏调的两个步骤。
- `Microi.Core` 只保存跨模块接口与请求/响应模型。`Microi.AI` 通过 `AddMicroiAI()` 自注册领域服务和生命周期任务；API 宿主不应感知 Ollama、Qdrant、Embedding 或 Schema 索引实现。

这一边界同时适用于 Controller、SignalR Hub、后台初始化和未来 Tool Gateway。新增 AI 入口时应先扩展 `IMicroiAI` 或 `Microi.AI` 内的专用服务，再由接口层做薄委托，不能把业务逻辑复制到 Controller。

## 授权边界：服务器 License 与中转 ApiKey 是两套机制

在未修改的吾码官方发布物中，内置在线 AI 的核心推理入口会统一读取服务器 License：`Chat`、`ChatStream`、`NL2SQL`、`NL2SQLStreaming`、`NL2V8Engine` 以及它们的可信聊天编排，只有本机存在有效的 `Personal` 或 `Enterprise` License 时才继续调用模型。自己在 `mic_ai` 中配置 DeepSeek、OpenAI 等供应商的 Endpoint/ApiKey，并不会绕过这层服务器授权。

服务器 License 的真实信任链是：

1. 吾码官方使用签发私钥生成 `microi.net.lic`；客户发布包和 NuGet 不包含该私钥。
2. 客户节点使用程序集内嵌的官方公钥验证 RSA 签名，同时验证当前机器 HID 和有效期。显式配置的公钥也只能是同一官方公钥的副本，客户自建“私钥 + 公钥”不能替换信任根。
3. 验签在本机完成，并非每次 AI 调用都访问 `api.itdos.com`。有效 License 启动后会延迟检查一次作废状态，之后每天检查一次；官网短时不可达或超时会跳过本次心跳，不会立即停用已经通过本地验签的 License。

因此，准确说法是“核心在线 AI 需要**由吾码官方签发的有效服务器 License**”，而不是“每次调用都必须在线请求官网授权”。只下载源码或安装包、复制 `Microi.AI.dll`、把租户名改成 `iTdos`，都不能自行签发有效 License。

官方中转站还要经过第二层账号授权：租户使用官网签发的 `sk-microi-*` ApiKey 请求 `https://api.itdos.com/v1`，官网按账号校验额度并计量。服务器 License 不能代替中转 ApiKey，中转 ApiKey 也不能把本地 `Chat/NL2SQL/NL2V8` 变成已授权状态。

`ProxyChat`、`ProxyChatStream`、头像生成和 OpenAI 兼容 `/v1/chat/completions` 现在也在 `AiProxyService` 领域层读取同一服务器 License；不是只靠页面隐藏。`/v1/models`、套餐、订单和用量属于发现/账户管理接口，不触发模型推理，仍可用于配置与购买流程。中转调用在服务器 License 之外还会继续校验登录态或 `sk-microi-*` 及账号额度。

`MicroiAI` 与 `AiProxyService` 只接受 `Microi.net` 中封闭的 `MicroiFeatureLicense` 实现；宿主仅重新注册另一个 `IMicroiFeatureLicense` 不会把 AI 变成已授权。签发客户端地址固定为 `https://api.itdos.com`，私钥目录从编译、NuGet 和发布内容中排除；签发服务还会核对私钥对应公钥必须与内嵌官方信任根一致。

上述保证针对未被篡改的官方二进制与正常部署。拥有服务器管理员权限的人仍可以替换或修改程序集、改变机器指令，任何纯本地 DRM 都无法从理论上抵抗这种物理控制；但这不等于其能够“伪造 License”。没有官方私钥时，生成的文件不能通过未修改节点内嵌官方公钥的 RSA 验签，也不能拿去给其它正常吾码节点使用。

## 跨界面、前后端 V8、MCP 与外部客户端调用

平台已提供前后端第一等 `V8.AI` 和专用 `microi_chat` MCP Tool。调用边界如下：

| 调用方 | 推荐入口 | 鉴权 | 普通返回 | 打字机 / 流式 |
|---|---|---|---|---|
| PC、H5、UniApp 或 MicroService 页面 | `POST /api/Ai/Chat` | 吾码登录 Token | 支持 | 改用 `POST /api/Ai/ChatStream` 并消费 SSE |
| 前端 V8 | `await V8.AI.Chat(...)` / `ChatGet(...)` | 自动使用当前登录 Token、租户并接收轮换 Token | 支持 | `await V8.AI.ChatStream(..., onChunk)` |
| 后端接口引擎 / 表单后端 V8 | `await V8.AI.Chat(...)` | 固定绑定当前 V8 租户与认证用户；匿名上下文拒绝 | 支持 | `await V8.AI.ChatStream(..., onChunk)` |
| Microi MCP | `microi_chat` | MCP 当前登录 Token与绑定租户；不接受身份、密钥或 Endpoint 覆盖 | 支持最终 `DosResult` | MCP Tool 返回最终结果，不冒充逐 token 流 |
| OpenAI 兼容客户端 | `POST /v1/chat/completions` | `Authorization: Bearer sk-microi-*` | `stream:false` | `stream:true` |

### 参数与安全规则

- `Chat` 和 `ChatStream` 同时声明了 GET/POST，但业务代码默认使用 POST。问题、系统提示、附件和会话信息不应放进 URL、代理日志或浏览器历史。
- 常用请求字段为 `UserChatMsg`、`AiModel`、`AiModelId`、`RelayModel`、`ConversationId`、`Mode`、`ReasoningEffort` 和 `Attachments`。模型 Endpoint 与供应商 ApiKey 由服务端读取；Controller 和 `V8.AI` 会清除客户端提交的 `ApiKey/Endpoint`。HTTP 来源由 Controller 归一为 `http-ai`，后端 V8 来源固定为 `v8-ai`；不能通过伪造 `Source=ai-intent-router` 绕过中转计量。
- 当前用户、用户名称和 `OsClient` 以服务端 Token 恢复结果为准。客户端提交同名字段不能切换租户或冒充用户。
- `ChatStream` 使用标准 SSE 事件：`message` 是增量文本，`result` 是最终结果，`error` 是失败信息，`done` 的数据为 `[DONE]`。所谓“打字机效果”是前端收到 `message` 后逐块更新界面，不是把完整回答再用定时器假装成流式。
- NL2SQL 不能通过通用包装把客户端表名当授权。必须继续调用受控的 `/api/Ai/NL2SQL`，由服务端根据当前用户生成不可伪造的表白名单。

### 前端 V8：普通 POST / GET

相对当前 `ApiBase` 的请求会自动携带吾码登录头，并接收服务端返回的新 Token：

```javascript
var result = await V8.AI.Chat({
  UserChatMsg: '把这段工单内容归纳成三条结论',
  AiModel: 'MiniMax-M3',
  AiModelId: '当前租户 mic_ai 记录Id',
  ConversationId: V8.NewGuid ? V8.NewGuid() : ''
});
if (result.Code != 1) {
  V8.Tips(result.Msg || 'AI调用失败', false);
  return;
}
V8.Result = result.Data;
```

`V8.AI.Chat` 默认 POST。只有纯标量、无附件、且确认问题允许进入 URL 日志时才使用 `V8.AI.ChatGet`；业务默认仍应使用 POST。

`AiModelId` 应来自当前租户已经启用且当前用户可见的模型选择，不要在公共前端硬编码发布租户的主键。

### 前端 V8：SSE 打字机输出

`V8.AI.ChatStream` 已封装 SSE 分帧、认证头、Token 轮换与最终结果。`onChunk` 每次收到真实 `message` 增量块：

```javascript
var abortController = new AbortController();
var answer = '';
var result = await V8.AI.ChatStream({
  UserChatMsg: '生成一段客户回访建议',
  AiModel: 'MiniMax-M3',
  AiModelId: '当前租户 mic_ai 记录Id'
}, function (chunk) {
  answer += chunk;
  V8.Result = answer;
}, {
  Signal: abortController.signal
});
if (result.Code != 1) V8.Tips(result.Msg || 'AI调用失败', false);
```

复杂页面应把这段逻辑放进 MicroService 的 `services/ai.ts`，并用 `AbortController` 在页面关闭时取消浏览器读取；不要在多个按钮 V8 中复制完整 SSE 解析器。

### 后端 V8：直接使用 V8.AI

后端接口引擎与表单后端事件不再自请求 HTTP。`V8.AI` 会绑定当前执行租户与 `V8.CurrentUser`，并清除调用参数中的身份、Endpoint、ApiKey、`AllowedTables` 和服务端授权标记：

```javascript
var result = await V8.AI.Chat({
  UserChatMsg: String(V8.Param.Question || ''),
  AiModel: String(V8.Param.AiModel || ''),
  AiModelId: String(V8.Param.AiModelId || '')
});
return result;
```

匿名接口没有可信用户上下文时 `V8.AI` 返回 `Code=1001`。`NL2SQL` 继续按当前用户生成表白名单；`NL2V8/NL2V8Stream` 仅平台管理员可调用。不要把完整 Token、问题和回答写入日志。

### MCP 调用

外部 Agent 直接调用专用 Tool：

```text
microi_chat({
  question: "归纳当前工单",
  aiModel: "MiniMax-M3",
  aiModelId: "...",
  reasoningEffort: "low"
})
```

`microi_chat` 只暴露对话白名单参数，实际 `OsClient`、用户和 Token 来自当前 MCP 连接，HTTP 来源再由服务端归一；Tool 不接受 Endpoint、ApiKey、Authorization 或身份覆盖。它返回最终 `DosResult`，不冒充逐 token MCP 流。如果 Agent 本身需要模型协议流，使用 `/v1/chat/completions` 的 `stream:true`；平台事实写入仍调用对应 MCP 写工具并遵守确认与回读。

## AI 图片与音乐工作台

`/#/mic-ai-engine` 首屏直接展示 AI 对话、数据分析、AI 绘图、AI 音乐、AI 视频和模型管理，不再把媒体能力藏在“自动识别”里。AI 绘图采用简化的 Stable Diffusion 式工作台：左侧按创作、AI 编辑、人像/商品和精确处理选工具，中间只保留当前工具必需参数，右侧预览结果；手机端依次折叠为工具、参数、结果。

这里必须区分“对话/意图模型”和“媒体生成模型”：`MiniMax-M3` 负责理解与路由，图片由 `image-01` 生成；音乐新路由优先请求 `music-3.0`，已有供应商配置继续兼容 `music-2.6`，只有托管音乐接口明确返回 410 退役终态时才切到官方开源 `MiniMax-Music3`。部署时必须以目标账号实时可用的模型清单为准，不能让文本模型用说明文字冒充图片或音频。

| 能力 | 登录态入口 | 当前边界 | 结果与页面呈现 |
|---|---|---|---|
| 生成式图片 | `POST /api/Ai/GenerateMiniMaxImage` | `image-01`；文生图及最多 4 张主体参考图；支持图生图、重绘、扩图、消除、去水印、证件照、多图合成、上色、修复、商品场景等受控工具意图 | 参考图先进入当前租户私有 HDFS，只把短时签名地址交给供应商；结果重新下载、校验并写入当前租户公有 HDFS |
| 精确图片处理 | `POST /apiengine/platform-ai-runtime`，`Action=ProcessImage` | 黑白、纯色背景抠除、缩放、居中裁剪、旋转、翻转、格式转换和拼图；不消耗模型额度 | `V8.Image` 在服务端处理并写入当前租户公有 HDFS，返回可回读的尺寸、格式和永久地址 |
| 音乐 | `POST /api/Ai/GenerateMiniMaxMusic` | 当前仅管理员；托管新路由 `music-3.0`，兼容既有 `music-2.6` 配置，或明确 410 后的官方开源 `MiniMax-Music3`；无人声，开源回退时长 10～60 秒 | 托管结果为 MP3，开源结果为 WAV，采样率、声道、码率与时长按实际文件头回读；两者均校验后写入当前租户公有 HDFS并用原生播放器预览 |

生成式“消除、扩图、去水印、抠图”等目前是参考图 + 提示词重绘，不是像素级蒙版编辑；页面必须明确提示这一边界。要求确定像素结果时，应选择右侧标记为“精确”的 `V8.Image` 工具。

图片请求示例：

```http
POST /api/Ai/GenerateMiniMaxImage
Content-Type: application/json
Authorization: <当前吾码登录 Token>

{
  "RequestId": "image:conversation-id:message-id",
  "Operation": "image-to-image",
  "Prompt": "一张现代办公室团队协作的横版插画",
  "Model": "image-01",
  "AspectRatio": "16:9",
  "Count": 1,
  "ReferenceImages": [
    { "FileName": "subject.webp", "DataUrl": "data:image/webp;base64,..." }
  ]
}
```

参考图只允许 JPEG、PNG、WebP，单张最多 10MiB、合计最多 24MiB。自定义尺寸必须在 512～2048 之间且为 8 的倍数。供应商临时图片地址不能直接作为最终结果返回。

音乐请求示例：

```http
POST /api/Ai/GenerateMiniMaxMusic
Content-Type: application/json
Authorization: <当前吾码管理员登录 Token>

{
  "RequestId": "music:conversation-id:message-id",
  "Prompt": "轻快、克制、适合产品演示的科技感纯音乐",
  "Model": "music-3.0",
  "DurationSeconds": 20,
  "IsInstrumental": true,
  "SampleRate": 44100,
  "Bitrate": 256000,
  "Format": "mp3"
}
```

两类请求都必须使用稳定 `RequestId`。服务端按当前 `OsClient + 用户 + RequestId` 做共享幂等；相同请求可回放，参数冲突或上游结果不确定时不能换随机 Id 盲目重试。供应商 Key、图片 Base64、音频十六进制和中转站真实密钥都不能返回浏览器。

音乐入口会先创建持久后台任务，返回 `Code=2` 和 `Data.TaskId`。继续调用 `GET /api/Ai/GetMiniMaxMusicTask?taskId=<原任务号>`，直到返回 `Code=1 + Permanent=true + FileUrl`；`Failed`、`Uncertain` 是需要处理的终态，不应一直显示“正在生成”。刷新页面或停止等待只结束前端等待，后台任务继续执行；重复提交必须保留原 `RequestId` 与全部参数。

若 Music3 事件流或文件下载中断，系统保存原供应商任务号及完成文件地址。状态中的 `CanRecoverResult=true` 表示可以点击“恢复原配乐结果”，或调用 `POST /api/Ai/RecoverMiniMaxMusicTask?taskId=<原任务号>`；恢复只读取既有生成结果，不再次作曲。旧请求若没有保存供应商回执，仍会保留不确定状态，不能凭超时推断已扣费或自动另开请求。

吾码中转节点采用 `POST /v1/microi/music_tasks`、`GET /v1/microi/music_tasks/{taskId}` 的异步协议，使用受保护的平台 API Key 和稳定 `Idempotency-Key`。调用节点、中转节点、Core/AI/API 和前端均需更新，安装 AI 助手应用包本身不会替换平台二进制。

### 媒体预览与文件地址

生成成功后，浏览器只消费服务端返回的 `FilePath`、`FileUrl`、`ContentType`、文件大小等附件元数据：

- 公有 HDFS 附件优先使用**当前运行租户**的 `sys_config.FileServer + FilePath` 生成最终 URL。不能写死官网域名，也不能继续沿用另一个租户或旧环境返回 URL 的域名前缀。
- 图片使用 `<el-image :preview-src-list="[url]" preview-teleported>` 在当前页面放大、缩放和关闭；图片卡片不能再套 `target="_blank"` 跳到新浏览器页面。
- 音频使用 `<audio controls preload="metadata">` 原页播放并显示真实时长，同时提供读取同一已校验 HDFS 地址的明确下载按钮；加载失败应显示接口或媒体错误，不能只输出“已生成”。
- AI 文本回答继续经过安全 Markdown 渲染；图片、音频、视频是结构化附件，不通过拼接 Markdown/HTML 来绕过 URL 与内容类型校验。

MiniMax 已于 2026-08-20 停止向新用户提供付费 Music/Lyrics API，并停止原免费模型服务。吾码仍优先兼容已具备 `music-3.0` 权限的现有账号；仅在上游明确返回 410 时切换官方开源 `MiniMax-Music3` Space。公开 Space 有 ZeroGPU 配额，生产节点可在既有服务端 `mic_ai` 模型配置中增加 `MiniMax-Music3` 路由、固定官方 Space Endpoint，并把 Hugging Face Token 存入受保护 ApiKey 字段；不得新增前端 Key、Compose 环境变量或 API `AppSettings`。上游未开通、配额不足或停用时应返回可诊断失败，不得生成伪音频、重复扣减或把文本回答冒充音乐成功。

## MiniMax 视频生成

吾码把 MiniMax 视频接入放在 `Microi.AI`，而不是让每个接口引擎各自保存 Key、拼接异步任务协议。这里复用的是供应商级底层能力：服务端密钥隔离、MiniMax 创建/查询/下载三段协议、当前用户绑定、订阅额度保护和跨节点幂等；文章主题、业务提示词、定时触发和内容平台分发仍由接口引擎、Job 或 Agent 编排。

MiniMax 当前采用异步流程：创建任务返回 `task_id`，查询成功后得到 `file_id`，最后再取得临时 `download_url`。吾码不会把两个原始 Id 下发给浏览器，而是返回绑定当前用户、用途和供应商 Key 的 `TaskHandle` / `FileHandle`。

### 配置边界

- MiniMax Token Plan Key 与按量 API Key 是两套独立凭据。把实际使用的 Key 配置到现有服务器端 AI Provider/ApiKey 受保护数据中，不要放进前端、V8 源码、Compose 环境变量或 API `AppSettings`。
- 租户优先使用已启用的 MiniMax 直连 Provider，官方 API Base 必须是 `https://api.minimaxi.com`。直连不可用时可以使用现有 `Microi.AI中转站` 配置，Base 固定为 `https://api.itdos.com/v1`；系统拒绝把视频请求转发到其它 Host。
- 当前 Token Plan 使用统一用量条、5 小时滚动窗口和周窗口，实际剩余额度以控制台为准；服务端不把“每天 2 条”或“每天 3 条”硬编码成供应商权威配额。若运营工作区明确要求每日最多 3 条，可以增加更保守的业务门禁，并在界面中明确它不是 MiniMax 官方剩余额度。
- 当前官方模型边界：`MiniMax-Hailuo-2.3` 支持文生/图生；`MiniMax-Hailuo-2.3-Fast` 只支持图生并要求首帧；首尾帧使用 `MiniMax-Hailuo-02`。Hailuo 2.3 清晰优先使用 6 秒 / 1080P，时长优先使用 10 秒 / 768P，两者不能同时最大；安全默认值仍为 6 秒 / 768P。

### 登录态 API

创建任务：

```http
POST /api/Ai/CreateMiniMaxVideo
Content-Type: application/json
Authorization: <当前吾码登录 Token>

{
  "RequestId": "article:2026-08-09:pm:douyin:v1",
  "Prompt": "Two adult engineers naturally discuss a release checklist in a modern office [固定].",
  "Model": "MiniMax-Hailuo-2.3-Fast",
  "Duration": 6,
  "Resolution": "1080P",
  "FirstFrameImage": "https://example.com/inspected-office-first-frame.png"
}
```

`RequestId` 是业务幂等键，不是随机重试号。创建前，服务端会在当前租户共享 Redis 中按 `OsClient + 当前用户 + RequestId` 原子占位：相同参数回放返回同一 `TaskHandle`，同一 Id 改参数会被拒绝；Redis 不可用或上游结果不确定时失败关闭，防止多节点/网络重试重复消耗日额度。

查询任务：

```http
POST /api/Ai/GetMiniMaxVideoTask
Content-Type: application/json

{ "TaskHandle": "<创建接口返回的签名句柄>" }
```

终态 `Status=Success` 时会返回 `FileHandle`。正常流程应立即把视频转存到当前租户 HDFS：

```http
POST /api/Ai/PersistMiniMaxVideoFile
Content-Type: application/json

{ "FileHandle": "<任务查询返回的签名句柄>" }
```

服务端会校验签名句柄、HTTPS 公网来源、文件大小和 MP4 文件头，再写入当前租户文件服务；成功返回永久 `FileUrl`。只有旧节点或转存故障诊断时才获取临时下载地址：

```http
POST /api/Ai/GetMiniMaxVideoFile
Content-Type: application/json

{ "FileHandle": "<任务查询返回的签名句柄>" }
```

后台 `/#/mic-ai-engine` 的管理员【AI视频】页读取 `mci_ai_content_asset`，可以创建、刷新、预览、审核和下载视频；生成中的记录按任务句柄轮询，完成后优先调用 `PersistMiniMaxVideoFile` 转存当前租户 HDFS，再用 `<video controls preload="metadata">` 原页播放，并通过明确的下载按钮读取同一个已校验文件地址。对话记录仍由 `mic_ai_record` 提供。临时/永久下载地址只代表视频生成或持久化完成，不代表已经发布到抖音、快手或其它平台。分发端仍要执行目标平台的上传、字段校验、dry-run、一次正式发布、任务详情和公开页面回读，并按平台规则如实标记 AI 生成内容。

当租户经 `Microi.AI中转站` 创建视频时，中转节点使用 `/v1/video_generation`、`/v1/query/video_generation`、`/v1/files/retrieve` 对接 MiniMax 协议；创建请求必须带稳定 `Idempotency-Key`。平台 ApiKey 只允许查询自己创建的原始 `task_id` / `file_id`，中转节点只访问直连官方 Provider，不能递归调用自己。

### 内容质量边界

用于技术内容分发时，推荐先生成并检查办公室首帧，再做 6 秒 768P 图生视频。画面可表现 25 岁以上、职业着装的成年人自然讨论设计、调试、发版、数据或 AI 工作流；不要性感化人物、模仿名人或冒充真实员工。若需要低调品牌露出，只把准确的 `Microi吾码` 作为背景墙上一处小型静态环境文字，禁止口播推荐、价格、二维码、促销按钮、Logo 动画或反复叠加品牌。

生成后必须验片。墙面文字错误、人脸/手部明显畸变、广告感强或内容不安全时不得进入发布流程。

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

## PC 与移动端统一 AI 助手

PC 顶栏助手和移动端助手复用 `mci_ai_data_assistant` 的 `Bootstrap`、会话及问答协议。业务快捷问题由启用的 `mci_ai_data_domain.PromptExamples` 动态产生；没有业务数据权限时，接口返回常规问答建议，不能在前端硬编码另一套业务问题。应用商城的 AI助手包同时包含业务域初始化数据和最新接口引擎源码。

### 所有角色默认可对话

从 AI助手 **v7.7.1** 起，所有已登录账号默认可以进行常规 AI 对话，包括未分配角色或没有业务数据权限的账号。没有数据权限只表示不能查询业务数据，不表示不能使用 AI助手。

**v7.7.2** 同时补齐只读角色的接口入口：助手使用 `$authenticated` 授权标记并保持禁止匿名调用，带有“仅查询”限制的客户也能聊天和管理自己的对话记录。原角色的业务只读限制不变，其它接口不会因此开放。

在 **AI模型管理 → 基础配置 → 所有角色可常规对话** 设置 `AllowAllRolesChat`。默认开启，存量空值也按开启处理；关闭后，该模型只供已明确授权的角色使用。此设置不会授予菜单、客户资料、订单、SQL 或管理员权限，模型仍必须启用且配置有效，调用仍受供应商可用性和额度限制。

系统设置中的“关闭AI助手图标”只控制入口显示，与模型对话开放设置和业务数据授权分开管理。普通角色没有数据策略或原策略模型已经失效时，仍可使用当前开放模型常规对话；恢复业务分析需要管理员核对角色的数据域、行级范围和模型白名单。

`Bootstrap` 独立返回 `Enabled`、`ChatEnabled` 和 `CanQueryData`。没有数据权限时显示“常规对话”，业务域列表为空；没有有效模型时提示检查模型配置，不再提示“当前角色未开通 AI助手”。常规对话不查询业务表或全库 Schema，也不将历史数据分析内容放入无权限问答上下文。多角色的数据范围按每个数据域及所选模型独立校验。

### 官方应用包归属与兼容

- 官方增量应用的事实源固定为 `app.microi.ai-engine`。从 v6.3.6 起，包内 `SysApiEngines` 是严格四项闭包：Managed `mci_ai_data_assistant`、Managed `platform-ai-account`、Managed `platform-ai-runtime`，以及租户拥有、策略为 `CreateIfMissing` 的应用级 `platform-ai-custom-hook`。三个 Managed 接口都必须带醒目的“安装、更新或重新安装会恢复官方源码”提示；租户只能在 Hook 中编写个性化逻辑。
- `platform-ai-runtime` 统一编排 `UpdateConversationTitle / RecognizeIntent / Chat / NL2SQL / NL2V8EngineSync` 五个非流式动作，新客户端直接调用 `/apiengine/platform-ai-runtime` 并传固定 `Action`；旧 `/api/Ai/*` 同名路由只做兼容转发。`ChatStream`、流式 `NL2V8Engine`、Provider Proxy、媒体、文件和策略元数据仍保持原生传输/安全边界。
- 支付宝回调的 C# 只选择并归一化可信租户、按该租户读取密钥验签、校验签名内 `app_id` 并形成不含签名/密钥的可信元数据，随后只调用一次 `platform-ai-account/CompletePayment`。订单条件认领、金额核对、订阅续期或新建、平台 Key 与默认供应商 Key 分配都在同一个接口引擎事务中完成；重复的同一订单/交易返回幂等成功，客户端不能直接伪造 `CompletePayment`。
- 数据助手与非流式运行时调用 Hook 时只发送 `Stage / SourceApiEngineKey / Action`；支付动作最多增加 `EventId / Provider`，账户其它动作只发送白名单资源元数据。Hook 不接收订单号、交易号、金额、问题、提示词、回答、标题、SQL、模型、附件、平台或供应商 Key、供应商任务号、文件句柄及媒体内容。
- 原 AI助手包夹带的 12 个 `ai_app_*` 接口——`ai_app_list`、`ai_app_detail`、`ai_app_get_file`、`ai_app_save_file`、`ai_app_create`、`ai_app_build`、`ai_app_preview`、`ai_app_download_source_zip`、`ai_app_download_build_zip`、`ai_app_moveobject_probe`、`ai_app_moveobject_exec_probe`、`ai_app_publish_store`——归 `app.microi.store` 维护。v6.3.5 只把它们从 AI助手安装包的资源选择和所有权声明中移除，不会删除目标租户已经存在的运行时接口记录；既有记录继续由应用商城包按其 Managed 策略升级，禁止用 AI助手升级执行破坏性清理。
- AI助手包正式拥有 9 张 `mic_sub_*` 订阅表，以及 `mci_ai_token_account`、`mci_ai_token_log` 两张用量表。每张表都必须同时提供 DDL、PhysicalColumns、DiyTables、DiyFields，日志表必须包含 `PromptPreview`；`mci_ai_token_recharge` 不在当前 C# 运行时实体闭包中，不能因为某个线上库存在同名表就擅自打入应用包。
- `Sys_User.AiApiKey` 不属于 AI助手包，而由 `app.microi.sys_user` 系统账号包统一提供建表 DDL、物理列和隐藏只读的低代码字段。AI助手运行时发现该列缺失时，会明确提示升级系统账号应用；请求路径不会自动改表。
- v6.3.5 会从 AI助手包的 DDL、PhysicalColumns、DiyTables、DiyFields、DataSets 各层移除重复的 `mci_ai_app_version`、`mci_ai_app_file`、`sys_microistore`，由 Store/SaaS 既有平台包维护；当前仅 AI助手包拥有的 `app_mic_aiapp`、`mci_ai_app` 继续保留。
- v6.3.6 要求后端同时提供 `V8.Method.ManageAiPlatform`、一次性 `V8.Method.RequireManagedProtocolContext` 与租户/用户绑定的 `V8.AI` 非流式原子（含 `UpdateConversationTitle`）。后端缺少任一能力时应在应用安装预检阶段失败关闭，不能只安装接口后留下运行期半可用状态。

普通角色进行业务数据分析时，必须通过 `mci_ai_role_policy` 明确配置数据范围、业务域和模型；常规对话不要求先建立这些策略。平台只对后端可信的 `V8.CurrentUser.Level >= 9999` 提供安装后的数据分析安全兜底：动态读取目标租户当前启用的业务域与模型，使用 `All` 范围，但仍关闭原始 SQL并默认隐藏敏感字段。禁止根据客户端参数、账号名称或前端路由判断超级管理员，也不能把发布租户的角色 Id、模型 Id 固化进安装包。

商城发布后的验收至少包含：回读 `sys_microistore.AppVersion/AppPakcet`；确认包内 `mci_ai_data_assistant` 版本和快捷问题数据；再以目标租户超级管理员真实调用 `Bootstrap`，断言 `Enabled=true`、模型非空且快捷问题可见。只看到发布接口成功不算完成。

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

## Schema 启动加载、租户范围与缓存位置

::: tip 先看结论
后端启动时不会扫描“主租户 + 全部子租户”的所有物理数据库表和字段。SaaS 引擎会挂载符合条件的租户运行配置，但 AI Schema 启动预热只处理当前配置主租户；子租户在第一次使用 NL2SQL、NL2V8 等 Schema 检索能力时按需加载。
:::

这三个阶段容易被混为一谈：

| 阶段 | 租户范围 | 实际加载内容 | 是否属于 AI Schema |
|---|---|---|---|
| SaaS 引擎启动挂载 | `sys_osclients` 中启用、未删除，且 `OsClientType`、`OsClientNetwork` 匹配当前节点并成功挂载的租户 | 租户运行配置、主数据库访问对象、Redis 等基础设施配置，保存到当前进程的 `OsClientExtend.ClientList` | 否。`ClientList` 有这个租户，不代表表字段已经进入 AI 索引 |
| AI Schema 启动预热 | 仅 `GetConfigOsClient()` 返回的配置主租户；为空时回退默认租户 | 低代码表、字段和菜单元数据的关键词索引；仅在当前节点在线 AI License 校验通过后执行 | 是 |
| 子租户首次 AI 分析 | 当前请求经过登录态和服务端租户解析后绑定的 `OsClient` | 该子租户自己的 Schema 关键词索引；启用向量模式时再加载该租户的向量索引 | 是，按需惰性加载，不在启动时全量预热 |

子租户配置异常时，SaaS 启动会记录错误并继续处理其它子租户；因此“`sys_osclients` 中存在记录”也不等于该租户一定已成功挂载。

### AI 实际读取的 Schema

AI 的在线 Schema 事实源不是数据库的 `INFORMATION_SCHEMA`，而是当前租户低代码元数据：

- `diy_table`：未删除表的 Id、物理表名和表说明。
- `diy_field`：未删除字段的 Id、所属表、字段名、标题、类型和备注。
- `sys_menu`：未删除且已绑定 `DiyTableId` 的菜单名称，用于补充业务语义。

当前实现单次读取每类元数据的上限是 50,000 条。只有已经登记到 `diy_table`、`diy_field` 的结构才会进入 AI Schema；仅在数据库中手工创建、但没有低代码元数据的物理表或字段不会自动出现。开发者本地的 `.microi-db-schema.md` 属于 VS Code/MCP 的本地快照，也不是在线 Microi.AI 的运行时数据源。

### 加载后保存在哪里

平台没有把 Schema 再复制到一张独立的 AI 业务表。关键词模式使用两级缓存，可选向量模式再增加 Qdrant：

| 层级 | 保存内容 | Key、隔离与有效期 | 作用 |
|---|---|---|---|
| 租户数据库 | `sys_menu`、`diy_table`、`diy_field` 原始元数据 | 由当前 `OsClient` 对应数据库隔离 | 权威事实源 |
| Redis L2 | 原始 `List<TableSchemaInfo>`，包含表、字段、菜单语义和可检索文本 | `Microi:{OsClient}:AiSchemaKeywordIndex:{FormEngineAuthzVersion}`，当前有效期 10 分钟 | 多 API 节点共享，避免重复读取全量元数据 |
| 进程内 L1 | 基于上述列表构建的关键词倒排索引 | 同一版本化 Key，当前有效期 2 分钟 | 当前节点快速检索；可随进程退出丢失 |
| Qdrant（可选） | Schema 文本的向量与表/字段元数据 Payload | 仅 `EnableVectorDatabase=1` 时使用；HTTP 默认 collection 为 `microi_schema_v2_http_768`，每个 point 带 `os_client`、`table_id` 等租户过滤字段 | 只补充模糊语义召回，不能替代数据库事实源或权限校验 |

Qdrant 还保留 gRPC 兼容 collection `microi_schema_v2_grpc_384`。无论使用哪种向量通道，确定性 point Id 都由“租户 + 表 Id”生成，查询必须带 `os_client` 过滤。`EnableVectorDatabase` 缺失、为空或为 `0` 时，运行时不会连接、初始化或同步 Qdrant/Ollama/Embedding。

::: warning Schema 缓存不是业务数据缓存
Redis 和 Qdrant 只保存表字段说明等结构索引，不会把订单、客户、金额等业务行数据预先复制进去。真正的数据分析 SQL 仍在请求发生时查询当前租户数据库。
:::

### Microi.AI 数据分析如何使用这些信息

1. 服务端从登录态和可信请求上下文确定当前 `OsClient`、用户和角色，客户端不能自行指定其它租户。
2. 服务端根据当前租户 `diy_table`、AI 角色策略和 FormEngine 读取权限生成精确表白名单，并排除平台控制表和带通用 NL2SQL 无法安全还原的行级范围表。
3. Schema 搜索按当前租户读取 L1/L2；没有命中时回源该租户数据库并建立缓存。子租户的第一次请求就是在此处完成惰性加载。
4. 关键词候选和可选向量候选都再次与精确白名单取交集，只把少量相关表字段放进模型 Prompt。
5. 模型生成 SQL 后，服务端继续校验单条只读 `SELECT`、所有 `FROM`/`JOIN` 表、危险语法、最大行数和超时。
6. 校验通过后才在当前租户数据库实时执行；Schema 索引负责“找表和字段”，不负责保存或返回业务事实。

### 结构变更何时生效

关键词索引复用 Redis 中的 FormEngine 授权/结构版本 `Microi:{OsClient}:FormEngineAuthz:Version`。通过标准 FormEngine 流程修改 `sys_menu`、`diy_table`、`diy_field`、角色或用户授权时会推进版本，旧版本缓存随即不再被新请求命中，下一次请求会建立新索引。

Redis 不可用或无法取得版本时，服务端直接回源当前租户数据库，不沿用版本未知的旧索引。若绕过 FormEngine 直接执行 SQL 修改元数据，版本可能不会立即变化；在 L1/L2 到期、服务重启或显式刷新前可能仍看到旧 Schema，因此平台结构维护应优先使用标准低代码/FormEngine 入口。

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
