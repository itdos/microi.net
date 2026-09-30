# 网易号 视频发布

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Wangyihao”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到Wangyihao”
  - “同步视频到Wangyihao”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为Wangyihao。
2. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


## 1. contentPublishForm 数据结构

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定为 `task` | `task` |
| `title` | `string` | **是** | 视频标题 | - |
| `description` | `string` | 否 | 视频描述 | - |
| `tags` | `string[]` | **是** | 视频标签 | - |
| `category` | `object[]` | **是** | 视频分类，使用 `CascadingPlatformDataItem[]` 结构 | - |
| `declaration` | `number` | 否 | 创作申明：1-内容由AI生成, 2-个人原创, 3-取材网络, 4-虚构演绎 | - |
| `createType` | `number` | 否 | 创作类型：0-非原创, 1-原创 | 0 |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |
| `scheduledTime` | `number` | 否 | 定时发布时间戳（13 位 Unix 时间戳，单位：毫秒） | - |

## 2. 复杂对象结构

### 3.1 CascadingPlatformDataItem (级联分类对象)

> [!IMPORTANT]
> **规则 (Rule)**:
> 所有的 `raw` 数据必须透传通过分类接口获取的原始对象。

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 蚁小二分类 ID |
| `yixiaoerName` | `string` | **是** | 蚁小二分类名称 |
| `children` | `object[]` | 否 | 子级分类列表 (`CascadingPlatformDataItem[]`) |
| `raw` | `object` | **是** | 平台原始数据 (必须透传) |

## 3. JSON 示例

```json
{
  "publishType": "video",
  "platforms": ["网易号"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_wy_002",
        "video": {
          "key": "v_key",
          "size": 1024000,
          "width": 1920,
          "height": 1080,
          "duration": 60
        },
        "contentPublishForm": {
          "formType": "task",
          "title": "网易号视频标题示例",
          "description": "这是网易号平台的视频内容描述。",
          "tags": ["科技", "前沿", "AI"],
          "category": [
            {
              "yixiaoerId": "cat_002",
              "yixiaoerName": "科技",
              "raw": { "id": "1", "name": "科技" }
            }
          ],
          "createType": 1,
          "declaration": 2,
          "pubType": 1
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
| `category` | `category` | [获取发布分类](../../get-publish-categories.md) |
