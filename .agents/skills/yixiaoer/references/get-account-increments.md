# 获取账号增量数据

查询“数据 -> 账号数据 -> 增量数据”页面使用的时间区间统计。CLI 使用日期输入，并转换为接口所需的中国标准时间（UTC+8）当天起止 Unix 毫秒时间戳。

## 命令

```text
yxer query account-increments --start-date 2026-08-14 --end-date 2026-08-20 [--group-id GROUP_ID] [--platform PLATFORM] [--account-name NAME]
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `--start-date` | 是 | 包含当天，格式 `YYYY-MM-DD` |
| `--end-date` | 是 | 包含当天，格式 `YYYY-MM-DD` |
| `--group-id` | 否 | 按账号分组 ID 筛选 |
| `--platform` | 否 | 按平台筛选，例如 `xhs` 或 `小红书` |
| `--account-name` | 否 | 按账号名称关键词筛选 |

开始日期不能晚于结束日期。日期范围转换示例：

```text
2026-08-14 -> startTime=1786636800000
2026-08-20 -> endTime=1787241599999
```

## 接口来源

CLI 使用已有 API key 鉴权，并发送 `x-client: web`、`x-platform: windows`、`x-version: 2.7.3`。命令会读取页面对应的三个只读接口：

- `GET /overview/incremental`：增量账号、汇总和趋势，带 `startTime`、`endTime`。
- `GET /social/dm-stats`：仅传入增量账号 ID，返回这些账号的私信 `summary` 和按日 `trend`，带同一时间范围。
- `GET /v2/platform/accounts?page=1&size=1000`：管理账号详情，包含负责人 `principal`、运营人 `operators` 等服务端字段。

CLI 保留增量接口原有的 `accounts`、`summary`、`trends` 字段，并在同一 `data` 下增加 `dmMessageStats` 与 `managedAccounts`。`dmMessageStats.totals` 和 `incrementalAccountTotals` 均是本次增量账号列表口径，包含 `inCount/outCount`；`dailyTrend` 也是这些账号的逐日收发，并补齐整个日期范围。`accounts` 中增加对应账号的 `dmInCount`、`dmOutCount`、可读的 `statusLabel`，以及页面口径的 `dataUpdatedAt`、`dataUpdatedTime`（`overviewUpdatedAt` 优先，`updatedAt` 回退）。原始接口字段仍保持不变。

## 输出

```json
{
  "ok": true,
  "action": "account-increments",
  "version": "3.2.9",
  "data": {
    "accounts": [],
    "summary": {},
    "trends": [],
    "dmMessageStats": {"summary": [], "trend": [], "totals": {"inCount": 0, "outCount": 0}, "incrementalAccountTotals": {"inCount": 0, "outCount": 0}, "dailyTrend": []},
    "managedAccounts": {"page": 1, "size": 1000, "totalSize": 0, "totalPage": 1, "data": []}
  }
}
```

页面展示的新增发布数、新增粉丝、播放/阅读、评论、点赞、收藏、私信收发趋势及管理账号信息，均以 `data` 中接口实际返回的字段为准。
