# 文章发布 (Article Publish)

> [!CAUTION]
> **阅读规范 (Reading Protocol)**:
> 本文档是 **所有平台** 文章发布的 **唯一入口** 和 **基础 DTO 定义**。
> 在查阅具体的平台文档（如 `weixingongzhonghao.md`）之前，你 **必须** 首先查阅本文档以理解 Payload 的根结构，否则将导致生成的 JSON 无法通过校验。

## 触发场景 (Trigger)
- **意图辨析**：当用户下达长图文、深度文章或多图文消息（仅限微信公众号）分发指令时触发。
- **典型提示词**：
  - “发布这篇公众号文章，内容是...”
  - “帮我同步这篇长文章到知乎和 CSDN”
  - “把这一周的推文定时在周日发布”

## 执行逻辑 (Logic Flow)
1. **内容转换**：确保正文为 HTML 格式。若用户提供的是 Markdown 或纯文本，需先进行转换。
2. **资源补全**：
   - 调用 `upload` action 上传文章封面图。
   - 正文内嵌图片也建议先行上传获取 Key（视频号卡片、公众号卡片同理）。
3. **平台策略分配**：
   - **微信公众号**：必须单独发布，推荐使用 `platformForms` 结构。
   - **通用平台**（知乎、简书等）：使用 `accountForms` 结构进行分发。
4. **参数装配**：注入 `action: "publish"` 及其余 DTO 字段。
5. **指令执行**：先执行 `yxer validate <platform> article <payload.json>`，再执行 `yxer publish article <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。

## 1. 数据结构 (Data Structure)

接口要求传入 `CloudTaskPushRequest` 结构。

### 1.1 基础结构 (Base Structure)

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`publish` | - |
| `publishType` | `string` | **是** | 固定为 `article` | - |
| `platforms` | `string[]` | **是** | 目标平台枚举数组，详见下方平台列表 | - |
| `coverKey` | `string` | **是** | 任务封面资源 Key | - |
| `publishArgs` | `Object` | **是** | 发布参数核心容器 | - |
| `taskSetId` | `string` | 否 | 任务集唯一标识 (草稿发布时必填) | - |
| `desc` | `string` | 否 | 任务描述/摘要 | - |
| `publishChannel` | `string` | 否 | `cloud` (云端) 或 `local` (本机) | `cloud` |
| `clientId` | `string` | 否 | 客户端连接 ID (`local` 发布时必填) | - |
| `isDraft` | `boolean` | 否 | 是否仅保存为 draft (蚁小二草稿箱) | `false` |
| `isAppContent` | `boolean` | 否 | 业务扩展标记，CLI 会原样透传 | - |

### 1.2 草稿模式选取 (Draft Selection)

| 场景 | 蚁小二草稿箱 | 目标平台草稿箱 |
| :--- | :--- | :--- |
| **位置** | `Payload` 根路径 | `accountForms` -> `contentPublishForm` |
| **参数** | `"isDraft": true` | `"pubType": 0` (若平台不支持，见下方说明) |
| **效果** | 仅保存在蚁小二系统，不发起平台推送 | 执行推送流程，但最终结果为平台端的草稿态 |
| **用户话术** | “存为蚁小二草稿”、“以后再发” | “存到百家号草稿箱”、“推送到知乎草稿” |

> [!TIP]
> **字段兼容性补丁 (Draft Fallback Rule)**:
> Agent 在处理“存为平台草稿”时必须遵循以下优先级：
> 1.  **首选 (pubType)**：若目标平台文档定义了 `pubType` 字段，必须设置 `"pubType": 0`。
> 2.  **次选 (visibleType)**：若无 `pubType` 但定义了 `visibleType` 或 `status`/`privacy` 字段，则将其设置为 **`1` (私密/仅自己可见)**。对应的，`0` 表示公开。
> 3.  **不支持**：若上述两个字段均未在平台文档中定义，则说明该平台不支持草稿或私密保存，Agent 应告知用户并询问是否直接公开发布。


### 1.3 发布参数 (publishArgs)

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `accountForms` | `Array` | **是** | 账号发布表单列表 (定义目标账号) | - |
| `platformForms` | `Object` | 否 | **平台级表单**: 仅限 `微信公众号` 使用。按平台名称组织的共享配置字典 | - |
| `covers` | `Array` | 否 | **标准请求体共享文章封面列表**。CLI 校验时会在缺失时复制到各 `accountForms[i].contentPublishForm.covers` | - |
| `cover` | `Object` | 否 | 兼容旧输入。若未提供 `covers`，CLI 会把该单封面转换为 `covers[0]` | - |
| `coverKey` | `string` | 否 | **标准请求体共享封面 Key**。CLI 校验时会在缺失时复制到各 `accountForms[i].coverKey`；文章发布最终仍要求账号项有 `coverKey` | - |
| `content` | `string` | 否 | **标准请求体共享正文**。位置在 `publishArgs.content`，与 `accountForms` 同级；CLI 校验时会在缺失时复制到各 `accountForms[i].contentPublishForm.content` | - |

> [!IMPORTANT]
> **配置架构约束**:
> - **微信公众号专用性**: **微信公众号必须单独发布**。在一个发布请求中，如果包含微信公众号，则不能包含其他任何平台；反之亦然。
> - **platformForms**: **仅限微信公众号使用**。
> - **优先级**: 后端将优先尝试从 `platformForms` 中获取对应平台的配置，若不存在则回退至账号级的 `contentPublishForm`。

> [!TIP]
> **CLI 输入兼容规则**:
> - 推荐优先使用“标准请求体”形态，在 `publishArgs` 中声明共享的 `covers`、`coverKey`、`content`，这些字段都与 `accountForms` 同级。
> - 文章封面统一使用 `covers` 数组；只有一张封面时也写成 `covers: [{...}]`。`cover` 仅作为旧 payload 兼容输入。
> - 文章正文推荐直接填写 `publishArgs.content`，不要只在 `contentPublishForm.content` 中单独填写。
> - CLI 当前仍按**单平台命令**执行：`yxer publish article <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。
> - `yxer validate` 与 `yxer publish` 都接受完整标准请求体；在共享字段存在而账号项缺失时，CLI 会在校验阶段自动补齐到对应 `accountForms[]`。

### 1.4 账号表单项 (accountForms Item)

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `platformAccountId` | `string` | **是** | 蚁小二平台账号唯一 ID | - |
| `covers` | `Array` | **是** | 文章封面列表 (`OldCover[]`)；统一放在 `contentPublishForm.covers` | - |
| `contentPublishForm`| `Object` | 否 | **账号级透传配置**: 若未配置 `platformForms` 则从此读取；当 `publishArgs.content` 已提供时，CLI 会同步补齐到这里的 `content` | `{}` |
| `coverKey` | `string` | **是** | 账号级封面 Key，必须与 `contentPublishForm.covers[0].key` 一致 | - |
| `mediaId` | `string` | 否 | 业务扩展字段，CLI 原样透传 | - |
| `platformName` | `string` | 否 | 业务扩展字段，CLI 原样透传 | - |
| `publishContentId` | `string` | 否 | 业务扩展字段，CLI 原样透传 | - |

## 2. 发布示例 (Payload Example)

```json
{
  "action": "publish",
  "publishType": "article",
  "platforms": ["知乎"],
  "desc": "文章发布任务",
  "publishArgs": {
    "covers": [
      {
        "key": "article_cover_key",
        "width": 900,
        "height": 500,
        "size": 150000
      }
    ],
    "coverKey": "article_cover_key",
    "content": "<h1>演示文章标题</h1><p>这是一个演示文章的正文内容...</p>",
    "accountForms": [
      {
        "platformAccountId": "acc_art_001",
        "mediaId": "media_001",
        "platformName": "知乎",
        "publishContentId": "publish_content_001",
        "coverKey": "article_cover_key",
        "contentPublishForm": {
          "formType": "task",
          "title": "演示文章标题",
          "covers": [
            {
              "key": "article_cover_key",
              "width": 900,
              "height": 500,
              "size": 150000
            }
          ]
        }
      }
    ]
  }
}
```

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
