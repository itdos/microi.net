# 外部身份源登录吾码

## 目标流程

外部身份源只证明主体身份。回调完成后按当前租户查找绑定/受控 JIT 用户，重新确认 `sys_user` 仍启用，再签发 DiyToken。菜单、表、字段、角色、部门与数据范围不从外部 Token 直接继承。

## OIDC RP

必须覆盖：

- Authorization Code；公共客户端使用 PKCE S256。
- 随机 state、nonce、短时效、一次性消费和原始 Origin 绑定。
- Discovery 与 JWKS 的 HTTPS、SSRF、issuer 一致性和缓存更新。
- id_token 签名、算法、issuer、audience、有效期、nonce；必要时再请求 UserInfo。
- code 不能写日志、URL 清理、回调错误不泄露 Token/Secret。
- `client_secret_basic`、`client_secret_post` 或 `none` 与伙伴注册一致。

禁止 Implicit、Password Grant、宽松回调前缀、关闭签名或仅解码 JWT 不验签。

## SAML SP

必须覆盖：

- SP Metadata、AuthnRequest、RelayState、ACS 与可选 SLO。
- 浏览器回调使用 `/api/Sso/SamlCallback`，Assertion Consumer Service 使用 `/api/Sso/SamlAcs`。
- Response/Assertion 签名、Destination、Issuer、Audience、时间窗口、InResponseTo。
- Request ID 与 Assertion/Response 重放保护。
- 加密断言时使用本租户解密私钥；验签只用伙伴公开证书。
- NameID/Claim 到稳定 Subject 的明确规则。

不能因为伙伴证书配置困难而在生产关闭签名校验。

## CAS Client

- service 必须是精确、受控的吾码回调 URL。
- CAS 1.0 `/validate`、2.0 `/serviceValidate`、3.0 `/p3/serviceValidate` 按配置解析。
- Service Ticket 单次使用、短时效、绑定 service；失败响应不能当作用户属性。
- CAS 根地址生产使用 HTTPS，并经过 SSRF 检查。

## 用户解析顺序

1. 规范化 `OsClient`、连接方向和协议。
2. 提取稳定 Subject；拒绝空值、控制字符和不稳定昵称。
3. 先查 `mci_user_external_identity` 的精确绑定。
4. `BoundOnly` 未绑定即拒绝；`JitMatch/JitCreate` 仅按已审核映射运行。
5. 重新读取 `sys_user`，确认未删除、未停用。
6. 签发 DiyToken，写不含凭据的 SSO 审计。

步骤 2–5 固定由 `sso_resolve_federated_identity` 执行；`sso_http_oidc_callback`、`sso_http_saml_acs`、`sso_http_cas_callback` 只通过 `RunSsoProtocol` 取得已经验签、归一化且不含原始 Token/断言的 Claim。步骤 6 由 `sso_complete_login` 编排并调用一次性票据/DiyToken 原子。禁止为 OIDC、SAML、CAS 恢复 Controller 或各复制一套用户查询、JIT 和角色映射。

## 浏览器回调

弹窗消息必须同时校验 `event.source`、精确 `event.origin`、消息类型和 ConnectionKey。回调只传 90 秒左右的一次性票据；登录页再用该票据换 DiyToken。不要通过 `postMessage('*')`、URL fragment 或 Query 传 DiyToken。
