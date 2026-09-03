# 📄 OCR 识别引擎

Microi.OCR 是吾码面向业务图片和 PDF 的统一文字识别引擎。它把文件校验、租户隔离、模型服务访问、超时与容量限制、结果归一化放在可信后端，业务只需通过 V8、HTTP 或 MCP 调用同一份稳定协议。

:::: tip 先看结论
单张图片或普通 PDF 使用同步 OCR 即可；合同批量入库、票据归档等长耗时任务应使用数据库、MQ 或 outbox 建立可恢复任务。业务代码不得直接拼接 OCR 服务地址或读取密钥。
::::

## 它解决什么问题

OCR 引擎负责把图片或 PDF 转成“全文 + 分页 + 文本区域 + 置信度 + 坐标”的结构化结果，适合：

- 发票、收据、合同、证照、申请表和扫描档案的文字提取；
- PDF 多页文本提取、全文检索预处理和归档辅助；
- 拍照上传后的方向校正、文档展平和文本行方向识别；
- 通过区域坐标高亮原图文字，或交给后续接口引擎提取业务字段；
- 由 AI/MCP 在用户明确授权后读取本地文档文字。

| 能力 | OCR 引擎负责 | 业务系统继续负责 |
|---|---|---|
| 文本识别 | 全文、分页、区域、置信度、坐标 | 发票号码、金额、姓名等业务字段映射 |
| 文件防护 | 格式、Base64、文件魔数、大小和页数校验 | 上传权限、附件归属、保留期限 |
| 多租户 | 按当前登录租户读取服务地址和策略 | 菜单、表、行级权限与业务审批 |
| 模型服务 | 统一适配 PaddleX 基础与高稳定协议 | 模型精度评测、算力规划和扩缩容 |
| 运行方式 | 单文件同步识别 | 批量任务、幂等、重试、人工复核 |

OCR 只输出识别结果，不自动断言文本真实无误，也不等于票据验真、身份证联网核验或电子签章验证。登录验证码的生成与可选识别由 `Microi.Captcha` 承担，与业务文档 OCR 是两条独立能力链。

## 工作原理

~~~text
文件上传 / 已登录客户端 / MCP
              │
              ▼
V8.OCR.Recognize 或 platform-ocr-recognize
              │
              ▼
Microi.OCR：租户绑定、输入校验、限额、认证、结果归一化
              │
              ▼
独立 PaddleX/PaddleOCR 服务：CPU、GPU 或服务池
~~~

| 层 | 职责 | 信任边界 |
|---|---|---|
| 业务层 | 选择文件、触发识别、消费结果 | 只能传文件和识别选项 |
| 官方 Managed 接口 | 为 PC、移动端、外部登录客户端提供稳定 HTTP 路由 | 以验证后的 DiyToken 租户为准 |
| `V8.OCR` | 为接口引擎提供租户绑定能力 | 调用方不能覆盖租户、地址、密钥或 Header |
| `Microi.OCR` | 校验文件、读取 SaaS 配置、调用供应商、裁剪响应并记录 Trace | 只在可信 .NET 后端运行 |
| PaddleX 服务 | 加载模型并执行推理 | 建议只允许 API 内网访问 |

模型不加载到每个 Microi API 节点中。多个无状态 API 节点可以访问同一 OCR 服务池，模型扩容、CPU/GPU 选择和 API 扩容因此可以独立进行。

## 选择调用入口

| 场景 | 推荐入口 | 原因 |
|---|---|---|
| 接口引擎、表单后端事件、Job | `V8.OCR.Recognize` | 保存即生效，可继续编排 FormEngine、流程和通知 |
| PC、UniApp、第三方已登录应用 | `POST /apiengine/platform-ocr-recognize` | 官方稳定路由，统一鉴权与租户绑定 |
| Codex、VS Code、其它 MCP 客户端 | `microi_ocr_recognize` | 支持本地绝对路径，并有显式授权与安全审计 |
| 可信平台 .NET 扩展 | `IMicroiOcr.RecognizeAsync` | 复用相同校验、租户配置和返回模型 |

普通业务不要直接调用 `http://microi-ocr:8080/ocr`。否则会绕过租户开关、文件上限、密钥隔离、统一错误、Trace 和升级兼容。

## 快速启用

### 第一步：部署 OCR 服务

使用吾码 Docker 一键安装时，OCR 是默认附加能力。脚本创建 `microi-install-ocr` 独立编排，容器健康且 SaaS 字段与配置回读通过后才启用当前主租户；失败会保留日志并明确标记“OCR 未启用”，不会伪装成可用。

源码部署可使用仓库中的固定 CPU 基线：

~~~bash
cd Microi.Server/Microi.OCR/deploy/paddlex
docker compose -f compose.cpu.yml pull
docker compose -f compose.cpu.yml up -d --no-build
docker compose -f compose.cpu.yml ps
~~~

当前基线为 `PaddleX 3.6.1 + PaddlePaddle 3.2.2`、`linux/amd64`，镜像已经预置默认 OCR 产线模型。Compose 默认使用 4 CPU、8 GB 内存、4 GB 共享内存，并把宿主机诊断端口限制为 `127.0.0.1:18080`。

检查服务健康：

~~~bash
curl http://127.0.0.1:18080/health
docker compose -f compose.cpu.yml ps
~~~

:::: warning 容器地址不要混用
API 在宿主机运行时使用 `http://127.0.0.1:18080/ocr`；API 与 OCR 在同一个 `microi-ocr` Docker 网络时使用 `http://microi-ocr:8080/ocr`；一键安装编排中的 API 使用 `http://microi-install-ocr:8080/ocr`。宿主机不能直接解析 Docker 服务名。
::::

完整的一键安装顺序、ARM64/GPU 边界和网络编排见 [Docker 部署（一键安装）](../getting-started/docker-run.md)。

### 第二步：配置当前租户

管理员进入 `SaaS引擎 → OCR识别`，配置下列字段：

| 字段 | 用途 | 默认或限制 |
|---|---|---|
| `OcrEnabled` | 当前租户总开关 | 默认 `0`，失败关闭 |
| `OcrProvider` | 上游协议 | 默认 `PaddleX` |
| `OcrEndpoint` | 完整服务地址 | 必填；仅后端读取 |
| `OcrApiKey` | 可选 Bearer 密钥 | 未在固定 Header 提供 Authorization 时使用 |
| `OcrHeadersJson` | 可选固定 Header JSON | 最多 20 个 Header |
| `OcrTimeoutSeconds` | 单次上游调用超时 | 默认 60 秒，范围 1～300 秒；一键安装写入 120 秒 |
| `OcrMaxFileMB` | Base64 解码后的单文件上限 | 默认 20 MB，平台硬上限 100 MB |
| `OcrMaxPages` | 接受的最大返回页数 | 默认 10 页，平台硬上限 100 页 |
| `OcrMinConfidence` | 租户最低识别置信度 | 0～1，默认 0 |

`OcrProvider` 支持：

| 配置值 | 上游协议 | 典型用途 |
|---|---|---|
| `PaddleX` | `POST /ocr` | 仓库 CPU 基线与普通单机/服务池 |
| `PaddleXHighStability` | `POST /v2/models/ocr/infer` | PaddleX 高稳定性 KServe 外层协议 |

`OcrApiKey`、`OcrHeadersJson` 和 `OcrEndpoint` 不会进入前端 `SysConfig` 或普通 `V8.OsClientModel`。配置保存后应刷新共享租户缓存，并从另一 API 节点复测，不能只看当前节点界面值。

### 第三步：做一次最小识别

先使用一张小型 PNG/JPEG 完成单页识别，再测试真实 PDF。成功返回 `Code=1`、非空 `TraceId`、`Text`、`PageCount` 和 `ElapsedMilliseconds`，才说明网关与模型链路真正可用；容器 `healthy` 本身不等于业务识别成功。

## V8 接口引擎调用

上传请求中的文件可从 `V8.FilesByteBase64` 读取。下面示例保留全文和区域结果，业务可在成功后继续写表或触发流程：

~~~javascript
var fileBase64 = V8.FilesByteBase64.invoice;
if (!fileBase64) {
  return { Code: 0, Msg: '请选择需要识别的发票图片。' };
}

var result = await V8.OCR.Recognize({
  FileByteBase64: fileBase64,
  FileName: 'invoice.png',
  UseDocOrientationClassify: true,
  UseDocUnwarping: true,
  UseTextlineOrientation: true,
  TextRecScoreThresh: 0.5,
  ReturnWordBox: false
});

if (!result || result.Code !== 1) {
  return result || { Code: 0, Msg: 'OCR 未返回结果。' };
}

return {
  Code: 1,
  Data: {
    Text: result.Data.Text,
    AverageConfidence: result.Data.AverageConfidence,
    PageCount: result.Data.PageCount,
    Pages: result.Data.Pages,
    TraceId: result.Data.TraceId
  }
};
~~~

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `FileByteBase64` | string | 是 | 文件 Base64；也接受标准 `data:*;base64,` 前缀 |
| `FileName` | string | 否 | 建议传安全文件名，最长 255 字符；扩展名必须与文件内容一致 |
| `UseDocOrientationClassify` | boolean | 否 | 启用文档整体方向分类 |
| `UseDocUnwarping` | boolean | 否 | 启用拍照文档展平/畸变校正 |
| `UseTextlineOrientation` | boolean | 否 | 启用文本行方向分类 |
| `TextRecScoreThresh` | number | 否 | 0～1；只能提高租户最低阈值，不能降低 |
| `ReturnWordBox` | boolean | 否 | 上游支持时返回字级框；普通全文识别可关闭以减小响应 |

支持 `PDF`、`PNG`、`JPEG/JPG`、`BMP`、`GIF`、`TIFF/TIF`、`WebP`。平台同时检查 Base64、文件魔数和扩展名，不能通过伪造后缀绕过格式限制。

完整 V8 方法索引见 [V8 函数－后端](../v8-engine/v8-server.md#v8-ocr)，文件接收与上传方式见 [接口引擎](../v8-engine/api-engine.md#接口配置) 和 [分布式存储](../more/hdfs.md)。

## HTTP 调用

已登录客户端调用官方 Managed 接口：

~~~http
POST {ApiBase}/apiengine/platform-ocr-recognize
Authorization: Bearer <DiyToken>
OsClient: <当前租户>
Content-Type: application/json

{
  "FileByteBase64": "<文件Base64>",
  "FileName": "contract.pdf",
  "UseDocOrientationClassify": true,
  "UseDocUnwarping": true,
  "UseTextlineOrientation": true,
  "TextRecScoreThresh": 0.55,
  "ReturnWordBox": false
}
~~~

该接口 `AllowAnonymous=0`，请求体中的 `OsClient` 会被忽略，以验证后的 DiyToken 租户为准。它不接受 Endpoint、Provider、API Key、Authorization 覆盖、任意上游 Header、代理地址或服务端文件路径。

`platform-ocr-recognize` 是“SaaS引擎”官方应用托管的 `Managed` 资源，不应直接写入个性化代码。若要在识别后提取合同编号、写入业务表或启动流程，请新建租户接口引擎，在其中调用 `V8.OCR.Recognize` 后继续编排。

官方 `platform-runtime-custom-hook` 只接收阶段、来源接口和结果码，不接收文件 Base64、识别原文、服务地址或密钥。因此它适合做轻量流程门禁，不适合承载识别结果解析。

## MCP 调用

吾码 MCP 的 `microi_ocr_recognize` 适合让 Codex、VS Code 或其它 MCP 客户端读取当前用户明确授权的本地图片/PDF。示例参数：

~~~json
{
  "filePath": "D:\\documents\\contract.pdf",
  "includePages": true,
  "includeRegions": false,
  "maxTextChars": 100000,
  "useDocOrientationClassify": true,
  "textRecScoreThresh": 0.5,
  "confirmExecution": "OCR"
}
~~~

MCP 规则：

- `filePath` 与 `fileByteBase64` 必须且只能提供一个；
- `filePath` 必须是绝对路径、普通文件，符号链接会被拒绝；
- 文档字节会发送给当前租户管理员配置的 OCR 服务，因此必须显式传 `confirmExecution="OCR"`；
- `includePages` 默认关闭，`includeRegions` 会同时启用分页；这两个参数只控制 MCP 返回内容，不改变 OCR 识别；
- `maxTextChars` 范围为 1,000～200,000，默认 100,000，用于避免识别全文挤满 AI 上下文；
- 工具不接受 OsClient、Endpoint、Provider、API Key、Header 或 Authorization 覆盖；
- 审计只记录安全文件名、字节数、SHA-256 和选项，不记录本地路径、文件内容、识别文本或凭据。

## 返回结果

所有入口最终使用 `DosResult`。典型成功结果：

~~~json
{
  "Code": 1,
  "Msg": "",
  "Data": {
    "Provider": "PaddleX",
    "TraceId": "8f74f1f5989d4da7b538de5a90f4f9a4",
    "FileName": "invoice.png",
    "FileType": "PNG",
    "Text": "增值税电子普通发票……",
    "AverageConfidence": 0.96,
    "PageCount": 1,
    "ElapsedMilliseconds": 821,
    "Pages": [
      {
        "PageIndex": 0,
        "Text": "增值税电子普通发票……",
        "AverageConfidence": 0.96,
        "Regions": [
          {
            "Text": "发票号码",
            "Confidence": 0.98,
            "Polygon": [[126, 84], [246, 84], [246, 116], [126, 116]]
          }
        ]
      }
    ]
  }
}
~~~

| 字段 | 用途 |
|---|---|
| `Text` | 跨页合并后的全文，适合检索、摘要和后续字段提取 |
| `Pages` | 分页结果；每页包含文本、平均置信度和区域 |
| `Regions` | 文本块、置信度和多边形坐标，可用于原图高亮 |
| `AverageConfidence` | 识别结果的平均置信度，只能作为复核信号 |
| `TraceId` | 串联 API 与 OCR 服务诊断，报错时优先保留 |
| `ElapsedMilliseconds` | 网关本次识别耗时，可用于容量和超时评估 |

不要只判断 HTTP 200。业务成功必须判断 `Code===1`；低置信度、空文本或页数异常还应进入人工复核。

## 常见业务模式

### 单据识别并写入业务表

推荐新建业务接口引擎：

1. 校验当前用户是否可访问附件和目标业务记录；
2. 调用 `V8.OCR.Recognize`；
3. 使用确定性规则或经批准的 AI 提取字段；
4. 校验金额、日期、编号等业务规则；
5. 把 OCR 原文、TraceId、置信度和人工复核状态一并保存；
6. 最终提交仍由表单权限、状态机和事务控制。

OCR 结果不能直接替代原始附件。原文件应按业务保留策略存入私有文件系统，识别文本与业务字段要能追溯到同一附件版本。

### 批量合同、档案或票据

当前 OCR 入口是请求内同步识别。批量或长耗时场景应使用共享数据库/MQ/outbox：

- 为每个文件生成稳定任务 Id 和幂等键；
- 状态至少包含待处理、处理中、成功、失败、待人工复核；
- Worker 使用租约领取任务，并记录尝试次数和下次执行时间；
- 成功写入结果与任务完成必须位于可恢复的事务边界；
- 失败重试前先确认上次调用是否已经产生业务副作用；
- 任务事实不能放在进程内队列、`static` 字典或本地临时文件中。

### OCR 后接全文检索或 AI

先保存可追溯的 OCR 原文，再异步建立搜索索引或调用 AI。隐私、合同、证照等内容只有在供应商和数据出境策略获批后才能发送给外部模型；检索缓存 Key 和日志不要写原文。

## 部署与容量规划

| 项目 | 当前平台边界 |
|---|---|
| 单次超时 | 默认 60 秒，租户可配 1～300 秒 |
| 单文件 | 默认 20 MB，服务端硬上限 100 MB |
| 返回页数 | 默认 10 页，服务端硬上限 100 页 |
| 上游响应 | 服务端硬上限 16 MB |
| 源码 CPU 基线 | 4 CPU、8 GB 内存、4 GB `shm` |
| 镜像架构 | 当前公开基线为 `linux/amd64` |

这些是安全上限，不是性能承诺。上线前应使用真实图片尺寸、PDF 页数、清晰度和并发量压测 P50/P95/P99 延迟、内存峰值、错误率与识别质量。

GPU 环境需要按显卡驱动选择匹配的 CUDA 镜像与 PaddlePaddle wheel；ARM64 需要单独构建和验证。不要把 CPU Dockerfile 直接当作 GPU 镜像，也不要在生产使用浮动 `latest`。

模型卷 `microi-ocr-models` 用于复用预置/下载模型。健康检查有较长启动宽限，是为了低配机器首次复制和加载模型，不代表单次业务请求可以等待同样长的时间。

## 安全边界

:::: danger 文档内容可能是敏感数据
身份证、合同、病历、财务票据和内部资料在识别前必须确认处理授权、供应商边界、存储期限与审计要求。OCR 可用不等于允许把任意文件发送给模型服务。
::::

- 租户身份以 `V8TenantContext` 或验证后的 DiyToken 为准；调用参数不能切换到其它租户；
- 服务地址、密钥和固定 Header 只由可信后端从 SaaS 引擎读取；
- 远程 OCR 服务应使用 HTTPS、访问控制和最小网络白名单；本地服务只开放到 API 内网；
- 上游 3xx 自动跳转被禁用，Endpoint 只允许 HTTP/HTTPS 且不能包含 URL 凭据或 Fragment；
- `Host`、`Content-Length`、`Content-Type`、`Connection` 等危险/逐跳 Header 会被拒绝；
- 文件后缀、Base64 和魔数三重校验，返回体也有 16 MB 硬上限；
- 生产日志只保留必要的 Provider、Host、Trace 和错误分类，不记录文件 Base64、识别全文或密钥；
- `OcrMinConfidence` 是租户下限，调用方只能提高，不能通过传更低阈值绕过；
- OCR 后续写表仍需执行菜单、表、字段、行级权限、状态机、幂等与审计。

详细安全原则见 [平台安全与兼容基线](../more/security.md)。

## 故障排查

| 现象 | 优先检查 | 处理建议 |
|---|---|---|
| 当前租户未启用 OCR | `OcrEnabled`、租户是否正确、配置缓存 | 开启当前租户并刷新共享缓存 |
| 当前租户未配置服务地址 | `OcrEndpoint` 是否为空 | 按 API 所在网络选择宿主机或 Docker 内网地址 |
| Provider 配置无效 | `OcrProvider` | 使用 `PaddleX` 或 `PaddleXHighStability` |
| 服务返回 HTTP 4xx/5xx | Endpoint 路径、API Key、固定 Header、上游日志 | 用 `TraceId` 对照上游；不要把密钥写进业务脚本 |
| 调用超时 | 服务是否完成模型加载、图片/PDF 大小、CPU/GPU、并发 | 先降低样本规模并观察资源，再按压测调整超时与容量 |
| FileName 与内容不一致 | 文件扩展名和魔数 | 保留真实扩展名，不要只改后缀 |
| 文件超过限制 | 解码后大小、反向代理/API 请求体上限、`OcrMaxFileMB` | 三层上限取最小值；不要只提高租户字段 |
| PDF 返回页数超限 | `OcrMaxPages` 和上游 PDF 页数策略 | 拆分文件或转为可恢复批量任务 |
| HTTP 200 但业务失败 | `DosResult.Code`、`Msg`、`TraceId` | 必须按 `Code` 判断成功 |
| Docker 内网地址不可达 | API 是否加入 `microi-ocr` 网络、服务名是否匹配 | 宿主机用 `127.0.0.1:18080`，容器用服务名 |
| MCP 输出被截断 | `TextTruncated`、`maxTextChars`、`includePages` | 在许可范围内提高字符上限，按页处理，不要盲目开启全部 Regions |
| 识别文字不准确 | 原图清晰度、方向/展平选项、阈值、模型版本 | 建立标注样本集，以字段准确率和人工复核率评估 |

故障信息对外应保持稳定简短，详细原因通过 `TraceId`、API 日志和 OCR 容器日志关联。不要把上游原始响应、Header 或文件内容直接返回给客户端。

## 上线验收清单

- [ ] “系统引擎”侧边栏能够打开本页面，桌面与移动端锚点可用；
- [ ] OCR 容器健康，API 所在网络能够访问正确 Endpoint；
- [ ] 当前租户 9 个 OCR 字段存在、保存成功并在另一 API 节点生效；
- [ ] PNG/JPEG 单页、PDF 多页各至少一份真实样本返回 `Code=1`；
- [ ] 返回包含 `TraceId`、`Text`、`PageCount`、耗时与预期分页/区域；
- [ ] 非法 Base64、伪造后缀、超大文件、超页数和低阈值绕过均被拒绝；
- [ ] 未登录 HTTP 请求被拒绝，正文 `OsClient` 不能切换租户；
- [ ] V8、HTTP、MCP 三个入口至少分别完成一次授权样本验证；
- [ ] 日志和错误响应不出现 Base64、识别全文、API Key 或固定 Header；
- [ ] 批量场景具备共享任务、幂等键、租约、重试和人工复核状态；
- [ ] 使用标注样本记录字段准确率、人工复核率、P95 延迟和资源峰值；
- [ ] 升级、重启和多节点切换后再次完成真实识别，而不只检查健康状态。

## 相关文档

- [V8.OCR 后端 API 参考](../v8-engine/v8-server.md#v8-ocr)
- [Docker 部署（一键安装）](../getting-started/docker-run.md)
- [SaaS 引擎](./saas-engine.md)
- [接口引擎](../v8-engine/api-engine.md)
- [分布式存储](../more/hdfs.md)
- [搜索引擎](./search-engine.md)
- [平台安全与兼容基线](../more/security.md)
