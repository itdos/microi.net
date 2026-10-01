# 微信公众号文章发布参数 (WeiXinGongZhongHao Article)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [文章发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Weixingongzhonghao”平台发布文章内容时触发。
- **典型提示词**：
  - “发布这篇文章到Weixingongzhonghao”
  - “并在Weixingongzhonghao上同步更新”

## 执行逻辑 (Logic Flow)
1. **内容处理**：确保文章正文符合Weixingongzhonghao要求的格式。
2. **参数装配**：提取标题、正文及封面信息至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

> [!TIP]
> 微信公众号仍推荐使用 `platformForms`；同时可以在 `publishArgs` 根级放共享封面或业务扩展字段。CLI 保持单平台执行模型。

本平台文章发布推荐使用 `platformForms` 模式，以支持多账号共用单条图文包消息。

## 1. 结构概览 (Structure)

对于微信公众号，发布参数应位于 `publishArgs.platformForms["微信公众号"]` 中：

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `articles` | `Array` | **是** | 文章列表 (`WxGongZhongHaoContentFrom[]`, 1-8 篇) | - |
| `notifySubscribers` | `number` | **是** | 是否群发: 0-不群发, 1-群发 | `0` |
| `pubType` | `number` | **是** | 草稿: 0-草稿, 1-直接发布 | `1` |
| `scheduledTime` | `number` | 否 | 定时发布时间 (13 位 Unix 时间戳，单位: 毫秒) | - |
| `sex` | `number` | 否 | 群发性别: 0-全部, 1-男, 2-女 | `0` |
| `country` | `string` | 否 | 群发国家 | - |
| `province` | `string` | 否 | 群发省份 | - |
| `city` | `string` | 否 | 群发城市 | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "article",
  "platforms": ["微信公众号"],
  "coverKey": "img_key_999",
  "publishArgs": {
    "cover": {
      "key": "img_key_999",
      "size": 102400,
      "width": 800,
      "height": 600
    },
    "coverKey": "img_key_999",
    "accountForms": [
      {
        "platformAccountId": "ACC_ID_001",
        "platformName": "微信公众号"
      }
    ],
    "platformForms": {
      "微信公众号": {
        "articles": [
          {
            "title": "微信群发及原创设置教程",
            "content": "<p>正文内容... <video-card name='视频号视频' /> ... </p>",
            "authorName": "技术部",
            "digest": "这是关于微信发布能力更新的说明。",
            "type": 1,
            "cover": {
                "key": "img_key_999",
                "raw": {}
            },
            "quickRepost": 1,
            "quickPrivateMessage": 1,
            "categories": [
               { "yixiaoerId": "cat_001", "yixiaoerName": "科普", "raw": {} }
            ]
          }
        ],
        "notifySubscribers": 1,
        "pubType": 1,
        "sex": 0
      }
    }
  }
}
```

## 3. 复杂对象结构说明

### 3.1 WxGongZhongHaoContentFrom (单篇文章)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `title` | `string` | **是** | 文章标题 (最多 64 字) |
| `content` | `string` | **是** | 正文 (HTML 字符串)。支持嵌自定义标签（见下方）。 |
| `cover` | `Object` | **是** | 封面对象 (`Cover`) |
| `type` | `number` | **是** | 原创申明: 0-不申明, 1-申明原创 |
| `authorName` | `string` | 否 | 作者名称 (最多 8 个字)。申明原创时推荐填写。 |
| `digest` | `string` | 否 | 文章摘要 (最多 129 字) |
| `quickRepost` | `number` | 否 | 允许快捷转载: 0-否, 1-是 |
| `categories` | `Array` | 否 | 申明原创时设置的文章分类 (`Category[]`) |
| `quickPrivateMessage` | `number` | 否 | 快捷私信 (与留言互斥): 0-否, 1-是 |
| `contentSourceUrl` | `string` | 否 | 原文地址链接 |

#### 文章内嵌内容说明

正文 `content` 支持以下自定义 HTML 标签进行卡片嵌入：
- **公众号卡片**: 使用 `account-card`
- **视频号卡片**: 使用 `video-card`
- 其他多媒体（投票、卡片）直接嵌入对应位置。

### 3.2 Cover & Category

对于封面和分类对象，均需包含 `raw` 字段。

公众号文章的 DOCX 导入契约要求封面为横版输入（宽度大于高度）。CLI 会在上传前检查宽高，竖版或正方形封面直接拒绝，不会静默裁剪；建议使用约 900×383（2.35:1）的横版封面。

| 字段名 (Cover) | 类型 | 说明 |
| :--- | :--- | :--- |
| `key` | `string` | **是**: 资源资源 Key (优先使用) |
| `pathOrUrl` | `string` | 否: 资源 URL 地址 (可选备用) |
| `raw` | `object` | **是**: 平台原始数据 (必须透传) |

| 字段名 (Category) | 类型 | 说明 |
| :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是**: 分类 ID |
| `yixiaoerName` | `string` | **是**: 分类名称 |
| `raw` | `object` | **是**: 平台原始数据 (必须透传) |

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `cover.key` | `upload` | [资源上传](../../upload-resource.md) |
| `authorName` | `accounts` | [查询账号列表](../../query-accounts.md) |
