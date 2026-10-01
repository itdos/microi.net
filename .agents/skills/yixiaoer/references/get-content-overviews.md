# 获取作品数据 (Get Content Overviews)

获取当前团队下各账号发布的作品数据统计信息。

## 触发场景 (Trigger)
- **意图辨析**：当用户需要查询、分析或导出已发布内容（视频、文章等）的传播数据（阅读量、点赞量、转发量等）时触发。
- **典型提示词**：
  - “我的抖音视频播放量怎么样了？”
  - “查询最近 7 天所有账号的作品数据”
  - “看看特定账号 A 的点赞情况”
  - “由于最近流量下滑，查询表现最差的作品”

## 参数定义 (Parameters)

### 参数列表 (Payload Properties)

| 字段名 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`content-overviews` |
| `platform` | `string` | 否 | 指定查询某个平台。见 [平台定义](./platform.md)。 |
| `platformAccountId` | `string` | 否 | 媒体账号 ID (ObjectId)。 |
| `publishUserId` | `string` | 否 | 发布人 ID (ObjectId)。 |
| `type` | `string` | 否 | 作品类型：`article` (文章), `video` (视频), `miniVideo` (短视频), `dynamic` (动态)。 |
| `title` | `string` | 否 | 作品标题，支持模糊查询。 |
| `publishStartTime` | `number` | 否 | 发布时间范围开始（Unix 时间戳，毫秒）。 |
| `publishEndTime` | `number` | 否 | 发布时间范围结束（Unix 时间戳，毫秒）。 |
| `page` | `number` | 否 | 当前页码，默认 `1`。 |
| `size` | `number` | 否 | 每页数量，默认 `10`。 |

## 执行逻辑 (Logic Flow)
1. **需求解析**：识别用户查询的时间范围、平台及作品类型意图。
2. **时间处理**：将相对时间（如“最近7天”）转换为 Unix 毫秒时间戳注入 `publishStartTime`。
3. **参数装配**：构造 `action: "content-overviews"` 及其余过滤参数。
4. **指令执行**：当前能力正在迁移到 `yxer` CLI，本文档不再推荐脚本直调。
5. **数据反馈**：对返回的 `contentData` 进行聚合或横向对比，直接回答用户关心的关键性指标。

## 返回结果说明 (Response Details)

返回包含作品数据列表的对象。主要字段如下：

### 复杂对象：data.data (作品对象)

| 字段 | 类型 | 描述 |
| :--- | :--- | :--- |
| `platformAccountId` | `string` | 媒体账号 ID |
| `accountName` | `string` | 账号昵称 |
| `publishUserName` | `string` | 发布人昵称 |
| `contentData` | `object` | 原始统计数据。包含 `reCommand` (推荐), `play` (播放), `read` (阅读), `great` (点赞), `comment` (评论), `share` (分享), `collect` (收藏) 等。 |
| `updatedAt` | `number` | 数据更新时间戳 |

## 调用指令 (Command)

```text
当前版本尚未提供独立 `yxer` 子命令。
本页仅保留字段结构说明，执行时应优先扩展 Go CLI，而不是寻找旧脚本入口。
```

## 注意事项
- 查询大范围数据时，建议合理设置 `publishStartTime` 和 `publishEndTime` 以提高查询效率。
