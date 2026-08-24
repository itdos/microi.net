# 配置、Secret、安全与迁移

## diy_sso 分组

- `basic`：Key、名称、方向、协议、启用、排序。
- `oidc`：Issuer/Discovery/端点、Client、Scope、精确 Redirect URI。
- `saml`：Entity ID、Metadata、SSO/SLO、ACS。
- `cas`：Server URL、版本。
- `mapping`：Subject/Account/Name/Email/Role Claim、JSON 映射、JIT。
- `security`：Secret/证书设置 Key、签名/加密、PKCE/nonce、生命周期、私网开关。
- `legacy`：旧 Server/Client API、TokenName、GetTokenType。

`diy_sso` 是管理员专用平台表。匿名能力接口只投影 ConnectionKey、名称、协议、图标、说明和发起地址；旧兼容投影只允许同源 `/api/` 路径与安全 Token 参数名。

匿名投影由 `sso_capabilities` / `sso_legacy_capabilities` 接口引擎提供；Controller 不得直接查询并返回 `diy_sso`。内部协议网关通过 StopHttp 的 `sso_connection_runtime` 取得最小运行投影。客户端统一调用 `/apiengine/{ApiEngineKey}?OsClient=`，让观测数据保留真实 Key；新版宿主对未安装引擎返回结构化缺失错误，不再因动态路由尚未注册而直接 404。

## Secret 与证书

- `ClientSecretSettingKey` 等字段只存 `mci_system_setting` Key。
- 第三方 Client Secret 和私钥证书使用后端 Secret 存储，不出现在日志、导出、包、浏览器或 MCP 回读。
- 吾码对外 OIDC Client Secret 只存专用密码哈希；不能用 AES/DES 代替验证哈希。
- SAML 验签/加密公开证书与签名/解密私钥严格区分用途。
- 证书/签名 Key 轮换要有新旧重叠、伙伴确认、撤销和回滚窗口。

## 网络和 URL

所有外部 Discovery、JWKS、Metadata、Token、UserInfo 地址先过 HTTPS/SSRF 检查。默认拒绝回环、私网、链路本地、带用户信息 URL 和 DNS 重绑定；内网 IdP 只能由管理员显式开启并用网络出口白名单补强。

Redirect/Logout/ACS/CAS service 使用规范化后的绝对 URL 精确比较。不要允许通配符、子域后缀、前缀或 fragment。反向代理下使用可信外部 Origin，不能根据任意 Host/Header 构造安全回调。

## 账号与角色

默认 `BoundOnly`。JIT 需要：

- 稳定 Subject 与账号唯一性。
- 非管理员默认角色。
- 外部角色到 RoleId 的显式 allowlist。
- 离职、禁用、角色收回与冲突处理。
- 创建、匹配、拒绝和变更审计。

这些规则由 Managed `sso_resolve_federated_identity` 编排。JIT 创建最终调用精确受限的 `V8.Method.CreateFederatedUser` 原子，并用平台专用带盐密码哈希写入不可登录的随机初始密码；不得回退到 DES，也不得把外部角色名直接写成平台 RoleId。

不能把外部 `admin` 字符串、邮箱域或昵称直接解释为平台管理员。

## LegacyToken 迁移

1. 盘点旧 `ClientSsoApi/ServerSsoApi/TokenName` 和使用系统。
2. 为每个系统选择 OIDC、SAML2 或 CAS 并建立新连接。
3. 并行验证登录/退出和账号映射；新入口默认标准协议。
4. URL 中的旧 Token 读取后立即清理，不写 Referer、日志或分析平台。
5. 迁移完成后停用旧行；不要继续给新系统复制 LegacyToken。

旧兼容只允许调用同源 `/api/`，绝不把 DiyToken POST 到管理员配置的任意绝对 URL。浏览器只处理 `LegacyCapabilities` 已返回连接中明确登记的 `TokenName`；不得恢复“只要 URL 出现 `?token=` 就自动登录”的无配置旁路。
