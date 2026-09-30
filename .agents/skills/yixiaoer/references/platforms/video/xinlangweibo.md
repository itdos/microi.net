# 新浪微博 视频发布

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“新浪微博”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到新浪微博”
  - “同步视频到新浪微博”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为新浪微博。
2. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


## 1. contentPublishForm 数据结构

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| formType | string | 是 | 固定为 `task` | `task` |
| title | string | 是 | 视频标题 | - |
| description | string | 是 | 视频描述 | - |
| type | number | 否 | 内容类型：1-原创, 2-转载内容, 3-二次创作内容 | 1 |
| location | object | 否 | 视频位置，使用 `PlatformDataItem` 结构 | - |
| scheduledTime | number | 否 | 定时发布时间戳（13 位 Unix 时间戳，单位：毫秒） | - |
| collection | object | 否 | 合集信息 | - |

## 2. 复杂对象结构

### PlatformDataItem
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| id | string | 是 | ID |
| text | string | 是 | 文本内容 |
| raw | object | 是 | 平台原始数据 |

## 3. JSON 示例

```json
{
  "publishType": "video",
  "platforms": ["新浪微博"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "WEIBO_ACC_ID",
        "video": {
          "key": "v_key",
          "size": 1024000,
          "width": 1920,
          "height": 1080,
          "duration": 60
        },
        "contentPublishForm": {
          "formType": "task",
          "title": "微博视频发布标题",
          "description": "这是发布在微博的一段视频详情内容 #记录生活",
          "type": 1,
          "location": {
            "id": "loc_123",
            "text": "上海市",
            "raw": {}
          }
        }
      }
    ]
  }
}
```

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
