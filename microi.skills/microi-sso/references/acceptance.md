# 验收、商城发布与交付结论

## 分层证据

| 层 | 最低证据 |
|---|---|
| 源码 | 协议/安全原语测试，静态扫描无 Secret/Token 日志 |
| 后端构建 | 隔离输出 `dotnet build` 成功，不覆盖共享运行目录 |
| 前端构建 | 现代包和项目要求的兼容包完成 |
| 应用包 | 可重复生成；Name/AppId/Version、DDL、字段数、菜单、空数据集、11 个接口引擎源码同源与 ResourcePolicies 校验 |
| 官方商城 | `microi_itdos` 发布后回读 `sys_microistore` 与官方资源 API；状态、版本、包哈希一致 |
| 目标租户 | 安装/升级任务终态 `Succeeded`，再读真实表、字段、菜单、安装版本 |
| 运行时 | Capabilities、Discovery/Metadata/JWKS 和实际使用端点命中已部署程序集 |
| 浏览器 | 登录入口、弹窗 Origin、URL 清理、管理页 7 Tab、秘密无明文 |
| 伙伴联调 | 登录/拒绝/过期/重放/退出/停用/角色变化/轮换 |
| 多节点 | state、code、ticket、session、撤销和缓存跨节点一致 |

## 官方应用发布

1. 使用官方 `microi_itdos`，核对绑定 `https://api.itdos.com` 与 `OsClient=iTdos`。
2. 在发布源更新真实 `diy_sso`、字段、表单 Tabs 和菜单视图并回读。
3. 导出精确菜单/表和 11 个接口引擎，不带连接数据、用户绑定、Secret、证书或示例账号；接口源码必须与 `Microi-V8-Engine/.../SSO身份联邦` 逐字同源。
4. AppId 固定 `app.microi.sso`，PublisherType 为官方应用；10 个核心 Key 为 `Managed/Application`，`sso_event_hook` 为 `CreateIfMissing/Tenant`。
5. 发布后从官方资源 API 读取 `app.microi.sso.json`，校验 SHA-256、版本、1 菜单、1 表、64 字段、11 个接口引擎及策略。
6. 官方 iTdos 是发布源，安装任务被“发布源不允许安装”拒绝是保护性终态；不要绕过或伪装成成功。
7. 普通目标租户才执行安装/更新，并轮询后台任务到终态。Pending/Running/入队不算成功。

## 协议负向用例

- OIDC：state/nonce/PKCE 错、code 重放、issuer/audience 错、未知 kid、过期 token、refresh 重放、回调前缀攻击。
- SAML：签名错、过期、Audience/Destination/InResponseTo 错、Request/Assertion 重放、错误证书、未授权 ACS。
- CAS：ticket 重放、service 不同、过期 ticket、错误租户、CAS 失败响应。
- 通用：跨租户连接、停用用户、停用连接、SSRF 私网/回环、访问密钥会话授权、匿名读取 `diy_sso`。

## 结论措辞

只有真实伙伴和多节点验收也通过，才能说“该协议连接已可生产使用”。

- 包已发布但 Server/Client 未部署：写“官方配置包已发布，运行时代码待部署”。
- 端点冒烟通过但无真实 IdP/SP：写“协议端点已验证，伙伴联调待完成”。
- 官方源安装被保护性拒绝：写“发布源保护生效，不构成普通租户安装证据”。
- 因用户未授权输入密码而无法浏览器登录：写明 UI 登录后验收未完成，不用接口/源码代替视觉证据。

## 404 与应用缺失回归

- 客户端能力发现和登录完成只允许调用 `/api/ApiEngine/Run?OsClient=`，请求体携带精确 `ApiEngineKey`。
- 在未安装 `app.microi.sso` 的租户调用通用入口，应返回结构化“接口引擎不存在”；不能返回 `/api/Sso/Capabilities` 路由 404。
- 安装后回读 11 个 `sys_apiengine` 行并刷新缓存，再验证 `sso_capabilities` 为 `Code=1`。
- `/api/Sso/Capabilities`、`LegacyCapabilities`、`CompleteLogin`、`RotateClientSecret` 与 `/api/SysUser/SsoPengrui` 必须保持删除，防止业务逻辑重新漂回 Controller。
