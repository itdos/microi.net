# 获取音乐分类 (Get Music Categories)

获取在选择音乐素材时可选的分类列表。

## 调用指令 (Command)

```bash
yxer query music-categories <account_id> --json
```

抖音账号会返回推荐、热门榜、飙升榜、原创榜等榜单。将结果中的 `yixiaoerId` 和 `yixiaoerName` 一并用于音乐查询：

```bash
yxer query music <account_id> --category-id <yixiaoerId> --category-name <yixiaoerName> --json
```

## 参数列表 (Payload Properties)

| 字段名 | 类型 | 是否必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `account_id` | `string` | **是** | 蚁小二账号 ID (32位十六进制) |

## 返回结果 (Response)

返回一个包含音乐分类对象的数组。

```json
[
  {
    "yixiaoerId": "123",
    "yixiaoerName": "流行",
    "raw": { "id": "123", "name": "流行" }
  }
]
```

### 复杂对象：CategoryItem
- `yixiaoerId`: 内部分类 ID。
- `yixiaoerName`: 分类名称。
- `raw`: 原始平台返回的分类对象。

## 后端逻辑说明

- **功能**: 封装蚁小二标准音乐分类查询接口。
