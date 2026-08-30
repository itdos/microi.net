# 吾码向第三方提供登录

## 共同边界

先验证当前交互式 DiyToken，再生成第三方协议票据。访问密钥会话不能替代用户交互授权。外部 Client/SP/service 只能读取按 Scope/映射允许的最小资料，不能获得 DiyToken、菜单权限对象或内部角色策略。

## OIDC Provider

应提供：

- Discovery、JWKS、Authorize、Token、UserInfo。
- 机密客户端认证与公共客户端 PKCE S256。
- 一次性授权码，绑定 ClientId、Redirect URI、Scope、PKCE、用户、租户和过期时间。
- 签名 id_token，校验 nonce；按客户端派生 pairwise subject。
- 高熵不透明 Access/Refresh Token；仅保存哈希索引。
- Refresh Token rotation/reuse detection，family 撤销。
- Introspection、Revocation、RP-Initiated Logout 与精确 post-logout redirect。

Client Secret 轮换动作只显示一次明文，持久化 PBKDF2-SHA256 哈希。签名 Key 必须有 `kid`，轮换时保留验证重叠窗口。

对外 Claim 固定由 `sso_outbound_claims` 从启用用户与连接白名单生成；24 个 `sso_http_*` Managed 端点通过 `RunSsoProtocol` 把同一投影编码成 OIDC/SAML/CAS 响应。Client Secret 轮换由 `sso_rotate_client_secret` 编排，并调用精确受限的可信原子生成一次性明文与持久哈希，不能恢复为 Controller 定制动作。

## SAML IdP

应提供 IdP Metadata、SSO、签名 Response/Assertion、可选加密和 SLO。必须校验 SP Entity ID、ACS、Destination、AuthnRequest 签名/重放；Attribute 只来自白名单映射。每个伙伴独立证书/配置，不把私钥放进应用包或前端。

## CAS Server

应提供 `/login`、CAS 1.0 `/validate`、CAS 2.0 `/serviceValidate`、CAS 3.0 `/p3/serviceValidate` 和 `/logout`。Service Ticket 必须：

- 随机、短时、单次使用。
- 绑定当前租户、连接、用户和精确 service。
- 校验成功才返回用户属性；CAS 1.0 使用协议规定的 yes/no 文本。

当前不实现 CAS Proxy Ticket；需要代理链时先评估改用 OIDC。

## 授权页面

第三方发起 Authorize/SAML/CAS 登录后，若没有有效 Provider Session，先跳到吾码登录页；登录成功回到一次性 handoff。页面必须说明目标系统、请求 Scope 和退出影响。即使后续加入 Consent，仍不能把第三方请求的任意 Scope 自动映射为吾码管理员能力。
