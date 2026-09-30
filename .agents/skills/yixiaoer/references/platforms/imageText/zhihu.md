# 知乎图文发布参数 (Zhihu Image-Text)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [图文发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“知乎”平台发布图文动态时触发。
- **典型提示词**：
  - “发几张图到知乎”
  - “同步这条动态到知乎”

## 执行逻辑 (Logic Flow)
1. **资源校验**：确保所有图片均已上传并获得 Key。
2. **参数装配**：填充描述及图片列表至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

本平台图文发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `title` | `string` | 否 | 标题 (1-50 字符) | - |
| `description` | `string` | **是** | 图文内容，支持 HTML 格式及话题/好友/活动标签 | - |
| `images` | `Array` | 否 | 图片数组 (`OldImage[]`, 1-9 张) | - |

## 2. 复杂对象结构说明

### 复杂对象：OldImage
| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `width` | `number` | **是** | 图片宽度 | - |
| `height` | `number` | **是** | 图片高度 | - |
| `size` | `number` | **是** | 文件大小 (Bytes) | - |
| `key` | `string` | **是** | 资源 Key (通过上传接口获取) | - |
| `format` | `string` | **是** | 文件格式 (e.g., `jpg`, `png`) | - |

### description 标签说明

知乎图文描述支持 HTML 格式，内容应由 `<p>` 标签包裹。支持以下自定义标签：

- **话题 (topic)**: 使用 `<topic text='名称' raw='{...}'>#名称</topic>`。最多 5 个。
- **好友 (friend)**: 使用 `<friend raw='{...}'>@好友名</friend>`。
- **活动 (activity)**: 使用 `<activity raw='{...}'>活动名</activity>`。

> [!IMPORTANT]
> 所有的 `raw` 属性必须存放完整的原始数据 JSON 序列化字符串（包含 `yixiaoerId`, `yixiaoerName` 及原始 `raw` 字段）。

## 3. 依赖接口说明

若字段值需通过查询获得，需注明：
- **话题 (topic)**: 需通过 `[获取话题](../../get-topics.md)` 获得。
- **好友 (friend)**: 需通过 `[获取好友/关注](../../get-friends.md)` 获得。
- **活动 (activity)**: 需通过 `[获取征文活动列表](../../get-publish-activities.md)` 获得。

## 4. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "imageText",
  "platforms": ["知乎"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "ZH_ACC_ID",
        "contentPublishForm": {
          "formType": "task",
          "title": "知乎图文标题",
          "description": "<p>知乎想法内容 <topic text='知识' raw='{\"yixiaoerId\":\"123\",\"yixiaoerName\":\"知识\",\"raw\":{}}'>#知识</topic> @<friend raw='{\"yixiaoerId\":\"456\",\"raw\":{\"nick\":\"张三\"}}'>张三</friend></p>",
          "images": [
            { "key": "img_zh_01", "size": 1024, "width": 1080, "height": 1440, "format": "jpg" }
          ]
        }
      }
    ]
  }
}
```

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `topic` | `challenges` | [获取话题/挑战](../../get-challenges.md) |
| `images.key` | `upload` | [资源上传](../../upload-resource.md) |
| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `images.key` | `upload` | [资源上传](../../upload-resource.md) |
