# 视频发布 (Video Publish)

> [!CAUTION]
> **阅读规范 (Reading Protocol)**:
> 本文档是 **所有平台** 视频发布的 **唯一入口** 和 **基础 DTO 定义**。
> 在查阅具体的平台文档（如 `douyin.md`）之前，你 **必须** 首先查阅本文档以理解 Payload 的根结构，否则将导致生成的 JSON 无法通过校验。

## 触发场景 (Trigger)
- **意图辨析**：当用户下达分发视频指令（无论是单平台发布还是多平台矩阵分发）时触发。涵盖从本地视频上传到最终推送的全链路。
- **典型提示词**：
  - “把这个视频发布到全平台”
  - “帮我同步这个短剧到抖音和快手”
  - “我的视频号要更新了，标题是 XXX”
  - “使用本地模式分发这个视频”

## 执行逻辑 (Logic Flow)
1. **资源预处理**：
   - 调用 `yxer upload` 将本地或 URL 视频及封面图上传至云端，并持有获得的 `key`。
   - 严禁在 `publish` 负载中直接透传原始 URL。
2. **账号与平台选取**：识别目标 `platforms` 列表及具体的 `platformAccountId`（通过 `yxer accounts` 查询）。
3. **参数深度补全**：若涉及分类、地理位置、音乐等需要查询的动态字段，调用对应 `yxer query categories`、`yxer query locations`、`yxer query music` 等命令获取合法对象；多多视频 `shopping_cart.goods_id` 由用户手工提供，`source` 固定为 `pdd`。
4. **Payload 装配**：按照本文档 1.1 - 1.3 节定义的 DTO 结构，组装包含 `action: "publish"` 的完整 JSON。
5. **指令交付**：先执行 `yxer validate <platform> video <payload.json>`，再执行 `yxer publish video <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。
6. **状态跟踪**：记录返回的 `taskSetId`，以便后续通过 `yxer query records` 查询进度。

## 1. 数据结构 (Data Structure)

接口要求传入 `CloudTaskPushRequest` 结构。

### 1.1 基础结构 (Base Structure)

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`publish` | - |
| `publishType` | `string` | **是** | 固定为 `video` | - |
| `platforms` | `string[]` | **是** | 目标平台枚举数组，详见下方平台列表 | - |
| `coverKey` | `string` | **是** | 任务封面资源 Key | - |
| `publishArgs` | `Object` | **是** | 发布参数核心容器 | - |
| `taskSetId` | `string` | 否 | 任务集唯一标识 (草稿发布时必填) | - |
| `desc` | `string` | 否 | 任务描述/摘要 | - |
| `publishChannel` | `string` | 否 | `cloud` (云端) 或 `local` (本机) | `cloud` |
| `clientId` | `string` | 否 | 客户端连接 ID (`local` 发布时必填) | - |
| `isDraft` | `boolean` | 否 | 是否仅保存为草稿 (蚁小二草稿) | `false` |
| `isAppContent` | `boolean` | 否 | 业务扩展标记，CLI 会原样透传 | - |

### 1.2 草稿模式选取 (Draft Selection)

| 场景 | 蚁小二草稿箱 | 目标平台草稿箱 |
| :--- | :--- | :--- |
| **位置** | `Payload` 根路径 | `accountForms` -> `contentPublishForm` |
| **参数** | `"isDraft": true` | `"pubType": 0` (若平台不支持，见下方说明) |
| **效果** | 仅保存在蚁小二系统，不发起平台推送 | 执行推送流程，但最终结果为平台端的草稿态 |
| **用户话术** | “存为蚁小二草稿”、“以后再发” | “存到抖音草稿箱”、“推送到小红书草稿” |

> [!TIP]
> **字段兼容性补丁 (Draft Fallback Rule)**:
> Agent 在处理“存为平台草稿”时必须遵循以下优先级：
> 1.  **首选 (pubType)**：若目标平台文档定义了 `pubType` 字段，必须设置 `"pubType": 0`。
> 2.  **次选 (visibleType)**：若无 `pubType` 但定义了 `visibleType`，则将其设置为 **`1` (私密)**。对应的，`0` 表示公开。
> 3.  **不支持**：若上述两个字段均未定义，则说明该平台不支持草稿或私密保存，Agent 应告知用户并询问是否直接公开发布。


### 1.3 发布参数 (publishArgs)

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `accountForms` | `Array` | **是** | 账号发布表单列表 | - |
| `video` | `Object` | 否 | **标准请求体共享视频资源**。CLI 校验时会在缺失时复制到各 `accountForms[i].video` | - |
| `images` | `Array` | 否 | **标准请求体共享图片资源**。视频场景通常仅作扩展透传 | - |
| `cover` | `Object` | 否 | **标准请求体共享封面资源**。CLI 校验时会在缺失时复制到各 `accountForms[i].cover` | - |
| `coverKey` | `string` | 否 | **标准请求体共享封面 Key**。CLI 校验时会在缺失时复制到各 `accountForms[i].coverKey` | - |
| `horizontalCover` | `Object` | 否 | **标准请求体共享横版封面资源**。仅适用于平台 schema 暴露 `horizontalCover` 的视频平台；CLI 校验时会复制到各 `accountForms[i].contentPublishForm.horizontalCover` | - |
| `verticalCover` | `Object` | 否 | **标准请求体共享竖版封面资源**。仅适用于平台 schema 暴露 `verticalCover` 的视频平台；CLI 校验时会复制到各 `accountForms[i].contentPublishForm.verticalCover` | - |

> [!TIP]
> **CLI 输入兼容规则**:
> - 推荐优先使用“标准请求体”形态，即在 `publishArgs` 中声明共享的 `video`、`cover`、`coverKey`，再在 `accountForms[]` 中补平台差异字段。
> - 若平台支持横版封面，推荐在 `publishArgs.horizontalCover` 声明共享横版封面，或直接填写 `accountForms[].contentPublishForm.horizontalCover`；不要放在 `accountForms[].horizontalCover`。
> - 若平台支持竖版封面，推荐在 `publishArgs.verticalCover` 声明共享竖版封面，或直接填写 `accountForms[].contentPublishForm.verticalCover`；不要放在 `accountForms[].verticalCover`。百家号视频的主/横版封面仍是 `cover`，不是 `horizontalCover`。
> - CLI 当前仍按**单平台命令**执行：`yxer publish video <platform> <payload.json> [--publish-channel local --client-id <clientId>]`。即使请求体里可以表达多平台，命令本身仍需逐个平台调用。
> - `yxer validate` 与 `yxer publish` 都接受完整标准请求体；在共享资源字段存在而账号项缺失时，CLI 会在校验阶段自动补齐到对应 `accountForms[]`。

### 1.4 账号表单项 (accountForms Item)

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `platformAccountId` | `string` | **是** | 蚁小二平台账号唯一 ID | - |
| `video` | `Object` | **是** | **VideoFormItem**: 视频对象 (`key`, `width`, `height`, `size`) | - |
| `cover` | `Object` | **是** | **ImageFormItem**: 主封面对象 | - |
| `contentPublishForm`| `Object` | **是** | **透传层**: `{}` | - |
| `coverKey` | `string` | **是** | 账号级封面 Key (必须与 `cover.key` 一致) | - |
| `fps` | `number` | 否 | 视频发布帧率 (海外平台使用) | - |
| `mediaId` | `string` | 否 | 业务扩展字段，CLI 原样透传 | - |
| `platformName` | `string` | 否 | 业务扩展字段，CLI 原样透传 | - |
| `publishContentId` | `string` | 否 | 业务扩展字段，CLI 原样透传 | - |

## 2. 发布示例 (Payload Example)

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["抖音"],
  "coverKey": "video_cover_key",
  "desc": "视频发布任务",
  "publishChannel": "local",
  "clientId": "local-client",
  "publishArgs": {
    "video": {
      "key": "video_oss_key",
      "width": 1080,
      "height": 1920,
      "size": 52428800
    },
    "cover": {
      "key": "video_cover_key",
      "width": 1080,
      "height": 1920,
      "size": 307200
    },
    "coverKey": "video_cover_key",
    "accountForms": [
      {
        "platformAccountId": "acc_vid_003",
        "mediaId": "media_001",
        "platformName": "抖音",
        "publishContentId": "publish_content_001",
        "contentPublishForm": {
          "formType": "task",
          "title": "演示视频标题",
          "description": "<p>演示视频简介</p>"
        }
      }
    ]
  }
}
```

## 3. 支持平台列表 (Support Platforms)

以下平台支持通过 `publishType: "video"` 进行发布。

| 平台名称 | 标识符 | 文档链接 |
| :--- | :--- | :--- |
| **头条号** | `Toutiaohao` | [toutiaohao.md](./toutiaohao.md) |
| **哔哩哔哩** | `Bilibili` | [bilibili.md](./bilibili.md) |
| **哔哩哔哩-Open** | `Bilibili-Open` | [bilibili-open.md](./bilibili-open.md) |
| **抖音** | `Douyin` | [douyin.md](./douyin.md) |
| **快手-Open** | `Kuaishou-Open` | [kuaishou-open.md](./kuaishou-open.md) |
| **视频号** | `Shipinhao` | [shipinhao.md](./shipinhao.md) |
| **TikTok** | `Tiktok` | [tiktok.md](./tiktok.md) |
| **Youtube** | `Youtube` | [youtube.md](./youtube.md) |
| **Facebook** | `Facebook` | [facebook.md](./facebook.md) |
| **Instagram** | `Instagram` | [instagram.md](./instagram.md) |
| **淘宝光合** | `taobaoguanghe` | [taobaoguanghe.md](./taobaoguanghe.md) |
| ... | ... | ... |

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

> [!TIP]
> 完整工作流请参考 `../../workflows/`，技能入口位于 `../../SKILL.md`。
