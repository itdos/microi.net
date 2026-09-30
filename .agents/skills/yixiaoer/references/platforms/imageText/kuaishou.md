# 快手图文发布参数 (Kuaishou Image-Text)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [图文发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的 platform 差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Kuaishou”平台发布图文动态时触发。
- **典型提示词**：
  - “发几张图到Kuaishou”
  - “同步这条动态到Kuaishou”

## 执行逻辑 (Logic Flow)
1. **资源校验**：确保所有图片均已上传并获得 Key。
2. **参数装配**：填充描述及图片列表至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

本平台图文发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `description` | `string` | **否** | 图文描述，支持 HTML (`<p>`, `<topic>`)。最多 1000 字符。 | - |
| `images` | `OldImage[]` | **是** | 图片数组 | - |
| `location` | `PlatformDataItem` | **否** | 位置信息 | - |
| `music` | `PlatformDataItem` | **否** | 音乐信息 | - |
| `visibleType` | `number` | **是** | 可见类型: 0-公开, 1-私密, 3-好友可见 | 0 |
| `scheduledTime` | `number` | **否** | 定时发布时间 (13 位 Unix 时间戳，单位: 毫秒) | - |
| `collection` | `Category` | **否** | 合集信息 | - |

## 2. 复杂对象结构说明

### OldImage
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `key` | `string` | **是** | OSS 资源 Key |
| `size` | `number` | **是** | 文件大小 (Bytes) |
| `width` | `number` | **是** | 宽度 |
| `height` | `number` | **是** | 高度 |
| `format` | `string` | **是** | 文件格式 (如 `jpg`, `png`) |

### Category
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 蚁小二内部 ID |
| `yixiaoerName` | `string` | **是** | 显示名称 |
| `raw` | `object` | **是** | 平台原始数据 (如果接口返回，必须原样回传) |

### PlatformDataItem
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 统一 ID |
| `yixiaoerName` | `string` | **是** | 显示名称 |
| `raw` | `object` | **是** | 平台原始数据 (如果接口返回，必须原样回传) |

### MusicItem (音乐)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 蚁小二端统一音乐 ID |
| `yixiaoerName` | `string` | **是** | 歌曲名称 |
| `duration` | `number` | **是** | 音乐时长（秒） |
| `playUrl` | `string` | **是** | 试听/播放链接 |
| `artist` | `string` | **否** | 歌手/作者名 |
| `raw` | `object` | **是** | 平台原始数据 (如果接口返回，必须原样回传) |

## 3. 依赖接口说明

若字段值需通过查询获得，需注明：
- **位置 (location)**: 需通过 `[获取地理位置](../../get-locations.md)` 获得对应的 `PlatformDataItem`。
- **音乐 (music)**: 需通过 `[获取音乐](../../get-music.md)` 获得对应的 `PlatformDataItem`。
- **话题 (topic)**: 在 `description` 中使用 `<topic>` 标签时，话题数据需通过 `[获取话题](../../get-topics.md)` 获得。
- **合集 (collection)**: 需通过 `[获取合集](../../get-collections.md)` 获得对应的 `Category`。

## 4. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "imageText",
  "platforms": ["快手"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_ks_it_001",
        "contentPublishForm": {
          "formType": "task",
          "description": "<p>快手动态内容 <topic text='快手' raw='{\"id\":\"xxx\",\"name\":\"快手\"}'>#快手</topic></p>",
          "images": [
            { "key": "img_ks_01", "size": 1024, "width": 1080, "height": 1440, "format": "jpg" }
          ],
          "visibleType": 0
        }
      }
    ]
  }
}
```

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `images.key` | `upload` | [资源上传](../../upload-resource.md) |
