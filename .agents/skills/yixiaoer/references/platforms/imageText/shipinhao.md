# 视频号图文发布参数 (Shipinhao Image-Text)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [图文发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“视频号 / 微信视频号 / shipinhao”平台发布图文动态时触发。
- **典型提示词**：
  - “发几张图到视频号”
  - “同步这条动态到微信视频号”
  - “用 shipinhao 发图文”

## 执行逻辑 (Logic Flow)
1. **资源校验**：确保所有图片均已上传并获得 Key。
2. **参数装配**：填充描述及图片列表至 `contentPublishForm`；无需外部传入 `cover` / `coverKey`，CLI 会默认使用首图作为内部封面。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


本平台图文发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `title` | `string` | 否 | 标题 | - |
| `description` | `string` | 否 | 图文描述，支持 HTML (`<p>`, `<topic>`)。最多 1000 字符。 | - |
| `images` | `Array` | **是** | 图片数组 (`OldImage[]`)，1-18 张 | - |
| `location` | `Object` | 否 | 位置对象 (`PlatformDataItem`) | - |
| `music` | `Object` | 否 | 音乐对象 (`MusicItem`) | - |
| `scheduledTime` | `number` | 否 | 定时发布时间 (13 位 Unix 时间戳，单位: 毫秒) | - |
| `collection` | `Object` | 否 | 合集信息，使用 `Collection` 结构 | - |
| `pubType` | `number` | **是** | 发布类型: 0-平台草稿, 1-直接发布 | 1 |

## 1.1 封面派生规则

视频号图文没有单独的外部封面参数。只需提供 `contentPublishForm.images`；CLI 会在内部默认使用 `images[0]` 派生 `cover` / `coverKey`，不要在 payload 中额外手写封面字段。

## 2. 复杂对象结构说明

### OldImage
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `width` | `number` | **是** | 图片宽度 |
| `height` | `number` | **是** | 图片高度 |
| `size` | `number` | **是** | 文件大小 (Bytes) |
| `key` | `string` | **是** | 资源 Key (通过上传接口获取) |
| `format` | `string` | **是** | 文件格式 (e.g., `jpg`, `png`) |

### PlatformDataItem (基础结构)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | 是 | 统一 ID |
| `yixiaoerName` | `string` | 是 | 显示名称 |
| `raw` | `object` | 是 | 平台原始数据 |

### Collection
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | 是 | 合集 ID |
| `yixiaoerName` | `string` | 是 | 合集名称 |
| `raw` | `object` | 否 | 平台原始数据 |

### MusicItem (音乐)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | 是 | 蚁小二端统一音乐 ID |
| `yixiaoerName` | `string` | 是 | 歌曲名称 |
| `duration` | `number` | 是 | 音乐时长（秒） |
| `playUrl` | `string` | 是 | 试听/播放链接 |
| `artist` | `string` | 否 | 歌手/作者名 |
| `raw` | `object` | 否 | 平台原始数据。如果在音乐列表获取时该字段存在，发布表单中必须携带并完整透传 |



## 3. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "imageText",
  "platforms": ["视频号"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "SPH_ACC_ID",
        "contentPublishForm": {
          "formType": "task",
          "title": "视频号动态标题",
          "description": "<p>视频号图文内容 <topic text='微信' raw='{\"id\":\"xxx\",\"name\":\"微信\"}'>#微信</topic></p>",
          "pubType": 0,
          "images": [
            { "key": "img_sph_01", "size": 1024, "width": 1080, "height": 1440, "format": "jpg" }
          ]
        }
      }
    ]
  }
}
```

## 相关接口

| 目标字段 | 对应 Action | 文档参考 |
| :--- | :--- | :--- |
| `location` | `locations` | [获取位置信息](../../get-locations.md) |
| `collection` | `collections` | [获取合集列表](../../get-collections.md) |
| `music` | `music` | [获取背景音乐](../../get-music.md) |
| `tags` | `challenges` | [获取话题/挑战](../../get-challenges.md) |
| `images.key` | `upload` | [资源上传](../../upload-resource.md) |
