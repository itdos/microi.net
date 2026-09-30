# 获取成员列表

用于查询团队成员列表，对应接口 `GET /members`。

## 推荐命令

```bash
yxer query members
yxer query members --status joined --query 张三
yxer query members --role member --page 1 --size 10
```

## 请求说明

- 支持分页参数：`--page`、`--size`
- 支持成员状态过滤：`--status notJoined|pending|joined`
- 支持成员角色过滤：`--role master|admin|member`
- 支持按成员名称或手机号搜索：`--query`（`--keyword` 为别名）

## 使用建议

- 当账号分组需要填写 `visibleUsers`、或用户说“指定成员可见”时，应先执行 `yxer query members` 获取真实成员 ID。
- `visibleUsers` 必须直接使用 CLI 返回结果中的真实用户 ID，不要手写或猜测。

## 输出说明

- 返回成员列表。
- 具体字段以 CLI 实际 JSON 输出为准，Agent 应直接消费返回结果，不要手写成员对象。
