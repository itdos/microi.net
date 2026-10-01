# 知乎文章发布参数 (ZhiHu Article)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [文章发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。

## 触发场景 (Trigger)
- **意图辨析**：用户指定在“知乎”平台发布长文章或专栏内容，且需要配置如“多话题挂载”、“自定义封面列表”、“申明 AI 创作”或“存为知乎草稿”等知乎特有功能时触发。
- **典型提示词**：
  - “把这篇干货文章发布到知乎”
  - “知乎发布，加上‘科技’、‘教育’话题”
  - “声明这篇文章是 AI 辅助创作的”
  - “帮我同步这个内容到知乎草稿箱”

## 执行逻辑 (Logic Flow)
1. **内容纯化**：知乎对 HTML 格式支持有特定要求，建议确保 `content` 包含基础层级标签。
2. **辅助话题检索**：调用 `challenges` 接口获取知乎支持的 Topic 列表（限制最多 3 个）。
3. **申明装配**：根据文章属性注入 `declaration` 枚举值（如 5-AI辅助）。
4. **参数装配**：构造 `accountForms[i].contentPublishForm`。
5. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `title` | `string` | **是** | 文章标题 (9-100 字符) | - |
| `content` | `string` | **是** | 文章内容 (9-10000 字符，HTML 格式) | - |
| `covers` | `Array` | 否 | 文章封面列表 (`OldCover[]`) | - |
| `topics` | `Array` | 否 | 话题列表 (`Category[]`, 最多3个) | - |
| `declaration` | `number` | 否 | 创作申明: 0-无申明, 1-剧透, 2-医疗建议, 3-虚构创作, 4-理财内容, 5-AI辅助 | 0 |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |
| `scheduledTime` | `number` | 否 | 定时发布时间 (13 位 Unix 时间戳，单位: 毫秒) | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "article",
  "platforms": ["知乎"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "ZH_ACC_ID",
        "contentPublishForm": {
          "formType": "task",
          "title": "深度分析 AI 在 2026 年的发展",
          "content": "<h1>深度分析</h1><p>内容正文...</p>",
          "topics": [
            { "yixiaoerId": "cat_001", "yixiaoerName": "人工智能", "raw": {} }
          ],
          "declaration": 5,
          "pubType": 1
        }
      }
    ]
  }
}
```

## 3. 复杂对象结构说明

### 3.1 OldCover
包含 `key`, `size`, `width`, `height`。

### 3.2 Category (用于话题)
包含 `yixiaoerId`, `yixiaoerName`, `raw` (必须完整透传)。

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `topics`    | `challenges` | [获取话题/挑战](../../get-challenges.md) |
| `covers.key`| `upload`     | [资源上传](../../upload-resource.md) |
