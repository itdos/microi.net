# 图文发布 (Image-Text Publish)

> [!CAUTION]
> **阅读规范 (Reading Protocol)**:
> 本文档是 **所有平台** 图文发布的 **唯一入口** 和 **基础 DTO 定义**。
> 在查阅具体的平台文档（如 `xiaohongshu.md`）之前，你 **必须** 首先查阅本文档以理解 Payload 的根结构，否则将导致生成的 JSON 无法通过校验。

## 触发场景 (Trigger)
- **意图辨析**：发布短小精悍的图文动态（类似小红书笔记、微博动态、朋友圈风格）时触发。特点是多图 + 简短描述。
- **典型提示词**：
  - “帮我把这几张图发到小红书”
  - “发布一条带图片的微博动态”
  - “这个产品的宣传图，同步到抖音和推文”

## 执行逻辑 (Logic Flow)
1. **多图处理**：
   - 遍历所有待发图片，循环调用 `upload` action 获得多个资源 Key。
   - 严禁缺失任何图片的 Key。
2. **账号确权**：获取目标账号对应的 `platformAccountId`。
3. **平台细化**：针对小红书等平台，查阅对应文档补齐“话题”、“地点”等字段。
4. **Payload 装配**：按照 1.1 - 1.3 节结构，构造包含 `action: "publish"` 的 JSON。
5. **指令交付**：先执行 `yxer validate <platform> imageText <payload.json>`，再执行 `yxer publish imageText <platform> <payload.json> --dry-run`，确认请求后才正式发布。

> 微信公众号图文是例外：正文、发布设置写在 `accountForms[].contentPublishForm`，图片写在 `accountForms[].images`；`statement` 直接传数字枚举值。具体字段以 [`weixingongzhonghao.md`](./weixingongzhonghao.md) 为准。

淘宝光合图文的平台字段、商品查询和挂车规则见 [`taobaoguanghe.md`](./taobaoguanghe.md)。

## 1. 数据结构 (Data Structure)

接口要求传入 `CloudTaskPushRequest` 结构。

### 1.1 基础结构 (Base Structure)

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`publish` | - |
| `publishType` | `string` | **是** | 固定为 `imageText` | - |
| `platforms` | `string[]` | **是** | 目标平台枚举数组，详见下方平台列表 | - |
| `coverKey` | `string` | 否 | 任务封面资源 Key；新浪微博、小红书、视频号、知乎、头条号图文默认使用 `images[0]` 作为内部封面，无需外部传入 | - |
| `publishArgs` | `Object` | **是** | 发布参数核心容器 | - |
| `taskSetId` | `string` | 否 | 任务集唯一标识 (草稿发布时必填) | - |
| `desc` | `string` | 否 | 任务描述/摘要 | - |
| `publishChannel` | `string` | 否 | `cloud` (云端) 或 `local` (本机) | `cloud` |
| `clientId` | `string` | 否 | 客户端连接 ID (`local` 发布时必填) | - |
| `isDraft` | `boolean` | 否 | 是否仅保存为草稿 (蚁小二草稿) | `false` |

### 1.2 草稿模式选取 (Draft Selection)

| 场景 | 蚁小二草稿箱 | 目标平台草稿箱 |
| :--- | :--- | :--- |
| **位置** | `Payload` 根路径 | `accountForms` -> `contentPublishForm` |
| **参数** | `"isDraft": true` | `"pubType": 0` (若平台不支持，见下方说明) |
| **效果** | 仅保存在蚁小二系统，不发起平台推送 | 执行推送流程，但最终结果为平台端的草稿态 |
| **用户话术** | “存为蚁小二草稿”、“暂不发布” | “存到抖音草稿箱”、“推送到小红书草稿盒” |

> [!TIP]
> **字段兼容性补丁 (Draft Fallback Rule)**:
> Agent 在处理“存为平台草稿”时必须遵循以下优先级：
> 1.  **首选 (pubType)**：若目标平台文档定义了 `pubType` 字段，必须设置 `"pubType": 0`。
> 2.  **次选 (visibleType)**：若无 `pubType` 但定义了 `visibleType` 或 `privacy` 等字段，将其设置为 **`1` (私密)**。对应的，`0` 为公开。
> 3.  **不支持**：若上述字段均未在平台文档中定义，说明该平台不支持草稿或私密保存，Agent 应向用户说明情况并引导其选择公开推送或存为蚁小二内部草稿。


### 1.3 发布参数 (publishArgs)

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `content` | `string` | 否 | 通用平台图文描述；微信公众号图文使用 `contentPublishForm.desc` | - |
| `accountForms` | `Array` | **是** | 账号发布表单列表 | - |

### 1.4 账号表单项 (accountForms Item)

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `platformAccountId` | `string` | **是** | 蚁小二平台账号唯一 ID | - |
| `images` | `Array` | **是** | **ImageFormItem[]**: 图文图片列表 (`key`, `width`, `height`, `size`) | - |
| `cover` | `Object` | 否 | **ImageFormItem**: 主封面对象；仅在平台 schema 暴露单独封面字段时填写 | - |
| `contentPublishForm`| `Object` | **是** | **透传层**: `{}` | - |
| `coverKey` | `string` | 否 | 账号级封面 Key；首图封面平台由 CLI 派生，微信公众号若已有接口返回的 `coverKey` 可直接保留 | - |

## 2. 发布示例 (Payload Example)

```json
{
  "action": "publish",
  "publishType": "imageText",
  "platforms": ["小红书"],
  "publishArgs": {
    "content": "这是一个图文发布的描述内容。 #演示",
    "accountForms": [
      {
        "platformAccountId": "acc_img_002",
        "images": [
          { "key": "img_key_1", "width": 1080, "height": 1440, "size": 200000 }
        ]
      }
    ]
  }
}
```

## 4. 通用规则 (Common DTO Rules)

### 4.1 级联分类组装 (Cascading Categories)
许多平台要求传入由父及子的完整分类对象数组。
- **组装逻辑**：Agent 从 `categories` 接口获取数据后，若存在层级关系，**必须自行构造** 路径数组。
- **填表规范**：对于每一级，必须包含 `yixiaoerId`, `yixiaoerName` 以及对应的 **`raw`** 对象。
- **层级示例**：
  - 父分类：`{"yixiaoerId": "18", "yixiaoerName": "动漫", "raw": {...}}`
  - 子分类：`{"yixiaoerId": "1", "yixiaoerName": "国产动漫", "raw": {...}}`
  - **最终 Payload 形式**（Agent 需手动装配成此数组）：
    ```json
    "category": [
      { "yixiaoerId": "18", "yixiaoerName": "动漫", "raw": {...} },
      { "yixiaoerId": "1", "yixiaoerName": "国产动漫", "raw": {...} }
    ]
    ```
