# 爱奇艺视频发布参数 (AiQiYi Video)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Aiqiyi”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到Aiqiyi”
  - “同步视频到Aiqiyi”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为Aiqiyi。
2. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


在本平台视频发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定为 `task` | `task` |
| `title` | `string` | **是** | 视频标题 (长度: 1-50 字符) | - |
| `description` | `string` | **是** | 视频描述 (长度: 1-500 字符) | - |
| `tags` | `string[]` | **否** | 视频标签 (最多 10 个) | - |
| `category` | `Array` | **是** | 视频分类，使用 `CascadingPlatformDataItem[]` 结构 | - |
| `createType` | `number` | **是** | 内容类型：1-原创，2-转载 | 1 |
| `pubType` | `number` | **是** | 发布类型：0-草稿，1-直接发布 | 1 |
| `declaration` | `number` | **否** | 声明：0-无需申明，1-内容由 AI 生成, 2-虚构演绎, 3-取材网络 | 0 |
| `scheduledTime` | `number` | **否** | 定时任务 (13 位 Unix 时间戳，单位: 毫秒) | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["爱奇艺"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_aqy_vid_001",
        "video": {
          "key": "video_oss_key",
          "size": 1024000,
          "width": 1920,
          "height": 1080,
          "duration": 120
        },
        "coverKey": "video_cover_key",
        "cover": { "key": "video_cover_key", "size": 102400, "width": 800, "height": 600 },
        "contentPublishForm": {
          "formType": "task",
          "title": "爱奇艺精彩视频",
          "description": "这是一段有趣的视频描述，展示了爱奇艺发布流程。",
          "tags": ["影视", "科技"],
          "category": [
            { "yixiaoerId": "cat_001", "yixiaoerName": "影视", "raw": {} }
          ],
          "createType": 1,
          "pubType": 1,
          "declaration": 0
        }
      }
    ]
  }
}
```

## 3. 复杂对象结构说明

### 3.1 CascadingPlatformDataItem (多级分类)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 级联 ID |
| `yixiaoerName` | `string` | **是** | 级联显示的名称 |
| `children` | `Array` | 否 | 子级对象列表 |
| `raw` | `object` | **是** | 平台原始数据 (必须完整透传) |

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
| `category` | `categories` | [获取发布分类](../../get-publish-categories.md) |
