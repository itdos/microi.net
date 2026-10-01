# Youtube 视频发布

> [!IMPORTANT]
> 先阅读 [视频发布首页](./index.md) 的标准 Payload 结构。本页仅说明 `contentPublishForm` 内的平台字段。

## contentPublishForm 字段

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | string | 是 | 固定为 `task` | `task` |
| `title` | string | 是 | 视频标题，最多 100 字符 | - |
| `description` | string | 否 | 视频简介，最多 5000 字符 | - |
| `tags` | string[] | 否 | 标签列表 | `[]` |
| `category` | string | 否 | 分类 ID：`1`,`2`,`10`,`15`,`17`,`19`,`20`,`22`,`23`,`24`,`25`,`26`,`27`,`28`,`29` | `22` |
| `license` | string | 否 | `youtube` 或 `creativeCommon` | `youtube` |
| `embeddable` | boolean | 否 | 是否允许嵌入 | `true` |
| `madeForKids` | boolean | 否 | 是否面向儿童 | `false` |
| `visible` | string | 否 | 公开范围：`public`、`unlisted`、`private` | `public` |
| `containsSyntheticMedia` | boolean | 否 | 是否包含逼真的加工或合成内容 | `false` |
| `fps` | number | 否 | 封面帧毫秒偏移；也可在 `accountForms[]` 层填写 | `10` |

`thumbnail` 和 `videoKey` 是前端中间态字段；CLI 发布时应使用 `yxer upload` 后的 `accountForms[].video`、`accountForms[].cover` 和 `coverKey`。

## 示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["Youtube"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "YOUTUBE_ACC_ID",
        "video": { "key": "video_key", "size": 1024000, "width": 1920, "height": 1080 },
        "cover": { "key": "cover_key", "size": 204800, "width": 1280, "height": 720 },
        "coverKey": "cover_key",
        "contentPublishForm": {
          "formType": "task",
          "title": "Launch recap",
          "description": "Highlights from the launch",
          "category": "22",
          "license": "youtube",
          "visible": "public",
          "embeddable": true,
          "madeForKids": false,
          "containsSyntheticMedia": false
        }
      }
    ]
  }
}
```
