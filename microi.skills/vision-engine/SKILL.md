---
name: vision-engine
description: 设计、实现、配置、扩展和验收视觉引擎能力。处理 Microi.Vision、V8.Vision、ONNX Runtime、图片或视频帧、商品或物体样本库优先匹配、平台 AI 异步回退、人脸特征与关注人员合规、platform-vision-runtime、microi-vision 前端微服务和应用商城交付时使用。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# 视觉引擎

## 先读取相关规范

- 涉及完整表、字段、菜单和权限交付时，读取 `../microi-system-delivery/SKILL.md`。
- 涉及接口引擎业务逻辑时，读取 `../v8-crud-api/SKILL.md` 与 `../v8-api-config/SKILL.md`。
- 涉及图片上传、私有 HDFS 或保留清理时，读取 `../v8-file-upload/SKILL.md`。
- 涉及 AI 回退时，读取 `../ai-engine/SKILL.md`；涉及持久异步任务时读取 `../job-engine/SKILL.md`。
- 涉及人脸、关注人员、日志、租户或特征向量时，读取 `../v8-security/SKILL.md` 与 `../v8-saas-multi-tenant/SKILL.md`。
- 涉及全新工作台时，读取 `../microi-microservice/SKILL.md`、`../microi-frontend-sdk/SKILL.md`、`../ui-design/SKILL.md` 与 `../playwright-e2e/SKILL.md`。
- 涉及官方应用包时，读取 `../app-store/SKILL.md`。

## 固定架构

用户可见的应用、菜单、页面和文档标题统一使用中性名称“视觉引擎”；`Microi.Vision`、`V8.Vision` 和 `microi-vision` 仅作为程序集、API 与 AppKey 等技术标识，不得把“Microi 视觉识别”作为租户界面的固定品牌名称。

Microi.Vision 是可信 .NET 宿主中的最小视觉原子层，只负责：

1. 有界 JPEG/PNG/WebP 解码；
2. 只从受控模型目录按 `ModelKey` 加载 `model.json + *.onnx`；
3. 校验模型路径、大小、任务类型、输入参数和 SHA-256；
4. 用 ONNX Runtime 执行检测、分割、Embedding/FaceEmbedding，并按已安装运行库选择 CPU、CUDA、TensorRT、OpenVINO 或 DirectML；
5. 对检测框做人脸五点对齐或对象裁剪，归一化向量并执行 HNSW 近邻检索；
6. 提供 IoU 目标跟踪、连续帧投票和有界帧流入口。

商品/人员表、样本查询、阈值、状态机、AI 回退、业务日志和租户 Hook 必须留在接口引擎。不能把这些逻辑搬入 C# Controller/Service，也不能让 V8 指定模型路径、执行提供程序、Endpoint、API Key、摄像头凭据或其它 OsClient。

固定组件：

| 组件 | 策略 | 职责 |
|---|---|---|
| `platform-vision-runtime` | `Managed` | Recognize/Enroll/Result/Recent/Bootstrap/Capabilities |
| `platform-vision-ai-worker` | `Managed` | 持久任务消费、Microi.AI 视觉调用、回写与敏感图片清理 |
| `platform-vision-category-options` | `Managed` | 当前租户启用分类选项 |
| `platform-vision-subject-options` | `Managed` | 当前租户启用对象选项 |
| `platform-vision-custom-hook` | `CreateIfMissing` | 租户自己的低敏业务扩展，官方升级永不覆盖 |
| `microi-vision/workbench` | MicroService | 图片、摄像头帧、连续模式、来源状态、样本录入 |

详细数据、状态、协议和验收规范见 [architecture-and-acceptance.md](references/architecture-and-acceptance.md)。

## 数据库优先，AI 异步回退

识别顺序不可颠倒：

1. 生成稳定 `RequestId`，先按 `RequestNo` 做幂等读取；
2. 用当前策略的 `PipelineKey/ModelKey` 调用 `V8.Vision.Analyze`，先检测/分割，再对每个目标生成特征；
3. 只查询当前租户 `Status=Ready`、`Mode` 和 `ModelKey` 一致的样本；
4. 解保护候选向量，调用 `V8.Vision.Search` 执行 HNSW 近邻检索；
5. 连续视频调用 `V8.Vision.Stabilize` 做会话级投票；达阈值返回 `Status=LocalMatched, MatchSource=Database`；
6. 未达阈值且 AI 关闭，返回 `Status=Unmatched, MatchSource=None`；
7. AI 开启时先保存私有输入并创建共享后台任务，立即返回 `Status=AiPending`；
8. Worker 收敛到 `AiMatched` 或 `Failed`，前端用同一 `RequestNo` 轮询。

不得同步阻塞前端等待大模型，不得把 AI 结果自动写入可信对象主数据，也不得把本地相似度与 AI 置信度混成一个分数。

## V8 原子函数

```js
var analyzed = await V8.Vision.Analyze({
  FileByteBase64: V8.FilesByteBase64['frame'],
  FileName: 'frame.jpg',
  PipelineKey: 'general-yolox-dinov2-v1',
  Mode: 'General',
  FrameId: 'camera-01-000123',
  StreamSessionId: 'scale-01-session-42',
  FrameSequence: 123
});

var ranked = await V8.Vision.Search({
  QueryEmbeddingBase64: analyzed.Data.Detections[0].EmbeddingBase64,
  Candidates: candidates,
  Threshold: 0.82,
  TopK: 5,
  EfSearch: 80,
  IndexKey: 'ready-general-samples'
});

var voted = await V8.Vision.Stabilize({
  StreamSessionId: 'scale-01-session-42',
  FrameId: 'camera-01-000123',
  Key: ranked.Data.Matches.length ? ranked.Data.Matches[0].Key : '__unmatched__',
  Confidence: ranked.Data.Matches.length ? ranked.Data.Matches[0].Similarity : 0,
  WindowSize: 5,
  MinimumVotes: 3
});
```

主流流水线方法：`V8.Vision.Analyze`、`V8.Vision.Search`、`V8.Vision.Stabilize`；兼容原子方法：`Extract`、`ExtractBatch`、`Compare`、`CompareBatch`、`GetCapabilities`。业务入口优先使用 `V8.ApiEngine.Run('platform-vision-runtime', ...)`，不要把向量返回给普通浏览器或日志。

## 模型与准确率门禁

- 默认 `builtin-visual-fingerprint-v1` 只是相同/近似样图指纹，不能称为语义分类器或人脸模型。
- 内核已经实现 YOLOv8/YOLOX/RT-DETR/SCRFD 常见 ONNX 输出适配、DINOv2/DINOv3/SigLIP2 类嵌入、ArcFace 类人脸嵌入、HNSW、IoU 跟踪和连续帧投票；生产结果取决于实际安装的受控模型包与门店数据，不得把“已兼容”写成“模型准确率已通过”。
- 模型代码许可证、权重许可证、训练数据限制和商用授权必须分别核对；`model.json` 的 `License` 字段不是法律结论。
- 每个模型包固定版本、输入尺寸、RGB/BGR、Mean/Std、池化、来源、许可证和 SHA-256；不允许浮动 URL 在线下载后直接加载。
- 模型必须在目标 CPU/GPU、真实镜头、光照、角度和包装变化下建立标注集，测 Top-1/Top-K、误接受率、误拒绝率、P50/P95/P99、内存和人工复核率。
- 没有真实模型包与标注结果时，只能说“平台接入完成/指纹联调通过”，不能说“商品或人脸识别准确率通过”。
- ONNX Runtime 是主流部署运行时，但运行时主流不等于所装模型第一梯队；未测真实标注集与目标硬件 P50/P95/P99 前，不得宣称准确率或速度第一梯队。

## 人脸与关注人员强制边界

- 录入、识别、留存和共享生物特征前必须有合法依据、告知/同意、用途限制、访问控制和删除流程。
- 工作台 Face 模式必须要求本次明确同意；前端门禁不能替代后端校验。
- 人脸模板和请求按当前租户隔离；向量使用绑定租户和接口引擎的保护能力保存，列表/Hook/普通日志不返回正文。
- 默认 `RetainFaceInput=0`；AI Worker 无论成功失败都清理临时图片。
- 数据库未命中时，大模型只能描述中性可见事实，不得猜姓名、罪犯身份、族群、健康、政治等敏感属性。
- “罪犯/关注人员”命中仅是人工复核线索，不能单独触发抓捕、处罚、解雇、拒绝服务或身份认证。
- 身份认证仍使用 DiyToken、Passkey/严格人脸一次性票据和原有权限体系；视觉相似度不能替代登录或强身份验证。

## 视频入口

前端使用 `getUserMedia` 并按 `FrameIntervalMs` 取帧，必须提供开启、暂停、继续、再次识别和关闭操作；每次打开摄像头生成新的 `StreamSessionId`，每帧递增 `FrameSequence`。可信边缘宿主将 RTSP/WebRTC 解码为 `IAsyncEnumerable<MicroiVisionExtractParam>` 后调用 `RecognizeFramesAsync`。Microi.Vision 不直接连接调用方提交的 RTSP URL，不保存摄像头账号，不承担流媒体服务器职责。

连续帧必须有：最大图片大小、最小间隔、单客户端串行、取消/停止、RequestId 幂等、网络退避和后台任务去重。不能每个视频帧都无界调用大模型。

## 交付顺序

1. 更新并测试 Microi.Vision、V8 注入与 API DI；
2. 用 MCP `microi_plan_system` 做 dry run，再生成并 `microi_validate_system`；
3. 同步私有微服务源码，构建后按 V3 stage/finalize 发布公开产物并回读；
4. 写入默认分类/策略，按业务 Key 先查后写；
5. 发布框架 NuGet/Docker，使目标运行时实际包含 `V8.Vision`；
6. 通过官方应用发布引擎生成商城包，明确 `Managed/CreateIfMissing`，回读包 SHA 和不可变版本；
7. 在目标租户安装/更新后做真实浏览器、接口、后台任务和模型测试；
8. 分别报告源码、包、制品、部署、浏览器、模型准确率和物理摄像头边界。

`Microi.Vision` 必须作为独立闭源仓维护：`Microi.Anderson.sln` 使用 `ProjectReference`，公开 `Microi.net.sln` 只能使用同版本 NuGet；一键发布必须像 `Microi.AI`、`Microi.WorkFlow` 一样对 DLL 执行 Obfuscar、回写 nupkg，并以加密前后哈希变化及 `.microi-encrypted` 清单为门禁。模型权重继续独立分发，不进入 NuGet。

## 禁止事项

- 禁止用 HTTP 200、构建成功、Mock UI、同一图片命中代替真实商品/人脸准确率。
- 禁止把大模型标签伪装成数据库命中或权威身份。
- 禁止在接口参数中接受模型目录、任意本地路径、任意网络地址或执行提供程序。
- 禁止把图片 Base64、原始人脸、向量、提示词、AI Key 写入 Hook 或普通日志。
- 禁止用进程内队列、`static` 字典或本地文件作为 AI 任务完成事实源。
- 禁止在应用升级时覆盖 `platform-vision-custom-hook`。
- 禁止只发布商城包却宣称旧平台运行时已经具备 `V8.Vision`。

## 验收输出

最终报告至少分开列出：源码测试、5 表/字段/索引、7 菜单、5 引擎/4 事件、微服务源码与构建哈希、商城包与版本、框架制品、目标节点版本、真实浏览器、真实图片素材来源、数据库命中、AI 回退、人脸同意、模型准确率和未执行的物理设备测试。
