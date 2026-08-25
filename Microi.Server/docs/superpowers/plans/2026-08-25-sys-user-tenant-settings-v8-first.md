# SysUser 与租户系统设置 V8-first 收口草案

## 目标与归属

本轮将 `SysUserController` 与 `TenantSystemSettingsController` 中可编辑的业务编排迁移到
对应官方应用的固定 Managed ApiEngine。旧 Controller 路由只保留兼容桥；官方应用更新或
重新安装会恢复 Managed 源码。租户个性化逻辑写入各应用声明的 CreateIfMissing Hook，
不要直接修改 Managed 接口。

| ApiEngineKey | 官方应用 | 旧兼容路由 | 职责 |
| --- | --- | --- | --- |
| `platform-create-tenant` | SaaS引擎 | `POST /api/SysUser/CreateTenant` | 校验普通业务参数，调用当前用户租户开通可信原子 |
| `platform-user-update-profile` | 系统账号 | `POST /api/SysUser/UpdateCurrentProfile` | 当前用户资料字段白名单、CRUD、刷新登录投影 |
| `platform-user-update-preferences` | 系统账号（根集成迁移） | `POST /api/SysUser/UpdateMyDefaultIndexUrl` | 复用既有当前用户偏好接口 |
| `platform-tenant-system-settings` | 系统设置 | `List`、`Delete`、非 Secret `Save` | 私有设置列表、普通值保存、删除与安全审计 |

升级集成时需把独立资源脚本写入各自应用的 `SysApiEngines`，声明
`ResourcePolicies.ApiEngines[*].UpgradePolicy=Managed`、启用、禁止匿名，并加入
RequiredPlatformCapabilities。`platform-create-tenant` 使用 SaaS 的 `platform-runtime-custom-hook`；
系统账号声明 `platform-user-custom-hook`，系统设置声明 `platform-system-settings-custom-hook`。
三个 Hook 均为 `CreateIfMissing`，不可在升级时覆盖租户代码。

## 可信 C# 边界

- `ProvisionCurrentUserTenant` 只接受固定 `platform-create-tenant` 调用。Owner Id、手机号、姓名、
  存量密码全部从可信 DiyToken 与当前租户 `sys_user` 派生，忽略 Param 中的身份、密码和 AI Key。
- `PrepareCurrentUserProfileUpdate` 只接受固定资料引擎；目标用户取可信登录态，访问密钥拒绝；
  新头像只允许当前租户 `member/avatar` 或 `member/public-avatar` 精确目录。
- `ValidateTenantSystemSettingsOperation` 只接受固定设置引擎，要求原 Controller 同级的
  `Level >= 999` 且拒绝访问密钥。敏感 Key、Secret、已迁移公开 Key 均拒绝进入 V8 保存流程。
- `GetTenantSystemSettingsSecurityProjection` 只返回行 Id 对应的 `HasSecret` 布尔值和迁移 Key；
  不返回 `ConfigValue`、`SecretCipher` 或解密值。
- Secret/Sensitive Key 保存、Secret reveal challenge/step-up、地图最小凭据投影、密码哈希/重置、
  DiyToken 签发、管理员密码查看仍保留 C# 可信端点。

## Hook 语义

Managed 接口在写入前调用所属应用的 CreateIfMissing Hook，返回 `Code != 1` 可阻断操作。写入或
租户开通完成后的 Hook 失败不得反转已经发生的结果：主接口仍返回 `Code=1`，并在
`DataAppend.HookWarning` 和安全审计中记录告警，避免客户端重试造成重复租户或误报失败。
Hook 参数不包含密码、Secret、配置值、密文或头像外的任意用户认证字段。

## 兼容保留与后续边界

`AddSysUser/UptSysUser/DelSysUser/GetSysUser` 暂不改为直表 V8。这些动作当前依赖菜单/表授权、
委派管理范围、角色层级、密码二次认证及微信小程序内容审核；在没有等价可信授权原子之前，
直接改为 `V8.FormEngine` 会扩大权限。`GetSysUserPassword`、官网租户管理员密码查看/重置、
`SetPassword` 同样属于认证秘密边界，继续由 C# 承担。

升级验收至少覆盖：Managed 资源源码一致性、旧路由固定 Key 转发、伪造 Id/OsClient 无效、
访问密钥拒绝、跨租户头像拒绝、Secret 请求在 CRUD 前失败、查询错误不误新增、NaN Sort 归零、
后置 Hook 失败仍保持成功，以及列表不选择/返回 `SecretCipher`。
