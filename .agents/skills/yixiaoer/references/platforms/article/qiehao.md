# 企鹅号文章发布参数 (QiEHao Article)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [文章发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Qiehao”平台发布文章内容时触发。
- **典型提示词**：
  - “发布这篇文章到Qiehao”
  - “并在Qiehao上同步更新”

## 执行逻辑 (Logic Flow)
1. **内容处理**：确保文章正文符合Qiehao要求的格式。
2. **参数装配**：提取标题、正文及封面信息至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


本平台文章发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `title` | `string` | **是** | 文章标题 | - |
| `content` | `string` | **是** | 文章内容 (HTML 格式) | - |
| `covers` | `Array` | **是** | 文章封面列表 (`OldCover[]`) | - |
| `tags` | `string[]` | **是** | 文章标签 (至少一个) | - |
| `declaration` | `number` | 否 | 创作申明: 0-暂不申明, 1-AI生成, 2-个人观点, 3-剧情演绎, 7-AI辅助, 8-健康医疗, 9-危险行为 | - |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "article",
  "platforms": ["企鹅号"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_qh_001",
        "coverKey": "article_cover_key",
        "cover": { "key": "article_cover_key", "size": 102400, "width": 800, "height": 600 },
        "contentPublishForm": {
          "formType": "task",
          "title": "这是文章标题",
          "content": "<h1>文章标题</h1><p>正文内容...</p>",
          "covers": [
            { "key": "article_cover_key", "size": 102400, "width": 800, "height": 600 }
          ],
          "tags": ["科技", "AI"],
          "declaration": 0,
          "pubType": 1
        }
      }
    ]
  }
}
```

## 3. 复杂对象结构

### 3.1 OldCover (封面对象)
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `key` | `string` | OSS 资源 Key |
| `size` | `number` | 文件大小 (bytes) |
| `width` | `number` | 宽度 |
| `height` | `number` | 高度 |

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `covers.key` | `upload` | [资源上传](../../upload-resource.md) |
