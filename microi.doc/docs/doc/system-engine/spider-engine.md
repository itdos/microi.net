# 采集引擎

采集引擎用于把不同站点、H5、小程序、接口、视频平台、法律文书站点等外部数据，按可重复执行的规则采集到吾码平台。它不是一次性的 AI 抓取脚本，而是一套由采集站点、采集规则、采集账号、本地 Worker、任务、步骤、产物、通用结果和导出产物组成的标准系统引擎。

## 架构

推荐架构如下：

1. 后台低代码模块保存规则、账号、任务、日志和导出记录。
2. OpenClaw 本地 Worker 负责启动真实 Chrome、复用浏览器 Profile、处理验证码、捕获接口响应或读取 DOM。
3. 后端 V8 接口引擎负责任务领取、任务上报、数据入库、导出文件、私有附件上传。
4. 业务数据写入业务表，采集引擎表只保存通用采集运行数据。

跨平台桌面场景优先使用 OpenClaw，因为它可以封装 Electron / Express / Playwright / Chrome，并支持 Windows 与 macOS 打包。

## 服务端 V8.Spider 安全边界

`V8.Spider` 与 `V8.Http` 使用同一套 SSRF 兼容配置：严格模式默认关闭以兼容存量内网采集；显式开启后，初始 URL、重定向和浏览器子资源都执行协议、URL 凭据、DNS/IP 与允许主机校验。

V8 脚本不能传 `ExecutablePath` 或 `UserDataDir`。平台按 `OsClient + ApiEngineKey/EventName + SessionId/ProfileKey` 隔离浏览器目录与会话。默认资源边界：

- 当前节点最多 32 个会话：`MICROI_SPIDER_MAX_SESSIONS_TOTAL` / `Spider:MaxSessionsTotal`；
- 每个租户与引擎作用域最多 4 个：`MICROI_SPIDER_MAX_SESSIONS_PER_SCOPE` / `Spider:MaxSessionsPerScope`；
- 空闲 30 分钟回收：`MICROI_SPIDER_SESSION_IDLE_MINUTES` / `Spider:SessionIdleMinutes`；
- 最长 8 小时：`MICROI_SPIDER_SESSION_MAX_HOURS` / `Spider:SessionMaxHours`；
- 抓包响应体默认 200,000 字符、硬上限 1,000,000，每会话最多 100 条。

浏览器会话和会话数配额目前是节点进程内状态。多节点复用登录态需粘性路由或独立 Spider Worker；可靠任务状态、幂等键和结果必须写共享数据库/MQ，不能把浏览器进程当可恢复事实源。

## 标准表

采集引擎标准表使用 `mci_spider_` 前缀：

| 表名 | 说明 |
| --- | --- |
| `mci_spider_site` | 采集站点，保存站点类型、基础地址、登录地址、验证码要求。 |
| `mci_spider_rule` | 采集规则，保存 Recipe、凭据结构、重试策略、预期计划、保存接口、导出接口。 |
| `mci_spider_account` | 采集账号，保存账号、密码密文字段、登录身份名称、浏览器 Profile、验证码策略。 |
| `mci_spider_profile` | 浏览器会话，保存 Worker 写入的本地 Chrome Profile 状态。 |
| `mci_spider_worker` | 本地 Worker 心跳和运行状态。 |
| `mci_spider_task` | 采集任务，保存预计条数、成功条数、失败条数、完整条数、人工处理提示。 |
| `mci_spider_task_step` | 任务步骤日志。 |
| `mci_spider_artifact` | 采集产物，如截图、验证码图、接口响应、HTML、日志。 |
| `mci_spider_result` | 通用采集结果。具体业务表由规则 V8 保存。 |
| `mci_spider_export` | 导出产物，保存 TXT、Word、ZIP、Excel 等私有附件路径和导出统计。 |

通用表不要写死任何特定行业的主对象、分类或内容结构；具体业务含义应由业务表和规则 V8 表达。

## 采集规则

一个可交付的规则必须能被重复执行。`mci_spider_rule` 至少应包含：

- `RecipeJson`：采集步骤、页面入口、接口捕获、DOM 选择器、人工步骤。
- `CredentialSchemaJson`：需要哪些账号字段，例如账号、密码、姓名、机构码。
- `RetryPolicyJson`：验证码、密码、页面加载、接口捕获的重试策略。
- `ExpectedPlanJson`：应采集的账号、分类、模块、接口、页面或内容条目，用于统计进度。
- `SaveApiEngineKey`：保存业务数据的 V8 接口引擎。
- `ExportApiEngineKey`：导出交付文件的 V8 接口引擎。
- `ExportConfigJson`：支持的导出格式、命名规则、是否按分类拆分、是否上传私有附件。

如果站点需要从另一个系统先获取姓名、主体名等登录身份，Worker 获取成功后应写回 `mci_spider_account.LoginIdentityName`，下次复跑直接使用。

## 批量站点交付

当一个项目包含多个业务主体、多个网站或多种内容来源时，采集引擎应按“一个站点/入口一套可复跑规则”的方式交付，而不是由 AI 临时采集一次。

批量交付流程：

1. 从 Excel、Markdown、TXT、截图或客户资料中提取全量站点、账号、密码、身份信息、入口地址、分类、模块和交付格式。
2. 为每个站点创建或更新 `mci_spider_site`、`mci_spider_rule`、`mci_spider_account`。
3. 在 `ExpectedPlanJson` 中保存应采集账号、分类、模块、接口、页面或内容条目范围。
4. OpenClaw Worker 按规则执行，所有进度写入 `mci_spider_task`，所有步骤写入 `mci_spider_task_step`。
5. 页面截图、验证码截图、接口响应、HTML、日志、导出文件和 ZIP 包写入 `mci_spider_artifact` 或 `mci_spider_export`。
6. 规则保存引擎把采集结果写入业务表；规则导出引擎按业务需要生成 TXT、Word、ZIP、Excel 或其他格式，并上传为私有附件。
7. 交付报告按站点列出应采集、成功、失败、剩余、导出附件和失败原因。

推荐为项目配置一个交付报告接口引擎，例如 `<project>-spider-delivery-report`。报告接口不负责采集内容，而是读取 `mci_spider_site`、`mci_spider_rule`、`mci_spider_account`、`mci_spider_task`、业务结果表和 `mci_spider_export`，按规则输出：

- 规则是否可复跑。
- 账号是否完整。
- 应采集、成功、失败、完整、剩余数量。
- 业务数据和导出附件是否已交付。
- 失败阶段和失败原因。
- 旧规则是否只是“同对象已交付”，避免同一业务对象的多个规则重复计算交付数量。

失败站点也必须形成明确记录。失败原因至少应包含失败阶段、账号或分类范围、错误信息、页面/接口证据、是否需要人工继续、下次复跑建议。

## 业务表与导出附件

采集引擎的通用表只记录规则和运行态；客户查看的数据应写入业务表。例如：

- 业务主表可通过 `TableChild` 关联内容明细表，用户在主记录详情里直接查看采集结果。
- 分类或模块表可保存对应范围的 TXT、Word、Excel 等私有附件路径。
- 项目或来源表可保存全量 TXT 包、Word 包、ZIP 或其他交付附件路径。
- 导出产物表 `mci_spider_export` 使用中性字段保存导出标题、导出格式、私有附件、业务表、业务记录、导出数量、成功数量、失败数量。
- 后台用户应能在业务表和导出产物中重复下载附件。

创建或维护 `diy_table` 时，`Name` 是英文表名，`Description` 是简短中文表名，`Remark` 才写表用途和详细说明。

## 验证码与登录安全

验证码识别必须保守：

- 默认同一个账号同一个任务，AI OCR 最多失败或未确认 2 次。
- 超过 2 次必须弹出真实 Chrome，让用户手动输入验证码。
- AI 返回验证码后，应让用户确认或修正；取消视为未确认。
- 密码错误默认只尝试 1 次，避免重复错误触发封号或封 IP。
- 每次失败都应写入任务步骤和任务错误信息。

推荐把验证码识别做成可插拔策略：

- 算术表达式验证码优先走后端确定性解析，例如 `3+5`、`三加五`、`十减二`。
- 英文数字扭曲验证码可接入 DdddOCR、Tesseract + OpenCvSharp、PaddleOCR 或自训练 ONNX 模型。
- 中文文字验证码优先接入 PaddleOCR 或专门训练的中文验证码模型。
- 任何自动识别策略都必须设置最大自动尝试次数，默认同账号同任务最多 2 次；失败后由 OpenClaw 弹出真实 Chrome 让用户手动输入。
- 新方案上线前，应准备人工标注样本，对准确率、空返回率、误读率、耗时和封号风险做对比测试。

后端统一识别接口：

```http
POST /api/Captcha/Recognize
Content-Type: application/json
```

常用参数：

```json
{
  "OsClient": "租户",
  "Provider": "Auto | Arithmetic | DdddOcr | PaddleOcr | Tesseract | Http",
  "ImageBase64": "data:image/png;base64,...",
  "ExpressionText": "三加五等于几",
  "AllowedChars": "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "Endpoint": "可选，覆盖配置中的 OCR 服务地址",
  "TimeoutSeconds": 8
}
```

配置示例：

```json
{
  "CaptchaOcr": {
    "Provider": "DdddOcr",
    "Endpoint": "http://127.0.0.1:9898/ocr",
    "TimeoutSeconds": 8,
    "PaddleOcr": {
      "Endpoint": "http://127.0.0.1:9899/ocr"
    }
  }
}
```

`Auto` 会先解析算术表达式；如果配置了 OCR 服务地址，再调用外部 OCR 服务；仍失败时返回 `NeedManual=true`，由 OpenClaw 聚焦真实 Chrome 让用户手动输入。

## Worker 上报

OpenClaw 本地 Worker 应在以下时机写入后台：

- 打开浏览器：写入 `mci_spider_profile` 和 `browser-session` 产物。
- 页面截图：写入 `screenshot` 产物。
- 验证码 OCR：写入 `captcha-screenshot` 产物和验证码步骤。
- 捕获接口响应：写入 `api-response` 产物。
- 保存结果：通过 `mci-spider-task-report` 上报 `ExpectedCount`、`SuccessCount`、`FailCount`、`CompleteCount`。

## V8 引擎

常用接口引擎：

- `mci-spider-worker-heartbeat`：Worker 心跳。
- `mci-spider-task-next`：领取下一条任务。
- `mci-spider-task-report`：上报任务状态、步骤、产物和结果。
- 规则保存引擎：将采集结果写入业务表。
- 规则导出引擎：按规则生成 TXT、Word 或其他交付文件并上传为私有附件。

导出文件应通过平台私有附件路径保存，后台用户可以在导出产物中重复下载。不要把客户交付文件做成公开匿名访问。

## 后台菜单

采集引擎菜单默认建议放在“系统引擎”下，保持两级：

- 系统引擎 / 采集站点
- 系统引擎 / 采集规则
- 系统引擎 / 采集账号
- 系统引擎 / 采集任务
- 系统引擎 / 采集Worker
- 系统引擎 / 浏览器会话
- 系统引擎 / 任务步骤
- 系统引擎 / 采集产物
- 系统引擎 / 采集结果
- 系统引擎 / 导出产物

当项目以采集为主，或用户已经明确把“采集引擎”作为独立分组时，应保留三级结构，例如“系统引擎 / 采集引擎 / 采集规则”。AI 和 MCP 修复菜单时不能因为默认推荐两级，就隐藏、删除或强行拉平用户刻意创建的三级采集引擎菜单。

## 交付验收

交付采集规则时，应给出：

- 应采集多少、实际成功多少、失败多少、完整多少、剩余多少。
- 哪些账号已保存身份名称、浏览器 Profile 和验证码策略。
- 是否仍需要人工验证码兜底。
- 已生成哪些导出产物，TXT/Word/其他文件是否为私有附件。
- 后台菜单、规则、任务、产物、业务表是否可查看。
- OpenClaw 本地 Worker 是否可重复执行同一规则。
