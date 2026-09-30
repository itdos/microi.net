# 淘宝光合视频发布

平台 canonical key 为 `taobaoguanghe`，发布请求统一使用中文平台名 `淘宝光合`。支持云发布和本机发布。

```bash
yxer accounts list 淘宝光合 --status 1 --json
yxer prepare 淘宝光合 video
yxer schema fields 淘宝光合 video
yxer query taobao-guanghe-goods-tabs <account_id> --type video --json
yxer query taobao-guanghe-goods <account_id> --type video --source <source> --json
yxer validate 淘宝光合 video payload.json --publish-channel cloud
yxer publish video 淘宝光合 payload.json --publish-channel cloud --dry-run
yxer publish video 淘宝光合 payload.json --publish-channel cloud

# 本机发布（需客户端已启动并登录，且提供 clientId）
yxer validate 淘宝光合 video payload.json --publish-channel local --client-id <clientId>
yxer publish video 淘宝光合 payload.json --publish-channel local --client-id <clientId> --dry-run
yxer publish video 淘宝光合 payload.json --publish-channel local --client-id <clientId>
```

- `video`、`cover` 和 `coverKey` 放在账号表单层，`coverKey` 必须等于 `cover.key`。
- `short_title` 最多 30 字，`desc` 最多 1000 字。
- 商品查询必须先读取当前账号 `goods-tabs`，再显式传入其中返回的 `source`；不得省略 `--source` 或依赖默认商品池。根据用户意图选择来源，不全局禁止 `coreitem`。
- `shopping_cart` 可为空；非空时只能使用该账号 `--type video` 商品查询返回的完整对象，最多 6 件，不得裁剪 `raw`。
- 页面式表单选择多件商品时使用 `publish form choose ... shopping_cart --ids <id1>,<id2>`，必须明确列出每个商品 ID。
- 立即发布不传 `scheduledTime`；定时发布使用 13 位毫秒时间戳。
