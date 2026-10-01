# 哔哩哔哩-Open 视频发布参数 (BiLiBiLi-Open Video)

> [!IMPORTANT]
> 在使用本平台的特定参数之前，必须先阅读 [视频发布首页](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。

## 执行逻辑

1. 查询账号：`yxer accounts list 哔哩哔哩-Open --status 1 --json`。
2. 查询分类：`yxer query categories <account_id> --type video --json`，分类对象必须完整来自查询结果。
3. 上传视频和封面后组装 `accountForms[i].contentPublishForm`。
4. 先执行 `yxer validate 哔哩哔哩-Open video <payload.json>`，再执行 `yxer publish video 哔哩哔哩-Open <payload.json> --dry-run`。

## contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | 是 | 固定为 `task` | `task` |
| `title` | `string` | 是 | 视频标题 | - |
| `description` | `string` | 否 | 视频描述 | - |
| `tags` | `string[]` | 是 | 视频标签，1-12 个，单个最多 20 字 | - |
| `category` | `Array` | 是 | 视频分类，使用 `CascadingPlatformDataItem[]`，必须来自 `query categories` | - |
| `allowReprint` | `number` | 否 | 是否允许转载：0-允许，1-不允许 | 0 |
| `createType` | `number` | 否 | 类型：1-原创，2-转载。CLI 推荐使用该字段 | 1 |
| `type` | `number` | 否 | 后端 DTO 兼容字段：1-原创，2-转载 | 1 |
| `reprintSource` | `string` | 否 | 转载来源；转载时填写 | - |
| `visibleType` | `number` | 否 | 可见类型：0-公开，1-私密 | 0 |
| `pubType` | `number` | 否 | 发布类型：0-草稿，1-直接发布 | 1 |
| `scheduledTime` | `number` | 否 | 定时发布时间戳，毫秒 | - |

## Payload 示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["哔哩哔哩-Open"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "BILIBILI_OPEN_ACC_ID",
        "video": { "key": "v_key", "size": 1024000, "width": 1920, "height": 1080, "duration": 60 },
        "cover": { "key": "cover_key", "size": 102400, "width": 960, "height": 600 },
        "coverKey": "cover_key",
        "contentPublishForm": {
          "formType": "task",
          "title": "哔哩哔哩 Open 投稿",
          "description": "视频简介",
          "tags": ["生活"],
          "category": [
            { "yixiaoerId": "cat_001", "yixiaoerName": "生活", "raw": {} }
          ],
          "allowReprint": 0,
          "createType": 1
        }
      }
    ]
  }
}
```
