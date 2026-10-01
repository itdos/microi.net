# AI 执行协议

> 适用范围：任何通过 `yxer` CLI 查询、组装 payload、保存草稿、登记素材或发布内容的 Agent 任务。

本文档定义 AI Agent 的稳定执行协议。业务 workflow 负责说明做什么，本协议负责说明每一步做到什么状态才允许继续。

## 最高优先级规则

- 所有真实操作只能通过 `yxer` CLI 执行。
- 不得凭记忆、示例 JSON 或用户自然语言直接拼动态字段、账号、资源 key、枚举或平台私有结构。
- 任何正式写操作前，必须先完成对应 domain/workflow 读取、真实数据查询、候选确认、`validate` 和 `dry-run`。
- 用户只要求查看、修 payload、预览、dry-run 或排查时，禁止执行正式写操作。
- 用户中途改变目标平台、账号、发布通道、资源或发布时间时，必须回退到受影响的状态重新确认。

## 发布状态机

| State | 进入条件 | 下一步允许动作 | 禁止动作 |
| --- | --- | --- | --- |
| `intent_detected` | 已识别用户意图和业务域 | 读取 domain/workflow | 执行写操作 |
| `workflow_loaded` | 已读取业务域和必要 workflow | `yxer doctor` | 拼 payload、publish |
| `env_checked` | `yxer doctor` 成功或问题已解释 | 查询账号、判断发布通道 | publish |
| `account_selected` | 已从真实账号列表选中有效账号 | `prepare`、`schema fields` | 使用未确认账号发布 |
| `contract_loaded` | 已获取 `prepare` 和 `schema fields`，必要时已获取 `schema get` | upload、query、组装 payload | 写 schema 未声明字段 |
| `sources_collected` | 资源、动态字段、用户业务内容都已确认来源 | 组装或修订 payload | 编造动态对象 |
| `payload_ready` | payload 无占位符，字段来源清晰 | `yxer validate` | publish |
| `validated` | `yxer validate` 成功 | `yxer publish --dry-run` | 正式 publish |
| `dry_run_passed` | dry-run 成功，且通道参数与 validate 一致；云发布有 API key 时已完成账号/代理 preflight | 等待用户授权正式发布 | 未授权 publish |
| `published` | 正式 publish 成功 | 返回结果、记录后续排查方式 | 重复 publish |

## 状态回退规则

| 变化或错误 | 回退到 |
| --- | --- |
| 用户更换平台或发布类型 | `workflow_loaded` |
| 用户更换账号 | `account_selected` 之前，重新 `accounts list` |
| 用户更换发布通道或 `clientId` | `env_checked`，重新 validate/dry-run |
| 用户更换资源文件或 URL | `contract_loaded`，重新 upload |
| 动态字段候选不唯一或为空 | `contract_loaded`，重新 query 或等待用户确认 |
| 修改 payload 任意字段 | `payload_ready`，重新 validate/dry-run |
| validate 失败 | `contract_loaded` 或 `sources_collected`，只修报错字段 |
| dry-run 失败 | `payload_ready`，按错误恢复协议修复后重新 validate |

## 写操作门禁

执行正式 `yxer publish`、`yxer draft save`、素材登记、账号配置更新等写操作前，Agent 必须确认：

- 已读取 `SKILL.md` 和当前业务 domain。
- 已读取当前任务所需 workflow。
- 当前数据来自 `yxer` CLI、用户明确输入或平台文档，不来自猜测。
- 多候选关键数据已按确认协议由用户选择。
- payload 或写入参数不含 `<placeholder>`、示例值或未解析模板。
- 对发布任务，`validate` 和 `dry-run` 已通过，且正式发布使用同一份 payload 与同一套发布通道参数。

## 命令执行纪律

- 优先使用带 `--json` 的命令，便于稳定解析；命令不支持时再解析普通输出。
- 每次 CLI 返回候选列表后，先提取稳定 ID、名称、状态和平台，不要只看显示文本。
- CLI stdout 外层 `data` 是结果容器，不等于发布字段结构；写入 payload 前必须按 schema 或 workflow 重新装配。
- 命令失败时先读取错误信息和 hint/nextCommand，再决定是否重试；不要无差别重复执行正式写命令。

## 面向用户说明

- 自动选择唯一候选时，应说明选择依据。
- 需要用户选择时，按确认协议展示候选，不要让用户从原始 JSON 中猜。
- 正式发布前，必须明确说明已通过 dry-run，并等待用户授权，除非用户最初已经明确授权“校验通过后直接发布”。
