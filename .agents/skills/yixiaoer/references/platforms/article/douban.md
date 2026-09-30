# 豆瓣文章发布参数 (DouBan Article)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [文章发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Douban”平台发布文章内容时触发。
- **典型提示词**：
  - “发布这篇文章到Douban”
  - “并在Douban上同步更新”

## 执行逻辑 (Logic Flow)
1. **内容处理**：确保文章正文符合Douban要求的格式。
2. **参数装配**：提取标题、正文及封面信息至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


本平台文章发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `title` | `string` | **是** | 文章标题 | - |
| `content` | `string` | **是** | 文章内容 (HTML 格式) | - |
| `createType` | `number` | **是** | 创作类型: 0-非原创, 1-申明原创 | - |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |
| `tags` | `string[]` | 否 | 标签 | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "article",
  "platforms": ["豆瓣"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_db_001",
        "contentPublishForm": {
          "formType": "task",
          "title": "这是文章标题",
          "content": "<h1>豆瓣日记</h1><p>正文内容...</p>",
          "createType": 1,
          "pubType": 1,
          "tags": ["影评", "生活"]
        }
      }
    ]
  }
}
```

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `covers.key` | `upload` | [资源上传](../../upload-resource.md) |
