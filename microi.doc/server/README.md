# 官网快照与公网 IP 接口源码

这里维护本次业务接口的可版本控制事实源，`Microi-V8-Engine` 中同名文件仅为 MCP 远端回读镜像。接口通过已有 V8 能力实现，不修改平台 C#。

| 资源 | MCP 目标 | 交付源 |
| --- | --- | --- |
| `official_nuget_stats` | `microi_itdos_api_itdos_com` / `iTdos` | `api-engines/official-nuget-stats.js` |
| `officialNugetStatsRefresh` | 同上 | `jobs/official-nuget-stats.json` |
| `get-client-ip` | `microi_xjy` / `xjy` | `api-engines/get-client-ip.js` |
| `dns_sync_ip` 的上游读取段 | `microi_itdos_api_itdos_com` / `iTdos` | `api-engines/dns-sync-ip-upstream.patch` |

NuGet 定时任务按北京时间每天 00、03、06、09、12、15、18、21 点执行。官网只调用 `Action: Snapshot` 读取数据库最新成功快照；普通访问者的旧版 `Refresh` 请求也降为只读。刷新失败时保留上一份成功快照并返回任务失败；官网显示采集时间。已有累计下载量高水位策略继续保留，官方索引短时回退不会降低既有累计值。

`get-client-ip` 返回 HTTP 调用者的公网 IPv4，不接受参数中的 IP。当前部署通过真实请求验证的两个直接代理为 `172.16.0.115`、`172.30.9.234`；仅这些精确来源使用代理追加的 X-Forwarded-For 最右项。其它来源只使用连接地址。代理地址或追加规则变化后须重新核验；未知私网代理与非法链路失败关闭。

DNS 完整脚本保留原租户私有凭据和目标，因此公开仓只保存无密钥补丁。补丁替换旧上游为 `https://api.jifulii.com/apiengine/get-client-ip`，校验 HTTP 状态、业务返回和公网 IPv4。`CheckIpOnly: true` 在任何 DNS、缓存或日志清理操作前返回，可用于生产节点只读出口验证。部署时只在已授权的目标 MCP 上读取原脚本并应用该前缀补丁，保留未修改的私有尾段；不得用公开夹具重建完整生产脚本。

回归入口为 `npm run test:nuget`、`npm run test:dns-upstream`，两者均纳入官网 `check:content`。纯脚本测试证明分支及副作用边界；实际部署还须回读完整引擎源码、Quartz 计划与执行日志、数据库快照、公开 HTTP 响应及官网构建产物。
