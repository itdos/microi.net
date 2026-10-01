# yxer CLI 命令参考

`yxer` 是本技能唯一执行入口。Agent 和用户都应直接使用它。

## 命令分组

### 环境与版本

```bash
yxer --version
yxer doctor
yxer update [--check] [--global]
```

### 本地配置

```bash
yxer config get
yxer config set-local-client-id <clientId>
```

### Skill 安装与同步

```bash
yxer skill show
yxer skill sync [--global]
```

### 账号与资源

```bash
yxer accounts list [platform] [--name 关键词] [--status 1] [--page 1] [--size 20] [--all] [--json]
yxer accounts update <account_id> [--proxy-id ID] [--kuaidaili-area CODE] [--remark 文本] [--group ID] --dry-run
yxer accounts update <account_id> [--proxy-id ID] [--kuaidaili-area CODE] [--remark 文本] [--group ID]
yxer account-group list [--page 1] [--size 10]
yxer account-group create <name> [--visible-scope all|specific] [--visible-user USER_ID]... [--dry-run]
yxer account-group update <group_id> <name> [--visible-scope all|specific] [--visible-user USER_ID]... [--dry-run]
yxer account-group delete <group_id> [--dry-run]
yxer upload --file <file_path> [--bucket cloud-publish|material-library] [--dry-run]
yxer upload --url <resource_url> [--bucket cloud-publish|material-library] [--dry-run]
```

### 发布与校验

```bash
yxer validate <platform> <type> <payload.json> [--publish-channel cloud|local] [--client-id <clientId>] [--content-file <article.md>]
yxer publish <type> <platform> <payload.json> [--publish-channel cloud|local] [--client-id <clientId>] [--content-file <article.md>] [--dry-run]
yxer publish delete preview <task_set_id>
yxer publish delete from-record <task_set_id> --index N [--dry-run]
yxer publish delete <task_id> [--dry-run]
yxer publish form start <platform> <type> [--output publish-form.json] [--dry-run]
yxer publish form account <session.json> [--id <online_account_id>|--index N] [--dry-run]
yxer publish form inspect <session.json>
yxer publish form set <session.json> <payload.path> --value '<json-value-or-text>' [--index N] [--source-command <cmd>] [--dry-run]
yxer publish form choose <session.json> <field> --value-file <query.json> [--id <candidate_id>|--index N] [--account-id <id>] --source-command "yxer query ... --json" [--dry-run]
yxer publish form verify <session.json>
yxer publish form review <session.json> [--dry-run]
yxer publish form export <session.json> [--output payload.json] [--dry-run]
```

### 草稿与素材库

```bash
yxer draft save <payload.json> [--dry-run]
yxer draft import <article.docx> --cover <horizontal-cover.jpg> --account-id <online-account-id> [--author 蚁小二] [--original-author <original-author>] [--draft-id <existing-draft-id>] [--title <title>] [--digest <digest>] [--dry-run]
yxer material create <payload.json> [--dry-run]
yxer material add --file <文件路径或URL> [--thumb <缩略图路径或URL>] [--type image|video|file] [--dry-run]
yxer material list [--name <file_name>] [--type image|video|file] [--page 1] [--size 100]
yxer material move <material_id> --group-id <group_id> [--dry-run]
yxer material move-by-name <file_name> --group-id <group_id> [--dry-run]
yxer material groups [--page 1] [--size 50]
```

### 查询类能力

```bash
yxer query categories <account_id> [--type video|article]
yxer query locations <account_id> [--query 关键词] [--type 0|1|2|3]
yxer query music <account_id> [--query 关键词]
yxer query goods <account_id> [--query 关键词]
yxer query taobao-guanghe-goods-tabs <account_id> --type video|imageText
yxer query taobao-guanghe-goods <account_id> --type video|imageText --source SOURCE [--filter-value VALUE] [--second-filter-value VALUE] [--query 关键词] [--next-page TOKEN]
yxer query goods-detail <account_id> --url <product_url>
yxer query entitlements <account_id>
yxer query collections <account_id> [--type video|article]
yxer query drama-tasks <account_id> [--query 关键词] [--keyword 关键词]
yxer query members [--page 1] [--size 10] [--status notJoined|pending|joined] [--query 关键词] [--role master|admin|member]
yxer query friends <account_id> [--red-id 小红书号] [--query 关键词]
yxer query challenges <account_id> [--query 关键词] [--type video]
yxer query records [--platform P] [--limit N] [--status S] [--json]
yxer query account-increments --start-date YYYY-MM-DD --end-date YYYY-MM-DD [--group-id GROUP_ID]
yxer prepare <platform> <type>
yxer schema fields <platform> <type>
yxer schema get <platform> <type>
```

该命令的 `data` 保留 `accounts`、`summary`、`trends`，并增加 `dmMessageStats`（私信收发统计）和 `managedAccounts`（负责人、运营人等管理详情）。

入口说明：

- 推荐分组入口：`yxer account-group {list|create|update|delete}`
- 查询类能力统一使用：`yxer query ...`
- 旧的一层查询入口（如 `yxer categories ...`、`yxer records list ...`）已移除。

## 基本约束

- 发布类型统一使用：`video`、`imageText`、`article`
- 单次 `yxer publish` 只处理一个平台
- `publish` 仅支持 `payload.json` 模式
- 新建或补字段时，先执行 `yxer prepare <platform> <type>` / `yxer publish form start` 和 `yxer schema fields <platform> <type>`；`schema fields` 默认返回扁平路径清单，只有需要完整 payload 骨架时再执行 `yxer schema get <platform> <type>`
- `payload.json` 只支持标准 `publishArgs` 结构，所有平台统一
- `article` 发布可通过 `--content-file <article.md>` 指定 Markdown 正文源；CLI 会将 Markdown 渲染为 HTML，并按 Markdown 文件目录解析本地图片
- `yxer draft import <article.docx>` 是微信公众号文章的 DOCX 导入入口：读取 Word 正文和内嵌图片，封面必须在导入前提供横版图片；默认不声明原创
- DOCX 导入会把封面上传到 `cloud-publish`，把正文内嵌图片上传到 `material-library`，并把正文 `<img src>` 改成稳定可访问 URL，避免草稿编辑器显示黑图
- DOCX 导入不会自动裁剪竖版封面；宽度必须大于高度，建议按公众号常用的 900×383 横版比例准备封面
- `--content-file` 支持 `![alt](path)`、`![[path]]`、`<img src="path">` 和远程图片 URL；正式 `publish` 会上传图片并把 `publishArgs.content` 中的引用替换为稳定可访问 URL
- CLI 会根据 `publishArgs` 自动补齐最外层 `cover`、`coverKey`、`desc`、`isDraft`、`isAppContent`
- 云发布是默认模式
- 本机发布时必须提供 `clientId`
- `yxer validate`、`yxer publish --dry-run`、`yxer publish` 使用同一套发布通道解析逻辑
- `yxer publish --dry-run` 不创建发布任务，也不会上传正文图片；它返回渲染后的正文和图片处理计划，并在有 API key 的云发布场景执行账号/代理 preflight。最终图片 URL 只有正式 `publish` 上传后才能确定。local dry-run 不检测客户端在线状态。
- 本机发布推荐通过两种方式提供 `clientId`：
  - flags：`yxer publish <type> <platform> <payload.json> --publish-channel local --client-id <clientId>`
  - 预设默认值：`yxer config set-local-client-id <clientId>` 后，再执行 `--publish-channel local`
- 第四个位置参数属于旧版兼容，不再作为 Agent 推荐入口。
- 删除已发布作品时，优先执行 `yxer publish delete preview <task_set_id>` 查看平台、账号、类型、标题、封面和状态；随后用 `yxer publish delete from-record <task_set_id> --index N --dry-run` 按作品序号确认目标，再执行真实删除。`delete <task_id>` 仅保留给已有自动化兼容使用。
- 本机发布校验时，推荐在 `validate` 阶段就显式传入 `--publish-channel local`；若未显式传入但 payload 中已写 `publishChannel=local`，CLI 也会尝试从默认配置读取 `clientId`
- `yxer draft save` 只处理蚁小二内部草稿，不等同于平台草稿箱
- `yxer material create` 只做素材登记，前提是资源已经通过 `yxer upload --bucket material-library` 上传
- `yxer material add --file ...` 会自动完成上传和素材登记
- `yxer material list --name <file_name>` 返回匹配素材及其真实 ID；可配合 `--type image` 筛选图片
- `yxer material move-by-name <file_name>` 只接受精确文件名匹配；重名时返回候选，必须改用稳定 ID 执行 `material move`
- `yxer material move` 将已登记素材移动至目标素材分组；正式移动前先执行 `--dry-run`
- `yxer material groups` 查询可用于 `material move --group-id` 的真实素材分组 ID
- 查询类操作可以直接执行
- 已有完整标准 payload 时，发布类操作遵守“validate -> publish --dry-run -> 用户授权 -> publish”顺序；缺账号、字段、资源或动态对象时，先补“查账号 -> prepare/form/schema -> 上传资源 -> 查询复杂对象 -> 填 payload”。
- 页面式逐步填写可使用 `publish form` 会话；会话只负责本地状态，正式发布路径固定为 `publish form verify -> publish form export -> validate payload.json -> publish payload.json --dry-run -> publish payload.json`
- `publish form set` 只能写 `prepare` / `schema fields` / `fieldPlacements` 声明过的路径，不能用拼写不确定的路径试错。
- `publish form choose` 只用于 `dynamicFieldExamples` 声明的动态字段，必须带 `--source-command` 记录产生候选的 `yxer query ... --json` 命令；若 query 账号和目标账号不一致会被拒绝。
- 多多视频推广商品使用 `publish form set` 手工填写 `publishArgs.accountForms[].contentPublishForm.shopping_cart.goods_id`；CLI 固定 `source=pdd`，不使用 `publish form choose` 或 `yxer query goods` 的 `yixiaoerId`。
- 视频号剧集使用 `yxer query drama-tasks` 查询，并通过 `publish form choose ... drama` 写入；剧集对象只保留 `yixiaoerId`、`yixiaoerImageUrl`、`yixiaoerName`，不使用 `raw`。合集仍使用 `collections` / `collection`，继续保留完整 `raw`。
- `publish form verify`、`review`、`export` 会校验会话来源记录和当前 payload 是否一致；如果候选值被手工改写，需要重新执行 `set` 或 `choose`。
- 所有请求字段都必须来自 schema、平台文档或 CLI 返回结果；严禁虚构字段、乱猜枚举、手写 `raw` 对象或编造资源元数据

## 快速示例

### 环境检查

```bash
yxer doctor
yxer config get
```

### 查询账号

```bash
yxer accounts list 抖音 --json
yxer accounts list 小红书 --status 1
```

### 上传资源

```bash
yxer upload --file .\cover.jpg --dry-run
yxer upload --file .\video.mp4
yxer upload --url https://example.com/demo.jpg
```

## 推荐发布流程

### 标准 payload 结构

```json
{
  "action": "publish",
  "publishType": "imageText",
  "platforms": ["小红书"],
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

约束：

- 顶层必须有 `publishArgs`
- 账号列表必须放在 `publishArgs.accountForms[]`
- 平台业务字段通常放在 `publishArgs.accountForms[].contentPublishForm`；图文图片放在 `accountForms[].images`，微信公众号图文的字段和平台级默认表单以专属文档为准
- 不再支持顶层 `accountForms`
- 不再支持直接提交内层业务表单 JSON

### 获取表单字段与 schema

```bash
yxer prepare 小红书 imageText
yxer schema fields 小红书 imageText
yxer schema get 小红书 imageText
```

### 校验与预览发布

```bash
yxer validate 小红书 imageText .\payload.json
yxer publish imageText 小红书 .\payload.json --dry-run
```

Markdown 文章正文：

```bash
yxer validate 知乎 article .\payload.json --content-file .\文章.md
yxer publish article 知乎 .\payload.json --content-file .\文章.md --dry-run
yxer publish article 知乎 .\payload.json --content-file .\文章.md
```

### 本机发布校验

```bash
yxer validate 抖音 video .\payload.json --publish-channel local --client-id <clientId>
yxer publish video 抖音 .\payload.json --publish-channel local --client-id <clientId> --dry-run
```

### 正式发布

```bash
yxer publish imageText 小红书 .\payload.json
```

### 本机发布

```bash
yxer publish video 抖音 .\payload.json --publish-channel local --client-id <clientId>
```

## 常见工作流入口

- 共享规则：`../yixiaoer-shared.md`
- 通用规则：`../workflows/common-rules.md`
- 图文发布：`../workflows/publish-imageText.md`
- 视频发布：`../workflows/publish-video.md`
- 文章发布：`../workflows/publish-article.md`

## 发布通道约定

- 用户未指定“本机发布 / 本地发布 / 客户端发布”时，Agent 应默认使用云发布。
- 用户明确要求本机发布，或说明要走本机客户端/本机网络时，Agent 必须显式传 `--publish-channel local`，不要只在说明文字里表达。
- 若云发布返回“账号代理不存在”等代理相关错误，可建议切换到本机发布。
- CLI 默认只返回本机发布 `nextCommand`，不会自动切换通道；`--auto-fallback-local` 属于用户明确授权后的高级选项，不作为 Agent 默认路径。
- 若本机发布返回“客户端不在线”或“获取在线设备列表失败”，可建议用户启动蚁小二客户端，或改回云发布。

## 输出约定

- stdout 始终输出 JSON 数据
- stderr 只输出诊断、警告、提示和结构化错误
- 成功输出格式：`ok/action/version/data`
- 失败输出格式：`ok/version/error`
- 错误通过统一错误 envelope 输出
- `yxer doctor` 可能返回 `_notice.skills`，提示当前 AI skill 与 CLI 版本不同步，并建议优先执行 `yxer update`
- `yxer update` 是当前推荐的统一入口：会检查 CLI 安装方式、在 npm 安装场景下升级 CLI，并同步 AI skill

## 入口约束

- 仓库已移除旧 Node 入口，不再提供脚本兼容通道
- 未完成 CLI 化的能力只保留文档提示，不代表存在其他可执行入口
