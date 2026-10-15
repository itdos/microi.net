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

OIDC 公共客户端 `ClientAuthMethod=none` 每次授权都必须由用户在官方页面明确确认；已有 Provider Session 也不能自动返回 code，调用方删除或修改 prompt 不能绕过确认。`prompt=none` 返回 `interaction_required`，只向已校验的精确 redirect URI 回传错误与 state，不签发 code，也不强行打开确认页。缺失 prompt 或其它受支持的交互请求进入 opaque RequestId 确认流程；机密客户端保留既有 Provider Session 自动授权及显式 consent 行为。

`CompleteAuthorization` 的 `Preview=true` 只在当前交互式 DiyToken 下读取授权卡片，校验当前客户端启用状态、精确回调和 Scope，返回当前官方账号、目标系统、回调、Scope 与有效期的白名单投影。重复 Preview 不消费 RequestId，不返回 code、state、nonce、PKCE challenge、DiyToken 或客户端秘密；真正确认时才原子消费请求并再次校验客户端配置。账号确认使用 `ExpectedUserId` 收紧校验，授权身份始终来自当前 DiyToken，不能由页面指定。

没有有效 Provider Session 的交互请求先跳到吾码登录页，登录成功回到一次性 handoff。页面必须说明目标系统、当前官方账号、请求 Scope 和退出影响；任何第三方请求的 Scope 都不能自动映射为吾码管理员能力。上线验收须实际重复 Preview、再确认取得 code，不能用 HTTP 200 或旧 API 忽略 Preview 后直接消费请求的结果代替协议证据。
