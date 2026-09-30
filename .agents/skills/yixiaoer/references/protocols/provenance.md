# 字段来源追踪协议

> 适用范围：任何创建、修改、解释或提交 `payload.json` 的任务。

本文档定义 Agent 如何记录字段来源，避免 payload 看似正确但无法追溯。

## 来源优先级

字段来源优先级从高到低：

1. `yxer prepare <platform> <type>` 返回的表单契约、账号能力和前置数据。
2. `yxer schema fields <platform> <type>` / `yxer schema get <platform> <type>` 返回的字段定义、类型、必填项和示例结构。
3. `yxer query ...` 返回的动态候选对象。
4. `yxer upload` 返回的资源 key、尺寸、时长、格式等元数据。
5. 用户明确提供的业务内容，例如标题、正文、描述、发布时间。
6. 平台文档中明确声明的差异规则。

## 建议记录结构

当 CLI 或 payload 支持 meta 时，Agent 应记录字段来源。若当前命令不支持写入 meta，也应在 dry-run 或最终说明中保留关键来源摘要。

```json
{
  "field": "publishArgs.accountForms[0].platformAccountId",
  "sourceType": "cli.accounts",
  "sourceCommand": "yxer accounts list 抖音 --status 1 --json",
  "sourceId": "acc_001",
  "confirmedByUser": true
}
```

## 必须追踪的字段

| 字段类型 | 必须记录 |
| --- | --- |
| 账号 | 来源命令、`platformAccountId`、是否用户确认 |
| 资源 | 上传命令、原始文件或 URL、返回 key、size、width、height、duration、format |
| 分类 | 查询命令、分类 ID、分类路径、是否叶子节点 |
| 位置 | 查询命令、位置 ID、名称、raw 来源 |
| 音乐 | 查询命令、音乐 ID、名称、playUrl/url 是否保留 |
| 商品 | 查询命令、商品 ID、名称、raw 来源 |
| 合集/活动/话题/群组 | 查询命令、稳定 ID、名称、平台限制 |
| 视频号剧集 | `drama-tasks` 查询命令、`yixiaoerId`、`yixiaoerImageUrl`、`yixiaoerName`；不要求 `raw` |
| 发布通道 | `cloud` / `local` 决策依据、`clientId` 来源 |
| 发布时间 | 用户输入、解析后的 13 位毫秒时间戳 |

## 禁止来源

以下来源不得直接写入 payload：

- 用户自然语言中的动态对象名称。
- 示例 JSON 中的 ID、key、raw、尺寸或枚举。
- 历史成功 payload 中的账号、分类、位置、音乐、商品、资源 key。
- 未经当前 CLI 查询确认的本地缓存。
- CLI stdout 外层 envelope，例如直接把整个 `{ "data": ... }` 当作字段值。

## 修改 payload 时的追踪规则

- 只修复报错字段，不重写整份 payload。
- 修改字段后，更新该字段来源说明。
- 任意字段修改后，必须重新执行 `validate`；发布任务还必须重新执行 `publish --dry-run`。
- 如果无法确认字段来源，停止写操作并回到对应查询、上传或用户确认步骤。
