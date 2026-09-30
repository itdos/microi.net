# Payload 来源纪律

> 适用范围：任何需要创建、修改、校验或解释 `payload.json` 的任务。

## 何时读取

- 用户让 Agent 生成 payload
- 用户让 Agent 修 payload
- `validate` 失败，需要定位字段来源
- 用户问某个字段应该放哪一层

## 字段来源优先级

字段选择、候选确认和写入门禁必须同时遵守 [`data-accuracy.md`](./data-accuracy.md)。

1. `yxer prepare <platform> <type>`：确认表单项、前置数据、账号能力
2. 优先执行 `yxer schema fields <platform> <type>`：确认字段名、类型、必填项；需要完整层级骨架时再执行 `yxer schema get <platform> <type>`
3. 查询命令：补充动态对象，如 `category`、`location`、`music`、`collection`、`challenge`、`goods`；视频号剧集使用 `drama-tasks`
4. `yxer upload`：补充资源 `key`、尺寸、时长、格式等元数据
5. 用户明确提供的业务内容：标题、正文、描述、发布时间等
6. 平台文档：解释平台差异或特殊限制

## 标准结构

```json
{
  "action": "publish",
  "publishType": "<video|imageText|article>",
  "platforms": ["<平台中文名>"],
  "publishChannel": "cloud",
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "<platformAccountId>",
        "contentPublishForm": {
          "formType": "task"
        }
      }
    ]
  }
}
```

## 分层规则

- 顶层：`action`、`publishType`、`platforms`、`publishChannel`
- `publishArgs`：共享资源和账号表单容器
- `publishArgs.accountForms[]`：账号级表单
- `publishArgs.accountForms[].contentPublishForm`：平台业务字段
- `publishArgs.content`：文章正文主入口

## 查询 `data` 处理规则

- `yxer query ...` 的 stdout 外层 `data` 是 CLI 结果容器，只能作为字段来源，不能把整个响应 envelope 原样塞进发布 payload。
- 从查询结果选中候选后，必须按 `yxer schema fields <platform> <type>` / `dynamicFieldExamples` 显示的目标字段结构重新装配。
- 若目标字段要求嵌套 `data`，例如抖音视频 `shopping_cart[]`，应把商品完整对象放入该字段要求的内层 `data`，并补齐 schema 要求的外层字段，如 `sale_title`、`images`。
- 多多视频是例外：`shopping_cart` 只接收用户提供的 `goods_id` 和固定的 `source=pdd`，不得从 `yxer query goods` 返回对象中提取 `yixiaoerId`。
- 视频号 `contentPublishForm.drama` 是独立的三字段对象，必须来自 `yxer query drama-tasks`；不要把 `collection` 对象或 `raw` 放入该字段。
- 写入接口前必须重新执行 `yxer validate` 和 `yxer publish --dry-run`，以 dry-run 输出的 `request` 为最终请求结构依据。

## 哪些字段不能猜

- 任意 schema 未声明字段
- 任意复杂对象的 `raw`
- 任意上传资源的 `key` / `size` / `width` / `height` / `duration` / `format`
- 任意平台枚举值、默认值、分类层级 ID

## 修 payload 的顺序

1. 先看 `validate` 错误
2. 先回到 `prepare` / `schema fields` 核对字段；需要完整层级骨架时再用 `schema get`
3. 回到查询命令或 upload 结果核对字段值
4. 只修对应字段，不要重写整份 payload
5. 重新执行 `yxer validate`

## 严禁行为

- 从空白 JSON 猜测结构
- 直接把平台表单字段写到顶层
- 动态字段只填 ID 或名称、不填合法对象
- 手工伪造上传资源元数据
- 查询结果存在多个候选时，不经用户确认直接采用第一项
