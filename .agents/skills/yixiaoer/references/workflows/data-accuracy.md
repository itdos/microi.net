# 数据准确性工作流

> 适用范围：任何会创建、修改、发布、保存草稿、登记素材或更新账号配置的任务。

本文档定义 Agent 在写操作前如何确保数据来自真实查询结果，而不是凭自然语言、记忆或示例 JSON 猜测。

## 核心原则

- 写接口只接收已解析、已校验、有来源的数据。
- 自然语言只能用于触发查询、筛选候选和生成用户可确认的业务文案，不能直接作为动态对象写入 payload。
- `yxer` CLI 输出是唯一事实来源；字段名、枚举、账号、资源 key、分类、位置、音乐、商品、合集、活动等动态数据不得手写。
- CLI stdout 外层 `data` 只是机器可读结果容器；Agent 取得其中候选后，必须按目标 schema / `dynamicFieldExamples` 装配成发布字段结构，再请求接口。
- 只要候选结果不唯一，且下一步会产生写入、副作用或发布，必须先展示候选并等待用户明确选择。
- `validate`、`publish --dry-run`、正式 `publish` 必须使用同一份 payload 和同一套发布通道参数。

## 固定执行链

发布类写操作必须按以下链路执行：

1. 读取 `SKILL.md` 和相关 domain/workflow。
2. 执行 `yxer doctor`，确认环境可用。
3. 执行 `yxer accounts list <platform> --status 1`，只从有效账号中选择。
4. 执行 `yxer prepare <platform> <type>`，获取账号能力、前置数据和平台要求。
5. 执行 `yxer schema fields <platform> <type>`，确认字段名、类型、必填项；需要骨架时再执行 `yxer schema get`。
6. 对资源执行 `yxer upload`，只使用上传结果中的 key、size、width、height、duration、format 等字段。
7. 对需要查询的动态字段执行对应 `yxer query ...` 命令，保留 CLI 返回对象，不自行精简为 ID 或名称；多多视频 `shopping_cart.goods_id` 按平台 schema 由用户手工提供。
8. 从 CLI 输出 `data` 中选中候选后，按 schema / `dynamicFieldExamples` 转成目标字段结构；不要把查询响应 envelope 或候选对象直接当成完整发布请求。
9. 如果账号、动态对象、时间、发布通道或其他关键选项存在多个候选，先展示候选并等待用户确认。
10. 组装或修订 payload，只写入前面步骤已经确认的数据。
11. 执行 `yxer validate <platform> <type> <payload.json>`。
12. 执行 `yxer publish <type> <platform> <payload.json> --dry-run`。
13. 用户已授权正式发布时，才执行不带 `--dry-run` 的 `yxer publish`。

## 候选确认规则

以下情况必须等待用户确认，不能自动选择第一项：

- `accounts list` 返回多个可用账号，且用户没有指定账号。
- 用户按关键词选择分类、位置、音乐、商品、合集、剧集、活动、挑战、群组等，查询结果有多个合理候选。
- 用户给出的发布时间、发布通道、草稿类型或平台目标存在歧义。
- 本机发布需要 `clientId`，但当前 payload、flag 和配置中没有确定值。
- 查询结果与用户描述不完全匹配，但 Agent 认为可能可用。

可以自动选择的情况：

- 只有一个 `status=1` 的账号，且用户没有指定其他账号。
- 用户明确给出唯一账号 ID、资源 key、分类对象或查询命令返回项的稳定标识。
- 字段默认值已被 workflow 明确规定，例如 `formType=task`、默认云发布、封面默认使用首图或已上传封面。

自动选择时必须在面向用户的说明中告知选择依据，但 stdout 仍只输出 JSON。

## 动态对象来源表

| 数据类型 | 必须来源 | 写入规则 |
| --- | --- | --- |
| 账号 | `yxer accounts list` | 只使用 `status=1` 的账号；多个候选需确认 |
| 资源 | `yxer upload` | 使用 CLI 返回的完整资源字段，禁止外部 URL 直填 |
| 分类 | `yxer query categories` | 使用返回的完整对象；多级分类选择叶子节点或完整路径 |
| 位置 | `yxer query locations` | 使用返回对象，不手写 POI/raw |
| 音乐 | `yxer query music` / `music-categories` | 保留 playUrl/url 等查询元数据 |
| 商品（使用 `ShoppingCartItem` 的平台） | `yxer query goods` | 使用完整商品对象 |
| 多多视频 `shopping_cart.goods_id` | 用户明确输入 | 使用用户提供的业务商品 ID，CLI 固定补充 `source=pdd`，不读取 `yixiaoerId` |
| 合集 | `yxer query collections` | 使用完整合集对象并保留 `raw` |
| 视频号剧集 | `yxer query drama-tasks` | 使用完整三字段对象：`yixiaoerId`、`yixiaoerImageUrl`、`yixiaoerName`；不添加 `raw` |
| 话题/挑战 | `yxer query challenges` 或平台文档规定格式 | 不凭热门词手写 raw |
| 小红书描述中的用户艾特（含陌生人） | `yxer query friends --red-id` | 将完整用户对象 JSON 序列化到 `<friend>` 的 `raw`，不手写用户对象 |
| 活动/热点 | `yxer query activities` / `hot-events` | 使用完整返回对象 |
| 小程序/同步应用/游戏/群组 | 对应 `yxer query miniapps/syncapps/games/groups` | 使用 CLI 返回对象 |

## 禁止行为

- 从空白 JSON 猜字段、猜层级、猜枚举。
- 直接把用户自然语言中的名称写成动态对象。
- 查询结果为空时编造兜底对象。
- 只复制查询结果中的 ID，丢弃 CLI 返回的 raw 或配套字段；视频号剧集必须同时保留其三个真实字段。
- 修改 payload 后跳过 `validate` 或 `publish --dry-run`。
- `validate` 使用云发布参数，而 `publish` 改成本机发布参数，或反过来。
- 在用户只要求 dry-run、预览、修 payload 时执行正式写操作。

## 错误恢复

- `validate` 失败：只修正报错字段，重新按本工作流校验，不重写整份 payload。
- 动态字段校验失败：回到对应 `yxer query ...`，重新获取合法对象；多多视频 `shopping_cart.goods_id` 校验失败时回到用户输入并确认 ID，不使用商品查询对象。
- 资源字段校验失败：回到 `yxer upload`，不要手写 key 或尺寸。
- 账号失效：重新执行 `accounts list --status 1`，让用户确认新的账号。
- 发布通道失败：读取 `local-vs-cloud.md`，保持 validate、dry-run、publish 参数一致后重试。
