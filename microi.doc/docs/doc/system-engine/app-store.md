# 🏪 应用商城

> **平台从 v4.7.2 开始自动安装应用商城模块，用户可通过应用商城安装和管理各种应用**

## 数据来源

AI 应用与应用商城已经统一为一个系统，`sys_microistore` 是唯一应用主表。商城入口保留三个业务页签：

| 页签 | 数据来源 |
|---|---|
| AI 应用 | 使用模块引擎配置的 `SelectApi` 读取统一商城源，包含平台应用、Web、UniApp、微服务以及官方/社区来源。 |
| 我发布的应用 | 切换到隐藏模块【我发布的应用】，由该模块绑定当前租户 `sys_microistore`，不配置 `SelectApi`。 |
| 我安装的应用 | 切换到隐藏模块【我安装的应用】，由该模块绑定当前租户 `sys_microistoreversion`，不配置 `SelectApi`。 |

三个页签不是前端写死的数据源分支，而是三个真实模块引擎通过【页面多Tab → 关联模块】组成：主模块负责统一商城数据，两个隐藏模块分别负责当前租户的发布记录和安装记录。主模块不再拆分“官方应用、社区应用”，而是在同一 AI 应用列表中通过 `ApplicationType`、`Category`、`PublisherType` 和关键词进行复选筛选。

统一字段约定：

| 字段 | 说明 |
|---|---|
| `ApplicationType` | `Platform / Web / UniApp / MicroService`。 |
| `Category` | 游戏、企业应用、办公、教育、行业应用、平台能力等。 |
| `PublisherType` | 官方应用、社区应用。 |
| `ViewCount` | 官网或商城打开应用时累计浏览次数。 |
| `InstallCount` | 应用安装成功后累计安装次数。 |

因此本地数据始终走当前 `ApiBase + OsClient + Token`，不会发送到官网；以后其它业务遇到“不同 Tab 使用不同表单引擎和模块引擎”时，也直接配置 `TargetSysMenuId`，不需要修改 `diy-table` 的数据加载代码。
