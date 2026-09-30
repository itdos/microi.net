# 快手-Open 视频发布参数 (KuaiShou-Open Video)

> [!IMPORTANT]
> 在使用本平台的特定参数之前，必须先阅读 [视频发布首页](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。

## 执行逻辑

1. 查询账号：`yxer accounts list 快手-Open --status 1 --json`。
2. 上传视频和封面后组装 `accountForms[i].contentPublishForm`。
3. 先执行 `yxer validate 快手-Open video <payload.json>`，再执行 `yxer publish video 快手-Open <payload.json> --dry-run`。

## contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | 是 | 固定为 `task` | `task` |
| `description` | `string` | 是 | 视频描述 | - |
| `visibleType` | `number` | 否 | 可见类型：0-公开，1-私密 | 0 |
| `pubType` | `number` | 否 | 发布类型：0-草稿，1-直接发布 | 1 |
| `scheduledTime` | `number` | 否 | 定时发布时间戳，毫秒 | - |

## Payload 示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["快手-Open"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "KUAISHOU_OPEN_ACC_ID",
        "video": { "key": "v_key", "size": 1024000, "width": 1080, "height": 1920, "duration": 15 },
        "cover": { "key": "cover_key", "size": 102400, "width": 1080, "height": 1920 },
        "coverKey": "cover_key",
        "contentPublishForm": {
          "formType": "task",
          "description": "快手 Open 视频描述"
        }
      }
    ]
  }
}
```
