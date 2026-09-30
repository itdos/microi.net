---
name: yixiaoer
version: 3.2.24
description: "通过 yxer CLI 操作蚁小二多平台内容分发：账号查询、资源上传、发布前准备、payload 校验、云发布/本机发布、草稿保存、素材登记、发布记录排查与技能同步。"
metadata:
  category: "productivity"
  requires:
    bins: ["yxer"]
  cliHelp: "yxer --help; yxer doctor; yxer accounts list --help; yxer publish --help; yxer validate --help"
---

# 蚁小二 Skill

你是 AI Agent，通过 `yxer` CLI 操作蚁小二资源。真正执行一律走 CLI，不要假设存在旧 Node 脚本入口、隐式 API 或手工脚本。

**🚀 首次使用？先读 [`./QUICKSTART.md`](./QUICKSTART.md) - 5 分钟完成首次发布**

**CRITICAL - 开始前 MUST 先读取 [`./references/yixiaoer-shared.md`](./references/yixiaoer-shared.md)，其中包含环境检查、发布通道、同步和输出协议。**
**AI EXECUTION PROTOCOL - 涉及查询、payload 修订、草稿、素材或发布时，MUST 先读取 [`./references/protocols/execution.md`](./references/protocols/execution.md)，并按状态机推进。**
**BLOCKING REQUIREMENT - 涉及正式写操作时，禁止凭记忆拼 payload、禁止跳过 workflow、禁止绕过 `yxer` CLI 直接执行旧脚本或隐式 API。**

## 能力索引

根据用户需求，必须先读取对应业务域文档，再进入具体 workflow 或 reference。不要直接凭记忆拼 payload 或执行正式发布。

- AI 执行协议
  - 入口：[`./references/protocols/execution.md`](./references/protocols/execution.md)
  - 候选确认：[`./references/protocols/confirmation.md`](./references/protocols/confirmation.md)
  - 字段来源追踪：[`./references/protocols/provenance.md`](./references/protocols/provenance.md)
  - 错误恢复：[`./references/protocols/error-recovery.md`](./references/protocols/error-recovery.md)
  - 覆盖状态机、写操作门禁、多候选确认、payload 来源追踪和失败后的最小修复策略。

- 发布与 payload 修订
  - 入口：[`./references/domains/publish.md`](./references/domains/publish.md)
  - 覆盖视频、图文、文章发布，账号选择，云/本机通道判断，payload 来源纪律，动态字段查询，平台差异文档入口。
- 账号、环境与 skill 同步
  - 入口：[`./references/domains/accounts-and-env.md`](./references/domains/accounts-and-env.md)
  - 覆盖 `doctor`、`config`、账号查询与技能同步。
- 草稿与素材库
  - 入口：[`./references/domains/draft-and-material.md`](./references/domains/draft-and-material.md)
  - 覆盖蚁小二草稿、平台草稿判断、素材上传、素材登记与“上传后立即发布”的切换路径。
- 发布记录与失败排查
  - 入口：[`./references/domains/troubleshooting.md`](./references/domains/troubleshooting.md)
  - 覆盖 `query records`、按作品信息删除已发布内容、校验失败修复、本机/云发布错误分流与回退策略。
- 安装、升级与分发
  - 入口：[`./references/domains/install-and-sync.md`](./references/domains/install-and-sync.md)
  - 覆盖 skill 安装、同步、升级和宿主侧接入说明。

## 意图分流

| 用户意图 / 说法 | 先读入口 | 后续动作 |
| --- | --- | --- |
| “帮我发一下”“发个抖音/小红书”“发布视频/图文/文章” | [`./references/domains/publish.md`](./references/domains/publish.md) | 再按类型进入对应 workflow；已有完整 payload 时走 `validate -> publish --dry-run -> publish`，缺账号/字段/资源时先补 `doctor -> accounts list -> prepare/form -> upload/query` |
| “先别发，只生成/修一下 payload” | [`./references/domains/publish.md`](./references/domains/publish.md) | 强制读取 payload 来源和类型 workflow，只做字段修订，不擅自正式发布 |
| “查下账号/环境”“怎么配置 clientId”“看看 skill 要不要同步” | [`./references/domains/accounts-and-env.md`](./references/domains/accounts-and-env.md) | 先做环境检查，再决定是否继续业务流程 |
| “存草稿”“传素材”“放到素材库里” | [`./references/domains/draft-and-material.md`](./references/domains/draft-and-material.md) | 先区分草稿和素材，再判断是否需要回切发布域 |
| “为什么失败了”“查发布记录”“删除已发布作品”“解释 validate / publish 报错” | [`./references/domains/troubleshooting.md`](./references/domains/troubleshooting.md) | 先定位失败阶段；删除时预览作品信息、按序号 dry-run，再执行 |
| “安装 skill”“升级后怎么同步”“怎么接入这个技能” | [`./references/domains/install-and-sync.md`](./references/domains/install-and-sync.md) | 优先走 skill 展示、同步和安装说明 |

## 命令探索

```bash
yxer --help
yxer doctor
yxer <command> --help
yxer prepare <platform> <type>
yxer schema fields <platform> <type>
yxer schema get <platform> <type>
```

## 全局规则

- 发布、草稿、素材、排查都只允许通过 `yxer` CLI 执行。
- 任何涉及查询、候选选择、payload 修订或写操作的任务，必须先遵循 AI 执行协议中的状态机、确认协议和错误恢复协议。
- 涉及写操作或 payload 修订时，必须遵守 [`./references/workflows/data-accuracy.md`](./references/workflows/data-accuracy.md)：先查询真实数据，再确认候选，最后 validate / dry-run / 写入。
- BLOCKING REQUIREMENT: 正式发布前必须先用同一份 `payload.json`、同一套发布通道参数完成 `yxer validate -> yxer publish --dry-run`；缺账号、字段、资源或动态对象时，先补 `doctor -> accounts list -> prepare/form -> upload/query`。
- `prepare`/`publish form`、`schema fields` / `schema get`、workflow、平台文档和 CLI 实际输出，是组装 payload 的唯一依据。
- `prepare` 返回的 `data.form` 是可恢复的页面式表单契约；新建复杂 payload 时优先使用 `yxer publish form start/inspect/set/choose/verify/review/export`，不要自行发明字段或路径。form 会话不能直接发布，必须先 verify 并 export 成标准 `payload.json`。
- 图片、视频、封面等资源必须先上传，且只能复用 `yxer upload` 返回的真实字段。
- `category`、`location`、`music`、`collection`、`challenge`、`goods`、`drama` 等动态字段必须先通过 `yxer query ...` 查询，不能手写对象；视频号 `drama` 只保留查询结果中的 `yixiaoerId`、`yixiaoerImageUrl`、`yixiaoerName`，不添加 `raw`。多多视频例外：`shopping_cart.goods_id` 是用户手工提供的业务商品 ID，CLI 固定补充 `source=pdd`，不得从 `yxer query goods` 的 `yixiaoerId` 映射。
- 淘宝光合 `shopping_cart` 必须先通过目标账号、相同发布类型的 `taobao-guanghe-goods-tabs` 查询可用来源，再使用显式 `--source` 执行 `yxer query taobao-guanghe-goods`；完整保留商品对象和 `raw`，每个账号最多 6 件；不得依赖省略来源时的服务端默认商品池。
- CRITICAL: `validate`、`publish --dry-run`、正式 `publish` 必须使用同一套发布通道参数。

## 页面式表单会话

当一次性编辑 `payload.json` 无法表达页面中的完整流程时，使用本地会话逐步推进：

```bash
yxer publish form start <platform> <type> --output publish-form.json
yxer publish form inspect publish-form.json
yxer publish form set publish-form.json <payload.path> --value '<json-value>'
yxer publish form choose publish-form.json <field> --value-file query-result.json --id <candidate_id> --source-command "yxer query ... --json"
yxer publish form verify publish-form.json
yxer publish form review publish-form.json
yxer publish form export publish-form.json --output payload.json
```

`set` / `choose` / `verify` / `review` 只更新或检查本地会话，不会触发发布；动态字段必须用 `choose` 从 `query` 返回候选中选择，并用 `--source-command` 记录实际执行的 `yxer query ... --json` 命令。多多视频 `shopping_cart.goods_id` 不属于动态查询字段，使用 `set` 手工填写，CLI 固定 `source=pdd`。`set` 只能写 form contract 声明过的路径；`choose` 只写 `dynamicFieldExamples` 声明的字段，且 query 账号必须匹配目标账号。资源应直接使用 `upload` 返回的完整对象。文本字段可直接传文本，复杂对象使用 JSON。导出前 `verify` / `review` / `export` 会校验来源记录和当前 payload 是否一致；导出后仍必须按同一份 payload 和同一套发布通道参数执行 `validate payload.json -> publish payload.json --dry-run -> 用户授权 -> publish payload.json`。所有写本地文件的会话命令都支持 `--dry-run`。
