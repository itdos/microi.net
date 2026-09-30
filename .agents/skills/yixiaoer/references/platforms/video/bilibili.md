# 哔哩哔哩视频发布参数 (BiLiBiLi Video)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。

## 触发场景 (Trigger)
- **意图辨析**：用户指定在“哔哩哔哩 (B站)”分发视频，且需要配置如“申明原创/转载”、“设置视频分区 (Category)”、“关联合集”或“打标签 (Tags)”等 B 站特有社区功能时触发。
- **典型提示词**：
  - “把这个视频投到 B 站的生活区”
  - “B 站发布，申明是自制原创内容”
  - “添加‘摄影’、‘数码’标签到 B 站投稿”
  - “帮我同步这个视频到 B 站的 XXX 合集”

## 执行逻辑 (Logic Flow)
1. **分类预校验**：B 站投稿对分类 (Category) 要求极其严格，必须包含父子级 DTO。调用 `categories` 获取合法值。
2. **标签装配**：识别用户提供的关键词，转换为 `tags` 字符串数组（B 站限制 1-10 个）。
3. **申明判定**：根据 `createType`（自制/转载）自动匹配 `contentSourceUrl`。
4. **参数装配**：构造 `accountForms[i].contentPublishForm`。
5. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定为 `task` | `task` |
| `title` | `string` | **是** | 视频标题 (最多 80 字符) | - |
| `description` | `string` | 否 | 视频描述 (最多 2000 字符) | - |
| `tags` | `string[]` | **是** | 视频标签 (1-10 个，字符串数组) | - |
| `category` | `Array` | **是** | 视频分类，使用 `CascadingPlatformDataItem[]` 结构 | - |
| `declaration` | `number` | 否 | 创作者申明：0-不申明, 1-AI合成, 2-危险行为, 3-仅供娱乐, 4-引人不适, 5-理性适度消费, 6-个人观点 | 0 |
| `createType` | `number` | **是** | 类型：1-自制, 2-转载 | 1 |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | 1 |
| `scheduledTime` | `number` | 否 | 定时发布时间戳 (13 位 Unix 时间戳，单位: 毫秒) | - |
| `contentSourceUrl` | `string` | 否 | 原文 URL 链接 (当 `createType` 为 2 时必填) | - |
| `collection` | `object` | 否 | 合集信息，使用 `Collection` 结构 | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["哔哩哔哩"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "BILIBILI_ACC_ID",
        "video": { "key": "v_key", "size": 1024000, "width": 1920, "height": 1080, "duration": 60 },
        "contentPublishForm": {
          "formType": "task",
          "title": "我的第一条 B 站投稿",
          "tags": ["生活", "摄影"],
          "category": [
            { "yixiaoerId": "cat_001", "yixiaoerName": "生活", "raw": {} }
          ],
          "createType": 1,
          "pubType": 1
        }
      }
    ]
  }
}
```

## 3. 复杂对象结构说明

### 3.1 CascadingPlatformDataItem (多级分类)
包含 `yixiaoerId`, `yixiaoerName`, `raw`。

### 3.2 Collection (合集)
包含 `yixiaoerId`, `yixiaoerName`。

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
| `category`  | `categories` | [获取发布分类](../../get-publish-categories.md) |
| `collection`| `collections` | [获取合集列表](../../get-collections.md) |
