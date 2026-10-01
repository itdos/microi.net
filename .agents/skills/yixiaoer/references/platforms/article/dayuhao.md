# 大鱼号文章发布参数 (DaYuHao Article)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [文章发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Dayuhao”平台发布文章内容时触发。
- **典型提示词**：
  - “发布这篇文章到Dayuhao”
  - “并在Dayuhao上同步更新”

## 执行逻辑 (Logic Flow)
1. **内容处理**：确保文章正文符合Dayuhao要求的格式。
2. **参数装配**：提取标题、正文及封面信息至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


本平台文章发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `title` | `string` | **是** | 文章标题 (最多 50 字符) | - |
| `content` | `string` | **是** | 文章内容 (HTML 格式，最多 50000 字符) | - |
| `covers` | `Array` | 否 | 文章封面列表 (`OldCover[]`) | - |
| `verticalCovers` | `Array` | 否 | 文章竖版封面列表 (`OldCover[]`) | - |
| `declaration` | `number` | 否 | 声明: 0-无, 3-虚构演绎, 4-AI生成 | 0 |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |
| `scheduledTime` | `number` | 否 | 定时发布时间 (13 位 Unix 时间戳，单位: 毫秒) | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "article",
  "platforms": ["大鱼号"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_dy_001",
        "coverKey": "article_cover_key",
        "cover": { "key": "article_cover_key", "size": 102400, "width": 800, "height": 600 },
        "contentPublishForm": {
          "formType": "task",
          "title": "这是大鱼号文章标题",
          "content": "<h1>大鱼号文章标题</h1><p>正文内容...</p>",
          "pubType": 1,
          "declaration": 0,
          "covers": [
            { "key": "article_cover_key", "size": 102400, "width": 800, "height": 600 }
          ]
        }
      }
    ]
  }
}
```

## 3. 复杂对象结构说明

### 3.1 OldCover
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `key` | `string` | **是** | OSS 资源 Key |
| `size` | `number` | **是** | 文件大小 (Bytes) |
| `width` | `number` | **是** | 宽度 |
| `height` | `number` | **是** | 高度 |

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `covers.key` | `upload` | [资源上传](../../upload-resource.md) |
