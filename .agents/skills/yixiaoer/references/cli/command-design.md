# yxer 命令树设计标准

本文定义 `yxer` CLI 的命令树设计标准、输出约束，以及当前架构缺陷和后续优化方向。

## 目标

- 保持命令语义稳定，便于人类和 AI agent 共同使用。
- 保持 `stdout` JSON 输出稳定，避免命令名、action 名和返回结构长期漂移。
- 让“资源类能力”和“工作流类能力”在命令树上有明确边界。

## 顶层命令分层

当前建议把命令分为 4 类：

1. 系统类命令
- `doctor`
- `config`
- `skill`
- `update`

2. 资源类命令
- `accounts`
- `account-group`
- `material`
- `draft`

3. 工作流类命令
- `prepare`
- `validate`
- `publish`
- `upload`

4. 查询类命令
- `query`

## 命令树标准

### 1. 资源类能力优先使用资源命令

资源自身的 CRUD 能力优先设计成：

```bash
yxer <resource> list
yxer <resource> create ...
yxer <resource> update ...
yxer <resource> delete ...
```

例如：

```bash
yxer account-group list
yxer account-group create <name> --dry-run
yxer account-group update <group_id> <name> --dry-run
yxer account-group delete <group_id> --dry-run
```

规则：

- 资源名统一使用单数，如 `account-group`
- 子命令统一使用 `list/create/update/delete`
- `list` 可提供 `ls` alias；其余写操作默认不提供别名

### 2. `query` 只保留“跨资源查询”或“发布前置查询”

`query` 不是资源 CRUD 的兜底入口，而是保留给：

- 发布前置对象查询，如 `locations`、`music`、`groups`
- 视频号发布前剧集查询，如 `drama-tasks`
- 远端聚合视图查询，如 `records`、`details`
- 非标准资源树、但仍然明确只读的接口

规则：

- `query` 下只放只读能力
- 新增资源型查询时，优先判断是否应该归入某个资源命令，而不是默认塞进 `query`

### 3. 写操作必须支持 `--dry-run`

所有会产生副作用的命令应优先支持：

```bash
yxer <command> ... --dry-run
```

规则：

- `--dry-run` 返回实际请求预览，不执行远端写操作
- dry-run 输出中的字段必须来自 CLI 真实会发送的请求体，不允许编造
- 若命令没有可预览的 body，也应至少返回关键路径参数，如 `groupId`

### 4. action 命名要和命令树一致

成功 envelope 里的 `action` 字段统一按命令树命名：

- 读操作：`resource.list`
- 写操作：`resource.create` / `resource.update` / `resource.delete`
- dry-run：追加 `.dry-run`

例如：

- `account-group.list`
- `account-group.create`
- `account-group.create.dry-run`

不要继续混用这两类风格：

- `create-account-group`
- `account-group.create`

应统一保留后一种。

### 5. 命令命名统一使用 kebab-case

规则：

- 多单词资源名统一 kebab-case，如 `account-group`
- 多单词 flag 统一 kebab-case，如 `--publish-start-time`
- 路径参数占位名统一 `<group_id>`、`<account_id>` 这种 snake_case 风格

### 6. 帮助文案不再强调“兼容入口”

既然标准入口已经明确，后续帮助文案应直接描述职责，不再长期保留：

- “兼容入口”
- “推荐使用 xxx”

这些文案只适合迁移期，不适合作为长期帮助文本。

## 实现标准

### 1. 每个资源/领域一个命令文件

建议保持：

- `cmd/account_groups.go`
- `cmd/accounts.go`
- `cmd/material.go`
- `cmd/query.go`

不要让单个文件无限膨胀。

### 2. 优先使用 `newXxxCmd()` 构造函数

建议统一使用构造函数返回 `*cobra.Command`，而不是长期混用：

- `var xxxCmd = &cobra.Command{}`
- `func newXxxCmd() *cobra.Command`

构造函数模式更适合：

- 测试隔离
- 子命令复用
- 避免全局命令对象互相污染

### 3. 共享逻辑下沉到独立 helper

例如：

- body 构造：`buildAccountGroupBody`
- 读操作包装：`runQuery`

后续还可以继续抽象：

- `runWrite`
- `runDryRun`
- `requireNonEmptyID`

避免每个写命令都重复拼相同的 dry-run 和 runtime 加载逻辑。

## 当前架构缺陷

### 1. `cmd/query.go` 过大，职责过重

当前 `cmd/query.go` 同时承担：

- 查询命令注册
- 兼容根命令注册
- `update-account` 写操作
- `prepare` 工作流入口

问题：

- 文件过长，维护成本高
- `query` 与非 `query` 能力耦合
- 写操作 `update-account` 放在 `query.go` 里，职责不清晰

建议：

- 把 `update-account` 拆到 `cmd/accounts.go` 或新建 `cmd/account_update.go`
- 把 `prepare` 拆到单独文件
- `query.go` 只保留 query 域相关内容

### 2. 命令注册方式不统一

目前同时存在两种风格：

- 包级变量命令对象
- `newXxxCmd()` 工厂函数

问题：

- 测试时容易共享全局状态
- dry-run flag 等变量容易互相污染
- 不利于后续做命令树生成或重构

建议：

- 新代码统一走 `newXxxCmd()`
- 旧命令逐步迁移

### 3. 全局 flag 状态过多

当前很多命令使用包级变量存 flag 值，例如 `cmd/query.go` 中的大量全局变量。

问题：

- 测试需要手动清理状态
- 多命令复用时容易串值
- 命令实例不是完全自包含

建议：

- 优先把 flag 绑定到局部变量或 option struct
- 复杂命令引入 `Options` 结构，执行前从 `cmd.Flags()` 读取

### 4. action 命名历史包袱较重

当前仓库里既有：

- `records.list`
- `update-account`
- `publish.dry-run`

问题：

- 同一类动作命名风格不统一
- agent 侧很难基于 action 做稳定分类

建议：

- 逐步统一为 `resource.verb`
- 工作流类命令统一为 `workflow.verb` 或保持单命令名，但要明确约定

### 5. 文档存在重复源

当前命令文档分散在：

- `README.md`
- `README.md`
- `skills/yixiaoer/references/cli/command-reference.md`

问题：

- 容易改一处漏两处
- 标准变更时容易产生冲突文案

建议：

- 选一个主文档源
- 其余文档尽量引用或做自动同步
- 至少建立“命令变更时必须同步哪些文档”的 checklist

### 6. 测试覆盖偏重“命令存在”，缺少“命令树一致性”抽象

当前测试大量手动枚举命令名。

问题：

- 增删命令时测试改动分散
- 无法快速看出命令树整体是否符合标准

建议：

- 增加一类“命令树快照测试”或“结构断言 helper”
- 例如统一断言某个资源必须具备 `list/create/update/delete`

## 推荐优化顺序

### 第一阶段

- 固化资源类命令标准：`resource {list|create|update|delete}`
- 新增命令一律不再添加兼容入口
- 新增写命令一律支持 `--dry-run`

### 第二阶段

- 拆分 `cmd/query.go`
- 把包级 flag 变量逐步迁移到局部 options
- 统一 action 命名规范

### 第三阶段

- 建立命令树测试 helper
- 收敛命令文档单一来源
- 评估是否把 query 域拆成更细的资源树

## 当前建议

后续新增能力时，优先按下面顺序判断：

1. 这是系统命令、资源命令、工作流命令，还是只读查询命令？
2. 如果是资源能力，能否直接挂到已有资源树下？
3. 如果是写操作，`--dry-run` 输出应该长什么样？
4. 成功 envelope 的 `action` 是否和命令路径一致？
5. 文档是否同步到了命令参考和 skill 参考？
