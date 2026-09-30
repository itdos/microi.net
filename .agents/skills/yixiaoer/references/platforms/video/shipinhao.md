# 视频号视频发布参数 (WeiXin ShiPinHao Video)

## 账号优先

视频号视频必须先确认账号有效、由用户选择目标账号，再填写视频资料。新建会话时先执行：

```bash
yxer publish form start 视频号 video --output publish-form.json
yxer publish form account publish-form.json --id <online_account_id>
```

`form account` 会查询视频号账号并且只接受 `status=1` 的候选；有多个在线账号时必须由用户明确选择 `--id` 或 `--index`。在选择完成前，CLI 拒绝填写表单字段、review 和 export。

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。

## 触发场景 (Trigger)
- **意图辨析**：用户指定在“微信视频号”平台分发视频内容，且需要执行如“地点标记”、“关联剧集/合集”、“关联网店商品”、“参加活动”或“存为视频号草稿”等微信生态功能时触发。
- **典型提示词**：
  - “帮我把这个视频发到我的视频号”
  - “视频号发布，带上我在广州的位置”
  - “在视频号推文里挂载这个商品链接”
  - “参加视频号最新的创作激励活动”

## 执行逻辑 (Logic Flow)
1. **意图解析**：识别是否需要挂载商品 (Goods)、活动 (Activity)、位置 (Location)、合集 (Collection) 或剧集 (Drama)。
2. **多维辅助检索**：
   - 位置：调用 `locations` 获取 POI。
   - 活动：调用 `activities` 获取活动 ID。
   - 商品：调用 `goods` 获取带货商品信息。
   - 剧集：调用 `drama-tasks` 获取当前账号可用剧集。
3. **参数装配**：将查询结果按 schema 写入 `accountForms[i].contentPublishForm`；剧集只保留三个真实字段，不添加 `raw`。
4. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

> [!TIP]
> 示例优先使用“标准请求体”格式：共享资源放在 `publishArgs` 根级，账号差异字段放在 `accountForms[]`。CLI 会在校验阶段自动补齐缺失资源字段。

> [!IMPORTANT]
> 视频号封面大小不能超过 512KB。上传封面时必须执行 `yxer upload <封面路径或URL> --platform 视频号 --usage cover`；如果原图超限，CLI 会内部压缩后上传，并在返回 JSON 中给出压缩后的 `size`。payload 中使用该上传结果的完整 `cover` 对象和匹配的 `coverKey`。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定为 `task` | `task` |
| `title` | `string` | 否 | 视频标题 (最多 80 字) | - |
| `short_title` | `string` | 否 | 视频短标题 | - |
| `description` | `string` | 否 | 视频描述，支持 HTML 格式和 `@` 好友/话题标签 | - |
| `horizontalCover` | `object` | 否 | 视频横版封面，使用 `OldCover` 结构；填写在 `contentPublishForm.horizontalCover`，也可用共享字段 `publishArgs.horizontalCover` 自动补齐 | - |
| `createType` | `number` | **是** | 原创声明类型：1-声明原创，2-非原创或转载。用户未提及原创时保持 2 | 2 |
| `declaration` | `number` | 否 | 视频标注：0-无需标注，1-含 AI 生成内容，2-内容包含营销广告，3-内容为虚构剧情仅供娱乐，7-内容为转载，8-个人观点仅供参考 | 0 |
| `pubType` | `number` | **是** | 发布类型：0-草稿，1-直接发布；与原创声明无关 | 1 |
| `location` | `object` | 否 | 视频位置，使用 `PlatformDataItem` 结构 | - |
| `scheduledTime` | `number` | 否 | 定时发布时间戳 (13 位 Unix 时间戳，单位: 毫秒) | - |
| `shopping_cart` | `object` | 否 | 关联商品：使用 `yxer query goods` 返回的单个 GoodListItemResponse 对象，不包装为数组，不要求 `raw` | - |
| `collection` | `object` | 否 | 合集信息 (`yixiaoerId`, `yixiaoerName`, `raw`) | - |
| `drama` | `object` | 否 | 剧集信息：仅 `yixiaoerId`、`yixiaoerImageUrl`、`yixiaoerName`，不使用 `raw` | - |
| `activity` | `object` | 否 | 活动信息 (`yixiaoerId`, `yixiaoerName`, `raw`) | - |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["视频号"],
  "coverKey": "cover_key",
  "publishArgs": {
    "video": { "key": "v_key", "size": 1024000, "width": 1080, "height": 1920, "duration": 15 },
    "cover": { "key": "cover_key", "size": 102400, "width": 1080, "height": 1920 },
    "coverKey": "cover_key",
    "accountForms": [
      {
        "platformAccountId": "SPH_ACC_ID",
        "mediaId": "media_001",
        "platformName": "视频号",
        "publishContentId": "publish_content_001",
        "contentPublishForm": {
          "formType": "task",
          "title": "记录美好瞬间",
          "description": "<p>这是我的视频号首发 #生活 #记录</p>",
          "createType": 2,
          "declaration": 1,
          "pubType": 1,
          "location": {
            "yixiaoerId": "loc_001",
            "yixiaoerName": "广州市",
            "raw": {}
          }
        }
      }
    ]
  }
}
```

## 3. 复杂对象结构说明

### 3.1 OldCover
包含 `key`, `size`, `width`, `height`。

### 3.2 PlatformDataItem (位置/合集/活动)
包含 `yixiaoerId`, `yixiaoerName`, `raw` (必须完整透传)。

### 3.3 视频号商品

`contentPublishForm.shopping_cart` 是一个商品对象，不是数组。直接选择 `yxer query goods <account_id> --json` 返回的单个商品对象并完整保留查询字段。Web 的 `GoodListItemResponse` 包含 `yixiaoerId`、`yixiaoerName`、`price`，以及可能返回的 `earnPrice`、`count`、`yixiaoerDesc`、`yixiaoerImageUrl`；不需要手工补 `raw`。

### 3.4 Drama (剧集)

剧集不是合集，必须使用 `yxer query drama-tasks <account_id> [--query 关键词] --json` 查询，并通过 `publish form choose` 选择。发布路径为 `publishArgs.accountForms[].contentPublishForm.drama`，对象严格为：

```json
{
  "yixiaoerId": "event/<真实剧集标识>",
  "yixiaoerImageUrl": "<查询结果中的图片地址>",
  "yixiaoerName": "<查询结果中的剧集名称>"
}
```

`drama` 不需要 `raw`；`yixiaoerImageUrl` 是查询返回的剧集元数据地址。不要用 `collections` 查询结果替代，也不要用 `form set` 手工写入剧集。

## 相关接口

| 目标数据 | 对应 Action | 文档参考 |
| :--- | :--- | :--- |
| `location`  | `locations` | [获取位置信息](../../get-locations.md) |
| `activity`  | `activities` | [获取活动列表](../../get-publish-activities.md) |
| `shopping_cart`| `goods`   | [获取商品列表](../../get-goods.md) |
| `drama` | `drama-tasks` | [获取视频号剧集列表](../../get-drama-tasks.md) |
| `video.key` | `upload`    | [资源上传](../../upload-resource.md) |

## 4. 原创声明的自然语言触发

在 Agent 解析用户意图时，按下面规则写入 `contentPublishForm.createType`：

- “勾选原创”“声明原创”“开启原创”“按原创发布” → `createType: 1`
- “不勾选原创”“关闭原创”“非原创”“转载”，或用户没有提到原创 → `createType: 2`

不要新增或改用 `original`、`isOriginal`、`originalFlag`。`originalFlag` 是微信视频号底层请求字段，不是 yxer CLI 的输入字段；`pubType` 只负责草稿/直接发布。
