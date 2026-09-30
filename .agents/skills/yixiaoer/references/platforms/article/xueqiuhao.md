# 雪球号文章发布参数 (XueQiuHao Article)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [文章发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Xueqiuhao”平台发布文章内容时触发。
- **典型提示词**：
  - “发布这篇文章到Xueqiuhao”
  - “并在Xueqiuhao上同步更新”

## 执行逻辑 (Logic Flow)
1. **内容处理**：确保文章正文符合Xueqiuhao要求的格式。
2. **参数装配**：提取标题、正文及封面信息至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


本平台文章发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `title` | `string` | **是** | 文章标题 (长度: 9-100) | - |
| `content` | `string` | **是** | 文章内容 (HTML 格式) | - |
| `covers` | `Array` | 否 | 文章封面列表 (`OldCover[]`) | - |
| `visibleType` | `number` | **是** | 可见类型: 0-公开, 1-私密 | 0 |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |
| `declaration` | `number` | 否 | 内容申明: 0-不申明, 1-包含 AI 内容 | 0 |
| `scheduledTime` | `number` | 否 | 定时发布时间 (13 位 Unix 时间戳，单位: 毫秒) | - |

## 2. 复杂对象结构说明

### 2.1 OldCover
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `key` | `string` | **是** | OSS 资源 Key |
| `size` | `number` | **是** | 文件大小 (Bytes) |
| `width` | `number` | **是** | 宽度 |
| `height` | `number` | **是** | 高度 |

## 3. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "article",
  "platforms": ["雪球号"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_xq_001",
        "contentPublishForm": {
          "formType": "task",
          "title": "这是财经文章标题示例",
          "content": "<h1>雪球号财经文章</h1><p>内容正文...</p>",
          "visibleType": 0,
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
| `covers.key` | `upload` | [资源上传](../../upload-resource.md) |
