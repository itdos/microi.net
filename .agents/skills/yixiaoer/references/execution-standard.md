# YiXiaoEr Skill 严格执行标准 (Strict Execution Standard)

为了确保 蚁小二 (YiXiaoEr) 自动化技能在复杂 Agent 环境下的高可靠性、可追溯性以及版本一致性，所有调用者及技能维护者必须遵循本标准。

## 1. 版本控制与一致性 (Versioning & Consistency)

### 1.1 语义化版本
- 技能必须在 `skills/yixiaoer/SKILL.md` 的 frontmatter 中明确标注 `version`（遵循 SemVer 规范）。
- **执行要求**：Agent 在启动时**必须**校验环境中的技能版本是否符合预期（如 `>= 1.6.0`）。

### 1.2 物理一致性 (Integrity)
- 技能的核心逻辑（`cmd/`、`internal/`、`main.go`）不得在未修改版本号的情况下随意变动。
- 自动化流水线应建议生成 Hash 值进行对比。

## 2. 错误分类与标准码 (Standardized Error Codes)

为了准确区分“Agent 使用错误”与“后端系统错误”，所有错误 envelope 必须包含 `error.code` 字段：

| 错误代码 (`error.code`) | 分类 | 触发场景 |
| :--- | :--- | :--- |
| `YIXIAOER_USAGE_ERR` | Agent 侧错误 | 参数缺失、JSON 格式错误、平台枚举值非法、资源未上传即发布。 |
| `YIXIAOER_REMOTE_ERR` | 远端 API 错误 | 蚁小二后端返回 4xx/5xx、API Key 失效、配额超限。 |
| `YIXIAOER_AUTH_ERR` | 鉴权错误 | 缺失 `YIXIAOER_API_KEY` 或 Key 无权访问特定接口。 |
| `YIXIAOER_ENV_ERR` | 环境错误 | CLI 二进制缺失、关键环境变量缺失、网络不通。 |
| `YIXIAOER_INTEGRITY_ERR` | 完整性错误 | 运行的代码与文档版本不一致。 |

## 3. 资源预处理标准 (Pre-processing Standard)

**核心约束：发布与上传必须物理分离**。

1. **先上传再引用**：严禁在 `publish` Payload 中直接使用外部原始 URL。必须通过 `upload` action 获取系统内部 `key` 后进行替换。
2. **ContentType 签名一致性**：获取预签名 URL 时声明的 `contentType` 必须与执行 PUT 上传时的 `Content-Type` Header **完全一致**。禁止自行猜测或随意留空，否则将导致 `SignatureDoesNotMatch` 错误。
3. **封面图 (Cover)**：视频内容的封面图必须同样经过 `upload` 流程。
4. **状态校验**：在上传统一资源后，建议通过 `material` 接口（若需要）将其同步至素材库以增加发布稳定性。
5. **素材库原子化标准 (Material Library Standard)**：
    - **严禁一步到位**：当用户请求“上传到素材库”时，Agent **必须**执行两个物理步骤：
        1. **upload**：先将资源上传至 OSS（推荐 `bucket: "material-library"`）并获得 resource key。
        2. **material**：持有 resource key，调用逻辑将资源登记到素材库并获得素材 ID。
    - **错误规避**：严禁只执行 `upload` 而不执行 `material` 登记，否则用户在网页端将无法看到该素材。

### 3.1 标准请求体兼容约定 (Standard Publish Request Compatibility)

- CLI 现已兼容“标准请求体”输入格式。推荐将共享资源放在 `publishArgs` 根级，例如 `video`、`images`、`cover`、`coverKey`、`verticalCover`、`content`。
- CLI 在执行 `validate` / `publish` 时，会在 `accountForms[]` 缺失对应资源字段时自动补齐：
  - `publishArgs.video` -> `accountForms[i].video`
  - `publishArgs.images` -> `accountForms[i].images`
  - `publishArgs.cover` -> `accountForms[i].cover`
  - `publishArgs.coverKey` -> `accountForms[i].coverKey`
  - `publishArgs.verticalCover` -> `accountForms[i].contentPublishForm.verticalCover`（仅当平台 schema 暴露该字段时使用）
  - `publishArgs.content` -> `accountForms[i].contentPublishForm.content`
- 业务扩展字段如 `mediaId`、`platformName`、`publishContentId`、`fps`、`isAppContent` 会被 CLI 保留并原样透传，不参与额外业务改写。
- 命令层仍保持**单平台执行模型**：即使标准请求体本身可表达多平台，`yxer publish` 仍需按平台逐次调用。

## 4. 调用序列与检索规范 (Interaction Flow)

Agent 在执行任务时必须遵循以下“分级检索”逻辑：

1. **L1 技能入口检索**：读取 `skills/yixiaoer/SKILL.md` 确定 `action` 类型。
2. **L2 Domain / 索引检索**：在执行 `publish` 前，必须先读取对应 domain 与内容类型 `index.md`（如 `skills/yixiaoer/references/platforms/article/index.md`）确定 DTO 架构。
3. **L3 平台细化**：根据目标平台（如“抖音”），读取 `skills/yixiaoer/references/platforms/video/douyin.md` 对 `platformSettings` 进行深度补全。
4. **禁止跳级**：严禁在未读取 domain 与类型索引的情况下直接拼装平台参数。
5. **动态数据预查**：对于 `categories` (分类)、`tags` (标签)、`locations` (位置) 等动态字段，Agent **必须**先通过对应的查询 action 获取当前平台的合法值，严禁基于常识或过时缓存进行猜测。

## 5. 输出格式规范 (Output Schema)

脚本输出必须为严格的 JSON。

### 成功响应示例
```json
{
  "ok": true,
  "action": "publish",
  "version": "3.1.3",
  "data": {
    "task_set_id": "TS12345678"
  }
}
```

## 6. 错误处理与自检流程 (Error Handling & Self-Diagnosis)

当 CLI 执行失败并返回 `ok: false` 时，Agent 或开发者**必须**按照以下顺序进行自检：

### 第零步：优先匹配避坑指南 (Step 0: Check Troubleshooting Guide)
- 在进行任何深度调试前，**必须首先查阅**：[🛡️ 蚁小二 Skill 避坑与故障排查手册](./troubleshooting-guide.md)。
- 检查出错现象是否符合手册中的“常见四大坑点”（版本、设备在线、表单架构、签名一致性）。如果匹配，直接按方案修正。


### 第一步：检查版本一致性 (Check Version)
- 检查当前运行环境中的 `skills/yixiaoer/SKILL.md` 版本号。
- 确认 Agent 使用的 API 调用逻辑是否与该版本匹配。
- **排查项**：是否因版本过低导致某些新增字段（如 `publishChannel`）未生效。

### 第二步：检查请求参数规范 (Check Parameters)
- 对比输出的 `details` 信息与 `skills/yixiaoer/references/` 下的 DTO 与平台定义。
- **重点排查项 (必填项校验)**：
    - **封面图 (cover/covers)**：是否提供了有效的资源 key？
    - **视频资源 (video)**：视频发布是否包含必填的视频 key、标题或分类？
    - **平台特定字段**：如公众号的 `author`、抖音的 `is_public` 等。
- **重点排查项 (必填项校验)**：
    - **分类与标签路径**：分类 (categories) 必须使用通过 `action: "categories"` 接口获取的**完整 `child` 路径数组**。严禁只填入末级 ID。
    - **位置与话题**：如抖音的 POI 位置、话题等，必须通过对应的检索接口获取有效数据后果填入。
- **排查项**：检查必填字段是否遗漏、数据类型（String/Number）是否符合文档、平台枚举名称是否正确。


### 第三步：检查缓存与过期数据 (Check Cache & Stale Data)
- 检查是否存在过期的缓存文件（如旧的 Payload JSON、过时的资源 Key）。
- **资源上传专项排查**：在上传阶段如果出现 `SignatureDoesNotMatch` 错误，优先检查 `contentType` 定义是否与上传时的 Header **完全对齐**。Agent 在调用 `action: "upload-resource"` 时传入的 `contentType` 必须与后续 PUT 请求中的 `Content-Type` 字节级一致。
- **发布通道与代理校验**：
    - 若执行发布任务返回“获取在线设备列表失败”或提示“客户端不在线”，原因为选择了 **本机发布 (publishChannel: 'local')** 但环境中未运行蚁小二客户端。建议保持客户端在线，或修改为 **云发布 (publishChannel: 'cloud')**。
    - 若**云发布**返回“账号代理不存在”，原因为账号绑定的独立代理 (proxyId) 失效或该平台强制需要代理配置。Agent 应先检查账号的 `proxyId` 或 `kuaidailiArea` 是否设置，并提示用户通过 `yxer accounts update` 绑定新的代理。
- **执行逻辑**：如果怀疑使用了缓存导致的异常，必须清理相关临时文件并严格按照最新技能定义的流程重新执行（如重新执行 `upload` 流程）。
- **草稿处理逻辑 (Draft Selection)**：当涉及“草稿”时，Agent 必须通过语义判断用户是指 **“蚁小二内部草稿”** (`yxer draft save`) 还是 **“发布到平台草稿箱”** (`yxer publish` + `pubType: 0`)。**若语义不明确，Agent 必须询问用户以确认，严禁在未明确用户意图时随意选取一种或默认执行。**
    - **平台草稿兼容性补丁**：若用户指定“发布到平台草稿箱”，Agent 遵循以下执行链：
        1. **pubType 优先**：若平台定义了 `pubType`，使用 `pubType: 0`。
        2. **visibleType 次之**：若无 `pubType` 但有 `visibleType` (或 `status`/`privacy`)，将其设为 **`1` (私密)**。对应的，`0` 表示公开。
        3. **不支持告知**：若均无定义，则判定为不支持，必须提示用户。
### 6.4 分类路径完整性校验 (Category Path Integrity)
- **核心逻辑**：对于支持多级结构的分类（如 B 站视频分区），Agent 在填充表单时**必须**使用完整的 `child` 路径数组。
- **数据获取**：直接透传从 `action: "categories"` 结果中提取的 `child` 字段。
- **执行动作**：Agent 选中目标分类后，应直接将该对象的整个 `child` 数组填入 `contentPublishForm.category` 或对应字段。
- **严禁**：严禁只填入单一的 `yixiaoerId` 或末级分类名。

---

## 7. 账号有效性校验 (Account Validity)
- **校验标准**：Agent 在执行 `publish` 前，其选择的账号 `status` 必须为 `1` (有效)。
- **严禁执行**：若账号 `status` 为 `2` (失效)，Agent **严禁**尝试执行发布任务，应立即提示用户账号需要重新登录或处理。
- **数据来源**：账号状态必须通过 `action: "accounts"` 接口实时获取，不得依赖过期的历史数据。

## 8. 避坑指南：常见失败场景 (Common Failure Scenarios)

| 场景 | 原因分析 | 改进建议 |
| :--- | :--- | :--- |
| **版本不支持该功能** | 技能版本号过低，未包含新增动作或字段。 | 检查 `skills/yixiaoer/SKILL.md` 版本，提示用户升级或回退逻辑。 |
| **获取在线设备失败** | 选用了“本机发布”但客户端未开启或未登录。 | 提示用户：**“蚁小二客户端需要保持在线”**，或者建议改为 **“云发布”** (publishChannel: 'cloud')。 |
| **发布失败：表单错误** | Agent 生成的 JSON 结构与 `skills/yixiaoer/references/` 下的 DTO 架构不匹配。 | **强制核对**：Agent 必须校验传入表单是否符合对应平台的文档要求。 |
| **任务卡在发布中/待发布** | 虽然 API 接收了请求，但表单内容不合规导致引擎挂起。 | **规则校验**：检查表单是否严格按照文档规则填入，特别是 `raw` 数据透传。 |
| **发布失败：必填项缺失** | 忽略了平台要求的必填核心字段（如标题、分类）。 | **必填项自检**：检查文档中标记为“必填”的字段是否已全部填入。 |
| **上传失败/签名不匹配** | `contentType` 在获取上传地址与执行 PUT 时不一致。 | **一致性校验**：必须确保 `action: "upload-resource"` 时传入的 `contentType` 与实际上传一致。 |
| **云发布报错：账号代理不存在** | 账号绑定的独立代理 (`proxyId`) 已失效，或云发布环境未配置代理。 | **修复建议**：通过 `yxer accounts update` 为账号设置 `kuaidailiArea`（内置代理）或有效的 `proxyId`（独立代理）。 |

---

*本标准由 OpenClaw 架构组制定。违反本标准导致的发布失败或数据异常将由调用者承担相应责任。*
