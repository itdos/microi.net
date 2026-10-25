# 参与 Microi吾码

欢迎提交问题复现、文档修正、回归测试和代码改进。先从一个范围明确、能够验证的改动开始；平台介绍与规划见 [README](README.md)，模块位置见[源码架构](microi.doc/docs/doc/getting-started/source-code-architecture.md)。

## 选择合适的入口

| 事项 | 入口与所需资料 |
|---|---|
| 功能故障 | 在 [Gitee Issues](https://gitee.com/ITdos/microi.net/issues) 或 [GitHub Issues](https://github.com/itdos/microi.net/issues) 提交最小复现；同一问题尽量只建一个主 Issue，另一处附链接 |
| 功能建议 | 说明使用者、业务问题、现有做法、预期行为和验收条件；实现前先对齐较大范围的设计 |
| 文档修正 | 给出页面地址、错误段落、对应版本与依据，在已有页面原位修改 |
| 安全漏洞或含敏感材料的问题 | 按下方安全报告方式私下联系，不在公共 Issue 上传材料 |
| 实施、培训或商务需求 | 使用[官方联系入口与服务商名录](https://microi.net/contact/index.html#service-providers)，确认具体服务范围和交付约定 |

服务商名录用于发现公开联系入口，不代表统一资质、响应时限或某个项目已经验收。

在 [Gitee 新建 Issue](https://gitee.com/ITdos/microi.net/issues/new) 或 [GitHub 选择模板](https://github.com/itdos/microi.net/issues/new/choose)时，使用[故障报告](.github/ISSUE_TEMPLATE/bug_report.md)或[功能建议](.github/ISSUE_TEMPLATE/feature_request.md)填写版本、复现材料或验收条件。两站共用默认分支的 `.github/ISSUE_TEMPLATE/`；[Gitee 官方模板说明](https://help.gitee.com/issue/templates)确认支持该目录。若页面没有自动带入模板，可复制对应模板正文后填写，公开前先完成脱敏。

## 提交可复现的问题

请提供以下信息；不适用的项注明原因，不需要上传完整客户工程或数据库：

1. API、前端、CLI/插件及相关应用包的版本；源码问题另附提交号。
2. 操作系统、浏览器、部署方式，以及与问题相关的数据库或存储版本。
3. 从初始状态开始的最短复现步骤、预期结果与实际结果。
4. 已脱敏的错误文本、请求路径、发生时间及日志关联标识；必要时提供最小示例数据。
5. 是否稳定复现、影响范围、最近是否升级，以及已经尝试的处理方式。

不要公开 Token、Cookie、访问密钥、密码、连接串、签名下载地址、客户身份或业务数据。截图和附件也要检查地址栏、请求头及背景内容。对外共享最小材料前，确认你有权公开。

## 私下报告安全问题

通过[官方联系页](https://microi.net/contact/index.html)中的技术联系人发送简要问题描述，并确认后续受限材料的接收方式。首次沟通可提供受影响版本、漏洞类型和影响范围；不要在公共 Issue、PR、日志或录屏中发布尚未协调披露的利用细节和真实凭据。

测试仅在自己拥有或已获授权的环境中进行。与维护者确认复现、修复和公开说明的安排；本页不设漏洞奖励或响应时限承诺。平台现有边界见[安全与兼容基线](microi.doc/docs/doc/more/security.md)。

## 开始修改

1. 阅读工作区 [AGENTS.md](AGENTS.md) 和 [workspace-conventions](microi.skills/workspace-conventions/SKILL.md)，再按修改范围读取相关 Skill。
2. 先搜索已有实现、Issue、文档和测试。普通业务优先使用低代码配置与 V8；平台通用缺陷才进入对应框架模块。
3. 使用自己有权访问的源码与开发环境。共享工作区保留他人的未提交改动，不执行整树清理或覆盖。
4. 限定改动范围，解释非显然的设计意图；功能行为变化同时维护对应中文文档与必要回归。

日常官网正文维护 `microi.doc/docs/doc/` 中文单源，英文由站点翻译流程生成。应用或客户私有规则留在其独立工程，不混入平台公共实现。

## 按改动选择验证入口

先按对应项目的 README 和锁文件安装依赖。以下命令从仓库根运行，按改动选择；浏览器、数据库和第三方服务验收使用已授权的隔离环境。

| 改动 | 已有入口 |
|---|---|
| 平台后端离线回归 | PowerShell：`./Microi.Server/Microi.Tests/run-tests.ps1 -Mode Quick`；范围见 [Microi.Tests](Microi.Server/Microi.Tests/README.md) |
| 前端 HTTP 工具示例 | `npm --prefix Microi.Client run test:v8-http`；其它模块选择 [package.json](Microi.Client/package.json) 中对应脚本 |
| MCP 工具 | `npm --prefix microi.mcp run typecheck`，再执行 `npm --prefix microi.mcp test` |
| 官网文档 | `npm --prefix microi.doc run check:content`，最终执行 `npm --prefix microi.doc run docs:build` |
| 公开生态、适配与案例证据工具 | 运行 [公开证据 CI](.github/workflows/public-evidence.yml) 中的 Node 离线回归；无密钥、无数据库、无付费模型调用 |
| 独立应用、移动端 | 使用该工程自身测试；移动端另见[协作指南](microi.uniapp/CONTRIBUTING.md) |

公共仓和完整源码环境的测试范围可能不同。缺少私有源码或外部依赖时记录具体未覆盖项，不删除断言或将跳过记为通过。界面行为还要验证实际浏览器、桌面/移动及明暗主题；数据操作检查权限、异常和写后回读。

公开维护活动可使用[生态采集工具与已保存快照](microi.benchmarks/ecosystem/README.md)复核；工具匿名读取两站公开 API，区分完整、截断和不可用数据，不公开邮箱，也不把维护者或未知作者计为第三方贡献者。适配与安全证据使用[依赖及回执核验工具](microi.benchmarks/compatibility/README.md)，分别记录源码版本、历史测试和真实环境验收。欢迎贡献缺失的最小复现和已脱敏证据；stars、forks、提交数和一次测试通过都不能替代用户验收或认证。

## 贡献与交付的完成记录

PR 说明应写清问题触发条件、修改后的行为、影响范围、实际运行的命令和结果。缺陷修复提供能够复现旧行为的回归；文案或低风险调整使用相应链接、内容和渲染检查。

实施验收可沿用以下记录，逐项附可复核的证据：

| 阶段 | 记录内容 |
|---|---|
| 需求 | 使用者、功能范围、权限、数据口径及明确的验收条件 |
| 源码与配置 | 提交号、应用包版本、配置差异及依赖；排除凭据 |
| 测试 | 通过与失败的用例、环境、未覆盖范围和复现命令 |
| 发布与安装 | 产物版本/摘要、发布回执、目标安装状态及回读结果 |
| 运行验收 | 真实角色、关键业务流程、数据结果与界面检查 |

源码测试通过、产物上传、目标安装和业务验收分别记录。没有执行的阶段明确标注未执行，不能用其中一项替代其余阶段。

## 许可与公开仓边界

公开仓代码按 [LICENSE](LICENSE) 使用；独立闭源组件、商业授权、第三方依赖和客户资料遵循各自许可，不因为参与贡献而改变授权。

提交前检查 [.public-repo-protected-paths](.public-repo-protected-paths) 和暂存差异：受保护源码及 gitlink 不进入公开仓；保留 Git hooks，不使用强制暂存或绕过检查。截图、视频、PDF、安装包等资源按工作区 CDN 规则处理，源码只保留必要链接和清单。

提交内容应是你有权贡献的成果，并说明引用来源及适用许可。使用 AI 辅助仍需人工核对行为、来源和测试结果；不要把密钥、客户资料或未获授权的代码提交给模型或仓库。
