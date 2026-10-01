# 头条号视频发布参数 (TouTiaoHao Video)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。

## 触发场景 (Trigger)
- **意图辨析**：用户指定在“今日头条 (头条号)”分发视频，且需要配置如“流量激励/申明（Declaration）”、“定时发布”或“可见性设置”等功能时触发。
- **典型提示词**：
  - “把这个视频发到我的头条号上”
  - “头条号发布，申明是自行拍摄的原创内容”
  - “我的头条视频要定时在今天晚上 8 点发布”
  - “设为头条私密视频”

## 执行逻辑 (Logic Flow)
1. **标题优化**：头条视频标题限制为 1-30 个字符；CLI 与平台字段口径保持一致。
2. **标签装配**：识别用户提供的关键词，转换为 `tags` 字符串数组（限制 1-5 个）。
3. **申明校验**：根据内容来源注入 `declaration` 枚举；若涉及 AI 创作，必须标注为 `3-AI生成`。
4. **参数装配**：构造 `accountForms[i].contentPublishForm`。
5. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `title` | `string` | **是** | 视频标题 (1-30 字符) | - |
| `description` | `string` | **是** | 视频描述 (1-400 字符) | - |
| `tags` | `string[]` | **是** | 视频标签 (1-5 个，字符串数组) | - |
| `declaration` | `number` | 否 | 创作者申明：1-自行拍摄, 2-取自站外, 3-AI生成, 6-虚构演绎故事经历, 7-投资观点仅供参考, 8-健康医疗分享仅供参考 | - |
| `scheduledTime` | `number` | 否 | 定时发布时间戳（13 位 Unix 时间戳，单位：毫秒） | - |
| `visibleType` | `number` | **是** | 可见性: 0-公开, 1-私密 | 0 |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["头条号"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_tt_video_001",
        "video": { "key": "v_key", "size": 10240000, "width": 1920, "height": 1080, "duration": 60 },
        "contentPublishForm": {
          "formType": "task",
          "title": "今日头条发布测试",
          "description": "这是测试视频的描述内容...",
          "tags": ["生活", "摄影"],
          "declaration": 1,
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
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
