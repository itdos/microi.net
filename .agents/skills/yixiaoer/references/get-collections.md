# 获取合集列表 (Get Collections)

获取账号已创建的合集列表。主要用于抖音、今日头条等支持合集的平台。

## 调用指令 (Command)

```bash
yxer query collections ACCOUNT_ID --json
```

## 参数列表 (Payload Properties)

| 字段名 | 类型 | 是否必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `account_id` | `string` | **是** | 蚁小二账号 ID (32位十六进制) |

返回一个 `Category` 数组。发布时必须直接使用 `yxer query collections` 返回的完整对象作为 `collection` 参数传递给发布流程，不能只保留 ID、名称或 `raw` 的局部字段。

```json
[
  {
    "yixiaoerId": "col_123",
    "yixiaoerName": "美食系列",
    "raw": { ... }
  }
]
```

## CLI / 后端逻辑

- **CLI 命令**: `yxer query collections <account_id> [--type video|article] [--json]`
- **功能**: 封装蚁小二标准化合集查询接口 (`GET /platform-accounts/{platformAccountId}/collections`)。
- **参数映射**: 将 `account_id` 映射为 URL 路径变量，将 `type` 映射为 `publishType` 查询参数。

