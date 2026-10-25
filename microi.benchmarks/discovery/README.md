# 公开页面发现与通知

这里保存 Microi 官网主动 URL 通知的脱敏回执，供外部读者核对实际提交范围。通知工具位于 [`microi.doc/scripts/indexnow.mjs`](../../microi.doc/scripts/indexnow.mjs)，五项离线测试覆盖配置权限、URL 范围、线上校验和回执语义；公共 CI 不发通知。

## 2026-10-26 首次通知

[`indexnow-2026-10-26.json`](indexnow-2026-10-26.json) 记录了一次实际 POST：10 个公开规范 URL、零重试，线上校验文件已核对。服务返回 HTTP 202，状态为 `ReceivedKeyValidationPending`，表示已收到并等待密钥验证。`indexingConfirmed` 为 `false`；不将它解释成已抓取、已收录、搜索排名提升或外部评价已更新。

提交前读取实际线上 sitemap 并校验页面范围，排除了账号工具页、撤回页、站外链接和带参数地址。回执不包含站点密钥、校验文件位置、私有路径、用户或客户信息。校验文件按协议由官网提供，不进入本文或 sitemap。

接收后的抓取和收录由参与的搜索引擎决定。参见 [IndexNow 文档](https://www.indexnow.org/documentation) 与 [常见问题](https://www.indexnow.org/faq)。本回执不代表其它站长平台的所有权验证或提交；未知结果不盲目重发。

## 后续变更只通知相关页面

后续实际部署了新内容时，可用 `--paths-file` 指向公开规范路径组成的 JSON 数组，例如
`["/doc/v8-engine/mcp-server.html","/doc/more/security.html"]`，再执行：

```sh
node microi.doc/scripts/indexnow.mjs submit --paths-file /已有目录/changed-paths.json --out /已有目录/新的回执.json
```

输入限 1–100 个站内路径、16 KiB，不接受站外地址、账号工具页、参数、片段或路径归一化歧义；
实际 POST 前仍验证线上校验文件与 sitemap。省略该参数兼容原固定批次；不因旧 202 状态重发旧批。
