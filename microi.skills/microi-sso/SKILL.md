---
name: microi-sso
description: 设计、实现、配置、迁移、发布和验收 Microi 吾码双向 SSO 身份联邦。用于外部系统通过 OIDC、SAML2、CAS 登录吾码，或吾码作为 OIDC OP、SAML IdP、CAS Server 集成其它系统，以及 diy_sso、账号/角色映射、Secret/证书、官方应用 app.microi.sso 和真实伙伴联调。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi SSO 身份联邦

## 何时使用

以下任务必须使用本 Skill：

- Keycloak、Entra ID、ADFS、CAS Server、企业统一身份中心登录吾码。
- 吾码账号登录 ERP、OA、BI、门户或其它第三方系统。
- 修改 `diy_sso`、SSO 登录页、OIDC/SAML/CAS 接口引擎端点、Claim/角色映射或旧 Token SSO。
- 发布、安装、升级或验收官方商城应用 `app.microi.sso`。

固定 Gitee、微信、GitHub 登录与 Passkey/TOTP 仍以 `v8-security` 为主；当需求是可配置企业身份联邦时转到本 Skill。

## 先读取什么

按任务读取，不要一次加载全部参考：

- 外部身份源登录吾码：读 [references/inbound.md](references/inbound.md)。
- 吾码给第三方提供登录：读 [references/outbound.md](references/outbound.md)。
- 表字段、Secret、证书、安全与存量迁移：读 [references/configuration-and-security.md](references/configuration-and-security.md)。
- 测试、商城发布、目标安装与交付结论：读 [references/acceptance.md](references/acceptance.md)。

源码修改前同时完整读取 `workspace-conventions/SKILL.md`；认证、DiyToken、秘密或权限任务再读 `v8-security/SKILL.md`；商城任务再读 `app-store/SKILL.md`。

## 不可破坏的事实

1. DiyToken 是进入吾码后的唯一平台会话入口。SSO 认证成功后签发 DiyToken，不创建第二套用户/权限 Token。
2. 吾码向外提供的 OIDC/SAML/CAS 协议票据独立、短期、可撤销，绝不把 DiyToken 给第三方。
3. `OsClient + ConnectionKey + Subject` 是外部主体隔离边界；所有回调、票据、缓存和审计都绑定租户。
4. 新连接只用 OIDC、SAML2、CAS；URL Token 是迁移兼容项，不是推荐协议。
5. Redirect URI、ACS、Destination、Audience 和 CAS service 必须精确匹配；生产端点必须 HTTPS。
6. Secret/私钥只存 `mci_system_setting` 的受控值；`diy_sso` 只存 Setting Key。匿名接口只返回登录入口白名单投影。
7. 外部角色、邮箱或昵称不能直接获得管理员权限。默认 `BoundOnly`，JIT 必须显式默认角色、唯一性、回收和审计。
8. HTTP 200、构建成功、商城任务入队或包可下载都不是完整 SSO 验收。
9. SSO 公开 HTTP 路由和业务逻辑都必须由接口引擎承载：连接投影、绑定/JIT、角色与 Claim 映射、审计、登录完成、租户扩展以及 OIDC/SAML/CAS 路由不得重新写进 Controller。只有协议编解码、签名验签、Secret/私钥隔离、一次性票据与 DiyToken 等可信原子可以保留在独立 `Microi.SSO` 类库，并且只能由精确官方 Managed Key 调用。
10. 客户端调用固定应用接口必须优先使用 `/apiengine/{ApiEngineKey}?OsClient=`，让系统日志/监控按真实接口引擎归因；新版宿主即使接口尚未安装也会返回结构化缺失错误。`/api/ApiEngine/Run` 只保留给无法预知 Key 的旧版兼容调用，禁止新增固定业务依赖；同样禁止调用已删除的 `/api/Sso/Capabilities` 等定制路由。

## 标准工作流

### 存量 TokenLogin 与深链接兼容

- 已启用且精确配置 `ClientSsoApi=/api/SysUser/TokenLogin` 的旧连接使用平台原生 DiyToken 验证；不能错误过滤掉，也不能改走外部身份源的 `sso_legacy_token_login`。未配置、已停用、任意 URL 或非法 Token 必须继续拒绝。
- SSO 成功后优先保留用户指定的站内深链接及业务参数（如 `ShowClassicLeft/ShowClassicTop`）；只有没有指定目标页才采用用户/系统默认首页。菜单/数据权限仍由正常路由守卫与后端校验。
- URL Token 使用后从地址栏和下一次 Router 导航对象同时清除，包括 hash query；单独 `history.replaceState` 不够，动态路由重匹配会把旧 query 带回。验收必须检查 TokenLogin 成功、目标页真实可见、URL 无凭据、布局参数保留；不能仅断言 HTTP 302 或 Code=1。

1. 识别方向、协议、租户、身份伙伴、用户生命周期、退出和密钥/证书责任人。
2. 读取当前 `diy_sso` Schema、菜单、真实连接和已部署 Server/Client 版本；不要从旧截图猜测。
3. 先选标准协议和安全 profile，再配置字段、Secret/证书 Key、Claim/角色映射。
4. 先把业务编排写成可随应用发布的接口引擎；仅当现有 V8 无法安全完成底层原子能力时，才扩展最小 `V8.Method`，并把调用权限制到精确官方接口 Key。禁止把整个流程放进新 Controller，也禁止让原子方法接受任意租户、回调地址或 Secret。
5. 分别验证源码/单测、后端构建、前端构建、运行时端点、浏览器 UI、真实伙伴和多节点。
6. 平台级资源通过官方应用包发布；官方源用 `microi_itdos` 更新并发布，普通目标租户走商城安装/升级任务。
7. 最终明确已验证与未验证边界，尤其是“配置包已发布”与“运行时代码已部署”的区别。

## 官方应用合同

- AppId：`app.microi.sso`
- 名称：`SSO 身份联邦`
- 资源：`diy_sso`、`/system/sso`、字段/布局/视图、34 个 Managed 核心接口引擎和 1 个 CreateIfMissing 租户 Hook；其中 24 个 `sso_http_*` 接管原 SSO Controller 的全部公开路由，不发布用户绑定、连接实例、Secret、证书或示例账号。
- `ResourcePolicies.ApiEngines` 必须逐 Key 显式声明。核心使用 `Managed/Platform`；`sso_event_hook` 使用 `CreateIfMissing/Tenant`，安装后永不被官方覆盖。
- 官方 `iTdos` 是发布源，保护性拒绝安装属于正确行为；普通租户安装才必须轮询到 `Succeeded`。

## C# 与接口引擎责任线

接口引擎固定承载：

- `sso_capabilities`、`sso_legacy_capabilities` 的匿名白名单投影；
- `sso_connection_runtime`、`sso_user_runtime` 的内部最小投影；
- `sso_resolve_federated_identity` 的绑定、JIT 与角色映射；
- `sso_outbound_claims`、`sso_protocol_event`、`sso_event_hook`；
- `sso_complete_login`、`sso_rotate_client_secret`、`sso_legacy_token_login` 的业务编排。
- 24 个 `sso_http_*` Managed 端点：`/api/Sso/Begin`、`/api/Sso/CompleteAuthorization`、OIDC 回调/Discovery/JWKS/Authorize/Token/UserInfo/Introspect/Revoke/Logout、CAS 回调/Login/Validate/Logout、SAML Begin/ACS/Login/Complete/Metadata/Logout。

C# 只保留：

- `Microi.SSO` 的 `SsoProtocolRuntime` 中 OIDC/SAML/CAS 报文编解码、签名验签和协议响应构造；该类型不是 MVC Controller、没有 Route/Http 特性，不直接拥有公开地址；
- Secret、私钥、证书和协议 Token 的可信隔离；
- 高熵一次性 code/ticket、重放保护和 DiyToken 签发；
- 仅允许精确 Managed Key 调用的 `RunSsoProtocol`、`CreateFederatedUser`、`CreateSsoLoginTicket`、`CompleteSsoLogin`、`RotateSsoClientSecret` 原子。

公开协议路由使用 `ApiAddress`（包括 `{OsClient}`、`{ConnectionKey}` 路径模板）和 `ResponseType=HTTP`。接口引擎可以返回状态码、Content-Type、XML/纯文本、重定向和安全响应头；`Set-Cookie` 等高风险响应头只能来自 `RunSsoProtocol` 签名的可信响应。不得因为协议需要原始 HTTP 而恢复任何 `Sso*Controller`。

新增 SSO 需求先判断是否只需修改上述接口引擎。只有缺少不可伪造、不可泄露的底层原子时才增加 V8 方法；增加后同时更新应用 `RequiredPlatformCapabilities`、后端文档、测试与最低版本。

详细用户文档：`microi.doc/docs/doc/more/sso.md`。
