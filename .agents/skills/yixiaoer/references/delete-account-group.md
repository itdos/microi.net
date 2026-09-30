# 删除账号分组

用于删除账号分组，对应接口 `DELETE /groups/{groupId}`。

## 推荐命令

```bash
yxer account-group delete group_1 --dry-run
yxer account-group delete group_1
```

## 请求说明

- 路径参数 `groupId` 使用命令第一个位置参数传入。
- 删除前先执行 `--dry-run`，确认目标分组 ID 后再正式提交。

## 输出说明

- `--dry-run` 返回预览请求，不产生实际副作用。
- 正式执行返回远端删除结果；若接口返回空响应，CLI 成功 envelope 中的 `data` 可能为 `null`。
