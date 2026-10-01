# 发布与 Payload

适用范围：用户要发布视频、图文、文章，或要修订发布 payload、解释字段归属、确认发布通道。

**CRITICAL - 只要用户意图落在本域，MUST 先读取下方 workflow，再决定是否执行任何 `prepare`、字段查询、`validate` 或 `publish`。**
**BLOCKING REQUIREMENT - 未使用同一份 `payload.json` 和同一套发布通道参数完成 `validate`、`publish --dry-run` 前，绝对禁止正式 `publish`。缺账号、字段、资源或动态对象时，必须先完成 `doctor`、账号确认、`prepare/form`、`schema fields`、上传和查询。**
**AI EXECUTION PROTOCOL - 发布域任务必须先按协议状态机推进，不允许越过 `validated` / `dry_run_passed` 状态直接发布。**

## 读取顺序

1. [`../protocols/execution.md`](../protocols/execution.md)
2. [`../protocols/confirmation.md`](../protocols/confirmation.md)
3. [`../protocols/provenance.md`](../protocols/provenance.md)
4. [`../protocols/error-recovery.md`](../protocols/error-recovery.md)
5. [`../workflows/common-rules.md`](../workflows/common-rules.md)
6. [`../workflows/data-accuracy.md`](../workflows/data-accuracy.md)
7. [`../workflows/account-selection.md`](../workflows/account-selection.md)
8. [`../workflows/local-vs-cloud.md`](../workflows/local-vs-cloud.md)
9. [`../workflows/payload-sourcing.md`](../workflows/payload-sourcing.md)
10. 按类型继续读取：
   - 图文：[`../workflows/publish-imageText.md`](../workflows/publish-imageText.md)
   - 视频：[`../workflows/publish-video.md`](../workflows/publish-video.md)
   - 文章：[`../workflows/publish-article.md`](../workflows/publish-article.md)

## 意图路由

- 用户只说“帮我发一下”“发个抖音/小红书”“发视频/图文/文章”时，直接进入本域，并继续按类型读取 workflow。
- 用户明确说“先别发，只生成 payload”“帮我修 payload”时，仍进入本域，但最终动作只停留在 payload 修订或 `validate` / `publish --dry-run`。
- 用户明确说“查为什么发失败了”“解释报错”时，先切 [`./troubleshooting.md`](./troubleshooting.md)，不要直接重试正式发布。
- 用户明确说“上传素材后马上发”时，先完成素材流程，再回切本域继续执行发布主流程。

## 平台差异入口

- 总索引：[`../platforms/index.md`](../platforms/index.md)
- 视频平台：[`../platforms/video/index.md`](../platforms/video/index.md)
- 图文平台：[`../platforms/imageText/index.md`](../platforms/imageText/index.md)
- 文章平台：[`../platforms/article/index.md`](../platforms/article/index.md)

只有在 `prepare` / `schema get` 之后，且当前 workflow 无法回答平台差异时，才继续读取具体平台文档。

## 强制门禁

- 未进入协议状态机的 `workflow_loaded` 状态不执行 CLI 写操作
- 已有完整 payload 时，可直接进入 `validate -> publish --dry-run`；但不得跳过正式发布前用户授权
- 缺账号、字段、资源或动态对象时，未执行 `yxer doctor` 不进入组装流程
- 缺账号或账号不确定时，未确认 `accounts list` 中账号 `status=1` 不继续
- 需要组装或补字段时，未执行 `prepare` / `publish form` / `schema fields` 不组装 payload；只有需要 payload 骨架时再补 `schema get`
- 未按 `data-accuracy.md` 完成需要查询的动态字段和多候选确认，不继续写 payload 或发布；多多视频 `shopping_cart.goods_id` 按平台规则使用用户明确输入
- 未先 `validate` 与 `publish --dry-run` 不执行正式 `publish`

## 常用命令

```bash
yxer accounts list [platform] [--name 关键词] [--status 1] [--json]
yxer prepare <platform> <type>
yxer schema get <platform> <type>
yxer upload --file <file_path>
yxer upload --url <resource_url>
yxer query categories <account_id> [--type video|article]
yxer query locations <account_id> [--query 关键词] [--next-page TOKEN]
yxer query music <account_id> [--query 关键词] [--category-id ID] [--category-name 名称] [--next-page TOKEN]
yxer query music-categories <account_id>
yxer query goods <account_id> [--query 关键词] [--next-page TOKEN]
yxer query collections <account_id> [--type video|article]
yxer query drama-tasks <account_id> [--query 关键词]
yxer query miniapps <account_id> [--query 关键词]
yxer query syncapps <account_id>
yxer query games <account_id> [--query 关键词]
yxer query hot-events <account_id> [--type video|article]
yxer query groups <account_id>
yxer query friends <account_id> [--red-id 小红书号] [--query 关键词]
yxer query activities <account_id> [--type video|article] [--category-id ID] [--query 关键词]
yxer query challenges <account_id> [--query 关键词] [--type video] [--next-page TOKEN]
yxer validate <platform> <type> <payload.json> [--publish-channel cloud|local] [--client-id <clientId>]
yxer publish <type> <platform> <payload.json> [--publish-channel cloud|local] [--client-id <clientId>] --dry-run
yxer publish <type> <platform> <payload.json> [--publish-channel cloud|local] [--client-id <clientId>]
```

## 决策提示

- 用户只说“帮我发”时，默认云发布；明确说“本机发布”“客户端发布”时切到本机通道。
- 用户要“只生成 payload”时，仍要先走 `prepare` / `schema get` 和字段查询纪律。
- 用户要填分类、位置、音乐、合集、话题、商品时，先查询，再回填完整对象；多多视频的 `shopping_cart.goods_id` 由用户手工提供，固定 `source=pdd`，不使用商品查询返回的 `yixiaoerId`；视频号剧集使用 `yxer query drama-tasks`，只写入查询结果的 `yixiaoerId`、`yixiaoerImageUrl`、`yixiaoerName`，不添加 `raw`。
- 用户要挂载小程序或选择同步发布应用时，先执行 `yxer query miniapps` / `yxer query syncapps`，再把 CLI 返回对象完整回填到 payload。
- 用户要挂载游戏、绑定热点或选择群聊时，先执行 `yxer query games` / `yxer query hot-events` / `yxer query groups`，再把 CLI 返回对象完整回填到 payload。
- 用户要在小红书描述中艾特用户（包括陌生人）时，先执行 `yxer query friends <account_id> --red-id <小红书号> --json`，将选中的完整对象 JSON 序列化后写入 `<friend raw='...'>@用户名</friend>`；不要新增未被 schema 声明的 `friends` 字段。
- 用户要按音乐分类找配乐或参加平台活动时，先执行 `yxer query music-categories` / `yxer query activities`，再把 CLI 返回对象完整回填到 payload。
