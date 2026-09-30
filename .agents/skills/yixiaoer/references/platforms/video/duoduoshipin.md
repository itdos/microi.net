# 多多视频 视频发布

> [!IMPORTANT]
> **前提条件 (Prerequisite)**:
> 在使用本平台的特定参数之前，你 **必须** 已经阅读并理解了 [视频发布首页 (Index)](./index.md) 中定义的 Payload 根结构。本页仅描述 `contentPublishForm` 内部的平台差异化字段。


## 触发场景 (Trigger)
- **意图辨析**：用户指定在“Duoduoshipin”平台分发视频内容时触发。
- **典型提示词**：
  - “把这个视频发布到Duoduoshipin”
  - “同步视频到Duoduoshipin”

## 执行逻辑 (Logic Flow)
1. **意图确认**：确认目标平台为Duoduoshipin。
2. **参数装配**：识别并填充标题、描述等平台特定字段至 `contentPublishForm`。
3. **指令执行**：先执行 `yxer validate <platform> <type> <payload.json>`，再执行 `yxer publish <type> <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。


## 1. contentPublishForm 数据结构

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| formType | string | 是 | 固定为 `task` | `task` |
| description | string | 否 | 多多视频描述 | - |
| declaration | number | 否 | 内容声明：`0` 无需声明，`1` 内容由 AI 生成，`3` 内容为转载，`5` 虚构演绎仅供娱乐，`7` 内容含营销信息，`8` 个人观点仅供参考 | `0` |
| scheduledTime | number | 否 | 仅在用户明确要求定时发布时填写；不填写时 CLI 默认立即发布 | - |
| pubType | number | 否 | 发布方式；CLI 默认设置为 `1`（立即发布） | `1` |
| shopping_cart | object | 否 | 关联商品信息（购物车）；商品 ID 由用户手工输入 | - |

`declaration=0` 表示无需声明，服务端不会将其转换为 `statement: { "type": 0 }`；非 `0` 值由服务端转换为 `statement: { "type": declaration }`。CLI 只传 `contentPublishForm.declaration` 数字字段，不要直接构造旧的 `statement` 对象。

`shopping_cart` 出现时必须包含以下字段：

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `goods_id` | `string` | 是 | 用户输入的多多视频业务商品 ID；不是 `yxer query goods` 返回对象中的 `yixiaoerId` |
| `source` | `string` | 是 | 固定为 `pdd`，CLI 会自动补齐 |

## 2. JSON 示例

```json
{
  "publishType": "video",
  "platforms": ["Duoduoshipin"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "PDD_VIDEO_ACC_ID",
        "video": {
          "key": "v_key",
          "size": 1024000,
          "width": 1080,
          "height": 1920,
          "duration": 30
        },
        "contentPublishForm": {
          "formType": "task",
          "description": "这是多多视频的商品分享推荐内容。",
          "declaration": 0,
          "shopping_cart": {
            "goods_id": "998877",
            "source": "pdd"
          }
        }
      }
    ]
  }
}
```

使用页面式 CLI 表单时，通过 `publish form set` 填写用户商品 ID，不要使用 `publish form choose`：

```bash
yxer publish form set publish-form.json publishArgs.accountForms[0].contentPublishForm.shopping_cart.goods_id --value '"998877"'
```

## 相关接口

| 目标数据 | 对应 Action | 相关文档 |
| :--- | :--- | :--- |
| `video.key` | `upload` | [资源上传](../../upload-resource.md) |
