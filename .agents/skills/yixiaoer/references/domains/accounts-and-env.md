# 账号、环境与 Skill 同步

适用范围：用户要检查环境、初始化配置、查询账号、查看 skill 安装状态。

**CRITICAL - 用户只要说“先看看环境/账号/同步状态”，就先停在本域，不要提前进入发布、草稿或素材主流程。**

## 优先读取

1. [`../protocols/execution.md`](../protocols/execution.md)
2. [`../protocols/confirmation.md`](../protocols/confirmation.md)
3. [`../protocols/error-recovery.md`](../protocols/error-recovery.md)
4. [`../yixiaoer-shared.md`](../yixiaoer-shared.md)
5. [`../workflows/account-selection.md`](../workflows/account-selection.md)

## 常用命令

```bash
yxer doctor
yxer config get
yxer config init --api-key <apiKey>
yxer config set-local-client-id <clientId>
yxer accounts list [platform] [--name 关键词] [--status 1] [--page 1] [--size 20] [--all] [--json]
yxer query members [--page 1] [--size 10] [--status notJoined|pending|joined] [--query 关键词] [--role master|admin|member]
yxer query account-overviews --platform P [--name 关键词] [--group 分组] [--login-status 1] [--member-id ID] [--page 1] [--size 10]
yxer query content-overviews [--platform P] [--account-id ID] [--publish-user-id ID] [--type video|article|miniVideo|dynamic] [--title 关键词] [--publish-start-time 毫秒] [--publish-end-time 毫秒]
yxer query account-increments --start-date YYYY-MM-DD --end-date YYYY-MM-DD [--group-id GROUP_ID]
yxer query proxies [--size 9999]
yxer query proxy-areas
yxer accounts update <account_id> [--proxy-id ID] [--kuaidaili-area CODE] [--remark 文本] [--group ID] --dry-run
yxer skill show
yxer skill sync [--global]
```

增量查询的 `data` 还包含 `dmMessageStats` 私信收发趋势和 `managedAccounts` 管理账号详情，字段保持蚁小二接口原样。

## 规则

- 首次使用、环境不明、或失败排查后，先 `yxer doctor`
- `doctor` 失败时先修环境，不继续业务流程
- 涉及本机发布前的 `clientId` 判断时，先查询现有配置和账号列表
- `yxer accounts list` 默认查第 `1` 页、每页 `20` 条；传 `--page`、`--size` 可控制单页范围，传 `--all` 时才继续翻页
- `yxer accounts update` 是写操作，正式执行前必须先用同一参数执行 `--dry-run`
- 涉及账号分组的 `visibleUsers`、指定成员可见、按成员挑选负责人时，先执行 `yxer query members` 获取真实成员 ID
- 命中多个账号时，结构化列出候选并让用户确认；只有一个可用账号时可自动选中并说明
- 查询或更新账号配置时，按执行协议记录当前状态；任何写操作失败后按错误恢复协议处理，不直接重复执行
- 用户明确说“先不要发布，只查环境/账号”时，完成本域后直接停下，不擅自继续发布流程
