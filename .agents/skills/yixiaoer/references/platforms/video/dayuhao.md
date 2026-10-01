# 大鱼号视频发布参数 (DaYuHao Video)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Dayuhao”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到Dayuhao”
  - “同步视频到Dayuhao”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为Dayuhao。
2. **参数装配**：识别并填充标题、标签、分类等平台特定字段至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


在本平台视频发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值为 `task` | `task` |
| `title` | `string` | **是** | 视频标题 (5-60 字符) | - |
| `tags` | `string[]` | 否 | 最多 10 个标签，每个标签最多 10 字 | `[]` |
| `category` | `Array` | **是** | 视频分类，至少选择一个查询结果，使用 `CascadingPlatformDataItem[]` | - |
| `createType` | `number` | 否 | 创作类型: 0-非原创, 1-原创 | 0 |
| `declaration` | `number` | 否 | 声明字段: 0-无需申明, 3-虚构演绎, 4-AI 生成 | 0 |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |
| `horizontalCover` | `object` | 否 | 视频横版封面，使用 `OldCover` 结构；填写在 `contentPublishForm.horizontalCover`，也可用共享字段 `publishArgs.horizontalCover` 自动补齐 | - |
| `scheduledTime` | `number` | 否 | 定时发布时间戳 (13 位 Unix 时间戳，单位: 毫秒) | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["大鱼号"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_dy_vid_001",
        "video": {
          "key": "video_oss_key",
          "size": 1024000,
          "width": 1920,
          "height": 1080,
          "duration": 60
        },
        "coverKey": "video_cover_key",
        "cover": { "key": "video_cover_key", "size": 102400, "width": 800, "height": 600 },
        "contentPublishForm": {
          "formType": "task",
          "title": "大鱼号视频发布标题",
          "horizontalCover": { "key": "horizontal_cover_key", "size": 102400, "width": 1280, "height": 720 },
          "tags": ["生活", "摄影"],
          "category": [
            { "yixiaoerId": "cat_001", "yixiaoerName": "生活", "raw": {} }
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

发布前先执行 `yxer query categories <platformAccountId> --type video --json`，从结果中选择分类并保留完整对象。大鱼号分类跟随蚁小二 Web 端固定目录，CLI 将目录嵌入自身并在确认账号平台后直接返回，不请求不支持大鱼号的账号分类接口。CLI 会在提交时将查询对象转换为蚁小二表单使用的 `id`、`text`、`raw` 结构。

### 3.1 CascadingPlatformDataItem (分类对象)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 级联 ID |
| `yixiaoerName` | `string` | **是** | 级联显示的名称 |
| `children` | `Array` | 否 | 子级对象列表 |
| `raw` | `object` | **是** | 平台原始对象 (必须透传) |

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
| `category` | `categories` | [获取发布分类](../../get-publish-categories.md) |
