# 话题标签格式规范

适用范围：发布 payload 中涉及 `topics`、`tags`、`challenge`，或 `description` / `desc` / `content` 中的 `<topic>` 标签时，必须先读取本文档。

## 目的

- 统一 Agent 对“话题/标签”字段的装配方式
- 明确“描述类字段/正文中的话题标签结构”和“字段中的话题对象结构”是两套规则
- 明确 CLI 会兜底修复 `description` 中的普通 `#话题`；字段中的话题对象仍按各平台字段定义传入

## 总规则

- Agent 必须优先以目标平台 schema 和平台文档为准。
- 字段中的话题数据，如 `topics`、`tags`、`challenge`，必须按各平台 schema 和平台文档定义的字段结构传入。
- 只有当平台文档明确要求在 `description`、`desc` 或 `content` 中嵌入话题标签时，才使用 `<topic>` HTML。
- `description` / `desc` / `content` 中的 `<topic>` 规则，不适用于 `topics`、`tags`、`challenge` 等字段对象。
- CLI 内部兼容逻辑只处理 `description` 字段：将普通 `#话题` 归一化为 `<topic>` HTML；不会处理 `content`，也不会改变 `tags` / `topics` / `challenge` 字段结构。

## 字段类型对照

### 1. `topics`

用于平台显式支持结构化话题对象的场景，例如知乎文章、抖音文章、易车号文章等。

标准结构：

```json
[
  {
    "yixiaoerId": "topic_id",
    "yixiaoerName": "话题名",
    "raw": {}
  }
]
```

规则：

- 必须来自 `yxer query challenges`、`yxer query categories` 或平台文档明确指定的查询命令返回结果
- 必须保留完整 `raw`
- 不要只传名称字符串

### 2. `tags`

用于平台要求字符串数组的场景，例如 CSDN 文章、B 站文章、企鹅号文章等。

标准结构：

```json
["AI", "自动化发布"]
```

规则：

- 以 schema 和平台文档定义的字段类型为准
- 不要写成单个逗号拼接字符串
- 不要混入 `#`，除非平台文档明确要求

### 3. `challenge`

用于平台只接受单个挑战/话题对象的场景，例如抖音视频。

标准结构：

```json
{
  "yixiaoerId": "challenge_id",
  "yixiaoerName": "挑战名",
  "raw": {}
}
```

规则：

- 必须来自 `yxer query challenges <account_id> ...`
- 必须透传完整对象
- 不要把 `challenge` 和 `tags` / `topics` 混用

### 4. 描述类字段/正文中的 `<topic>` HTML

仅用于平台文档明确说明 `description`、`desc` 或 `content` 支持 `<topic>` 标签的场景，例如抖音图文。

标准结构：

```html
<p>正文描述</p><p><topic text="合拍">#合拍</topic><topic text="夏日">#夏日</topic></p>
```

规则：

- Agent 必须直接写出最终 HTML
- 如 `description` 仍是普通文本加 `#话题`，CLI 会在 validate/dry-run/publish 流程中归一化为上述 HTML。
- `text` 属性应为不带 `#` 的标签文本
- 标签正文通常为 `#标签名`
- 不要把这种 HTML 结构误用于 `topics` / `challenge` / `tags` 字段
- 不要同时依赖 `tags` 再让 CLI 自动拼 `<topic>`；CLI 不从 `tags` 生成描述话题。

## 平台装配优先级

1. 先看 `yxer schema fields <platform> <type>`
2. 再看对应平台文档
3. 只有文档明确允许时，才在 `description` / `desc` / `content` 中写 `<topic>` HTML
4. 字段中的话题数据始终按字段类型本身传入，不使用 `<topic>` HTML

## 抖音相关规则

### 抖音视频

- 优先使用平台文档定义的结构化字段，如 `challenge`
- `description` 是普通描述字段；除非平台文档明确要求，否则不要把字段中的话题改写成 `<topic>` HTML

### 抖音图文

- 若文档要求 `description` 支持 `<topic>`，Agent 应直接传最终 HTML
- 这个规则只针对 `description`
- 不要把 `topics` / `challenge` 之类字段也按 `<topic>` HTML 处理
- 不要只传 `tags` 再期待 CLI 注入 `<topic>`

### 抖音文章

- 优先使用 `topics: Category[]`
- `topics` 按结构化字段传入，不按 `<topic>` HTML 规则处理
- 不要把文章话题只写在 `description` / `desc` / `content` 文本里

## 禁止行为

- 只给自然语言描述，例如 `"description": "今天聊聊 #AI #自动化"` 或 `"desc": "今天聊聊 #AI #自动化"`，却不按平台要求提供结构化字段或描述 HTML
- 把 `topics` 写成字符串数组
- 把 `tags` 写成对象数组
- 把 `topics` / `challenge` / `tags` 按 `<topic>` HTML 结构传入字段本身
- 省略查询结果里的 `raw`
- 依赖 CLI 从 `tags`、`topics`、`challenge` 或 `content` 自动修复标签结构

## 推荐执行方式

1. 先查 schema：`yxer schema fields <platform> <type>`
2. 再查平台文档确认字段类型
3. 如需动态话题对象，先执行 `yxer query challenges` / `yxer query categories`
4. 由 Agent 直接生成最终 payload
5. 用 `yxer validate` 验证；`description` 中的普通 `#话题` 会被 CLI 归一化为 `<topic>` HTML
