# 百家号文章发布参数 (BaiJiaHao Article)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [文章发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的 platform 差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Baijiahao”平台发布文章内容时触发。
- **典型提示词**：
  - “发布这篇文章到Baijiahao”
  - “并在Baijiahao上同步更新”

## 执行逻辑 (Logic Flow)
1. **内容处理**：确保文章正文符合Baijiahao要求的格式。
2. **参数装配**：提取标题、正文及封面信息至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

本平台文章发布通过 `contentPublishForm` 承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定值: `task` | `task` |
| `title` | `string` | **是** | 文章标题 (2-30 字符) | - |
| `content` | `string` | **是** | 文章正文 (HTML 格式, 9-10000 字符) | - |
| `covers` | `Array` | **是** | 文章封面列表 (`OldCover[]`, 1-3 张) | - |
| `category` | `Array` | **是** | 文章分类列表 (`Category[]`, 1-2 个) | - |
| `pubType` | `number` | **是** | 发布类型: 0-草稿, 1-直接发布 | - |
| `declaration` | `number` | 否 | 内容声明: 0-不声明, 1-内容由 AI 生成 | - |
| `scheduledTime` | `number` | 否 | 定时发布时间 (13 位 Unix 时间戳，单位: 毫秒) | - |
| `activity` | `Object` | 否 | 征文活动数据对象，使用 `Activity` 结构 | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "article",
  "platforms": ["百家号"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_bjh_001",
        "contentPublishForm": {
          "formType": "task",
          "title": "百家号文章标题",
          "content": "<h1>文章标题</h1><p>正文内容至少需要9个字以上。</p>",
          "covers": [
            { "key": "article_cover_key", "size": 102400, "width": 800, "height": 600 }
          ],
          "category": [
            { "yixiaoerId": "cat_001", "yixiaoerName": "文化", "raw": {} }
          ],
          "pubType": 1,
          "declaration": 0
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

### 3.2 Category (分类)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 分类 ID |
| `yixiaoerName` | `string` | **是** | 分类名称 |
| `raw` | `object` | 否 | 原始分类对象 |

### 3.3 Activity (活动)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 活动 ID |
| `yixiaoerName` | `string` | **是** | 活动名称 |

## 相关接口

| 目标数据 | 对应 Action | 文档参考 |
| :--- | :--- | :--- |
| `category` | `categories` | [获取账号分类](../../get-publish-categories.md) |
| `activity` | `activities` | [获取征文活动](../../get-publish-activities.md) |
| `covers.key` | `upload` | [资源上传](../../upload-resource.md) |
