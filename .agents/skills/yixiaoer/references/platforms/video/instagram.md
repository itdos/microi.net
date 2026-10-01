# Instagram 视频发布

> [!IMPORTANT]
> 先阅读 [视频发布首页](./index.md) 的标准 Payload 结构。本页仅说明 `contentPublishForm` 内的平台字段。

## contentPublishForm 字段

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | string | 是 | 固定为 `task` | `task` |
| `description` | string | 否 | 视频描述，最多 2200 字符 | - |
| `share_to_feed` | boolean | 否 | 是否分享到动态 | `false` |

`thumbnail` 和 `videoKey` 是前端中间态字段；CLI 发布时应使用 `yxer upload` 后的 `accountForms[].video`、`accountForms[].cover` 和 `coverKey`。

> [!CAUTION]
> Instagram 是 Meta 容器式发布。Meta 会在“创建发布容器”阶段主动下载 `accountForms[].video.key` 对应的媒体 URL。若上传资源的原文件名或最终 key 路径含中文等非 ASCII 字符，Meta 可能直接返回 HTTP 400，导致容器创建失败。处理方式是把原视频改成英文文件名后重新执行 `yxer upload`，再更新 payload 中的 `video.key`。

## 示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["Instagram"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "INSTAGRAM_ACC_ID",
        "video": { "key": "video_key", "size": 1024000, "width": 1080, "height": 1920 },
        "contentPublishForm": {
          "formType": "task",
          "description": "New reel",
          "share_to_feed": false
        }
      }
    ]
  }
}
```
