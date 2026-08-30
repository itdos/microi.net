# SSO 身份联邦

Microi 吾码从 `v7.5.0` 起提供双向 SSO 身份联邦：既可以让企业身份中心或其它系统登录吾码，也可以让吾码作为身份提供方，为其它系统提供登录。统一支持 **OpenID Connect（OIDC）**、**SAML 2.0** 和 **CAS 1.0/2.0/3.0**，外部身份进入吾码后仍签发 DiyToken，不建立第二套用户、角色或业务权限体系。

> 旧版【系统设置 → 单点登录】只有“跳转地址 + URL Token”兼容配置，不能视为完整身份联邦。新接入必须优先使用 OIDC、SAML2 或 CAS；旧 URL Token 仅用于有迁移计划的存量系统。

## 一、能力边界

| 方向 | 吾码角色 | 典型场景 | 支持能力 |
|---|---|---|---|
| 外部系统 → 吾码 | OIDC RP、SAML SP、CAS Client | Entra ID、Keycloak、ADFS、CAS Server 或企业统一身份中心登录吾码 | Discovery/Metadata、授权码、PKCE S256、state/nonce、签名/issuer/audience/有效期校验、账号绑定、受控 JIT、一次性登录票据、DiyToken |
| 吾码 → 外部系统 | OIDC OP、SAML IdP、CAS Server | ERP、OA、BI、门户或客户系统复用吾码账号登录 | OIDC Discovery/JWKS/Authorize/Token/UserInfo/Introspection/Revocation/Logout，SAML Metadata/签名断言/可选加密/SLO，CAS Login/Validate/ServiceValidate/Logout |

“支持标准协议”不等于无边界地兼容所有历史扩展。当前面向浏览器企业 SSO 的受治理配置文件，不提供 OAuth Implicit、Resource Owner Password、SAML ECP/Artifact、CAS Proxy Ticket 等过时或少见流程。伙伴系统若只支持厂商私有协议，应优先在网关侧转换为 OIDC/SAML2/CAS，再接入吾码。

## 二、端到端示例

假设集团使用 Keycloak，吾码租户为 `corp`：

1. 管理员安装官方应用 `app.microi.sso`，在【系统设置 → SSO 身份联邦】新增连接 `group-keycloak`。
2. 方向选择“外部系统 → 吾码”，协议选择 OIDC，填写 Discovery URL、Client ID、Scope，并在租户系统设置保存 Client Secret；`diy_sso` 只保存设置 Key，不保存 Secret 明文。
3. 首次上线使用 `BoundOnly`，管理员把 Keycloak 的稳定 `sub` 绑定到既有吾码用户。需要自动开户时再评审 `JitMatch` 或 `JitCreate`，明确默认角色和角色映射。
4. 用户在吾码登录页选择“集团统一身份”，浏览器通过独立窗口完成授权。回调验证 code、state、nonce、PKCE、签名、issuer、audience 和有效期后，只向原始可信 Origin 回传一次性票据。
5. 吾码重新读取有效用户并签发 DiyToken。菜单、按钮、表、字段、部门与数据范围继续由吾码服务端权限体系判断。

反向场景中，第三方 ERP 登记为吾码的 OIDC Client。ERP 跳转到 `/sso/corp/authorize`，用户确认后用一次性 code + PKCE 换取短期协议 Token；ERP 永远不会得到用户的吾码 DiyToken。

## 三、安装与升级

官方商城应用信息：

- AppId：`app.microi.sso`
- 应用名：`SSO 身份联邦`
- 类型：官方平台应用
- 配置资源：`diy_sso`、`/system/sso` 菜单、64 个字段、7 个配置分组
- 运行资源：35 个接口引擎，其中 34 个官方 Managed 核心（含 24 个公开 HTTP 协议端点）和 1 个租户 CreateIfMissing Hook
- 安装数据：不附带示例连接、用户绑定、Client Secret 或证书

从 `v7.5.9` 起，原 SSO Controller 的 24 个公开路由也全部由 Managed 接口引擎交付。接口引擎现在支持 `{OsClient}`/`{ConnectionKey}` 路径模板，以及受控状态码、Content-Type、重定向、XML/纯文本和响应头；独立 `Microi.SSO` 类库只保留 OIDC/SAML/CAS 协议编解码、签名验签、证书/Secret 隔离、一次性票据和 DiyToken 等可信原子，不再保留任何 `Sso*Controller`。`Microi.net.Api` 仅注册 `AddMicroiSSO()`，`Microi.Client` 负责登录入口和安全弹窗恢复。

### 接口引擎合同

| 接口 Key | 责任 | 策略 |
|---|---|---|
| `sso_capabilities` | 匿名登录入口白名单投影 | Managed |
| `sso_legacy_capabilities` | 存量 URL Token 安全投影 | Managed |
| `sso_connection_runtime` | 协议网关读取脱敏运行配置 | Managed / StopHttp |
| `sso_resolve_federated_identity` | 精确绑定、JitMatch、JitCreate、角色映射 | Managed / StopHttp |
| `sso_protocol_event` | 脱敏协议审计与 Hook 编排 | Managed / StopHttp |
| `sso_event_hook` | 租户自己的登录/退出扩展 | CreateIfMissing / StopHttp |
| `sso_outbound_claims` | 吾码对外最小 Claim 投影 | Managed / StopHttp |
| `sso_complete_login` | 一次性票据换 DiyToken | Managed |
| `sso_rotate_client_secret` | OIDC Client Secret 轮换编排 | Managed |
| `sso_legacy_token_login` | 受限的存量 Token 登录 | Managed |
| `sso_user_runtime` | 协议网关读取启用用户最小投影 | Managed / StopHttp |
| `sso_http_*`（24 个） | `/api/Sso/Begin`、授权完成与回调，OIDC/SAML/CAS 标准公开地址 | Managed / ResponseType=HTTP |

官方核心被租户修改时升级失败关闭，不自动合并可执行代码。`sso_event_hook` 首次安装后归租户所有，后续官方升级永不覆盖；需要官方新增行为时发布新的 Hook Key，不能把现有租户 Hook 改回 Managed。

吾码官方 `iTdos` 租户是商城发布源，服务端会拒绝在发布源上再次安装商城应用。发布源通过 MCP 更新真实资源并发布；普通目标租户才执行商城安装/更新任务，并轮询到 `Succeeded` 后回读资源。

## 四、连接配置

配置页按用途分为 7 个 Tab：

| Tab | 关键字段 | 说明 |
|---|---|---|
| 基本信息 | `SsoKey`、`Name`、`Direction`、`Protocol`、`IsEnable`、`Sort` | `SsoKey` 是稳定连接标识，发布后不要随意改名 |
| OIDC | `Issuer`、Discovery/Authorize/Token/UserInfo/JWKS/Logout、`ClientId`、认证方式、Scope、精确回调 | 优先使用 HTTPS Discovery；回调逐条精确匹配 |
| SAML2 | `EntityId`、Metadata、SSO/SLO、ACS | 交换 Entity ID、端点与公开证书；生产环境要求签名 |
| CAS | `CasServerUrl`、`CasVersion` | 新系统优先 CAS 3.0；Service Ticket 单次使用且绑定精确 service |
| 账号与权限映射 | Subject/Account/Name/Email/Role Claim、Claim/Role Mapping、开户模式、默认角色 | 外部角色只能映射到明确授权的吾码 RoleId |
| 安全与生命周期 | Secret/证书设置 Key、签名/加密、PKCE/nonce、issuer/audience、私网端点、Token 有效期 | 高风险开关默认关闭或强校验 |
| 兼容模式 | `ServerSsoApi`、`ClientSsoApi`、`TokenName`、`GetTokenType` | 只为旧 URL Token 系统迁移保留 |

### 账号开通策略

- `BoundOnly`：默认且最安全。只有 `mci_user_external_identity` 中已绑定的主体能登录。
- `JitMatch`：按明确的受信 Claim 匹配既有账号；不能仅凭昵称猜测。
- `JitCreate`：创建新用户，必须配置非管理员默认角色、唯一账号规则、停用/离职回收和审计流程。

无论使用哪种策略，服务端都以 `OsClient + ConnectionKey + ProviderSubject` 隔离外部主体，不允许跨租户复用绑定。

### Secret 与证书

`ClientSecretSettingKey`、`SigningCertificateSettingKey`、`ValidateCertSettingKey`、`EncryptCertSettingKey` 只填写 `mci_system_setting` 中的 Key。秘密值只在可信后端读取，匿名能力接口、列表、导出、日志和应用包都不返回明文。

吾码作为 OIDC Client 时使用加密保存的第三方 Client Secret；吾码作为 OIDC Provider 时生成的 Client Secret 只在轮换动作成功后显示一次，数据库保存 PBKDF2-SHA256 哈希。SAML 私钥证书必须受控保存；公开验签/加密证书可以按伙伴配置。证书轮换应保留新旧公开证书重叠窗口，完成伙伴切换后再撤销旧证书。

## 五、协议端点

`{OsClient}` 必须与当前租户一致，`{ConnectionKey}` 使用连接的 `SsoKey`。

登录页能力发现与登录完成使用可观测的自定义入口 `POST /apiengine/sso_capabilities?OsClient={OsClient}`、`POST /apiengine/sso_complete_login?OsClient={OsClient}`。不要再调用已移除的 `/api/Sso/Capabilities`、`/api/Sso/LegacyCapabilities`、`/api/Sso/CompleteLogin`、`/api/Sso/RotateClientSecret` 或 `/api/SysUser/SsoPengrui`；新版宿主即使应用尚未安装，也会返回结构化“接口引擎不存在”，而不是路由 404。

`POST /api/Sso/Begin`、`POST /api/Sso/CompleteAuthorization` 以及下列标准协议 URL 都是 `app.microi.sso` 中 `sso_http_*` 接口引擎的 `ApiAddress`，不属于 MVC Controller。普通 V8 决定路由、匿名策略和编排；`V8.Method.RunSsoProtocol` 只允许对应官方 Key 调用，负责协议编解码、签名验签、一次性票据和 DiyToken 等可信原子。高风险 `Set-Cookie` 只能由该原子生成进程内签名响应，租户脚本无法伪造。

路径模板值是权威参数：例如 `/saml/{OsClient}/sp/{ConnectionKey}/metadata` 命中后，服务端用路径中的租户与连接覆盖同名 Query/Form/JSON 值；多个模板同时匹配会失败关闭，避免跨租户或跨连接混淆。

### 吾码作为 OIDC Provider

| 用途 | 路径 |
|---|---|
| Discovery | `GET /sso/{OsClient}/.well-known/openid-configuration` |
| JWKS | `GET /sso/{OsClient}/jwks` |
| Authorize | `GET /sso/{OsClient}/authorize` |
| Token | `POST /sso/{OsClient}/token` |
| UserInfo | `GET/POST /sso/{OsClient}/userinfo` |
| Introspection | `POST /sso/{OsClient}/introspect` |
| Revocation | `POST /sso/{OsClient}/revoke` |
| Logout | `GET /sso/{OsClient}/logout` |

授权码单次使用并绑定 Client、精确 Redirect URI、Scope、PKCE challenge、用户和租户。Access/Refresh Token 使用高熵不透明值，Redis 只按哈希索引；Refresh Token 每次轮换，检测到重放会撤销整个 family。

### SAML2

| 用途 | 路径 |
|---|---|
| 吾码 IdP Metadata | `GET /saml/{OsClient}/metadata` |
| 吾码 SP Metadata | `GET /saml/{OsClient}/sp/{ConnectionKey}/metadata` |
| 吾码作为 IdP 登录 | `GET/POST /saml/{OsClient}/login` |
| 外部登录发起/ACS | `/api/Sso/SamlBegin`、`/api/Sso/SamlAcs` |
| SLO | `GET/POST /saml/{OsClient}/logout` |

SAML 请求与响应校验签名、Destination、Issuer、Audience、时间窗口、InResponseTo 和重放；需要时加密断言。生产环境不允许关闭签名断言校验。

### CAS

| 用途 | 路径 |
|---|---|
| Login | `GET /cas/{OsClient}/login` |
| CAS 1.0 Validate | `GET /cas/{OsClient}/validate` |
| CAS 2.0 Validate | `GET /cas/{OsClient}/serviceValidate` |
| CAS 3.0 Validate | `GET /cas/{OsClient}/p3/serviceValidate` |
| Logout | `GET /cas/{OsClient}/logout` |

Service Ticket 为一次性票据，必须与原始 service 精确绑定；校验失败不返回用户属性。

## 六、安全基线

1. 生产身份端点、Metadata、回调和 Logout 使用 HTTPS；HTTP 仅允许显式开启的 loopback 联调。
2. Discovery、JWKS、Metadata、Token 和 UserInfo 请求默认拒绝私网、回环、链路本地与带用户信息的 URL，防止 SSRF；受控内网身份中心必须由管理员显式开启并限制网络出口。
3. OIDC 必须使用授权码流程；公共客户端要求 PKCE S256，所有登录校验 state 和 nonce。
4. Redirect URI、post-logout URI、ACS、SAML Destination 与 CAS service 使用精确匹配，不接受前缀、通配符或 URL fragment。
5. 匿名 `sso_capabilities` 只返回入口名称、协议、图标和发起地址；`diy_sso` 是管理员专用平台表，不允许匿名通用 FormEngine 查询。
6. 旧 URL Token 专用接口只投影同源 `/api/` 路径和安全参数名，并立即从地址栏移除凭据；只有启用的兼容连接明确登记相同 `TokenName` 时才允许自动登录，任意 `?token=` 不再构成登录授权；新系统不得继续采用 URL Token。
7. 外部认证成功只确认“是谁”，不能代替菜单、表、行、字段、状态机、幂等、事务和审计授权。
8. 登录票据、授权码、CAS Ticket、Refresh Token、SAML Request ID 都应验证过期与重放；失败日志不记录 code、Token、Secret、断言原文或 DiyToken。
9. 管理员轮换 Secret/证书、启停连接、修改回调或开户策略后，应清理缓存并完成真实伙伴回归。

更多平台级要求见[平台安全与兼容基线](./security)；Passkey、TOTP 和固定 Gitee/微信/GitHub 登录见[登录方式与强身份验证](./identity-verification)。

## 七、上线验收

不要用单一“接口返回 200”代替完整验收。至少分别记录：

1. **源码与单测**：安全原语、协议状态机、回调校验、重放、跨租户、失败路径通过。
2. **构建**：后端隔离输出构建成功；PC 现代包与兼容包构建成功。
3. **应用包**：`app.microi.sso` 可重复生成，字段数/DDL/菜单、35 个接口引擎源码同源性与 ResourcePolicies 校验通过。
4. **官方商城**：官方 `sys_microistore` 行为 `Published`，AppId、版本、包哈希和资源计数回读一致。
5. **目标租户**：安装/更新任务到 `Succeeded`，真实表、字段、菜单和版本回读；发布源保护性拒绝不能冒充安装成功。
6. **浏览器 UI**：登录页只显示当前租户启用的连接，管理页 7 个 Tab 与双向/协议筛选正确，秘密字段无明文。
7. **真实伙伴**：每种实际使用的协议至少完成登录、拒绝、过期、重放、退出、用户停用、角色变化与密钥/证书轮换联调。
8. **多节点**：状态、票据、Session、Token 撤销和缓存刷新在不同 API 节点结果一致。

## 八、常见问题

**登录页请求 `/api/Sso/Capabilities` 等旧路径 404**：先升级 `Microi.Client`；新版能力接口统一调用 `/apiengine/{ApiEngineKey}`。再升级 `Microi.Server` 和 `app.microi.sso`，并回读 35 个接口引擎。`/api/Sso/Begin`、授权完成与协议回调仍保留原 URL，但它们现在是 Managed 接口引擎 `ApiAddress`，不是 Controller。

**商城更新后仍执行旧接口代码**：回读 `sys_apiengine.Version/ApiV8Code`，确认 Managed 基线没有租户修改冲突，刷新租户接口引擎缓存；不要用 SQL 强行覆盖或手工修改 `.resource-sync-base`。

**登录后没有菜单**：SSO 只完成认证；检查该用户在吾码中的角色、部门、菜单和表权限。

**OIDC 回调提示 state/nonce/PKCE 无效**：不要重用旧窗口或旧 code，核对代理后的外部 HTTPS Origin、回调地址和多节点 Redis。

**SAML 签名失败**：核对 Entity ID、证书用途、签名算法、时钟、Destination/Audience 以及 Base64/PEM/PFX 格式，禁止为了联调关闭生产签名校验。

**CAS Service Ticket 无效**：Ticket 只能使用一次，并且校验时的 service 必须与登录时完全一致。

协议依据：[OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0-18.html)、[OAuth 2.0 Security Best Current Practice（RFC 9700）](https://www.rfc-editor.org/rfc/rfc9700.html)、[CAS Protocol Specification](https://apereo.github.io/cas/development/protocol/CAS-Protocol-Specification.html)。
