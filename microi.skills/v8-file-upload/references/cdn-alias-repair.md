# 已提交应用的 CDN 特殊字符别名修复

## 已提交应用的 CDN 特殊字符别名修复（强制）

- 区分逻辑路径、对象键和 URL：原始 `@` 对象的 URL 可写 `%40`；字面量 `%40` 对象的 URL 需写 `%2540`。禁止在 HDFS 全局反解码对象键，禁止迁移或覆盖协议 v3 不可变编码对象、完整性标记及清单摘要。
- 此类修复使用现有受管接口引擎 `ai_app_cdn_backfill` 的 `Action=RepairCommittedCdnAliases`，不是任意文件复制接口。当前租户超级管理员仍须满足 `Level >= 9999`，精确匹配 `AppId/ConfirmAppId`；只补充已提交公有运行资产的原始 `@` 别名，不接收文件体、桶、URL 或自定义来源/目标路径。
- 先回读商城及完整版本记录，显式冻结 `ExpectedAppKey/ExpectedVersionId/ExpectedVersionNo`、`ExpectedRequestId/ExpectedRequestFingerprint/ExpectedRuntimeManifestHash`、`ExpectedCommittedPublishVersionId/ExpectedCommittedRuntimeManifestHash`、`ExpectedCurrentVersion/ExpectedPublishFence/ExpectedPublishRowVersion`。后三个数值使用规范十进制字符串。服务端须同时核对活动指针、协议、版本归属、版本 `FencingToken`、派生 `ReleasePrefix` 及完整清单；不得用调用方传入的清单替代权威记录。
- 商城与版本状态只接受 `ProjectionPending/RepairRequired/Completed`。完整运行清单按平台 ordinal 路径顺序，以 `Path<TAB>Sha256<TAB>Size`、行间 LF、末尾无 LF、UTF-8 重算 SHA-256；后续每次回读还须保持冻结清单字符串不变。指针、活动版本、栅栏、行版本或清单变化即停止，先核对部分副作用，再重新取得契约，不能盲目替换预期值续跑。
- 仅接受 `assets/<bundle>/import/<两位十六进制>/<文件名>@<子资源>.json` 的非入口、公有运行 JSON，每个不超过 1 MiB；拒绝源码、私有资源、百分号转义、绝对路径、目录穿越和不支持的 `@` 路径。来源为同版本目录中把原始 `@` 替换成字面量 `%40` 的既有对象；目标为版本目录及固定目录的原始 `@` 对象。全部使用当前租户内对象路径和 `Limit:false`，不能用 HTTPS 来源 URL 代替。
- `DryRun` 默认 `true`，显式 `false` 才复制。`AliasStart` 是冻结清单内符合条件的原始 `@` JSON 列表的零基游标，`AliasCount` 只允许 1–5；每资产最多复制版本和固定两个别名，一批最多 10 次复制。写入前预检整批来源和已有目标：`Sha256` 是原始物理字节摘要，与 `Size` 一同绑定清单；`WireSha256` 是字节转为 Base64 文本后的历史兼容摘要，只校验格式及来源、目标一致，禁止将它与清单原始摘要作相等判断。目标同字节跳过，任一不同即整批拒绝。每次复制前后重新核对摘要及最新绑定。
- `V8.Method.CopyObject` 没有原子的 create-if-absent/禁止覆盖保证，此动作必须如实返回 `AtomicCreateOnly:false`。预检查存在检查与复制之间的竞态，不能与另一发布者或任意写入者竞争同一固定路径；原后台投影可继续写同一冻结版本的相同字节。不得把“先查不存在再复制”描述为原子 create-only。
- 每批先 DryRun，再用同一绑定复制，保存 `Attempted/Copied/RequiresReadback/NextAliasStart`，从版本与固定 CDN 独立核对实际字节后再续批。超时、未知结果或 `Code=0` 先回读已尝试路径，不能盲重试；数据库事务无法回滚 OSS 副作用。禁止删除旧对象、重新上传字节、HTTP 回退或直接修改数据库状态。
- 修复不刷新 CDN、不推进指针、不修改清单或发布状态。原后台必须继续完成刷新、公开回读与 `Completed` 状态收敛；不能以对象复制成功代替公网资源及真实浏览器验收。操作说明见 [分布式存储](https://microi.net/doc/more/hdfs.html)。
