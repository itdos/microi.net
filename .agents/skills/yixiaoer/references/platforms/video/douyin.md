# 抖音视频发布参数 (DouYin Video)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。

## 触发场景 (Trigger)
- **意图辨析**：用户指定在“抖音”平台发布视频，且需要配置如“地点挂载”、“合集关联”、“添加背景音乐”、“关联小程序/游戏”等抖音特有社交与变现功能时触发。
- **典型提示词**：
  - “把这个视频发布到抖音，并带上 #风景 话题”
  - “在抖音发布时挂载这个小游戏”
  - “查询抖音热门音乐并添加”
  - “声明这个抖音视频是由 AI 生成的”

## 执行逻辑 (Logic Flow)
1. **意图细化**：识别抖音特有的增强功能需求（如地点、音乐、合集）。
2. **辅助查询**：对于 `location`, `music`, `challenge` 等字段，必须先调用对应的 `get-*` action 获取标准 ID 及 `raw` 数据。
3. **参数装配**：将细化参数封装至 `accountForms[i].contentPublishForm`。
4. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

> [!TIP]
> 抖音视频如涉及话题，请先读取 [`../../topic-tags.md`](../../topic-tags.md)。标准做法是直接传平台字段定义的最终结构，不依赖 CLI 从 `tags` 自动改写 `description`。

> [!TIP]
> 示例优先使用“标准请求体”格式：共享资源放在 `publishArgs` 根级，账号差异字段放在 `accountForms[]`。CLI 会在校验阶段自动补齐缺失资源字段。

> 说明：仓库当前不再把 `syncComment` 作为公开 schema 字段暴露，因为现有文档、查询命令和工作流里都没有它的稳定来源或获取流程。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定为 `task` | `task` |
| `title` | `string` | 否 | 抖音视频标题 (1-30 字) | - |
| `description` | `string` | 否 | 抖音视频描述 (1-1000 字) | - |
| `horizontalCover` | `object` | 否 | 抖音视频横版封面，使用 `OldCover` 结构；填写在 `contentPublishForm.horizontalCover`，也可用共享字段 `publishArgs.horizontalCover` 自动补齐 | - |
| `declaration` | `number` | 否 | 声明: 3-内容从 AI 生成, 4-可能引人不适, 5-虚构演绎, 6-危险行为 | - |
| `location` | `object` | 否 | 抖音视频位置，使用客户端位置结构 `{ isScp, data }`，其中 `data` 为 `PlatformDataItem` | - |
| `scheduledTime` | `number` | 否 | 定时发布时间戳 (13 位 Unix 时间戳，单位: 毫秒) | - |
| `allow_save` | `number` | 否 | 保存权限: 0-不允许, 1-允许 | 0 |
| `shopping_cart` | `object[]` | 否 | 购物车列表，使用 `ShoppingCart` 结构；旧字段 `shoppingCart` 会在预检阶段自动归一化 | - |
| `group_shopping` | `object` | 否 | 团购信息，使用 `GroupShopping` 结构 | - |
| `collection` | `object` | 否 | 合集信息，使用 `Category` 结构 | - |
| `sub_collection` | `object` | 否 | 合集选集，使用 `Category` 结构 | - |
| `sync_apps` | `object[]` | 否 | 同时发布应用，使用 `Category[]` | - |
| `hot_event` | `object` | 否 | 热点事件，使用 `Category` 结构 | - |
| `challenge` | `object` | 否 | 挑战/话题，使用 `Category` 结构 | - |
| `mini_app` | `object` | 否 | 挂载小程序 (与购物车互斥)，使用 `MiniApp` 结构 | - |
| `music` | `object` | 否 | 背景音乐信息，使用 `MusicItem` 结构 | - |
| `cooperation_info` | `object` | 否 | 共创信息 | - |
| `game` | `object` | 否 | 游戏挂载信息，使用 `GameItem` 结构 | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["抖音"],
  "coverKey": "cover_key",
  "publishArgs": {
    "video": {
      "key": "v_key",
      "size": 1024000,
      "width": 1080,
      "height": 1920,
      "duration": 15
    },
    "cover": {
      "key": "vertical_cover_key",
      "size": 102400,
      "width": 1080,
      "height": 1920
    },
    "coverKey": "vertical_cover_key",
    "horizontalCover": {
      "key": "horizontal_cover_key",
      "size": 102400,
      "width": 1280,
      "height": 720
    },
    "accountForms": [
      {
        "platformAccountId": "DOUYIN_ACC_ID",
        "mediaId": "media_001",
        "platformName": "抖音",
        "publishContentId": "publish_content_001",
        "contentPublishForm": {
          "formType": "task",
          "title": "记录美好生活",
          "description": "第一条抖音视频 #生活",
          "horizontalCover": {
            "key": "horizontal_cover_key",
            "size": 102400,
            "width": 1280,
            "height": 720
          },
          "declaration": 3,
          "location": {
            "isScp": false,
            "data": {
              "yixiaoerId": "123",
              "yixiaoerName": "上海市",
              "raw": {}
            }
          }
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

### 3.2 PlatformDataItem / Category / MiniApp / GameItem
所有统一的基础结构必须包含 `yixiaoerId`, `yixiaoerName`, `raw`。
- `raw`: 平台原始数据。如果在获取时该字段存在，发布表单中必须携带并完整透传。

`location` 外层必须使用客户端位置结构：

```json
{
  "isScp": false,
  "data": {
    "yixiaoerId": "123",
    "yixiaoerName": "上海市",
    "raw": {}
  }
}
```

### 3.3 ShoppingCart (购物车/团购)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `sale_title` | `string` | **是** | 推广标题 (最多 10 字) |
| `images` | `string[]` | **是** | 商品图片数组 |
| `data` | `object` | **是** | 核心商品数据对象 |

`data` 内部必须包含以下字段：

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 商品 ID |
| `yixiaoerName` | `string` | **是** | 商品名称 |
| `raw` | `object` | **是** | 平台原始数据 (透传) |

`group_shopping` 使用独立结构，必须包含 `brand_switch_value`, `sale_title`, `data`。

### 3.4 MusicItem (音乐)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `yixiaoerId` | `string` | **是** | 内部 ID |
| `yixiaoerName` | `string` | **是** | 歌曲名称 |
| `duration` | `number` | **是** | 时长 (秒) |
| `raw` | `object` | **是** | 原始数据 (透传) |

## 相关接口

| 目标字段 | 对应 Action | 文档参考 |
| :--- | :--- | :--- |
| `location` | `locations` | [获取位置信息](../../get-locations.md) |
| `collection` | `collections` | [获取合集列表](../../get-collections.md) |
| `shopping_cart` | `goods` | [获取商品列表](../../get-goods.md) |
| ... | ... | ... |
