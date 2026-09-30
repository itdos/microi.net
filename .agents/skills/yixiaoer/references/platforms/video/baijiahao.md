# 百家号视频发布参数 (BaiJiaHao Video)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Baijiahao”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到Baijiahao”
  - “同步视频到Baijiahao”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为Baijiahao。
2. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


## 封面契约

- **主/横版封面**：使用必填的 `publishArgs.accountForms[].cover` 和 `publishArgs.accountForms[].coverKey`；`coverKey` 必须等于 `cover.key`。标准请求体也可以把二者共享放在 `publishArgs.cover` / `publishArgs.coverKey`，CLI 会补齐到账号项。资源使用 `OldCover` 形态，至少包含 `key`、`size`、`width`、`height`。
- **竖版封面**：使用可选的 `publishArgs.accountForms[].contentPublishForm.verticalCover`，也可以共享填写 `publishArgs.verticalCover`，CLI 会补齐到 `contentPublishForm`。资源同样使用 `OldCover` 形态，至少包含 `key`、`size`、`width`、`height`。
- 客户端会把输入的主/横版封面和竖版封面分别序列化为内部的 `covers[0]` 和 `verticalCovers[0]`；没有提供竖版封面时，百家号 Worker 使用主封面作为竖版封面兜底。
- 百家号视频没有独立的 `horizontalCover` CLI 字段，也不直接填写客户端内部的 `verticalCovers` 数组。当前客户端视频规格要求主封面，主封面大小上限为 5 MB；未暴露单独的竖版必填、比例或像素限制。

在本平台视频发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定为 `task` | `task` |
| `title` | `string` | 否 | 视频标题 (1-30 字符) | - |
| `description` | `string` | **是** | 视频描述 (1-100 字符) | - |
| `tags` | `string[]` | 否 | 视频标签 (1-6 个) | - |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |
| `statement` | `object` | 否 | 内容声明对象；未声明时可省略 | - |
| `location` | `Object` | 否 | 位置信息，使用 `PlatformDataItem` 结构 | - |
| `scheduledTime` | `number` | 否 | 定时发布时间戳 (13 位 Unix 时间戳，单位: 毫秒) | - |
| `collection` | `Object` | 否 | 合集信息 (`yixiaoerId`, `yixiaoerName`, `raw`) | - |
| `activity` | `Object` | 否 | 征文活动信息 (`yixiaoerId`, `yixiaoerName`, `raw`) | - |

### 1.1 statement 声明对象

当前蚁小二客户端使用 `statement` 对象，同时支持“声明”和“补充声明”；未选择任何声明时可省略整个对象。不要使用旧的顶层 `declaration` 字段，也不要把 `isAigc` 作为输入字段。

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `type` | `integer` | **是（当 statement 存在时）** | 主声明：`0` 不声明，`1` 内容由AI生成，`16` 内容为转载，`4` 含虚构演绎内容，`8` 内容含有营销信息，`32` 个人观点，仅供参考 | 未选择时省略 |
| `subType` | `integer` | 否 | 补充声明：`0` 不选择，`1` 内容可能引人不适，`2` 内容含有高危险行为，`4` 请理性适度消费，`8` 未成年人请在监护人指导下浏览 | 未选择时省略（界面显示 `0`） |

客户端会把 `statement.type` 和 `statement.subType` 转换为百家号请求字段 `publish_statement` 和 `publish_statement_sub`，并根据主声明派生 `activity_list.aigc_bjh_status`；CLI 只接收 `statement` 对象，不要直接填写这些平台请求字段。

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["百家号"],
  "publishArgs": {
    "video": {
      "key": "video_oss_key",
      "size": 1024000,
      "width": 1920,
      "height": 1080,
      "duration": 60
    },
    "cover": {
      "key": "cover_oss_key",
      "size": 102400,
      "width": 1920,
      "height": 1080
    },
    "coverKey": "cover_oss_key",
    "verticalCover": {
      "key": "vertical_cover_oss_key",
      "size": 102400,
      "width": 1080,
      "height": 1440
    },
    "accountForms": [
      {
        "platformAccountId": "acc_bjh_video_001",
        "video": {
          "key": "video_oss_key",
          "size": 1024000,
          "width": 1920,
          "height": 1080,
          "duration": 60
        },
        "contentPublishForm": {
          "formType": "task",
          "title": "百家号视频标题",
          "description": "视频精彩描述内容...",
          "tags": ["科技", "未来"],
          "pubType": 1,
          "statement": {
            "type": 1,
            "subType": 4
          },
          "location": {
            "yixiaoerId": "loc_001",
            "yixiaoerName": "北京市",
            "raw": {}
          }
        }
      }
    ]
  }
}
```

## 3. 复杂对象结构说明

### 3.1 PlatformDataItem / Category
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 统一 ID |
| `yixiaoerName` | `string` | **是** | 显示名称 |
| `raw` | `object` | **是** | 平台原始数据 (必须完整透传) |

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
| `location` | `locations` | [获取位置信息](../../get-locations.md) |
| `activity` | `activities` | [获取征文活动](../../get-publish-activities.md) |
