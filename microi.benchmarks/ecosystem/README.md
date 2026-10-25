# 公开仓库生态指标

本工具匿名、只读采集 [Gitee](https://gitee.com/ITdos/microi.net) 和 [GitHub](https://github.com/itdos/microi.net) 的公开 REST API。无需 Token，不发 Issue、不发 PR、不访问私有仓，不使用本地 Git 作者数据冒充公开证据。只依赖 Node.js 20 或更新版本。

## 运行

在仓库根目录执行：

```sh
node --max-old-space-size=256 --test --test-concurrency=1 microi.benchmarks/ecosystem/collect.test.mjs
node --max-old-space-size=256 microi.benchmarks/ecosystem/collect.mjs
```

默认统计采集开始前 90 天。指定窗口和输出文件：

```sh
node microi.benchmarks/ecosystem/collect.mjs --since 2026-07-27T14:03:10.000Z --until 2026-10-25T14:03:10.000Z --max-pages 5 --out ecosystem-new-snapshot.json
```

`--out` 不覆盖已有文件。工具串行 GET，每页最多 100 条、每个数据集默认最多 10 页，可用 `--max-pages 1..30` 调整。请求有 20 秒超时和 8 MiB 响应上限。不重试限流、不绕过权限，也不接受任意目标服务器。退出码 `0` 表示公开数据分页完整；`2` 表示报告已生成但至少一项截断或不可用；其它非零表示参数或文件等执行失败。CI 只执行合成数据回归，不联网刷新指标。

## 统计口径

- 时间窗为 UTC 的 `[since, until)`。提交按 committer 时间筛选，固定默认分支的 head 后分页；仅统计可达提交，包含合并提交，不统计代码行数或开发工时。
- 同站提交和跨站汇总都按完整 SHA 去重。两站历史不同的内容等价提交不能据此合并，因此不能把去重提交数解释为独立功能数量。
- 同一托管站按服务端账号 Id 去重；只计算已映射的非机器人账号。`Bot` 类型或 `[bot]` 后缀单列，其他自动化身份可能无法识别。未映射作者保留为未知，不使用邮箱、姓名或展示名推测身份。结果不输出身份列表、邮箱、邮箱哈希或原始 JSON。
- 不跨站猜测同一个人，不把维护者、员工、自动化提交误称为第三方开发者。`crossHostUniquePeople` 和 `thirdPartyContributorCount` 保持 `null`；stars、forks 也不是活跃贡献者数。
- Issue 排除 GitHub API 混入的 PR。`observedRecordsInWindow` 是更新时间落入窗口的记录数；其中的账号数是这些记录的**原作者账号数**，不代表作者在窗口内活跃。创建、关闭、合并分别按各自时间字段计数；不是关闭率，也不计算缺少完整评论证据的响应时间。
- `complete` 只指该公开 API 在当前窗口的分页完成，不包括私有反馈、微信社群、服务商、商业客户或已删除记录。达到页数上限为 `partial`，观察数量只作下限；失败为 `unavailable`/`null`，不能写成零。两站不是原子快照，采集期间 Issue/PR 状态可能变化。
- 报告保存窗口、公开来源 URL、默认分支 head、页面 HTTP 状态与响应整体 SHA-256，便于复采。公开 API 可能改变头像/计数等字段，因此相同窗口再次请求的响应摘要不保证不变；摘要用于核对当次输入，不是认证签名。

接口说明：[GitHub commits](https://docs.github.com/en/rest/commits/commits)、[GitHub issues](https://docs.github.com/en/rest/issues/issues)、[GitHub pulls](https://docs.github.com/en/rest/pulls/pulls)、[Gitee REST API](https://gitee.com/api/v5/swagger)。

## 已保存观察

[2026-10-25 公开快照](snapshot-2026-10-25.json)，窗口为 2026-07-27 14:03:10 UTC 至 2026-10-25 14:03:10 UTC，每个数据集最多 5 页。

| 指标 | Gitee | GitHub |
|---|---:|---:|
| 采集时 stars / forks | 509 / 199 | 21 / 9 |
| 已观察默认分支提交 | 至少 500，分页截断 | 至少 500，分页截断 |
| 已观察提交映射的非机器人账号 | 至少 3 | 至少 3 |
| 其中未映射作者的提交 | 419 | 196 |
| 窗口内创建 / 关闭 Issue | 0 / 0 | 0 / 0 |
| 窗口内创建 / 合并 PR | 3 / 3 | 0 / 0 |
| 采集时仓库最近推送 UTC | 2026-10-25 13:36:23 | 2026-10-19 01:28:14 |

提交数据不是完整 90 天总量。已观察跨站唯一 SHA 为 1000，仍是下限；跨站唯一人数、外部作者人数和维护者响应时间未知。Gitee 的 3 个 PR 对应 1 个已映射原作者账号，其组织关系未经核实。这里的零仅表示这两个公开 API 在窗口内没有相应记录，不表示平台没有用户反馈或伙伴。

贡献入口见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。欢迎补充可复现问题、最小测试与文档修正；公开材料先排除客户信息和凭据。
