# 🛡️ 登录方式、Passkey、Authenticator、第三方登录与严格人脸验证

Microi 吾码的身份验证增强方案采用“**DiyToken 会话与权限体系 + WebAuthn/Passkey + 标准 TOTP Authenticator + Gitee/微信/GitHub 外部身份 + 可选严格人脸网关 + 一次性步进验证票据**”。登录页的【登录方式】按钮会以主题化气泡面板展示当前租户可用方式；无论使用哪一种方式，最终都只签发吾码 DiyToken，不会用 ASP.NET Identity 替换现有用户、权限或 Token 体系，也不会把指纹、人脸模板、Authenticator 密钥、OAuth ClientSecret 或登录权限判断放到前端。

## 一、选型与是否需要额外 Docker

| 能力 | 主流实现 | 吾码中的用途 | 是否需要额外 Docker |
|---|---|---|---|
| Windows Hello、Touch ID、Face ID、Android 屏幕锁 | WebAuthn / Passkey | 登录、改密确认、敏感操作二次验证 | **不需要**。浏览器调用系统认证器，API 只保存公钥凭据 |
| USB/NFC 安全密钥 | WebAuthn / FIDO2 | 无密码登录、高安全岗位 | **不需要** |
| Microsoft Authenticator、Google Authenticator 等 | 标准 TOTP（RFC 6238） | 账号 + 6 位动态口令登录、改密确认、敏感操作二次验证 | **不需要**。服务端只保存认证加密后的 TOTP 密钥 |
| Gitee、微信开放平台、GitHub | OAuth 2.0 / 微信网站应用扫码协议 | 已绑定外部身份后的免密码登录 | **不需要**。只需在租户系统设置中填写平台应用凭据 |
| 服务端严格人脸 + 活体检测 | `Microi Face Gateway v1` 对接云厂商或私有模型服务 | 必须由服务端统一判定的人脸场景 | **通常需要独立服务**；可以是云 API 网关，也可以是额外 Docker/集群 |

因此，绝大多数“用本机人脸/指纹登录吾码”的需求优先使用 Passkey，不需要像本地 OCR 那样加载模型容器。只有业务明确要求“服务端保存人脸主体、活体检测、跨设备统一比对”时，才部署或采购严格人脸服务。核心 API 节点不加载人脸模型，避免每个节点重复占用 GPU/内存。

吾码服务端使用 [Fido2NetLib](https://github.com/passwordless-lib/fido2-net-lib) 验证 WebAuthn 证明。浏览器只把签名结果交给后端；Windows Hello、Face ID 等生物数据仍由操作系统安全区掌管，不会上传到吾码。

## 二、DiyToken 是会话与权限单一事实源

Passkey、TOTP 和严格人脸只回答“当前用户是否完成了足够强的身份验证”。验证成功后：

- 登录场景仍由平台签发 DiyToken，继续绑定 `OsClient`、终端类型和 `did`。
- 菜单、角色、部门、表权限、数据范围、接口引擎权限和平台控制面权限仍按吾码服务端授权快照判断。
- 自定义敏感操作只获得一个两分钟有效、只能使用一次的票据；它不是第二套登录 Token。
- 访问密钥会话不能申请或消费生物识别步进票据，避免看板密钥升级为控制面身份。

这意味着现有项目无需迁移到 ASP.NET Identity，也不需要重建用户、角色、部门或菜单授权数据。

## 三、内置流程

### 1. Passkey 登录

1. 登录页读取当前租户身份验证能力。
2. 浏览器向后端申请 WebAuthn challenge。
3. 用户通过系统人脸、指纹、PIN 或安全密钥完成验证。
4. 后端校验 RP ID、Origin、challenge、公钥签名、用户验证标记和签名计数。
5. 后端读取仍启用的 `sys_user`，签发标准 DiyToken 登录结果。

账号可以留空以使用可发现凭据；输入账号时，Passkey 必须与该账号准确匹配。不存在的账号与错误凭据使用相同的通用失败边界，不能用于枚举用户。

### 2. Authenticator 登录

1. 用户在【个人中心 → 身份验证器】扫码绑定 Microsoft Authenticator、Google Authenticator 或其它兼容 TOTP 的应用。
2. 每个验证器可分别勾选“允许免密码登录”和“允许二次授权”；服务端在每次验证时重新读取该策略。
3. 登录页选择 Authenticator，输入账号和当前 6 位动态口令，不需要输入密码；验证成功后仍签发 DiyToken。

标准 TOTP 的 6 位码不能全局唯一标识用户，因此新浏览器上仍需要账号；只有 Passkey 可发现凭据支持真正不输入账号。TOTP 密钥使用租户绑定的带版本 AES-GCM 密文保存，动态码还带共享 Redis 限流和计数器防重放。

### 3. Gitee、微信扫码与 GitHub 登录

1. 租户管理员在【系统设置 → 登录与身份】创建并启用对应 Provider 的 `ClientId` 与 `ClientSecret`。
2. 用户先使用原有方式登录，在【个人中心 → 外部账号】绑定自己的 Gitee、微信或 GitHub 身份。
3. 此后登录页点击【登录方式】中的对应气泡，浏览器通过独立授权窗口完成 OAuth/扫码授权；回调只向原始可信 Origin 回传 90 秒、一次性登录票据。
4. 后端根据 `Provider + ProviderSubject` 查找当前租户的有效绑定，重新读取仍启用的 `sys_user`，再签发标准 DiyToken。

未绑定的外部身份不会自动创建吾码用户，也不会按邮箱或昵称猜测账号归属。Provider 的授权、换 Token 和用户信息端点固定在后端白名单中，租户只能配置开关、名称、说明、Scope、ClientId 与 ClientSecret，不能把 OAuth code 或 Secret 改送到任意地址。

### 4. 修改密码

个人中心先按 `用户Id + 编码后的新密码` 计算操作摘要，再按用户选择完成 Passkey、Authenticator 或严格人脸验证。后端重新计算同一摘要并原子消费票据；票据与当前租户、用户、用途和摘要任一项不符都会拒绝。

已经登记强因子的用户必须完成步进验证；没有登记任何因子的存量用户继续执行原密码校验，避免升级后把自己锁在系统外。管理员重置他人密码属于独立的控制面授权，不复用“本人改密”票据。

### 5. 自定义特殊场景

前端表单/列表 V8 负责发起用户交互：

```javascript
var actionHash = await V8.Identity.CreateActionHash({
  Version: 1,
  Action: 'ApprovePayment',
  RecordId: V8.Form.Id,
  Amount: V8.Form.Amount
});

V8.Identity.Verify({
  Purpose: 'ApprovePayment',
  ActionHash: actionHash,
  Method: 'Auto', // Auto | Passkey | Totp | Face
  Code: '' // Method=Totp 时传 Authenticator 当前 6 位码
}, function (result) {
  if (result.Code !== 1) return V8.Tips(result.Msg, false);
  V8.ApiEngine.Run('approve-payment', {
    Id: V8.Form.Id,
    IdentityVerificationTicket: result.Data.Ticket
  }, function (saveResult) {
    V8.Tips(saveResult.Msg, saveResult.Code === 1);
  });
});
```

后端接口引擎必须从数据库重读权威数据，并用同一规范重新计算摘要，然后消费票据：

```javascript
var formResult = V8.FormEngine.GetFormData('payment_order', {
  Id: V8.Param.Id,
  _SelectFields: ['Id', 'Amount', 'Status']
});
if (formResult.Code !== 1) return formResult;

var form = formResult.Data;
var canonical = JSON.stringify({
  Version: 1,
  Action: 'ApprovePayment',
  RecordId: form.Id,
  Amount: form.Amount
});
var actionHash = V8.EncryptHelper.Sha256Hex(canonical);
var verified = V8.Method.ConsumeIdentityVerificationTicket({
  Ticket: V8.Param.IdentityVerificationTicket,
  Purpose: 'ApprovePayment',
  ActionHash: actionHash
});
if (verified.Code !== 1) return verified;

// 验证通过后再执行敏感写入；业务本身仍需权限、状态机、幂等和审计。
return V8.FormEngine.UptFormData('payment_order', {
  Id: form.Id,
  Status: 'Approved'
});
```

前端传来的 `ActionHash` 不能作为后端事实。金额、记录状态、接收人、命令版本等影响授权结果的字段都要由后端重读并按固定字段顺序计算。票据消费成功不代替菜单/表权限、行级规则、幂等键或数据库事务。

## 四、租户系统设置与安全边界

数据库、Redis、MongoDB、MinIO、MQ 等部署级连接仍放在主控数据库的 `sys_osclients`，子租户不能修改。需要浏览器读取的登录入口显示、品牌文字等公开配置在当前租户 `sys_config` 创建实体字段；OAuth 开关、ClientId/ClientSecret 等后端私密配置放在当前租户的 `mci_system_setting`，由【系统设置 → 登录与身份】关联维护，不新增 API 环境变量或 `appsettings` 节点。

两张表的边界固定，不允许用运行时勾选把私密记录临时公开：

- `sys_config` 的实体字段进入前端 `SysConfig` 安全投影；不存在 `PublicSettings` 包装层。
- `mci_system_setting.IsPublic` 是停用的历史兼容字段，所有普通值与 Secret 都仅供后端，任何记录都不会进入浏览器。
- Secret 只通过可信后端写入租户绑定的认证密文，列表永远掩码。临时显示原文必须先完成 Passkey、TOTP 或严格人脸二次验证；响应使用 `no-store`，30 秒后前端清除，审计不记录原文。
- 前端 V8、普通 FormEngine HTTP、匿名请求和访问密钥会话不能读取私密设置。后端接口引擎/后端 V8 事件从当前租户 `V8.SysConfig.ServerPrivateSettings[ConfigKey]` 使用普通私密值或 Secret，但不得回传、记录或写入前端可读数据；ClientSecret 从不进入浏览器。

登录与身份常用设置如下：

| Key | 类型/可见性 | 说明 | 默认值 |
|---|---|---|---|
| `Login.Identity.Enabled` | Bool / 服务端私有 | 登录方式总开关 | `true` |
| `Login.Passkey.Enabled` | Bool / 服务端私有 | Passkey/WebAuthn | `true` |
| `Login.Authenticator.Enabled` | Bool / 服务端私有 | TOTP Authenticator | `true` |
| `Security.PasswordChange.RequireStepUp` | Bool / 服务端私有 | 已有强因子时改密需二次验证 | `true` |
| `Login.External.Enabled` | Bool / 服务端私有 | 第三方登录总开关 | `true` |
| `Login.Face.Enabled` | Bool / 服务端私有 | 严格人脸入口 | `false` |
| `Login.Gitee.Enabled` / `Login.WeChat.Enabled` / `Login.GitHub.Enabled` | Bool / 服务端私有 | 对应外部登录能力 | `false` |
| `sys_config.LoginPasskeyDisplay` 等五个实体字段 | Bool / 浏览器公开 | 登录页入口是否显示；缺失或空值默认显示 | `1` |
| `Login.{Provider}.ClientId` | String / 服务端私有 | OAuth 应用 ClientId | 无 |
| `Login.{Provider}.ClientSecret` | String / Secret | OAuth 应用 ClientSecret | 无 |
| `Login.{Provider}.Name` / `.Description` / `.Scope` | String / 服务端私有 | 名称、简介和授权 Scope | 平台安全默认值 |

`{Provider}` 目前支持 `Gitee`、`WeChat`、`GitHub`。回调地址由后端按当前 API 域名固定生成：`/api/ExternalLogin/Callback?OsClient={租户}&Provider={Provider}`，应把【开始授权】接口返回的 `CallbackUrl` 原样登记到第三方平台。生产环境必须使用 HTTPS；`localhost` 仅用于受控开发。RP ID、Origin 或第三方回调域名配错时，浏览器/供应商会正确拒绝验证。

官方应用商城 `app.microi.saas-engine` 会幂等安装身份表、动态设置表、外部身份表、默认设置、个人中心和租户系统设置微服务。默认行使用 `InsertIfMissing + ConfigKey`：老租户升级后自动看见功能，租户后来明确保存的值不会被下一次升级覆盖。为了兼容旧配置，默认行仍允许历史 `sys_osclients` 身份开关在租户首次保存新设置前生效；一旦保存，`ValueSource=Tenant` 的租户值成为事实源。

## 五、平台数据

应用包创建六张 `mci_` 平台安全/配置表：

- `mci_identity_credential`：用户公钥凭据、凭据哈希、签名计数、认证器信息、状态和最后使用时间。
- `mci_identity_device`：凭据与设备摘要、可信状态和最后在线信息。
- `mci_identity_face`：人脸供应商、不透明主体引用、登记和验证状态；不保存人脸原图或模板。
- `mci_identity_totp`：认证加密后的 TOTP 密钥、用途策略、最近接受计数器和状态；列表、日志和 API 不返回明文密钥。
- `mci_system_setting`：当前租户后端私密业务设置、Secret 密文、来源和排序；不保存公开配置或部署级连接配置。
- `mci_user_external_identity`：吾码用户与 Gitee/微信/GitHub 不透明主体标识的绑定；不会保存第三方 access token。

`CredentialIdHash` 必须有唯一索引，登记还会使用租户隔离的分布式租约；唯一约束与幂等检查共同防止双节点重复登记。challenge 保存到共享 Redis 五分钟，敏感操作票据保存两分钟并使用原子 `GETDEL` 消费，不能用进程内字典代替。

## 六、HTTP API

统一前缀为 `/api/IdentityVerification/`：

- `GetCapabilities`：读取租户能力；匿名只返回开关，登录用户额外返回本人是否已登记因子。
- `BeginPasskeyRegistration` / `CompletePasskeyRegistration`：登记 Passkey，要求普通 DiyToken 登录会话。
- `BeginPasskeyAuthentication` / `CompletePasskeyAuthentication`：登录或步进验证。
- `ListAuthenticators` / `RenameAuthenticator` / `RevokeAuthenticator`：管理本人凭据。
- `UpdateAuthenticatorPolicy`：分别控制某个 Passkey/TOTP 是否允许免密码登录、是否允许二次授权。
- `BeginTotpEnrollment` / `CompleteTotpEnrollment` / `ListTotpAuthenticators` / `RevokeTotpAuthenticator`：登记和管理 Authenticator。
- `VerifyTotp`：用于账号 + 动态口令登录或签发敏感操作一次性票据。
- `BeginFaceVerification` / `CompleteFaceVerification`：创建严格人脸会话并轮询完成。

外部登录使用 `/api/ExternalLogin/`：

- `Begin` / `Callback` / `CompleteLogin`：创建一次性 OAuth state、接收固定供应商回调并换取 DiyToken。
- `ListBindings` / `RevokeBinding`：列出和撤销当前用户自己的外部身份绑定。

租户动态设置使用 `/api/TenantSystemSettings/`：匿名只允许 `GetPublic`；管理员可 `List`、`Save`、`Delete`，Secret 原文还必须通过 `GetRevealChallenge` + `Reveal` 完成一次性步进验证。

业务页面优先使用 `V8.Identity` 或平台个人中心，不要自行拼接 WebAuthn 二进制结构。后端业务统一调用 `V8.Method.ConsumeIdentityVerificationTicket`，不要新增“验证成功布尔值”或可重复使用的自定义 Token。

## 七、Microi Face Gateway v1

核心平台只依赖最小协议：

```http
POST {FaceApiBase}/v1/verification/sessions
Authorization: Bearer {FaceApiKey}
Content-Type: application/json
```

请求包含 `TenantReference`、`SubjectReference`、`Mode`（`Enroll` / `Verify`）、`Purpose`、`ReturnUrl` 和 `RequestId`。响应返回 `SessionId` 与 HTTPS `SessionUrl`。

```http
GET {FaceApiBase}/v1/verification/sessions/{SessionId}
Authorization: Bearer {FaceApiKey}
```

完成响应至少返回 `Status`/`Verified` 与相同的 `SubjectReference`。吾码会拒绝主体不一致、非 HTTPS 或越过配置网关域名的会话地址。供应商回调、活体策略、留存期限、未成年人/敏感个人信息同意和地区合规由部署方按业务所在地落实。

## 八、启用顺序与验收

1. 更新后端并确认自动升级已成功导入 `app.microi.saas-engine`；或在应用商城手动更新“SaaS引擎”，回读六张表、默认设置、索引和 `microi-platform-service` 版本。
2. Passkey 与 TOTP 默认开启；登录页【登录方式】应能展示已启用方式。生产环境建议显式配置 Passkey RP ID/Origins；需要严格人脸时再配置网关。
3. 在【个人中心 → 身份验证器】登记 Passkey/TOTP，并逐个决定是否允许免密码登录、二次授权；至少保留两个恢复因子或管理员重置路径。
4. 如需外部登录，在【系统设置 → 登录与身份】配置 Provider 开关、ClientId、ClientSecret 和可选 Scope，先在个人中心绑定，再从退出后的登录页完成真实授权。
5. 验证 PC 和手机登录、本人改密、用途策略切换、凭据/外部绑定撤销、TOTP 重放、OAuth state 重放、重复票据、过期票据、跨用户/跨租户票据。
6. 多节点同时完成同一登记/绑定、验证中断、Redis 短暂故障和滚动升级；断言凭据/外部主体唯一、票据最多消费一次、DiyToken 权限不扩大。
7. 最后再启用严格人脸，并完成真实供应商/活体检测和隐私合规验收。

浏览器虚拟认证器可以验证 WebAuthn 协议和页面流程，但不能宣称通过了真实 Windows Hello、Face ID、指纹硬件或第三方活体检测；这些必须在目标设备和供应商环境单独验收。
