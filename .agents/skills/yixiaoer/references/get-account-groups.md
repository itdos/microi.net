# 获取账号分组列表

用于查询账号分组列表，对应接口 `GET /groups`。

## 推荐命令

```bash
yxer account-group list [--page 1] [--size 10]
```

## 输出说明

- 返回账号分组列表。
- 支持分页参数：`--page`、`--size`。
- 具体字段以 CLI 实际 JSON 输出为准，Agent 应直接消费返回结果，不要手写分组对象。
