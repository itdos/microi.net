# 发布通用规则

> 所有发布工作流均需遵守本文档规则。

---

## 智能助理原则

做智能助理，不做表单填写机。能自动补全的默认值先补全，只在必须决策时才追问用户。

## 强制门禁

发布类任务分为两条路径。已有完整标准 `payload.json` 时走快速路径；缺账号、字段、资源或动态字段时走组装路径。

### 快速路径

1. 读取 `../../SKILL.md`
2. 读取当前文件和对应类型 workflow
3. 确认 payload 是标准结构且不含占位符
4. 执行 `yxer validate`
5. 执行 `yxer publish --dry-run`
6. 用户授权后执行正式 `yxer publish`

### 组装路径

当 payload 尚未完整，必须满足以下顺序；任意一步未完成，都不允许继续到下一步：

1. 读取 `../../SKILL.md`
2. 读取当前文件
3. 读取 `data-accuracy.md`、`account-selection.md`、`local-vs-cloud.md`、`payload-sourcing.md`
4. 如涉及话题/标签，读取 `../topic-tags.md`
5. 读取对应类型 workflow
6. 执行 `yxer doctor`
7. 执行 `yxer accounts list`
8. 执行 `yxer prepare <platform> <type>` 或 `yxer publish form start/inspect`
9. 优先执行 `yxer schema fields <platform> <type>`；需要 payload 骨架时再执行 `yxer schema get <platform> <type>`
10. 执行 `yxer upload`
11. 执行动态字段查询命令
12. 多候选或歧义数据按 `data-accuracy.md` 展示给用户确认
13. 组装 payload
14. 执行 `yxer validate`
15. 执行 `yxer publish --dry-run`
16. 用户授权后执行正式 `yxer publish`

禁止行为：

- 缺字段来源时跳过 `prepare` / `publish form` / `schema fields` / `schema get` 直接手写 payload
- 先执行 `publish`，失败后再补 `validate`
- 从空白 JSON 文件开始猜字段、猜层级、猜顺序
- 未读取 workflow 就按历史记忆填平台字段
- 动态查询返回多个候选时，未让用户确认就直接选择第一项
- 跳过 `publish --dry-run` 直接正式发布

## 发布前自检清单

每次真正执行 `validate` / `publish` 前，Agent 应先确认：

- `[ ]` 已读技能入口
- `[ ]` 已读通用规则
- `[ ]` 已读数据准确性工作流
- `[ ]` 已读类型 workflow
- `[ ]` 已完成环境检查
- `[ ]` 已确认账号有效
- `[ ]` 新建或补字段时已拿到最新 `prepare` / `publish form` 结果
- `[ ]` 新建或补字段时已拿到最新 `schema fields` 结果；如需骨架再补 `schema get`
- `[ ]` 已完成资源上传，不存在未处理的外部 URL 直填；如果是 Markdown 文章，已在 `validate` / `publish` 中传入 `--content-file`，由 CLI 统一处理正文图片
- `[ ]` 已查询需要查询的动态字段，不存在手写 `raw`；多多视频 `shopping_cart.goods_id` 使用用户明确输入
- `[ ]` 多候选账号、分类、位置、音乐、商品、合集、剧集、活动等已由用户确认
- `[ ]` 当前 payload 不含模板占位符
- `[ ]` 当前 payload 已先通过 `validate`
- `[ ]` 当前 payload 已先通过 `publish --dry-run`

## 数据真实性原则

- Agent 组装请求数据时，必须以 `yxer prepare`、`yxer schema fields` / `schema get`、平台文档和 CLI 返回结果为唯一依据。
- 严禁自行猜测字段名、层级、枚举、默认值、示例值、`raw` 对象内容或资源元数据。
- 文档未定义、schema 未声明、CLI 未返回的字段，不得写入 payload。
- 动态字段和复杂对象必须先查询后填写；查不到时继续查询或向用户确认，不能凭经验编造。多多视频 `shopping_cart.goods_id` 是用户输入的业务 ID，不走商品查询。
- 话题/标签字段必须按 `../topic-tags.md` 的最终格式直接写入 payload。CLI 只兜底归一化 `description` 中的普通 `#话题`，不处理 `content`，也不改变 `tags` / `topics` / `challenge` 字段结构。

---

## 发布通道判断规则

Agent 在任何 `publish` 之前，都要先读取 [`local-vs-cloud.md`](./local-vs-cloud.md) 并判断这次任务是云发布还是本机发布。

### 何时用云发布

- 用户未明确指定发布通道
- 用户只说“帮我发布”，没有强调本机客户端
- 当前环境没有可用 `clientId`

### 何时用本机发布

- 用户明确说“本机发布”“本地发布”“走客户端发布”
- 用户明确表示不要走云端代理，或者希望走当前机器网络环境
- 云发布已因代理问题失败，用户接受改走本机

### 本机发布执行规则

- 必须显式使用 `publishChannel=local`
- 必须通过 `--client-id` 或 `yxer config set-local-client-id` 提供 `clientId`
- `validate`、`publish --dry-run`、正式 `publish` 必须使用同一套发布通道参数，避免“校验通过但执行模式不一致”
- 推荐的 `clientId` 来源：
  1. 命令 flags：`--client-id <clientId>`
  2. 本地配置：`yxer config set-local-client-id <clientId>` 后由 CLI 自动读取
  3. payload 中已有 `clientId` 时可沿用

第四个位置参数属于旧版兼容，不再作为 Agent 推荐入口。

推荐命令形态：

```bash
yxer validate <platform> <type> .\payload.json --publish-channel local --client-id <clientId>
yxer publish <type> <platform> .\payload.json --publish-channel local --client-id <clientId> --dry-run
yxer publish <type> <platform> .\payload.json --publish-channel local --client-id <clientId>
```

如果已经通过 `yxer config set-local-client-id <clientId>` 预设默认值，则可省略 `--client-id`，但仍建议显式保留 `--publish-channel local`。

### 发布通道失败后的回退

- 本机发布报“客户端不在线”或“获取在线设备列表失败”：
  - 提示用户启动并登录蚁小二客户端
  - 若用户不方便保持在线，建议改用云发布
- 云发布报“账号代理不存在”：
  - 提示检查账号代理配置
  - 若用户希望立即绕过代理限制，可改用本机发布
  - 不默认使用 `--auto-fallback-local`；只有用户明确授权“一失败就切本机”时才可使用

### dry-run 语义

- `yxer publish --dry-run` 只预览最终请求，不创建发布任务。
- 云发布且已配置 API key 时，dry-run 会做账号/代理 preflight；local dry-run 不检测客户端在线状态。
- dry-run 输出中的 `meta.remoteChecks` 表示本次是否实际执行了远端 preflight。

---

## 默认值自动补全规则

字段来源和修 payload 顺序，优先遵循 [`payload-sourcing.md`](./payload-sourcing.md)。

### 标准 payload 结构

所有平台都必须使用同一套标准发布结构：

```json
{
  "action": "publish",
  "publishType": "<video|imageText|article>",
  "platforms": ["<平台中文名>"],
  "publishChannel": "cloud",
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "<platformAccountId>",
        "contentPublishForm": {
          "formType": "task"
        }
      }
    ]
  }
}
```

强约束：

- 顶层必须包含 `publishArgs`
- `accountForms` 只能出现在 `publishArgs.accountForms`
- 平台差异字段默认填写在 `publishArgs.accountForms[].contentPublishForm`
- 共享资源字段可放在 `publishArgs` 根级，与 `accountForms` 同级，例如 `video`、`images`、`cover`、`coverKey`、`content`
- 文章正文推荐放在 `publishArgs.content`，再由 CLI 自动补齐到 `accountForms[].contentPublishForm.content`
- 不再兼容顶层 `accountForms`
- 不再兼容直接把平台表单字段放在 payload 顶层

以下字段 Agent 应自动填入，无需询问用户：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `formType` | `"task"` | 固定值，无需询问 |
| `publishChannel` | `"cloud"` | 仅在用户未指定本机发布时默认使用 |
| `images[].key/size/width/height/format` | 从 `yxer upload` 结果自动获取 | 严禁手动编造 |
| `video.key/size/width/height/duration/format` | 从 `yxer upload` 结果自动获取 | 严禁手动编造 |
| `cover` / `coverKey` | 默认使用 `images[0]` 或视频封面 | 用户未单独指定封面时自动使用 |

在自动填值之前，Agent 必须先读取平台前置数据和 schema：

- 新建或补字段时，先执行 `yxer prepare <platform> <type>` 或使用 `yxer publish form start/inspect` 获取表单契约
- 新建或补字段时，先执行 `yxer schema fields <platform> <type>`，确认字段名、类型和必填项；需要根层级骨架时再执行 `yxer schema get <platform> <type>`
- 只有在 `prepare` / `publish form` / `schema fields` / `schema get` 已确认后，才开始填写或补齐 `payload.json`
- Agent 不允许从空白 JSON 手工拼接 payload；必须先基于标准结构、publish form 会话或 CLI 模板生成骨架，再按返回结果填值

以下字段应先向用户确认，再填入：

| 字段 | 确认方式 |
| --- | --- |
| `title` | 展示标题内容，请用户确认 |
| `description` / `content` | 如用户未提供，从标题自动生成并展示给用户确认 |
| `platformAccountId` | 如用户只有一个在线账号，自动选择并告知用户；多个则列出让用户选 |
| `scheduledTime` | 用户明确要求定时发布才询问时间；CLI 中统一传 13 位 Unix 毫秒时间戳，默认立即发布 |
| `publishChannel` | 用户明确提到本机/本地/客户端发布时，必须切换为 `local` |
| `clientId` | 用户要求本机发布且当前配置中没有默认值时，必须补齐 |

---

## 资源上传规范

### 图片上传

- 支持格式：`jpg` / `png` / `webp`
- 每张图必须单独调用 `yxer upload` 获取 key
- 从返回结果中提取 `key` / `size` / `width` / `height` / `format`
- 禁止手动编造这些字段

### 视频上传

- 支持格式：`mp4` / `mov`
- 调用 `yxer upload <视频路径>` 获取 key
- 返回结果额外包含 `duration`
- 视频封面必须单独上传，不能用视频文件本身代替封面

### URL 资源

- 直接传 HTTP/HTTPS URL，`yxer upload` 会自动下载后上传
- 本地文件传绝对路径

---

## 复杂对象查询规范

账号选择和 `platformAccountId` 确认，优先遵循 [`account-selection.md`](./account-selection.md)。

以下字段严禁手动构造，必须通过查询命令获取完整对象；除视频号 `drama` 外，动态对象按各自 schema 保留完整 `raw`：

| 字段 | 查询命令 | 返回必需字段 |
| --- | --- | --- |
| `location` | `yxer query locations <account_id> [--query 关键词]` | 整个 `yxer query locations` 返回对象 |
| `music` | `yxer query music <account_id> [--query 关键词]` | 整个 `yxer query music` 返回对象 |
| `collection` / `sub_collection` | `yxer query collections <account_id> [--type video]` | 整个 `yxer query collections` 返回对象 |
| 视频号 `drama` | `yxer query drama-tasks <account_id> [--query 关键词]` | 只保留 `yixiaoerId`、`yixiaoerImageUrl`、`yixiaoerName`，不使用 `raw` |
| `challenge` | `yxer query challenges <account_id> [--query 关键词]` | 整个 `yxer query challenges` 返回对象 |
| 小红书 `description` 中的 `<friend>` | `yxer query friends <account_id> --red-id <小红书号>` | 将整个用户对象 JSON 序列化到标签 `raw`，支持陌生人，标签正文使用查询结果名称 |
| `category` | `yxer query categories <account_id> [--type video\|article]` | 整个 `yxer query categories` 返回对象 |
| `goods` | `yxer query goods <account_id> [--query 关键词]` | 整个 `yxer query goods` 返回对象 |

查询后，将完整返回对象填入 payload 对应字段，不要只填 ID 或名称。视频号 `drama` 按上表的三个字段例外处理；多多视频 `shopping_cart.goods_id` 使用用户输入并固定 `source=pdd`；`collection` 仍必须保留完整 `raw`。
前置查询对象一律不允许简化，包括 `location`、`goods`、`music`、`collection`、`challenge`、`category` 等；必须使用 CLI 查询返回的完整对象数据。多多视频不使用 `goods` 查询对象。
其中 `music` 的 `playUrl` / `url` 属于查询结果元数据，不能因为外链规则手动删除。

---

## 分类层级规则

若分类存在层级结构，Agent 必须选择并提交最深层的叶子节点。

示例：

```text
错误：只填 "美食"
正确：填 "美食" 下的 "家常菜"
```

---

## 错误处理

| 错误场景 | 处理方式 |
| --- | --- |
| `yxer validate` 失败 | 读取错误信息，修正对应字段后重新校验 |
| `yxer publish` 失败 | 读取错误信息，判断是否需要重新 upload 或修正参数 |
| `yxer upload` 失败 | 检查文件路径或 URL 是否有效，重试一次 |
| `yxer accounts` 无在线账号 | 告知用户，建议检查账号 cookie 是否过期 |
| 查询命令返回空 | 放宽关键词重试；仍为空则告知用户该账号不支持此功能 |
| 本机发布失败且提示客户端不在线 | 引导用户启动客户端，或建议改用云发布 |
| 云发布失败且提示账号代理不存在 | 提示检查代理，或建议改用本机发布 |

---

## 严禁行为

- 未确认账号 `status=1` 就构造 payload
- 用户明确要求本机发布时，仍然默认走云发布
- 使用本机发布却没有通过 flag、配置或 payload 提供 `clientId`
- 手动编造 `key` / `size` / `width` / `height` / `duration`
- 手动构造 `location` / `music` / `collection` / `challenge` 的 `raw`
- 跳过 `yxer validate` 直接执行 `yxer publish`
- 在 payload 中直接使用外部 URL 作为图片或视频地址
- 跳过工作流步骤，自行拼大 JSON payload
- 用户说“草稿”时不询问类型，自行猜测是蚁小二草稿还是平台草稿
