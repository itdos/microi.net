# Facebook 视频发布

> [!IMPORTANT]
> 先阅读 [视频发布首页](./index.md) 的标准 Payload 结构。本页仅说明 `contentPublishForm` 内的平台字段。

## contentPublishForm 字段

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | string | 是 | 固定为 `task` | `task` |
| `title` | string | 否 | 视频标题，最多 128 字符 | - |
| `description` | string | 否 | 视频描述，最多 2048 字符 | - |

`thumbnail` 和 `videoKey` 是前端中间态字段；CLI 发布时应使用 `yxer upload` 后的 `accountForms[].video`、`accountForms[].cover` 和 `coverKey`。

## 示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["Facebook"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "FACEBOOK_ACC_ID",
        "video": { "key": "video_key", "size": 1024000, "width": 1920, "height": 1080 },
        "contentPublishForm": {
          "formType": "task",
          "title": "Campaign video",
          "description": "Campaign story"
        }
      }
    ]
  }
}
```
