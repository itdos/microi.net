# 视频发布工作流

> 适用范围：抖音视频、快手视频、B 站视频、视频号视频、微博视频等。
> 阅读本文档前，请先阅读 [common-rules.md](./common-rules.md)。

---

## 推荐入口

仅支持 `payload.json` 模式。发布前先获取表单字段和 schema：

```bash
yxer prepare <platform> video
yxer schema fields <platform> video
yxer schema get <platform> video
```

开始前，先补读：

- [`account-selection.md`](./account-selection.md)
- [`local-vs-cloud.md`](./local-vs-cloud.md)
- [`payload-sourcing.md`](./payload-sourcing.md)
- 涉及话题/标签时：[`../topic-tags.md`](../topic-tags.md)

视频号视频有额外的账号门禁：必须先执行 `yxer publish form account <session.json> --id <online_account_id>` 从 `status=1` 账号中完成用户选择，再填写视频、封面和平台资料。未完成账号选择时，CLI 会拒绝继续写入表单。

## 执行顺序

1. 查询账号：`yxer accounts list [platform] [--status 1] [--json]`
2. 获取前置数据：`yxer prepare <platform> video`
3. 先获取字段视图：`yxer schema fields <platform> video`；需要 payload 骨架时再执行 `yxer schema get <platform> video`
4. 上传视频：`yxer upload <视频路径或URL>`
5. 上传封面：`yxer upload <封面路径或URL>`；视频号封面必须使用 `yxer upload <封面路径或URL> --platform 视频号 --usage cover`，超 512KB 时由 CLI 内部压缩
6. 按需查询分类、位置、音乐、合集、剧集、话题、商品；视频号剧集使用 `yxer query drama-tasks <account_id> [--query 关键词] --json`
7. 根据前置数据、schema 和字段来源纪律填写 `payload.json`
8. 查阅对应平台文档：`../platforms/video/`
9. 执行校验：`yxer validate <platform> video <payload.json>`
10. 正式发布：`yxer publish video <platform> <payload.json>`

## 关键规则

- 发布前必须确认目标账号 `status=1`
- 视频只能有一个，封面必须单独上传
- 用户未提供封面时，必须补问，不要自动截帧
- 百家号视频的主/横版封面使用账号级 `cover` + `coverKey`（必填且 `coverKey` 必须等于 `cover.key`）；竖版封面使用可选的 `contentPublishForm.verticalCover`，也可放在共享的 `publishArgs.verticalCover`。客户端内部会生成 `covers[0]` / `verticalCovers[0]`，未提供竖版时以主封面兜底；不要给百家号传 `horizontalCover`
- 可选复杂对象必须通过查询命令取得完整对象后再填入；多多视频 `shopping_cart.goods_id` 由用户输入，不使用商品查询对象，`source` 固定为 `pdd`
- 多多视频声明使用 `contentPublishForm.declaration`，允许值为 `0/1/3/5/7/8`；`0` 表示无需声明且不转换为 `statement`，非 `0` 由服务端转换为 `statement.type`，不要手写旧的 `statement` 对象
- 百家号视频声明使用 `contentPublishForm.statement` 对象；`type` 是主声明，当前值为 `0`（不声明）、`1`（内容由AI生成）、`16`（内容为转载）、`4`（含虚构演绎内容）、`8`（内容含有营销信息）、`32`（个人观点，仅供参考）；`subType` 是补充声明，值为 `0`（不选择）、`1`（内容可能引人不适）、`2`（内容含有高危险行为）、`4`（请理性适度消费）、`8`（未成年人请在监护人指导下浏览）。`statement` 可省略；不要使用旧的顶层 `declaration`，也不要传 `isAigc`
- 视频号 `drama` 必须通过当前账号的 `drama-tasks` 查询并使用 `publish form choose` 选择；对象只保留 `yixiaoerId`、`yixiaoerImageUrl`、`yixiaoerName`，不要求 `raw`。`collection` 仍按合集规则使用完整 `raw`。
- 话题/标签必须直接按 `../topic-tags.md` 的目标格式传入；不要依赖 CLI 从 `description` 自动改写
- 视频号原创声明必须按平台文档映射：用户说“勾选原创”“声明原创”或“开启原创”时，在 `publishArgs.accountForms[].contentPublishForm` 写 `createType: 1`；未提及或明确关闭/转载时写 `createType: 2`。不要把 `pubType` 当作原创开关
- 发布前先看 `prepare` 和 `schema fields` 返回的字段；只有要确认完整骨架时再看 `schema get`
- `payload.json` 必须使用统一标准结构：顶层 `publishArgs`，业务字段放在 `publishArgs.accountForms[].contentPublishForm`
- 用户明确要求本机发布时，必须显式传 `--publish-channel local` 和 `--client-id`

## 发布示例

```bash
yxer validate 抖音 video .\payload.json
yxer publish video 抖音 .\payload.json
```

## 本机发布示例

```bash
yxer publish video 抖音 .\payload.json --publish-channel local --client-id <clientId>
```

## 平台文档入口

- 索引：`../platforms/video/index.md`
- 平台细节：`../platforms/video/*.md`
