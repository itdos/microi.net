# 官网快照与公网 IP 接口源码

这里维护本次业务接口的可版本控制事实源，`Microi-V8-Engine` 中同名文件仅为 MCP 远端回读镜像。接口通过已有 V8 能力实现，不修改平台 C#。

| 资源 | MCP 目标 | 交付源 |
| --- | --- | --- |
| `official_nuget_stats` | `microi_itdos_api_itdos_com` / `iTdos` | `api-engines/official-nuget-stats.js` |
| `officialNugetStatsRefresh` | 同上 | `jobs/official-nuget-stats.json` |
| `get-client-ip` | `microi_xjy` / `xjy` | `api-engines/get-client-ip.js` |
| `dns_sync_ip` 的上游读取段 | `microi_itdos_api_itdos_com` / `iTdos` | `api-engines/dns-sync-ip-upstream.patch` |

NuGet 定时任务按北京时间每天 00、03、06、09、12、15、18、21 点执行。官网只调用 `Action: Snapshot` 读取数据库最新成功快照；普通访问者的旧版 `Refresh` 请求也降为只读。官网显示采集时间，采集成功不保证 NuGet 内部各统计层同时更新。

从 `v1.0.7` 开始，权威汇总采用固定官方 Owner 页面 `https://www.nuget.org/profiles/ITdos` 的侧栏 `Packages` 和 `Total downloads of packages`，覆盖该 owner 全部包，与访问官方主页的汇总口径一致。脚本验证 HTTP 状态、HTML 长度、canonical URL、owner 标题和完整侧栏结构；不取页面首个数字、不仅统计首 20 个包，也不把不同统计时刻的分页包卡片求和代替侧栏总计。HTML 结构变化或统计校验失败时返回任务失败，保留原数据库快照，不以 Search 旧数冒充一次新的 Gallery 采集。

`Source=nuget-official-gallery` 表示成功采集官方侧栏；已有累计高水位策略继续保留，官方侧栏回退时标记 `nuget-official-gallery-high-water`，并在刷新结果 `observedTotalDownloads` 中保留本次侧栏原值。`SuccessfulEndpoints=1` 表示本次 Gallery 来源确认成功。两个 Search API 节点仅作交叉诊断，其结果通过刷新响应的 `searchSuccessfulEndpoints`、`searchTotalDownloads`、`searchLagDetected` 保留在任务日志；它们不能覆盖 Gallery 主值，全部失败也不撤销已经验证的 Gallery 结果。诊断字段不新增数据库列，普通 `Snapshot` 仍只读取持久化快照，不发起任何外部请求。

`get-client-ip` 返回 HTTP 调用者的公网 IPv4，不接受参数中的 IP。当前部署通过真实请求验证的两个直接代理为 `172.16.0.115`、`172.30.9.234`；仅这些精确来源使用代理追加的 X-Forwarded-For 最右项。其它来源只使用连接地址。代理地址或追加规则变化后须重新核验；未知私网代理与非法链路失败关闭。

DNS 完整脚本保留原租户私有凭据和目标，因此公开仓只保存无密钥补丁。补丁替换旧上游为 `https://api.jifulii.com/apiengine/get-client-ip`，校验 HTTP 状态、业务返回和公网 IPv4。`CheckIpOnly: true` 在任何 DNS、缓存或日志清理操作前返回，可用于生产节点只读出口验证。部署时只在已授权的目标 MCP 上读取原脚本并应用该前缀补丁，保留未修改的私有尾段；不得用公开夹具重建完整生产脚本。

`net.itdos.net` 每次同步都先读回既有阿里云 A 记录并验证记录身份，只有云端值已经等于指定上游 IP 时才免写；永久 Redis 缓存不能作为跳过云端查询的依据。发现漂移后，必须更新返回数字 `Code=1` 且同一记录再次云回读值一致才算成功；成功缓存 TTL 为 60 秒，仅作记账。其它 14 个目标的同步逻辑、凭据和记录标识保持原样。

`VerifyEgress: true`（兼容字符串 `"1"`）只在管理员同时指定 `CheckIpOnly` 时生效：从实际生产节点调用两个固定独立 IPv4 来源 `4.ipw.cn`、`ipv4.icanhazip.com`（各 10 秒上限），与指定上游结果对照，并通过监控快照读取当前节点身份。该显式诊断分支不写 DNS 或 Redis；某个独立来源超时应保留为诊断结果，不能冒充多个来源均验证成功。

回归入口为 `npm run test:nuget`、`npm run test:dns-upstream`，两者均纳入官网 `check:content`。纯脚本测试证明分支及副作用边界；实际部署还须回读完整引擎源码、Quartz 计划与执行日志、数据库快照、公开 HTTP 响应及官网构建产物。
