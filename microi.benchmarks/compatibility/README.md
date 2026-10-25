# 适配与安全证据核验

该工具盘点公开源码中的 .NET 目标框架、平台版本和数据库驱动声明，并可核对已有 TRX 的整体 SHA-256、逐项结果、计数与选定测试组。它不运行 API、不读连接串、不连接数据库、不启动 Docker，也不会执行真实 SQL Server 或客户业务专项。仅需 Node.js 20 或更新版本。

```sh
node --max-old-space-size=256 --test --test-concurrency=1 microi.benchmarks/compatibility/inspect.test.mjs
node --max-old-space-size=256 microi.benchmarks/compatibility/inspect.mjs
```

有权读取原始回执时，可以核验摘要并生成新的脱敏报告。原始 TRX 可能含主机名、路径和测试参数，不应直接公开：

```sh
node microi.benchmarks/compatibility/inspect.mjs --trx /path/to/microi-platform.trx --expected-sha256 f77bc63acaa0b557208d2182f6164114f39f5a9dbd984a70758a5d5b152aa905 --tested-platform-version 8.6.8 --source-commit f1e12ec023579501261a0106c2e629d669156fcd --out compatibility-new-snapshot.json
```

`--tested-platform-version` 和 `--source-commit` 必须来自原归档来源记录；工具会明确标为来源声明，不会用 TRX 哈希冒充版本签名。失败/跳过仍保留为未通过；摘要、计数和重复执行 Id 不一致时拒绝复用。输出文件不能覆盖。退出码 `0` 表示盘点/回执格式核验完成；`2` 表示存在缺失的驱动声明或回执含未通过用例；其它非零为输入/摘要/文件错误。此退出码不是兼容认证结果。

## 已核对的证据

[2026-10-25 脱敏快照](snapshot-2026-10-25.json)记录当时工作树的 `8.6.9` 源码依赖，API 目标框架 `net10.0`、Dos.ORM `netstandard2.1`。完整文件摘要保留在快照中，工作树可能包含未提交修改，版本号本身不表示已发布或运行验收。

| 证据 | 已核对结果 | 不能推出的结论 |
|---|---|---|
| 本次盘点工具环境 | Windows `10.0.26200` / x64 / Node `v20.20.1` | 不等于平台在所有操作系统通过 |
| 历史平台回执 | 来源声明为 `8.6.8`，2026-10-25 05:00:12 +08:00 完成，5524 项通过、0 失败、0 未通过；SHA-256 与归档摘要一致 | 不能证明 `8.6.9`、客户部署、压力上限或第三方认证 |
| 历史数据库契约组选取 | 5 个测试类，共 78 项通过 | 是驱动类型、注册、配置、只读 SQL 与管理规则等契约，不是六种真实数据库全矩阵验收 |
| 历史安全契约组选取 | 5 个测试类，共 287 项通过 | 不是独立渗透测试，不证明全量安全或零漏洞 |
| 数据库实库 / CPU / OS 组合 | 本次没有相应版本绑定回执 | 统一 `not-verified-by-this-inspection`，不能从驱动存在推导通过 |
| 国产化适配或第三方安全认证 | 未提供可核验证书 | 统一 `not-provided`，不宣称已获认证 |

测试类与逐组数量在 JSON 中公开。原始回执只有持有者可以独立核对，因此历史摘要属于维护方提供的可追踪测试证据，不是第三方背书。源测试入口见 [Microi.Tests](../../Microi.Server/Microi.Tests/README.md)，数据库规则见[扩展数据库](../../microi.doc/docs/doc/system-engine/databases.md)，安全边界见[安全基线](../../microi.doc/docs/doc/more/security.md)。

后续真实适配记录至少包含平台提交/版本、数据库完整版本、驱动、CPU、OS、部署方式、TLS、字符集、账号权限、连接/参数化读写/事务/结构变更/备份恢复的实际结果，以及脱敏回执摘要。使用已授权的既有环境；明确未执行项，不为了补表创建新容器或写业务数据。
