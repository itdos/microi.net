# TikTok 视频发布

> [!IMPORTANT]
> 先阅读 [视频发布首页](./index.md) 的标准 Payload 结构。本页仅说明 `contentPublishForm` 内的平台字段。

## contentPublishForm 字段

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | string | 是 | 固定为 `task` | `task` |
| `description` | string | 是 | 视频描述，最多 2200 字符 | - |
| `visible` | string | 否 | 可见性：`public`、`friends`、`private` | `public` |
| `comment` | boolean | 否 | 是否允许评论 | `true` |
| `stitch` | boolean | 否 | 是否允许 Stitch | `true` |
| `duet` | boolean | 否 | 是否允许 Duet | `true` |
| `aigc` | boolean | 否 | 是否 AI 生成内容 | `false` |
| `business` | boolean | 否 | 是否品牌与商业合作披露 | `false` |
| `yourOwn` | boolean | 否 | 是否你的品牌 | `false` |
| `collaborative` | boolean | 否 | 是否合作品牌 | `false` |
| `fps` | number | 否 | 封面帧毫秒偏移；也可在 `accountForms[]` 层填写 | `10` |
| `isAdVideo` | boolean | 否 | 是否广告视频 | `false` |

`thumbnail` 和 `videoKey` 是前端中间态字段；CLI 发布时应使用 `yxer upload` 后的 `accountForms[].video`、`accountForms[].cover` 和 `coverKey`。

## 示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["TikTok"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "TIKTOK_ACC_ID",
        "video": { "key": "video_key", "size": 1024000, "width": 1080, "height": 1920 },
        "contentPublishForm": {
          "formType": "task",
          "description": "A short product demo",
          "visible": "public",
          "comment": true,
          "stitch": true,
          "duet": true,
          "fps": 10
        }
      }
    ]
  }
}
```
