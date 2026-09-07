---
name: email-engine
description: 开发、安装和使用吾码邮箱系统 mci-email。用于 QQ、163、126、企业或自定义 IMAP/SMTP 邮箱账号维护、自动与手动同步、邮件阅读、草稿、附件、回复转发、发送结果核对，以及邮箱 MCP 工具和 V8.Email 协议原子。
---

# 吾码邮箱系统

> **Codex 非阻塞自动更新：** 先遵循 [工作区约定](../workspace-conventions/SKILL.md)，通过 `microi update --background --workspace "<工作区绝对路径>" --json` 投递更新检查；当前任务继续执行，不等待更新或重启现有会话。

邮箱系统是使用吾码 UI 的独立 Vue 3 微服务，商城 AppKey 为 `mci-email`，
后台入口为「系统引擎 → 邮箱系统」，菜单路由 `/mci-email`。

先读取 `../workspace-conventions/SKILL.md`；开发或发布时还需读取
`../microi-microservice/SKILL.md`、`../app-store/SKILL.md`。
先调用 `microi_list_applications`，再读取目标应用完整上下文，禁止覆盖未读取的源码。

## 选择正确入口

| 需求 | 入口 |
| --- | --- |
| 邮箱工作台 | 源码微服务 `mci-email` |
| 账号配置 | 原表 `mic_email_server`，通过宿主 `openForm` 打开吾码表单 |
| 全部业务 HTTP | 接口引擎 `mci-email`，请求参数 `Action` |
| 手动同步 | `Action: Sync` 返回持久后台任务，使用 `SyncStatus` 回读终态 |
| 自动同步 | 定时任务调用 `mci-email-auto-sync`，内部调度 `mci-email-sync-step` |
| 协议、MIME、加密 | 最小后端原子 `V8.Email`，不新增业务 Controller |
| 租户扩展 | `mci-email-hook`，商城策略 `CreateIfMissing` |
| AI 操作 | `microi_email_query`、`microi_email_manage`、`microi_email_send` |

当前版本沿用原邮箱配置表的平台管理员权限（`Level >= 9999`），
并按当前用户检查账号和邮件所有权。不得因 AI 使用而绕过这些约束。
各运行节点需要包含 `V8.Email` 的平台版本；仅安装前端源码不能补齐 .NET 协议能力。

## 配置和同步

1. 确认用户拥有或获准使用邮箱；在服务商处开启 IMAP/SMTP，取得客户端授权码。
2. 打开账号表单，选择 QQ / 163 / 126 / 腾讯企业邮箱 / 自定义，填写地址与授权码。
3. QQ、163 常用 IMAP 993 / SMTP 465，选择 `SslOnConnect`；
   使用 SMTP 587 时选择 `StartTls`。具体端口以服务商配置为准。
4. 授权码提交后由可信后端加密。编辑留空保留旧值；列表、导出、源码、日志和截图不含原文。
5. 先检测连接，再手动同步。首次先显示最新一批邮件，再增量补齐历史并核对状态。
6. 自动同步由平台定时任务运行，不依赖浏览器开着；每个账号设置同步间隔。

目录路径作为服务商的不透明值保存，不能自行翻译或改写。
去重键必须包含账号、目录、UIDVALIDITY 和 UID；UIDVALIDITY 改变时只重建该目录缓存。
同步锁使用接口引擎分布式锁，检查点进入数据库；进程重启后继续执行。
邮件正文按需读取，默认阻止脚本、表单提交与外部图片；不能直接在宿主使用 `v-html`。

## MCP 使用

先通过 `microi_codex action=profiles` 选择用户指定租户，再按工具 Schema 调用。

```json
{"action":"Overview"}
```

以上参数用于 `microi_email_query`，不会回传授权码。
查询邮件用 `action: Messages`，可传 `accountId`、`folderKind`、`keyword`、
`pageIndex` 和 `pageSize`；只在任务需要时读取正文或附件。

维护工具先返回操作预览。用户已有明确授权后，`confirmExecution` 精确填写
`Action:目标Id`；新账号为 `SaveAccount:new`，新草稿为 `SaveDraft:账号Id`。
同步需要稳定的 `requestId`，恢复同一请求不得生成新值。

发信先通过 `microi_email_manage(action: SaveDraft)` 保存确定的收件人、正文与附件，
然后调用 `microi_email_send(draftId, confirmExecution: draftId)`。
只有用户已授权发送给这些收件人时才执行；不要把读取邮件的请求当作发送授权。

## 发送和结果边界

- 一次发送意图绑定稳定草稿 Id 和 Message-Id；同一草稿重复请求不能再次 SMTP 投递。
- `Sent` 表示 SMTP 服务器已接受；收件端可见需要实际收件验证。
- `Unknown` 表示连接中断等情况导致结果不确定，保留在发件箱，禁止自动重发。
  先按 Message-Id 检查服务商已发送目录；确需新发时由用户确认新的发送意图。
- 远端已发送副本单独保存；副本或租户 Hook 失败不得回滚已发生的 SMTP 副作用。
- 原子只解密当前租户的凭据，不能向 V8 暴露解密方法；必须校验 TLS 证书。

协议方法和参数见 [V8.Email 原子参考](references/v8-email.md)。
最终分别验证源码/构建、API 权限、连接、实际收件、附件字节、重复发送、
自动同步、宿主表单、商城包与官网真实截图。
