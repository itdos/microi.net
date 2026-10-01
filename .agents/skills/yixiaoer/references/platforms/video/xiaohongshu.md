# 小红书视频发布参数 (XiaoHongShu Video)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“小红书”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到小红书”
  - “发布到小红书时按小红书号艾特这个用户”
  - “同步视频到小红书”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为小红书。
2. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`；如需艾特用户（含陌生人），将 `<friend>` HTML 标签写入 `description`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

> [!TIP]
> 示例优先使用“标准请求体”格式：共享资源放在 `publishArgs` 根级，账号差异字段放在 `accountForms[]`。CLI 会在校验阶段自动补齐缺失资源字段。

在本平台视频发布通过 `contentPublishForm`承载以下参数。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定为 `task` | `task` |
| `title` | `string` | 否 | 视频标题 (最多 20 字) | - |
| `description` | `string` | 否 | 视频描述，支持 `<friend>` HTML 标签；用户对象（含陌生人）必须来自 `yxer query friends --red-id`。最多 1000 字。 | - |
| `declaration` | `number` | 否 | 内容类型申明: 1-虚构演绎, 2-笔记含 AI 合成内容 | - |
| `createType` | `number` | 否 | 创作类型: 1-原创, 0-不申明 | 0 |
| `location` | `object` | 否 | 视频位置，使用 `PlatformDataItem` 结构 | - |
| `scheduledTime` | `number` | 否 | 定时发布时间戳 (13 位 Unix 时间戳，单位: 毫秒) | - |
| `visibleType` | `number` | **是** | 可见类型: 0-公开, 1-私密, 3-好友可见 | 0 |
| `collection` | `object` | 否 | 合集信息，使用 `Collection` 结构 | - |
| `group` | `object` | 否 | 群聊信息，使用 `Group` 结构 | - |
| `bind_live_info` | `object` | 否 | 直播预告信息，使用 `LiveInfo` 结构 | - |
| `shopping_cart` | `object[]` | 否 | 关联商品信息，使用 `ShoppingCartItem` 结构数组 | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["小红书"],
  "coverKey": "cover_key",
  "publishArgs": {
    "video": {
      "key": "v_key",
      "size": 1024000,
      "width": 1080,
      "height": 1440,
      "duration": 30
    },
    "cover": {
      "key": "cover_key",
      "size": 102400,
      "width": 1080,
      "height": 1440
    },
    "coverKey": "cover_key",
    "accountForms": [
      {
        "platformAccountId": "XHS_ACC_ID",
        "mediaId": "media_001",
        "platformName": "小红书",
        "publishContentId": "publish_content_001",
        "contentPublishForm": {
          "formType": "task",
          "title": "小红书视频标题",
          "description": "这是在小红书分享的一段精彩视频 #好物分享 #生活",
          "createType": 1,
          "visibleType": 0,
          "declaration": 2
        }
      }
    ]
  }
}
```

## 3. 复杂对象结构说明

### 3.1 description 中艾特用户（含陌生人）

小红书用户艾特不是 `contentPublishForm` 的独立字段，而是描述 HTML 的一部分；目标用户可以不是当前账号的好友：

```html
<p>视频内容 <friend raw='用户查询结果的完整 JSON 序列化字符串'>@用户名称</friend></p>
```

先执行 `yxer query friends <account_id> --red-id <小红书号> --json`，选择 `data.list` 中的完整用户对象，将其 JSON 序列化后写入 `raw`，并使用查询结果的 `yixiaoerName` 生成标签正文。详见 [获取小红书用户/艾特对象](../../get-friends.md)。

### 3.2 PlatformDataItem (位置)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 统一 ID |
| `yixiaoerName` | `string` | **是** | 显示名称 |
| `raw` | `object` | **是** | 平台原始数据 (必须完整透传) |

### 3.3 Collection (合集)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 合集 ID |
| `yixiaoerName` | `string` | **是** | 合集名称 |
| `child` | `object[]` | 否 | 子级合集列表 |
| `raw` | `object` | **是** | 平台原始数据 (透传) |

### 3.4 Group (群聊)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 群聊 ID |
| `yixiaoerName` | `string` | **是** | 群聊标题 |
| `raw` | `object` | **是** | 平台原始数据 (透传) |

### 3.5 LiveInfo (直播预告)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 直播预告 ID |
| `yixiaoerName` | `string` | **是** | 直播预告标题 |
| `raw` | `object` | **是** | 平台原始数据 (透传) |

### 3.6 ShoppingCartItem (商品)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 商品 ID |
| `yixiaoerName` | `string` | **是** | 商品名称 |
| `yixiaoerImageUrl` | `string` | 否 | 商品图片 URL |
| `yixiaoerDesc` | `string` | 否 | 商品说明 |
| `price` | `number` | 否 | 商品价格（单位：分） |
| `raw` | `object` | **是** | 平台原始数据 (透传) |

## 相关接口

| 目标字段 | 对应 Action | 文档参考 |
| :--- | :--- | :--- |
| `location` | `locations` | [获取位置信息](../../get-locations.md) |
| `collection` | `collections` | [获取合集列表](../../get-collections.md) |
| `group` | `groups` | [获取群聊列表](../../get-groups.md) |
| `description.friend` | `friends` | [获取小红书用户/艾特对象](../../get-friends.md) |
| `shopping_cart` | `goods` | [获取商品列表](../../get-goods.md) |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
