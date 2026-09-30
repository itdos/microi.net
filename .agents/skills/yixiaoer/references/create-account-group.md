# 创建账号分组

用于创建账号分组，对应接口 `POST /groups`。

## 推荐命令

```bash
yxer account-group create 核心账号组 --dry-run
yxer account-group create 核心账号组
yxer account-group create 核心账号组 --visible-scope all --dry-run
yxer account-group create 核心账号组 --visible-scope specific --visible-user user_1 --visible-user user_2 --dry-run
```

## 请求说明

- CLI 请求体支持以下字段：
  - `name`: 分组名
  - `visibleScope`: 可见范围，支持 `all` / `specific`
  - `visibleUsers`: 当 `visibleScope=specific` 时必填，表示可见用户 ID 列表
- `--visible-scope specific` 时，必须至少传入一个 `--visible-user <userId>`。
- 当涉及“指定成员可见”时，应先执行 [`yxer query members`](./get-members.md) 获取真实成员 ID，再回填到 `--visible-user`。
- 写操作先执行 `--dry-run`，确认请求体后再正式提交。

## 输出说明

- `--dry-run` 返回预览请求，不产生实际副作用。
- 正式执行返回远端创建结果，字段以 CLI 实际 JSON 输出为准。
