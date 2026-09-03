# 👁️ 视觉引擎

视觉引擎的可信 .NET 技术组件名为 `Microi.Vision`。它接收 JPEG、PNG、WebP 图片或已经取出的连续视频帧，使用受控 ONNX 模型生成视觉特征；接口引擎再优先与当前租户的样本库匹配，未命中时立即返回“未匹配 / AI 识别中”，并按租户策略异步调用平台 AI 引擎。后台应用、菜单和工作台统一显示中性名称“视觉引擎”，不会强制显示 Microi 或吾码品牌。

:::: tip 先看结论
商品、鱼类、蔬菜、建筑和经合法授权的人脸都使用同一条“样本录入 → 特征提取 → 数据库匹配 → 可选 AI 回退”链路。默认内置模型只是零部署近似图片指纹，适合联调和相同/近似样图；生产语义识别或人脸比对应安装经过许可证与数据集评估的 ONNX 模型包。
::::

## 用户名称与技术组件

“视觉引擎”覆盖物体、商品、人员、建筑和以后扩展的工业缺陷等视觉任务，不只限定某个零售领域；`Microi.Vision` 只作为程序集、命名空间与开发 API 名称。职责分层如下：

| 层 | 负责 | 不负责 |
|---|---|---|
| `Microi.Vision` .NET 类库 | 有界图片解码、ONNX Runtime、检测/分割、人脸对齐、特征向量、HNSW、IoU 跟踪与连续帧投票 | 业务表、商品名称、人员身份、日志与 AI 提示词 |
| `V8.Vision` | 把最小原子能力安全暴露给当前租户接口引擎 | 允许脚本指定模型文件路径、执行提供程序或其它租户 |
| `platform-vision-runtime` | 样本库优先匹配、状态机、私有文件、后台任务、业务 Hook | 训练模型或把密钥交给前端 |
| `platform-vision-ai-worker` | 对未命中图片调用 Microi.AI，回写最终结果并清理敏感输入 | 把人脸模型猜测当成真实身份 |
| `platform-vision-custom-hook` | 留给租户追加日志、写业务表、触发通知等低敏元数据逻辑 | 接收图片、向量、AI 提示词或身份敏感信息 |
| `microi-vision` 前端微服务 | 图片上传、摄像头取帧、连续识别、结果来源、样本录入 | 在浏览器内持有模型或伪造最终匹配结论 |

## 识别状态机

~~~text
图片 / 摄像头帧
        │
        ▼
Microi.Vision 检测/分割并提取目标特征
        │
        ▼
当前租户 Ready 样本 HNSW Top-K 比对
   ┌────┴──────────────┐
   │达到阈值           │未达到阈值
   ▼                   ▼
LocalMatched      AiPending / Unmatched
   │                   │ AI 开关开启
   │                   ▼
   │          持久后台任务调用 Microi.AI
   │                   │
   └──────────────► AiMatched / Failed
~~~

前端必须展示 `MatchSource`，不能把数据库相似度和 AI 置信度混成一个分数。HTTP 200 也不代表业务命中，必须同时判断 `Code`、`Status` 和 `MatchSource`。

| `Status` | `MatchSource` | 含义 |
|---|---|---|
| `Received` | `None` | 连续帧已分析，但投票尚未形成稳定结论 |
| `LocalMatched` | `Database` | 当前租户样本库达到阈值 |
| `AiPending` | `None` | 数据库未命中，AI 后台任务已受理 |
| `Unmatched` | `None` | 数据库未命中且 AI 回退已关闭 |
| `AiMatched` | `AI` | AI 返回一般物体/商品语义结果 |
| `Failed` | `None` | 流水线或 AI 调用失败，可按业务规则复核或重试 |
| `LowQuality` | `None` | 图片质量未达到策略下限，未进入判断 |

## 安装后的后台资源

官方“视觉引擎”应用安装到租户后，在“系统引擎”下创建一个父菜单“视觉引擎”和六个子菜单：

| 菜单 | 资源 | 用途 |
|---|---|---|
| 识别工作台 | 新前端微服务 `microi-vision/workbench` | 上传、摄像头、连续帧、结果和样本录入 |
| 识别对象 | `mci_vision_subject` | 商品、鱼类、人员、建筑等可识别业务对象 |
| 视觉样本库 | `mci_vision_sample` | 对象图片、模型版本、受保护特征和质量状态 |
| 对象分类 | `mci_vision_category` | 商品、生鲜水产、蔬菜、肉类、人员、建筑等分类树 |
| 识别记录 | `mci_vision_request` | 数据库命中、AI 处理中、AI 结果、耗时和清理状态 |
| 识别配置 | `mci_vision_profile` | 模型 Key、阈值、Top-K、视频间隔、AI 回退和保留策略 |

核心接口引擎为 `platform-vision-runtime`，动作包含 `Bootstrap`、`Capabilities`、`Dashboard`、`Subjects`、`Recognize`、`Enroll`、`Result` 和 `Recent`。AI Worker 与四个核心/选项引擎由商城应用以 `Managed` 策略维护；`platform-vision-custom-hook` 必须声明为 `CreateIfMissing`，升级不能覆盖租户自己的业务代码。

## 快速使用

### 录入识别对象

先在“识别对象”录入业务事实，例如：

- 对象编号：`FISH-CARP-001`
- 对象名称：`鲤鱼`
- 所属分类：`生鲜水产`
- 对象类型：`Product`
- 识别模式：`General`

人员对象应使用 `ObjectType=Person`，保存事件会强制切换到 `RecognitionMode=Face`。人员分类只能选择 `Face` 或 `All` 识别域。

### 录入样本

不要直接在“视觉样本库”表单中粘贴向量。进入“识别工作台”，选择对象并上传清晰、来源合法、角度有代表性的图片，调用 `Enroll`：

```javascript
var result = await V8.ApiEngine.Run('platform-vision-runtime', {
  Action: 'Enroll',
  SubjectId: '对象Id',
  FileName: 'carp-side.jpg',
  FileByteBase64: V8.FilesByteBase64['sample']
});
return result;
```

样本目标由 `V8.Vision.Analyze` 检测/对齐后生成对象级向量，再使用绑定当前租户和当前接口引擎的保护能力保存；旧宿主在升级窗口内才兼容回退到 `V8.Vision.Extract`。公开结果、Hook 和列表默认都不返回向量正文。

### 单图识别

```javascript
var result = await V8.ApiEngine.Run('platform-vision-runtime', {
  Action: 'Recognize',
  RequestId: V8.Method.NewUlid(),
  Mode: 'General',
  FileName: 'scale-camera.jpg',
  FileByteBase64: V8.FilesByteBase64['frame']
});

if (result.Code !== 1) return result;

if (result.Data.Status === 'AiPending') {
  // 先把“样本库未命中，AI 识别中”展示给用户，再按 RequestNo 轮询 Result。
}
return result;
```

同一个 `RequestId` 重试会读取原请求，不重复入队。AI 任务使用共享数据库后台任务，不依赖单机内存队列。

### 连续视频帧

浏览器使用 `getUserMedia` 打开前置或后置摄像头，按 `FrameIntervalMs` 将画面压缩成 JPEG 帧后调用 `Recognize`。工作台提供开启、暂停、继续、再次识别和关闭；每次开启建立新的 `StreamSessionId`，每帧递增 `FrameSequence`，静止画面在浏览器端直接跳过，服务端按 TrackId 做连续帧投票。手机浏览器必须使用 HTTPS（localhost 调试除外）。可信 .NET 宿主也可把 RTSP/WebRTC 解码后的帧流传给：

```csharp
IAsyncEnumerable<DosResult<MicroiVisionExtractResult>> results =
    vision.RecognizeFramesAsync(frames, "general-dinov2-v1", "General", cancellationToken);

IAsyncEnumerable<DosResult<MicroiVisionAnalyzeResult>> detectedResults =
    vision.AnalyzeFramesAsync(pipelineFrames, "retail-yolox-siglip2-v1", "General", cancellationToken);
```

Microi.Vision 不直接接受调用方传入的任意 RTSP URL、摄像头账号或网络 Header。摄像头协议、断线重连和取帧留在可信宿主或边缘网关，可避免 SSRF、凭据泄漏和 API 进程长期持有视频连接。

## V8.Vision 原子能力

`V8.Vision` 只允许选择宿主已经安装并完成 SHA-256 校验的 `ModelKey`：

```javascript
var analyzed = await V8.Vision.Analyze({
  FileByteBase64: V8.FilesByteBase64['image'],
  FileName: 'fish.jpg',
  PipelineKey: 'general-yolox-dinov2-v1',
  Mode: 'General',
  FrameId: 'camera-01-000123',
  StreamSessionId: 'scale-01-session-42',
  FrameSequence: 123
});

var ranked = await V8.Vision.Search({
  QueryEmbeddingBase64: analyzed.Data.Detections[0].EmbeddingBase64,
  Candidates: candidateVectors,
  Threshold: 0.82,
  TopK: 5,
  EfSearch: 80,
  IndexKey: 'ready-general-samples'
});

var stable = await V8.Vision.Stabilize({
  Observations: recentTrackObservations,
  MinimumVotes: 3,
  WindowSize: 5,
  MinimumAverageConfidence: 0.55
});
```

| 方法 | 作用 | 硬边界 |
|---|---|---|
| `Analyze` | 检测/分割、多目标特征、人脸对齐与跟踪 | 只允许宿主安装且 SHA-256 通过的 PipelineKey |
| `Search` | HNSW 近邻检索 | 有界候选、TopK、EfSearch；小集合自动精确回退 |
| `Stabilize` | 连续帧多数投票 | 按租户、会话与 TrackId 隔离，窗口和 TTL 有界 |
| `Extract` | 单图提取特征 | JPEG/PNG/WebP，默认解码前 16 MB |
| `ExtractBatch` | 一次提取有界帧批次 | 默认最多 12 帧；仍逐帧取消检查 |
| `Compare` | 比较两个同维向量 | 余弦相似度，阈值必须在 0～1 |
| `CompareBatch` | 对候选集排序 | 默认最多 2,000 个候选、TopK 最多 50 |
| `GetCapabilities` | 返回模型、任务类型、许可证和就绪状态 | 不返回模型目录或宿主路径 |

完整签名见 [V8 函数－后端](../v8-engine/v8-server.md#v8-vision)。一般业务优先调用 `platform-vision-runtime`，只有编写自定义接口引擎时才直接组合原子函数。

## 模型与准确率

类库使用 [ONNX Runtime C#](https://onnxruntime.ai/docs/get-started/with-csharp.html) 和图优化执行推理。模型包目录必须包含 `model.json` 和同目录 `.onnx` 文件，描述输入尺寸、RGB/BGR、均值、标准差、池化方式、来源、许可证和不可变 SHA-256。

当前内核已实现主流工程链路：YOLOv8/YOLOX/RT-DETR/SCRFD 常见检测输出、对象裁剪与人脸五点对齐、DINOv2/DINOv3/SigLIP2 类嵌入、ArcFace 类人脸嵌入、HNSW、IoU TrackId、连续帧投票，以及 CPU/CUDA/TensorRT/OpenVINO/DirectML 执行提供程序选择。它属于第一梯队常见的架构方向，但“架构已实现”不等于“任意模型与任意门店都达到第一梯队准确率”。

2026-09-03 的可复现鱼类负面基准使用 10 种鱼、每类 1 张独立样本和 1 张不同测试图：DINOv2-S INT8 为 Top-1 `3/10`、Top-3 `7/10`，CPU 热态端到端均值 `98.8 ms`、P95 `115 ms`；SigLIP2-B/16 INT8 为 Top-1 `4/10`、Top-3 `4/10`，CPU 热态均值 `92.2 ms`、P95 `103 ms`。因此，通用预训练向量 + 单样本不满足商超投产门禁；必须增加真实秤台多角度样本，微调鱼类/包装数据，并在目标硬件重新标定。完整素材、许可、逐项结果和失败项见仓库 `AI-Project/microi/vision/TEST-REPORT.md`。

生产建议建立独立模型基线：

| 场景 | 建议路线 | 注意事项 |
|---|---|---|
| 通用商品/物体 | DINOv3/DINOv2、SigLIP2 等视觉嵌入模型导出 ONNX，使用真实门店样本做近邻匹配 | 模型代码、权重、训练数据和商用许可证分别审核；DINOv3 不能沿用 DINOv2 的许可证结论 |
| 多物体与秤面分离 | 安装经业务数据微调的 YOLO/RT-DETR 检测或分割模型，内核逐目标生成特征 | COCO 通用权重没有鱼种细分类，不能直接当商超成品 |
| 人脸 | 安装 SCRFD/同级检测与 ArcFace embedding，并启用活体检测 | InsightFace 代码与其官方预训练权重许可不是同一件事；商用权重必须单独审核 |
| 未知物体语义 | Microi.AI 视觉模型异步回退 | AI 标签是模型输出，不会自动写成可信商品主数据 |

模型名称不能代替验收。每个门店/摄像头应使用独立标注集测量 Top-1、Top-K、误接受率、误拒绝率、P50/P95 延迟和人工复核率；阈值按模型版本、镜头、光照和业务风险校准。内置 `builtin-visual-fingerprint-v1` 只适合同图/近似图联调，不得对外宣称为跨角度商品识别或生产人脸识别。YOLOX + DINOv2 的真实 ONNX 流水线已用官方示例图跑通多框、对象级特征和 TrackId，但该回归只验证解析/推理链路，不是鱼种准确率证明。

## 闭源源码与 NuGet 边界

`Microi.Server/Microi.Vision/` 与 `Microi.AI`、`Microi.WorkFlow` 一样是独立闭源仓，只允许推送到公司内部 GitLab。创建人使用 `Microi.Anderson.sln` 时由 `ProjectReference` 加载源码；普通用户使用公开 `Microi.net.sln` 时只解析同版本 `Microi.Vision` NuGet 包。

根目录 `Microi一键编译发布.sh` 已把 `Microi.Vision` 纳入与 AI/Workflow 相同的 Obfuscar 清单：发布目录先混淆 DLL，再替换 nupkg 内原 DLL；缺少 `.microi-encrypted` 记录、混淆前后哈希不变或包内 DLL 哈希不一致都会阻止发布。模型权重独立部署，不进入源码仓和 NuGet。

## 人脸与关注人员边界

人脸模板属于高敏感生物特征：

- 录入前必须有合法处理依据、告知/同意、用途限制、访问控制和删除流程；
- 工作台在人脸模式下要求本次明确同意，不能靠默认勾选代替；
- 样本、特征、请求记录严格绑定当前租户，普通响应不返回受保护向量；
- 默认不保留人脸识别输入，AI Worker 完成或失败后都清理临时图片；
- 未命中人脸时，Microi.AI 只允许返回可见的中性描述，不得猜测真实姓名、罪犯身份、族群、健康、政治等敏感属性；
- “关注人员/涉案人员”命中只能作为人工复核线索，不能单独作为处罚、抓捕、解雇或身份认证依据；
- 高风险动作仍需菜单/表/行权限、状态机、人工复核、幂等与不可篡改审计。

## AI 回退与数据保留

`AiFallbackEnabled` 默认开启，`FaceAiFallbackEnabled` 可单独关闭。数据库未命中时先返回 `AiPending`，让收银或监控页面保持响应；后台任务把私有临时图片交给当前租户配置的 Microi.AI 模型，完成后更新同一识别记录。

AI 回退关闭时返回 `Unmatched`，不产生外部模型调用。调用失败返回 `Failed`，不能把网络错误改写成“未识别到商品”。通用图片按 `RetainInputDays` 清理；人脸模式默认立即删除输入。样本原图的长期保留需由业务管理员另行制定权限和期限。

## 应用商城交付

“视觉引擎”官方应用包应包含 5 张表、字段与索引、4 个表单事件、7 个父子菜单、管理员权限、5 个接口引擎、默认分类/策略数据，以及 `microi-vision` 微服务版本引用。安装后仍需要平台运行时版本包含 `Microi.Vision` 与 `V8.Vision`；只安装应用包不能替代 .NET/NuGet/Docker 升级。

应用包必须声明：

```json
{
  "ResourcePolicies": {
    "ApiEngines": {
      "platform-vision-runtime": "Managed",
      "platform-vision-ai-worker": "Managed",
      "platform-vision-category-options": "Managed",
      "platform-vision-subject-options": "Managed",
      "platform-vision-custom-hook": "CreateIfMissing"
    }
  }
}
```

## 上线验收清单

- [ ] 当前租户 5 张表、全部字段、12 个业务索引和 7 个父子菜单均远端回读通过；
- [ ] `microi-vision/workbench` 的私有源码清单、公开构建清单、路由和哈希一致；
- [ ] `V8.Vision.GetCapabilities()` 明确区分内置指纹和生产模型包；
- [ ] 同一图片录入后再识别返回 `LocalMatched/Database`，相似度达到配置阈值；
- [ ] 未知图片先返回 `AiPending`，随后同一 `RequestNo` 收敛为 `AiMatched` 或 `Failed`；
- [ ] 摄像头可暂停、继续、再次识别和关闭，`StreamSessionId/FrameSequence` 连续且静止帧不会反复提交；
- [ ] 关闭 AI 后未知图片直接返回 `Unmatched`，没有后台任务；
- [ ] 摄像头单帧与连续帧能停止、恢复，不会无限并发或重复入队；
- [ ] 工作台跟随宿主租户主题色、浅色/深色即时切换，且至少通过一个非默认主题色的真实浏览器视觉验收；
- [ ] 人脸未明确同意时前端阻止提交，后端也执行独立校验；
- [ ] 向量、图片 Base64、模型路径、AI 密钥和敏感身份不出现在公开响应或普通日志；
- [ ] 真实标注集记录准确率、误接受/误拒绝、P95 延迟和人工复核率；
- [ ] 源码测试、商城发布、平台制品发布、目标节点升级和真实浏览器验收分别留证。

## 相关文档

- [V8.Vision 后端 API](../v8-engine/v8-server.md#v8-vision)
- [AI 引擎](./ai-engine.md)
- [前端微服务](./micro-app.md)
- [应用商城](./app-store.md)
- [任务调度](./job.md)
- [分布式存储](../more/hdfs.md)
- [平台安全与兼容基线](../more/security.md)
