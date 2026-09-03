# Microi.Vision 架构与验收参考

## 表模型

| 表 | 主业务键 | 关键字段 |
|---|---|---|
| `mci_vision_category` | `CategoryNo` | Name、Scope、ParentId、Sort、Enabled |
| `mci_vision_subject` | `ObjectNo` | Name、CategoryId、ObjectType、RecognitionMode、ThresholdOverride、ReviewRequired |
| `mci_vision_sample` | `SampleNo` | SubjectId、Mode、ImagePath、EmbeddingBase64、ModelKey、QualityScore、Status |
| `mci_vision_request` | `RequestNo` | Mode、Status、MatchSource、StreamSessionId、FrameSequence、DetectionsJson、StabilityJson、AI 字段、耗时 |
| `mci_vision_profile` | `ProfileKey` | 两类 ModelKey/Threshold、TopK、CandidateLimit、HnswEfSearch、连续投票、AI 开关、取帧间隔、保留策略 |

数据库隔离租户的业务表物理层可能没有 `OsClient` 列；建索引前必须以 `microi_get_db_schema` 和物理索引回读为准。若当前部署是共享表租户模型，才把真实租户字段放到唯一索引前缀，不能机械套用。

## 推荐索引

独立租户库基线：

- category: unique `(CategoryNo)`；普通 `(ParentId, Sort)`；
- subject: unique `(ObjectNo)`；普通 `(CategoryId, RecognitionMode, Enabled)`；
- sample: unique `(SampleNo)`；普通 `(ModelKey, Mode, Status)`、`(SubjectId)`；
- request: unique `(RequestNo)`；普通 `(Status, CreateTime)`、`(SubjectId, CreateTime)`；
- profile: unique `(ProfileKey)`；普通 `(IsDefault, Enabled)`。

## 状态与来源

| Status | MatchSource | Terminal | 说明 |
|---|---|---:|---|
| `Received` | `None` | 否 | 连续帧已处理，投票尚未稳定 |
| `LocalMatched` | `Database` | 是 | 当前模型版本样本达到阈值 |
| `AiPending` | `None` | 否 | 后台任务已接受 |
| `Unmatched` | `None` | 是 | 未命中且 AI 关闭 |
| `AiMatched` | `AI` | 是 | AI 标签已回写 |
| `Failed` | `None` | 是 | 本地流水线或 Worker 最终失败 |
| `ManualReview` | `None` | 是 | 高风险场景需要人工复核 |
| `LowQuality` | `None` | 是 | 低于质量阈值 |

`Status` 与 `MatchSource` 必须一起返回。AI 成功不应填充 `SubjectId`，除非后续人工确认并通过正常业务接口绑定。

## Runtime 请求

### Recognize

```json
{
  "Action": "Recognize",
  "RequestId": "稳定幂等键",
  "Mode": "General",
  "ProfileKey": "default",
  "FrameId": "camera-01-000123",
  "StreamSessionId": "scale-01-session-42",
  "FrameSequence": 123,
  "Continuous": true,
  "ResetStream": false,
  "FileName": "frame.jpg",
  "FileByteBase64": "...",
  "ConsentConfirmed": false
}
```

Face 模式必须 `ConsentConfirmed=true`；服务端不能只信任前端 checkbox。

### Result

```json
{ "Action": "Result", "RequestNo": "稳定幂等键" }
```

轮询应在终态停止，并使用指数或有界间隔；页面卸载、取消或新帧覆盖旧帧时应中止旧轮询。

### Enroll

```json
{
  "Action": "Enroll",
  "SubjectId": "当前租户对象Id",
  "FileName": "sample.jpg",
  "FileByteBase64": "...",
  "ConsentConfirmed": true
}
```

服务端读取对象的 Category/Mode，不能信任调用方自行提交 SubjectName、CategoryName 或 ModelKey。

## 公开结果最小字段

允许返回：RequestNo、FrameId、StreamSessionId、FrameSequence、Mode、Status、MatchSource、SubjectId/Name、CategoryId/Name、LocalSimilarity、Confidence、对象框/TrackId、Stability、AiLabel/Category/Description/Candidates、ModelKey/Version、ImageWidth/Height、QualityScore、RequestedAt、CompletedAt、ElapsedMs、ErrorMessage。

禁止返回：EmbeddingBase64、InputFilePath、图片 Base64、模型磁盘路径、AI Provider Key、系统提示词、后台任务内部载荷。

## 模型包 model.json

```json
{
  "SchemaVersion": 1,
  "ModelKey": "general-dinov2-v1",
  "ModelVersion": "1.0.0",
  "TaskType": "Embedding",
  "FileName": "model.onnx",
  "Sha256": "64位十六进制",
  "InputName": "input",
  "OutputName": "embedding",
  "InputWidth": 224,
  "InputHeight": 224,
  "ResizeMode": "CenterCrop",
  "ChannelOrder": "RGB",
  "Mean": [0.485, 0.456, 0.406],
  "Std": [0.229, 0.224, 0.225],
  "OutputPooling": "ClsToken",
  "Provider": "ONNX Runtime",
  "License": "按实际模型/权重填写",
  "SourceUrl": "权威来源"
}
```

流水线模型包可声明 `TaskType=Detection/Segmentation/FaceDetection/Pipeline` 并引用受控 detector/embedding；目前支持 YOLOv8、YOLOX、RT-DETR、SCRFD 常见张量布局，Face 模型使用 `TaskType=FaceEmbedding`。人脸必须经过检测和五点对齐，不能用简单 resize 伪装完成对齐。

## 测试矩阵

### .NET 单元/契约

- 合法 JPEG/PNG/WebP 提取与维数归一化；
- 非法 Base64、伪造格式、超大图片、像素炸弹拒绝；
- 路径穿越、错误 SHA、超大模型、不支持任务类型拒绝；
- 相同向量、相反向量、维数不一致、TopK、候选上限；
- YOLO/YOLOX/RT-DETR/SCRFD 解码、NMS、对象裁剪、人脸五点对齐；
- HNSW 精确回退、缓存指纹、IoU TrackId、连续帧窗口与最少票数；
- CPU 及目标部署环境实际可用的 CUDA/TensorRT/OpenVINO 提供程序；
- Face/General 与 TaskType 不匹配拒绝；
- V8 租户上下文覆盖调用参数；
- 能力返回不泄漏模型磁盘路径。

### 接口引擎

- 同 RequestId 幂等；
- 数据库优先且 AI 不入队；
- 未命中 + AI 开启立即返回 AiPending；
- Worker 成功/失败/重复消费收敛；
- AI 关闭直接 Unmatched；
- 低质量不进入匹配；
- 受保护向量只能在同租户同核心引擎解开；
- Hook 不接收敏感载荷且 CreateIfMissing 不被升级覆盖。

### 浏览器

- 已登录真实菜单打开 MicroService，不是独立 Mock 页面；
- 桌面、窄屏、暗色、键盘焦点和文字对比度；
- 上传预览、清除、重复选择、错误格式/超限；
- 摄像头授权拒绝、成功、暂停、继续、再次识别、关闭与卸载清理；
- Database/AiPending/AI/Unmatched/LowQuality/AiFailed 状态；
- FaceConsent 默认未勾选，未同意按钮禁用且后端拒绝；
- Console/PageError/失败请求为 0 或逐项解释。

### 准确率

至少分离 train/reference 与 test，测试集不能复用完全相同文件充当准确率。商品需覆盖角度、包装、遮挡、数量、背景、秤盘和光照；鱼类需覆盖鲤鱼/鲫鱼等相近类；人脸需覆盖姿态、光照、遮挡并按同意范围采样。

报告：样本数、类别数、Top-1、Top-K、混淆矩阵、阈值、FAR、FRR、P50/P95/P99、硬件、模型/权重版本与失败样本。完全相同图片命中只能算协议/回归测试，不计为泛化准确率。

## 发布证据

分别保存：

- 源码路径与测试命令；
- NuGet 包清单和公共源回读；
- Docker tag/digest 与匿名回读；
- MCP 表/字段/索引/菜单/引擎/事件回读；
- MicroService SourceManifestHash、RuntimeManifestHash、RouteSnapshotHash 与 committed version；
- 应用商城 PackageSha256、PackageSize、StoreVersionId、ResourceSnapshotHash；
- 目标平台版本、实例重启、真实登录浏览器截图；
- 素材 URL、许可证、作者/署名要求、本地 SHA-256；
- 未完成的模型包、物理摄像头、GPU 或生产部署边界。
