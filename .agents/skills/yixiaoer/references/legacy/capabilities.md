# 未 CLI 化能力索引

本页用于标记当前 `yxer` CLI 尚未覆盖、或仅部分覆盖的能力。它不是兼容入口说明，也不代表仓库内存在其他可执行主流程。

## 使用规则

1. 如果能力已经有正式 `yxer` 命令，优先直接调用现有命令。
2. 如果能力只有“部分覆盖”，优先使用现有命令完成已支持部分，剩余字段仅把对应文档当参考。
3. 如果能力仍“未覆盖”，应优先补成新的 `yxer` 子命令，而不是寻找旧脚本或新增脚本入口。

## 能力状态表

| 能力 | 当前状态 | 推荐/现有命令 | 参考文档 |
| --- | --- | --- | --- |
| 蚁小二内部草稿保存 | 已覆盖 | `yxer draft save <payload.json>` | `skills/yixiaoer/references/save-draft.md` |
| 平台草稿发布 | 部分覆盖 | `yxer publish <type> <platform> <payload.json>` | `skills/yixiaoer/references/save-draft.md` |
| 素材库登记 | 已覆盖 | `yxer material create <payload.json>` | `skills/yixiaoer/references/material-resource.md` |
| 素材上传并登记一体化 | 已覆盖 | `yxer material add --file <文件路径或URL>` | `skills/yixiaoer/references/material-resource.md` |
| 账号数据概览 | 已覆盖 | `yxer query account-overviews --platform P [--name 关键词] [--group 分组] [--login-status 1] [--member-id ID]` | `skills/yixiaoer/references/get-account-overviews.md` |
| 账号增量数据 | 已覆盖 | `yxer query account-increments --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | `skills/yixiaoer/references/get-account-increments.md` |
| 成员列表 | 已覆盖 | `yxer query members [--page 1] [--size 10] [--status joined] [--query 关键词] [--role master|admin|member]` | `skills/yixiaoer/references/get-members.md` |
| 作品数据概览 | 已覆盖 | `yxer query content-overviews [--platform P] [--account-id ID] [--type video|article|miniVideo|dynamic]` | `skills/yixiaoer/references/get-content-overviews.md` |
| 征文活动 | 已覆盖 | `yxer query activities <account_id> [--type video|article] [--category-id ID] [--query 关键词]` | `skills/yixiaoer/references/get-publish-activities.md` |
| 小程序列表 | 已覆盖 | `yxer query miniapps <account_id> [--query 关键词]` | `skills/yixiaoer/references/get-miniapps.md` |
| 同步发布应用 | 已覆盖 | `yxer query syncapps <account_id>` | `skills/yixiaoer/references/get-sync-apps.md` |
| 热点列表 | 已覆盖 | `yxer query hot-events <account_id>` | `skills/yixiaoer/references/get-hot-events.md` |
| 群聊列表 | 已覆盖 | `yxer query groups <account_id>` | `skills/yixiaoer/references/get-groups.md` |
| 小红书用户艾特对象（支持陌生人） | 已覆盖 | `yxer query friends <account_id> --red-id 小红书号` | `skills/yixiaoer/references/get-friends.md` |
| 账号分组列表 | 已覆盖 | `yxer account-group list [--page 1] [--size 10]` | `skills/yixiaoer/references/get-account-groups.md` |
| 创建账号分组 | 已覆盖 | `yxer account-group create <name> [--dry-run]` | `skills/yixiaoer/references/create-account-group.md` |
| 更新账号分组 | 已覆盖 | `yxer account-group update <group_id> <name> [--visible-scope all|specific] [--visible-user USER_ID]... [--dry-run]` | `skills/yixiaoer/references/update-account-group.md` |
| 删除账号分组 | 已覆盖 | `yxer account-group delete <group_id> [--dry-run]` | `skills/yixiaoer/references/delete-account-group.md` |
| 音乐分类 | 已覆盖 | `yxer query music-categories <account_id>` | `skills/yixiaoer/references/get-music-categories.md` |
| 游戏挂载 | 已覆盖 | `yxer query games <account_id> [--query 关键词]` | `skills/yixiaoer/references/get-games.md` |
| 代理管理 | 已覆盖 | `yxer query proxies` / `yxer query proxy-areas` / `yxer update-account <account_id> ... --dry-run` | `skills/yixiaoer/references/proxy-management.md` |

## 推荐迁移顺序

当前遗留表中的 CLI 化项目均已覆盖；后续若旧 skill 文档新增能力，应继续按本表补充状态。
