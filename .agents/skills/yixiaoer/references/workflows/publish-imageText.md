# 图文发布工作流

> 适用范围：抖音图文、小红书笔记、知乎想法、快手图文、微博图文、微信视频号图文、微信公众号图文等。
> 阅读本文档前，请先阅读 [common-rules.md](./common-rules.md)。

---

## 推荐入口

仅支持 `payload.json` 模式。发布前先获取表单字段和 schema：

```bash
yxer prepare <platform> imageText
yxer schema fields <platform> imageText
yxer schema get <platform> imageText
```

开始前，先补读：

- [`account-selection.md`](./account-selection.md)
- [`local-vs-cloud.md`](./local-vs-cloud.md)
- [`payload-sourcing.md`](./payload-sourcing.md)
- 涉及话题/标签时：[`../topic-tags.md`](../topic-tags.md)

## 执行顺序

1. 查询账号：`yxer accounts list [platform] [--status 1] [--json]`
2. 获取前置数据：`yxer prepare <platform> imageText`
3. 先获取字段视图：`yxer schema fields <platform> imageText`；需要 payload 骨架时再执行 `yxer schema get <platform> imageText`
4. 逐张上传图片：`yxer upload <文件路径或URL>`
5. 按需查询分类、位置、音乐、合集、话题、商品
6. 根据前置数据、schema 和字段来源纪律填写 `payload.json`
7. 查阅对应平台文档：`../platforms/imageText/`
8. 执行校验：`yxer validate <platform> imageText <payload.json>`
9. 先执行发布 dry-run：`yxer publish imageText <platform> <payload.json> --dry-run`
10. 确认请求体后再执行正式发布：`yxer publish imageText <platform> <payload.json>`

## 关键规则

- 发布前必须确认目标账号 `status=1`
- 每张图片都要单独上传，封面默认取第一张图
- 复杂对象必须通过查询命令获取完整对象，不要手写 `raw`
- 话题/标签必须直接按 `../topic-tags.md` 的目标格式传入；需要 `<topic>` HTML 时由 Agent 直接写最终内容
- 发布前先看 `prepare` 和 `schema fields` 返回的字段；只有要确认完整骨架时再看 `schema get`
- `payload.json` 必须使用统一标准结构：顶层 `publishArgs`，业务字段放在 `publishArgs.accountForms[].contentPublishForm`
- 多平台发布时，必须逐个平台分别执行完整流程
- 用户明确要求本机发布时，必须显式切换到 `local`

## 发布示例

```bash
yxer validate 小红书 imageText .\payload.json
yxer publish imageText 小红书 .\payload.json
```

## 本机发布示例

```bash
yxer publish imageText 抖音 .\payload.json --publish-channel local --client-id <clientId>
```

## 平台文档入口

- 索引：`../platforms/imageText/index.md`
- 平台细节：`../platforms/imageText/*.md`

微信公众号图文的专属字段和默认值见 [`../platforms/imageText/weixingongzhonghao.md`](../platforms/imageText/weixingongzhonghao.md)。微信公众号文章仍走 `publish article` 的独立工作流。
