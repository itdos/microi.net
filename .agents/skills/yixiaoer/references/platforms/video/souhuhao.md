# 搜狐号视频发布参数 (SouHuHao Video)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Souhuhao”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到Souhuhao”
  - “同步视频到Souhuhao”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为Souhuhao。
2. **分类查询**：先执行 `yxer query categories <platformAccountId> --type video --paths --json`，从 `paths` 选择最新的完整父子分类路径。
3. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`，`category` 保留从父分类到末级分类的完整路径。
4. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

CLI 会在搜狐号视频的 `validate`、`publish --dry-run` 和正式发布前，按每个 `platformAccountId` 重新查询分类并校验。只传末级分类时会自动从查询结果补齐父级；分类不存在、名称歧义或分类对象的 `id` 与 `raw.id` 不一致时，会在本地阻止发布并返回可用路径。

本平台视频发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `title` | `string` | **是** | 视频标题 (5-72 字符) | - |
| `description` | `string` | **是** | 视频描述 (5-200 字符) | - |
| `tags` | `string[]` | **是** | 视频标签 | - |
| `category` | `Array` | **是** | 视频分类 (`CascadingPlatformDataItem[]`) | - |
| `declaration` | `number` | **是** | 原创类型: 0-无特别声明, 1-引用申明, 2-自行拍摄, 3-包含AI创作内容, 4-包含虚构创作 | 0 |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | - |
| `scheduledTime` | `number` | 否 | 定时发布时间 (13 位 Unix 时间戳，单位: 毫秒) | - |

## 2. 复杂对象结构

### CascadingPlatformDataItem (级联分类)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | **是** | 选项 ID |
| `text` | `string` | **是** | 选项文本 |
| `children` | `Array` | 否 | 子级选项列表 (`PlatformDataItem[]`) |
| `raw` | `object` | **是** | 平台原始数据 |

## 3. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["搜狐号"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_sh_video_001",
        "video": {
          "key": "video_resource_key",
          "size": 10240000,
          "width": 1920,
          "height": 1080,
          "duration": 60
        },
        "contentPublishForm": {
          "formType": "task",
          "title": "搜狐号视频发布标题示例",
          "description": "这是关于在该平台发布视频的描述信息内容。",
          "tags": ["科技", "数码"],
          "category": [
            {
              "id": "43",
              "text": "生活",
              "raw": {
                "yixiaoerId": "43",
                "yixiaoerName": "生活",
                "raw": { "id": 43, "cmsChannelId": 206 }
              }
            },
            {
              "id": "58",
              "text": "生活百态",
              "raw": {
                "yixiaoerId": "58",
                "yixiaoerName": "生活百态",
                "raw": { "id": 58, "channelId": 43 }
              }
            }
          ],
          "declaration": 2,
          "pubType": 1
        }
      }
    ]
  }
}
```

## 相关接口

| 目标字段 | 对应 Action | 文档参考 |
| :--- | :--- | :--- |
| `category` | `categories` | [获取账号分类](../../get-publish-categories.md) |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
