# 公开页面发现与通知

这里保存 Microi 官网主动 URL 通知的脱敏回执，供外部读者核对实际提交范围。通知工具位于 [`microi.doc/scripts/indexnow.mjs`](../../microi.doc/scripts/indexnow.mjs)，七项离线测试覆盖配置权限、URL 范围、线上校验和回执语义；公共 CI 不发通知。

## 2026-10-26 首次通知

[`indexnow-2026-10-26.json`](indexnow-2026-10-26.json) 记录了一次实际 POST：10 个公开规范 URL、零重试，线上校验文件已核对。服务返回 HTTP 202，状态为 `ReceivedKeyValidationPending`，表示已收到并等待密钥验证。`indexingConfirmed` 为 `false`；不将它解释成已抓取、已收录、搜索排名提升或外部评价已更新。

提交前读取实际线上 sitemap 并校验页面范围，排除了账号工具页、撤回页、站外链接和带参数地址。回执不包含站点密钥、校验文件位置、私有路径、用户或客户信息。校验文件按协议由官网提供，不进入本文或 sitemap。

接收后的抓取和收录由参与的搜索引擎决定。参见 [IndexNow 文档](https://www.indexnow.org/documentation) 与 [常见问题](https://www.indexnow.org/faq)。本回执不代表其它站长平台的所有权验证或提交；未知结果不盲目重发。

## 后续变更只通知相关页面

### 供检索与引用的正文入口

[机器可读清单](https://microi.net/ai-docs/index.json)提供逐页正文地址、规范 HTML 地址、
标题、语言、字节数与 SHA-256。纯文本从实际发布的 SSR 正文提取，保留表格、代码与
可访问链接，排除全站导航、脚本与注释，不另写一套供 AI 使用的产品事实。
例如[安全说明正文](https://microi.net/ai-docs/doc/more/security.txt)对应官网同一页面。

`llms.txt` 与 HTML 的 `rel=alternate` 均指向这些替代格式。搜索索引仍以规范 HTML 为准；
正文目录允许抓取，使用 `noindex, follow` 避免重复收录，sitemap 不重复列出文本。
`dateModified` 只在有真实页面修订来源时出现；省略表示未知，不能用构建时间补填。
内容哈希仅用于一致性核对，不等于事实经过独立认证，也不保证模型采用或搜索排名改变。

发布时检查清单所有入口、正文哈希、内部链接及账户/撤回页面排除规则。
搜索效果另用固定查询、日期和返回结果观察；通知已接收、页面可抓取与已收录分别记录。

后续实际部署了新内容时，可用 `--paths-file` 指向公开规范路径组成的 JSON 数组，例如
`["/doc/v8-engine/mcp-server.html","/doc/more/security.html"]`，再执行：

```sh
node microi.doc/scripts/indexnow.mjs submit --paths-file /已有目录/changed-paths.json --out /已有目录/新的回执.json
```

输入限 1–100 个站内路径、16 KiB，不接受站外地址、账号工具页、参数、片段或路径归一化歧义；
实际 POST 前仍验证线上校验文件与 sitemap。省略该参数兼容原固定批次；不因旧 202 状态重发旧批。

## 2026-10-26 源码与安全文档更新

本批先完成两地域镜像发布，再独立核对公网构建来源与 7 个正文/索引/清单文件的实际字节，
见[公网回读](website-2026-10-26-phase2.json)。当前来源为 `6322d1a075c008c5fe4f3364759d3df4d67fa796`，
不是把镜像上传直接当作线上生效。MCP 声明预检和依赖安全新正文已能匿名读取，规范索引与 sitemap 包含两页。

[本批通知](indexnow-2026-10-26-phase2.json)仅包含这两个实际变更的规范页面，
一次 POST、零重试，服务返回 HTTP 200 / `Received`。`indexingConfirmed=false` 仍保留，
表示通知已收到，不证明已抓取、收录或改变任何外部评分；没有重发旧 10 页批次来替代验证。
