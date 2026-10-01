# 易车号 视频发布

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Yichehao”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到Yichehao”
  - “同步视频到Yichehao”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为Yichehao。
2. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


## 1. contentPublishForm 数据结构

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| formType | string | 是 | 固定为 `task` | `task` |
| title | string | 是 | 视频标题 | - |
| description | string | 是 | 视频描述 | - |
| scheduledTime | number | 否 | 定时发布时间戳（13 位 Unix 时间戳，单位：毫秒） | - |

## 2. JSON 示例

```json
{
  "publishType": "video",
  "platforms": ["Yichehao"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "YICHE_ACC_ID",
        "video": {
          "key": "v_key",
          "size": 1024000,
          "width": 1920,
          "height": 1080,
          "duration": 60
        },
        "contentPublishForm": {
          "formType": "task",
          "title": "易车网汽车评测视频",
          "description": "这是一段关于新款汽车性能评测的详细视频内容。"
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
