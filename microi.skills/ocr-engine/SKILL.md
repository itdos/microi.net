---
name: ocr-engine
description: 为 Microi 吾码集成、配置、调用和验收通用 OCR 能力。处理 V8.OCR、/api/ocr、PaddleX/PaddleOCR 服务、SaaS 租户 OCR 配置、图片或 PDF 文字识别、OCR 安全边界、Docker 部署和多节点交付时使用。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi OCR 引擎

## 先读取相关规范

- 涉及租户配置时，读取 `../v8-saas-multi-tenant/SKILL.md`。
- 涉及外部 OCR 服务时，读取 `../v8-http-integration/SKILL.md`。
- 涉及 Base64、上传文件或私有文件时，读取 `../v8-file-upload/SKILL.md`。
- 涉及权限、密钥、日志或匿名接口时，读取 `../v8-security/SKILL.md`。
- 涉及数据库字段和表单 Tab 时，读取 `../microi-db-schema/SKILL.md`。

## 固定架构

Microi 后端只实现统一 OCR 网关、租户隔离、协议适配和安全治理，不在 .NET 进程内训练或维护 OCR 模型。默认提供方为独立部署的 PaddleX OCR 服务；业务代码只能调用 `IMicroiOcr`、`V8.OCR` 或 `/api/ocr/recognize`，不得直接读取 SaaS 密钥并自行拼接 HTTP 请求。

同步识别必须绑定当前请求和当前租户。批量、超大文件或长耗时 OCR 应进入共享数据库/MQ/outbox，以全局任务 Id 做幂等；不得把任务状态、队列或锁只放在单机内存中。

## SaaS 配置

配置位于 `sys_osclients` 的独立“OCR识别”Tab：

| 字段 | 用途 | 默认值 |
|---|---|---|
| `OcrEnabled` | 租户总开关，默认关闭 | `0` |
| `OcrProvider` | `PaddleX` 或 `PaddleXHighStability` | `PaddleX` |
| `OcrEndpoint` | OCR 服务完整接口地址 | 空 |
| `OcrApiKey` | 可选 Bearer 密钥，只允许后端使用 | 空 |
| `OcrHeadersJson` | 可选服务端固定请求头 JSON | 空 |
| `OcrTimeoutSeconds` | 单次超时秒数 | `60` |
| `OcrMaxFileMB` | 单文件大小上限 | `20` |
| `OcrMaxPages` | PDF 页数上限 | `10` |
| `OcrMinConfidence` | 返回文本最低置信度 | `0` |

这些配置不得投影到 `V8.OsClientModel`，不得由前端请求覆盖，不得写入普通日志。没有启用、没有 endpoint 或配置无效时必须失败关闭。

## 调用

接口引擎或后端表单事件中：

```js
var result = await V8.OCR.Recognize({
  FileByteBase64: V8.FilesByteBase64.invoice,
  FileName: 'invoice.png',
  UseDocOrientationClassify: true,
  UseDocUnwarping: true,
  UseTextlineOrientation: true,
  TextRecScoreThresh: 0.5,
  ReturnWordBox: false
});

if (result.Code !== 1) {
  return result;
}

return {
  Code: 1,
  Data: {
    Text: result.Data.Text,
    Pages: result.Data.Pages,
    Provider: result.Data.Provider
  }
};
```

ASP.NET 客户端调用 `POST /api/ocr/recognize`，请求体与 `V8.OCR.Recognize` 一致，并携带正常登录 Token。`OsClient` 以 Token 解析结果为准。

标准成功结果包含 `Provider`、`Text`、`Pages`、`ElapsedMilliseconds`。每页包含 `PageIndex`、`Text`、`Regions`，每个区域包含 `Text`、`Confidence` 和归一化后的 `Polygon`。

## 协议与输入边界

- `PaddleX` 使用基础服务协议 `POST /ocr`。
- `PaddleXHighStability` 使用 KServe 协议 `POST /v2/models/ocr/infer`。
- 接受 PDF、PNG、JPEG、BMP、GIF、TIFF、WebP；同时检查文件扩展名、Base64 和文件魔数。
- 固定 `visualize=false`，避免服务返回大体积可视化图片。
- 由服务端限制文件大小、超时、PDF 页数、响应体大小和最低置信度。
- 禁止接受调用方传入 endpoint、API key、任意请求头、代理地址或本地文件路径，防止 SSRF 和密钥绕过。
- 日志只记录租户、提供方、状态码、耗时和安全裁剪后的错误，不记录文件 Base64、识别原文、API key 或完整响应。

## Docker 与多节点

- OCR 模型服务独立部署，固定 PaddleX/PaddlePaddle/模型版本；不要使用浮动 `latest` 直接上线。
- CPU 基线位于 `../../Microi.Server/Microi.OCR/deploy/paddlex/`，固定 PaddleX 3.6.1 与 PaddlePaddle 3.2.2；公开镜像固定为 `registry.cn-hangzhou.aliyuncs.com/microios/paddlex-ocr:3.6.1-paddle3.2.2-cpu`，当前只交付 `linux/amd64`。PaddlePaddle 3.3.0 存在 CPU oneDNN PIR 推理兼容问题，在完成真实图片回归前不得升级。
- 发布镜像使用同目录 `publish-image.ps1`：它从根目录发布配置读取凭据，通过隔离 Docker 配置和 `--password-stdin` 登录，推送后退出并匿名回读公开摘要。不得在命令行、日志或文档中展开用户名/密码，也不得只凭 `docker push` 返回成功就宣布国内镜像可用。
- 发布镜像时执行 `create_pipeline("OCR")` 预置默认产线模型。运行时使用 named volume 挂载 `/home/microi/.paddlex`，让 Docker 首次创建卷时从镜像复制模型；不要改成空宿主机 bind mount，否则会遮住镜像内的预置模型并触发重新下载。
- OCR 宿主机端口只绑定 `127.0.0.1`；Docker 化 API 与 OCR 同时加入 external bridge 网络 `microi-ocr`，一键安装的内部 endpoint 固定为 `http://microi-install-ocr:8080/ocr`。不得通过公网/LAN 回环调用同机 OCR。
- `install-microi.sh` 默认安装 OCR。必须依次满足“固定镜像拉取并回读为 amd64 → OCR healthy → API liveness → Upgrade29 的 9 个物理字段数据库回读 → 唯一活动主租户 → 配置写入后回读 → API 重启 readiness”才设置 `OcrEnabled=1`；任一步失败都保持失败关闭。API liveness 后立即回读字段，每秒一次且最多 15 秒；正常升级应首轮命中，镜像过旧或迁移失败应快速报错，禁止无意义等待 5 分钟。不要用安装脚本直接伪造 `diy_field` 元数据绕过 Upgrade29。
- API/Web 官方浮动 `latest` 必须在 Compose 启动时强制回源拉取，避免旧本机镜像通过 liveness 却缺少 Upgrade29。字段门禁失败后可以输出已生成端口、密码、目录和容器状态供恢复，但必须明确标记“安装未完成”、保留非零退出码，并显示 OCR SaaS 配置未完成；恢复汇总不是启用 OCR 的依据。
- OCR 使用固定不可变版本，不加入只跟踪 API/Web 浮动标签的 Watchtower 自动更新列表；升级镜像时先发布新 tag、匿名回读 digest/架构，再修改 Compose 与安装器。
- 登录国内镜像源必须从本机发布配置读取凭据并走 `docker login --password-stdin`，不得输出密码。推送成功不是发布验收，必须使用隔离的匿名 Docker config 回读 manifest/digest，必要时再做匿名拉取。
- 不要在内存不足的共享开发机上直接构建模型镜像。构建前检查物理内存、Docker 占用与同类进程；保留至少 `max(6 GB, 物理内存 20%)`，不足时延后构建而不是停止他人服务。
- API 多节点共享同一个或同一组 OCR endpoint；每节点仅保留无状态 `HttpClient`。
- OCR 服务至少配置 readiness、并发上限、CPU/GPU 资源上限、请求体上限和访问控制。
- GPU 推理采用独立 Worker/服务池，避免 OCR 模型抢占 Microi API 内存。
- 滚动升级时保持旧新 OCR 响应协议兼容；协议变更先扩展解析器，再升级服务。

## 验收门禁

交付时分别报告：

1. 源码：网关、V8、REST、SaaS 字段、密钥投影隔离是否齐全。
2. 定向测试：基础协议、高稳定协议、低置信度过滤、错误响应、配置隔离。
3. 数据库：目标 `OsClient` 的 Tab、字段和物理列经 MCP 写后回读。
4. 服务：真实 PNG/JPEG/PDF 至少各一例，包含中英文、旋转和多页场景。
5. 多节点：两个 API 节点同时调用，同租户限制一致，服务故障时均能超时/降级且不泄漏密钥。
6. UI：SaaS 配置表单能查看独立 Tab、保存配置，密码字段不出现在普通前端上下文。

没有真实 OCR endpoint、服务版本和样例识别结果时，只能声明“平台接入完成、运行验收待配置”，不能声明生产 OCR 已可用。
