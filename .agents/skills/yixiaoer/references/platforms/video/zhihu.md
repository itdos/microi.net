# 知乎视频发布参数 (ZhiHu Video)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“知乎”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到知乎”
  - “同步视频到知乎”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为知乎。
2. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


在本平台视频发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定为 `task` | `task` |
| `title` | `string` | 否 | 视频标题 (1-50 字符) | - |
| `description` | `string` | **是** | 视频描述 (1-500 字符) | - |
| `category` | `Array` | **是** | 视频分类，使用 `CascadingPlatformDataItem[]` 结构 | - |
| `declaration` | `number` | 否 | 视频创作申明: 0-不声明, 2-图片/视频由AI生成 | 0 |
| `createType` | `number` | **是** | 内容类型: 1-原创, 2-转载 | 1 |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |
| `scheduledTime` | `number` | 否 | 定时发布时间戳 (13 位 Unix 时间戳，单位: 毫秒) | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["知乎"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "ZHIHU_ACC_ID",
        "video": {
          "key": "video_oss_key",
          "size": 1024000,
          "width": 1920,
          "height": 1080,
          "duration": 60
        },
        "contentPublishForm": {
          "formType": "task",
          "title": "知乎精选视频标题",
          "description": "这是关于知乎深度内容的视频分享描述内容。",
          "category": [
            { "yixiaoerId": "cat_001", "yixiaoerName": "科技", "raw": {} }
          ],
          "createType": 1,
          "declaration": 0,
          "pubType": 1
        }
      }
    ]
  }
}
```

## 3. 复杂对象结构说明

### 3.1 CascadingPlatformDataItem (分类对象)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 级联 ID |
| `yixiaoerName` | `string` | **是** | 级联名称 |
| `children` | `Array` | 否 | 子级对象列表 |
| `raw` | `object` | **是** | 平台原始数据 (必须完整透传) |

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
| `category` | `categories` | [获取发布分类](../../get-publish-categories.md) |
