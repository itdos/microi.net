# 获取挑战/话题列表 (Get Challenges)

获取平台当前进行的挑战活动或推荐的话题列表。

## 1. 调用指令

```bash
yxer query challenges YOUR_ACCOUNT_ID --query 搜索词 --json
```

## 2. 返回数据结构

返回 `Category` 数组。发布时必须直接使用 `yxer query challenges` 返回的完整对象，不能只保留 ID、名称或 `raw` 的局部字段。

