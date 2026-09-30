# 获取地理位置 (Get Locations)

获取在发布内容时可选的地理位置列表（支持 POI 搜索、门店地址、带货地址等）。

## 调用指令 (Command)

```bash
yxer query locations XXX --query 深圳 --type 1 --json
```

## 参数列表 (Payload Properties)

| 字段名 | 类型 | 是否必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `account_id` | `string` | **是** | 蚁小二账号 ID (32位十六进制) |
| `keyword` | `string` | 否 | 搜索关键词 |
| `type` | `number` | 否 | 地址权限/搜索类型：`0`: 全部, `1`: 本地 (默认), `2`: 国内, `3`: 海外 |
| `nextPage` | `string` | 否 | 分页标识，在返回结果中获取 |

## 返回结果 (Response)

返回一个包含地理位置对象的数组。发布时必须将 `yxer query locations` 返回的整个对象作为 `location` 参数传递给发布流程，不能只摘取 `yixiaoerId`、`yixiaoerName` 或 `raw`。

```json
[
  {
    "yixiaoerId": "POI_12345",
    "yixiaoerName": "深圳市南山区...",
    "yixiaoerDesc": "详细地址描述",
    "productCount": "100",
    "cpsProductCount": "50",
    "raw": { ... }
  }
]
```

### 基础结构 (Base Structure)
- `yixiaoerId`: (必填) 内部唯一 ID。
- `yixiaoerName`: (必填) 地理位置名称。
- `raw`: (必填) 原始平台返回的地理位置对象。如果在获取时该字段存在，发布表单中必须携带并完整透传。
- `yixiaoerDesc`: (可选) 地理位置详细说明。

## CLI / 后端逻辑

- **CLI 命令**: `yxer query locations <account_id> [--query 关键词] [--type 0|1|2|3] [--json]`
- **功能**: 封装蚁小二标准地理位置查询接口 (`GET /platform-accounts/{platformAccountId}/location`)。
- **参数映射**: 将 `account_id` 映射为路径变量，将 `keyWord`, `locationType`, `nextPage` 映射为查询参数。

