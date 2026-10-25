# Microi 公开证据与复测工具

这里保存可复核的方法、固定测试任务和脱敏快照。每项证据分别说明采集日期、版本、范围及缺失信息；测试通过、代码发布、实际部署与客户验收是不同阶段。

| 目录 | 用途 | 证据边界 |
|---|---|---|
| [案例登记](case-evidence/README.md) | 官方 SaaS 最小投影的聚合统计与隐私检查 | 登记、去重名称、付费客户、独立客户和成功交付不能互换 |
| [开源生态](ecosystem/README.md) | 公开仓库活动、去重与分页完整性 | Star、提交账号、未知作者和实际独立贡献者分别统计 |
| [适配与安全](compatibility/README.md) | 源码驱动声明、版本、历史测试回执摘要校验 | 不是全部实际数据库矩阵、第三方认证或零漏洞证明 |
| [AI 结构化任务](ai-quality/README.md) | 固定三任务、两种上下文的受控模型试验 | 合成任务的结构正确性不等于完整系统交付效率 |
| [公开发现与通知](discovery/README.md) | 官网公开页面的主动 URL 通知回执 | 接收通知、密钥验证、抓取、收录和实际搜索命中分别记录 |

## 运行离线测试

需要 Node.js 20.20 或更新版本，无需业务数据库、供应商密钥或新建容器：

```sh
node --test --test-concurrency=1 microi.benchmarks/case-evidence/summarize-saas-registry.test.mjs microi.benchmarks/ecosystem/collect.test.mjs microi.benchmarks/compatibility/inspect.test.mjs microi.benchmarks/ai-quality/run.test.mjs
```

公共 CI 只运行合成数据与本地源码检查。实时生态采集只有匿名 GET；真实 AI 试验需要单独确认授权、额度和模型能力，不在 CI 自动执行。没有返回供应商 usage 时保留未知，不能用字符或传输字节量代替 Token。

## 提交复测结果

固定工具版本、任务集合、环境与时间窗口，记录失败、分页不足、缺失用量等限制。公开报告只包含必要统计与摘要，不上传用户账号、客户名称、邮箱、连接信息、密钥、原始业务数据或私有源码。涉及真实第三方账号与客户材料时，先确认发布权限。

改进方法和复现问题请按 [贡献指南](../CONTRIBUTING.md) 提交。官网的[能力证据](https://microi.net/doc/#capability-evidence)、[案例入口](https://microi.net/case/case-index.html)与[安全边界](https://microi.net/doc/more/security.html)提供对应产品说明。
