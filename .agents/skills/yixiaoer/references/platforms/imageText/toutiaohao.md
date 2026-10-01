# 头条号图文发布参数 (TouTiaoHao Image-Text)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [图文发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“头条号”平台发布图文动态时触发。
- **典型提示词**：
  - “发几张图到头条号”
  - “同步这条动态到头条号”

## 执行逻辑 (Logic Flow)
1. **资源校验**：确保所有图片均已上传并获得 Key。
2. **参数装配**：填充描述及图片列表至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

本平台图文发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `description` | `string` | **是** | 图文描述，支持 HTML 和话题标签 (`<topic>`)。最多 1000 字符。 | - |
| `images` | `Array` | **是** | 图片数组 (`OldImage[]`) | - |
| `declaration` | `number` | 否 | 创作类型 1:自行拍摄 2:取自站外 3:AI生成 6:虚构演绎,故事经历 7:投资观点,仅供参考 8:健康医疗分享,仅供参考 | - |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | - |

## 2. 复杂对象结构说明

### 复杂对象：OldImage
| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `width` | `number` | **是** | 图片宽度 | - |
| `height` | `number` | **是** | 图片高度 | - |
| `size` | `number` | **是** | 文件大小 (Bytes) | - |
| `key` | `string` | **是** | 资源 Key (通过上传接口获取) | - |
| `format` | `string` | **是** | 文件格式 (e.g., `jpg`, `png`) | - |

## 3. 依赖接口说明

若字段值需通过查询获得，需注明：
- **话题 (topic)**: 在 `description` 中使用 `<topic>` 标签时，话题数据需通过 `[获取话题](../../get-topics.md)` 获得。

## 4. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "imageText",
  "platforms": ["头条号"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_tt_it_001",
        "contentPublishForm": {
          "formType": "task",
          "description": "<p>今日头条内容 <topic text='头条' raw='{\"yixiaoerId\":\"123\",\"yixiaoerName\":\"头条\",\"raw\":{\"id\":\"xxx\",\"topic\":\"头条\"}}'>#头条</topic></p>",
          "images": [
            { "key": "img_resource_key", "size": 1024000, "width": 1080, "height": 1440, "format": "jpg" }
          ],
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
| `images.key` | `upload` | [资源上传](../../upload-resource.md) |
