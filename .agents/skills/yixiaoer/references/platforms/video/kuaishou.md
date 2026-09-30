# 快手视频发布参数 (Kuaishou Video)

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。

## 触发场景 (Trigger)
- **意图辨析**：用户指定在“快手”平台分发短视频，且需要配置如“可见范围控制 (visibleType)”、“同城展示 (nearby_show)”、“创作申明 (AI生成等)”或“合集挂载”等快手特色功能时触发。
- **典型提示词**：
  - “帮我把这个视频同步到快手”
  - “快手发布，设置仅好友可见”
  - “视频发到快手，不要在同城频道显示”
  - “申明这个快手内容是由 AI 辅助生成的”

## 执行逻辑 (Logic Flow)
1. **意图解析**：识别用户对私密性、同城展示及原创属性的要求。
2. **辅助字段检索**：
   - 位置：若需要，调用 `locations` 获取 POI 数据。
   - 合集：调用 `collections` 获取可用合集 ID。
3. **参数装配**：构造 `accountForms[i].contentPublishForm`，注意布尔值字段（如 `nearby_show`）的映射。
4. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

## 1. contentPublishForm 参数定义

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `formType` | `string` | **是** | 固定为 `task` | `task` |
| `title` | `string` | **否** | 视频标题 | - |
| `description` | `string` | **否** | 视频描述 | - |
| `declaration` | `number` | **否** | 视频声明：0-不申明, 1-内容为 AI 生成, 2-演绎情节仅供娱乐, 3-个人观点仅供参考 | 0 |
| `location` | `object` | **否** | 视频位置，使用 `PlatformDataItem` 结构 | - |
| `visibleType` | `number` | **是** | 可见类型：0-公开, 1-私密, 3-好友可见 | 0 |
| `scheduledTime` | `number` | **否** | 定时发布时间戳 (13 位 Unix 时间戳，单位: 毫秒) | - |
| `shopping_cart` | `object` | **否** | 关联商品信息 | - |
| `collection` | `object` | **否** | 合集信息，使用 `Category` 结构 | - |
| `mini_app` | `object` | **否** | 挂载小程序 (与购物车互斥) | - |
| `nearby_show` | `boolean` | **否** | 是否同城展示 | `true` |
| `allow_same_frame` | `boolean` | **否** | 是否允许同框 | `false` |
| `allow_download` | `boolean` | **否** | 是否允许下载 | `false` |

## 2. Payload 完整示例

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["快手"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "acc_ks_vid_001",
        "video": { "key": "v_key", "size": 1024000, "width": 1080, "height": 1920, "duration": 15 },
        "contentPublishForm": {
          "formType": "task",
          "title": "快手视频发布测试",
          "visibleType": 0,
          "nearby_show": true,
          "declaration": 1
        }
      }
    ]
  }
}
```

## 3. 复杂对象结构说明

### 3.1 PlatformDataItem / Category
包含 `yixiaoerId`, `yixiaoerName`, `raw` (必须完整透传)。

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `location`  | `locations`   | [获取位置信息](../../get-locations.md) |
| `collection`| `collections` | [获取合集列表](../../get-collections.md) |
| `video.key` | `upload`      | [资源上传](../../upload-resource.md) |
