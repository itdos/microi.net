# 账号选择工作流

> 适用范围：任何需要确定 `platform`、`platformAccountId` 或确认账号状态的任务，包括发布、草稿、素材、排查。

## 何时读取

- 用户只说“帮我发”但没给账号
- 用户给了平台，但没给账号名或账号 ID
- 用户给了多个候选账号，需要 Agent 选一个
- 用户要排查“为什么这个账号发不出去”

## 标准步骤

1. 先确定任务平台；平台不明确时，不进入 payload 阶段。
2. 执行 `yxer accounts list [platform] [--name 关键词] [--json]`。
3. 优先筛出 `status=1` 的账号。
4. 结合用户给的账号名、昵称关键词或已有 `platformAccountId` 定位目标账号。
5. 将选中的 `platformAccountId` 填入 `publishArgs.accountForms[].platformAccountId`。

## 选择规则

- 只有一个 `status=1` 的候选账号：自动选中，并明确告知用户。
- 有多个 `status=1` 候选账号：列出差异，让用户选择，不要擅自猜测。
- 没有 `status=1` 账号：停止后续执行，提示用户检查账号登录状态、Cookie 或客户端在线状态。
- 用户直接给了 `platformAccountId`：仍建议执行 `accounts list` 做存在性确认。

## 推荐命令

```bash
yxer accounts list 抖音 --json
yxer accounts list 小红书 --name 关键词 --status 1 --json
```

## 严禁行为

- 未确认账号有效就填写 `platformAccountId`
- 多个候选账号时默认取第一个
- 把账号昵称直接当成 `platformAccountId`
