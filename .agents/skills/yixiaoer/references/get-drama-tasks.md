# 获取视频号剧集列表

视频号的“剧集”是独立于“合集”的挂载能力。查询剧集使用 `drama-tasks`，不要用 `collections` 的返回对象代替。

## 调用指令

```bash
yxer query drama-tasks ACCOUNT_ID --query 剧名 --json
```

`--keyword` 是 `--query` 的兼容别名。即使不提供关键词，CLI 也会向接口发送 `keyWord=`。

## 返回对象

查询结果中的每个剧集对象必须完整保留以下三个字段：

```json
{
  "yixiaoerId": "event/<真实剧集标识>",
  "yixiaoerImageUrl": "http://wxapp.tc.qq.com/<查询结果图片>",
  "yixiaoerName": "风浪过后护妻安康"
}
```

剧集对象不包含也不需要 `raw`。不要从自然语言、旧缓存或合集结果手工拼出对象。

## 表单选择

```bash
yxer publish form choose publish-form.json drama \
  --value-file drama-tasks.json \
  --id <yixiaoerId> \
  --source-command "yxer query drama-tasks <account_id> --query 剧名 --json"
```

候选来源必须是当前目标视频号账号的 `yxer query drama-tasks` 返回值。多个候选必须使用 `--id` 或 `--index` 明确选择；`form set` 不能直接写入剧集字段。

## CLI / 后端逻辑

- **CLI 命令**：`yxer query drama-tasks <account_id> [--query 关键词] [--json]`
- **接口**：`GET /api/platform-accounts/{platformAccountId}/drama-tasks?keyWord={keyword}`
- **发布路径**：`publishArgs.accountForms[].contentPublishForm.drama`
- **与合集的区别**：合集使用 `yxer query collections` 和 `collection`，继续保留完整 `raw`；剧集使用 `drama-tasks` 和 `drama`，只保留上述三个字段。
