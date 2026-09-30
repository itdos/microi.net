# 小红书店铺 视频发布

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Xiaohongshushop”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到Xiaohongshushop”
  - “同步视频到Xiaohongshushop”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为Xiaohongshushop。
2. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


## 1. contentPublishForm 数据结构

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| formType | string | 是 | 固定为 `task` | `task` |
| title | string | 是 | 视频标题 | - |
| description | string | 是 | 视频描述 | - |
| location | object | 否 | 视频位置，使用 `PlatformDataItem` 结构，查询见 [`../../get-locations.md`](../../get-locations.md) | - |
| scheduledTime | number | 否 | 定时发布时间戳（13 位 Unix 时间戳，单位：毫秒） | - |
| shoppingCart | object[] | 否 | 关联商品列表，使用 `ShoppingCartItem` 结构数组 | - |

## 2. 复杂对象结构

### PlatformDataItem
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| id | string | 是 | ID |
| text | string | 是 | 文本内容 |
| raw | object | 是 | 平台原始数据 |

### ShoppingCartItem
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| yixiaoerId | string | 是 | 商品 ID |
| yixiaoerName | string | 是 | 商品名称 |
| yixiaoerDesc | string | 否 | 商品规格说明 |
| yixiaoerImageUrl | string | 否 | 商品图片 URL |
| price | number | 否 | 商品价格（单位：分） |
| earnPrice | number | 否 | 预估佣金（单位：分） |



## 3. JSON 示例

```json
{
  "publishType": "video",
  "platforms": ["Xiaohongshushop"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "XHS_SHOP_ACC_ID",
        "video": {
          "key": "v_key",
          "size": 1024000,
          "width": 1080,
          "height": 1440,
          "duration": 30
        },
        "contentPublishForm": {
          "formType": "task",
          "title": "小红书店铺新品推荐",
          "description": "这是关于店铺新品发布的推广视频。",
          "shoppingCart": [
            {
              "goods_id": "112233",
              "price": 99.9
            }
          ]
        }
      }
    ]
  }
}
```

## 相关接口

| 目标字段 | 对应 Action | 文档参考 |
| :--- | :--- | :--- |
| `location` | `locations` | [获取位置信息](../get-locations.md) |
| `shoppingCart` | `goods` | [获取商品列表](../../get-goods.md) |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
