# 腾讯视频 视频发布

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Tengxunshipin”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到Tengxunshipin”
  - “同步视频到Tengxunshipin”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为Tengxunshipin。
2. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


## 1. contentPublishForm 数据结构

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| formType | string | 是 | 固定为 `task` | `task` |
| title | string | 是 | 视频标题 | - |
| tags | string[] | 否 | 视频标签 | - |
| declaration | number | 否 | 腾讯视频申明：1-内容由AI生成, 2-剧情演绎仅供娱乐, 3-取材网络谨慎甄别, 4-个人观点仅供参考 | - |
| scheduledTime | number | 否 | 定时发布时间戳（13 位 Unix 时间戳，单位：毫秒） | - |

## 2. JSON 示例

```json
{
  "publishType": "video",
  "platforms": ["Tengxunshipin"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "TX_VIDEO_ACC_ID",
        "video": {
          "key": "v_key",
          "size": 1024000,
          "width": 1920,
          "height": 1080,
          "duration": 60
        },
        "contentPublishForm": {
          "formType": "task",
          "title": "腾讯视频标题示例",
          "tags": ["影视", "评论"],
          "declaration": 4
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
