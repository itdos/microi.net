# 🛡️ Passkey、设备生物识别与严格人脸验证

Microi 吾码的身份验证增强方案采用“**DiyToken 会话与权限体系 + WebAuthn/Passkey 身份证明 + 可选严格人脸网关 + 一次性步进验证票据**”。它不会用 ASP.NET Identity 替换 DiyToken，也不会把指纹、人脸模板或登录权限判断放到前端。

## 一、选型与是否需要额外 Docker

| 能力 | 主流实现 | 吾码中的用途 | 是否需要额外 Docker |
|---|---|---|---|
| Windows Hello、Touch ID、Face ID、Android 屏幕锁 | WebAuthn / Passkey | 登录、改密确认、敏感操作二次验证 | **不需要**。浏览器调用系统认证器，API 只保存公钥凭据 |
| USB/NFC 安全密钥 | WebAuthn / FIDO2 | 无密码登录、高安全岗位 | **不需要** |
| 服务端严格人脸 + 活体检测 | `Microi Face Gateway v1` 对接云厂商或私有模型服务 | 必须由服务端统一判定的人脸场景 | **通常需要独立服务**；可以是云 API 网关，也可以是额外 Docker/集群 |

因此，绝大多数“用本机人脸/指纹登录吾码”的需求优先使用 Passkey，不需要像本地 OCR 那样加载模型容器。只有业务明确要求“服务端保存人脸主体、活体检测、跨设备统一比对”时，才部署或采购严格人脸服务。核心 API 节点不加载人脸模型，避免每个节点重复占用 GPU/内存。

吾码服务端使用 [Fido2NetLib](https://github.com/passwordless-lib/fido2-net-lib) 验证 WebAuthn 证明。浏览器只把签名结果交给后端；Windows Hello、Face ID 等生物数据仍由操作系统安全区掌管，不会上传到吾码。

## 二、DiyToken 是会话与权限单一事实源

Passkey 和严格人脸只回答“当前用户是否完成了足够强的身份验证”。验证成功后：

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

### 2. 修改密码

个人设置先按 `用户Id + 编码后的新密码` 计算操作摘要，再完成 Passkey 或严格人脸验证。后端重新计算同一摘要并原子消费票据；票据与当前租户、用户、用途和摘要任一项不符都会拒绝。

已经登记强因子的用户必须完成步进验证；没有登记任何因子的存量用户继续执行原密码校验，避免升级后把自己锁在系统外。管理员重置他人密码属于独立的控制面授权，不复用“本人改密”票据。

### 3. 自定义特殊场景

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
  Method: 'Auto' // Auto | Passkey | Face
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

## 四、SaaS 配置

配置统一位于 `sys_osclients` 的【身份验证】Tab，不新增 API 环境变量或 `appsettings` 节点：

| 字段 | 说明 | 建议默认值 |
|---|---|---|
| `IdentityVerificationEnabled` | 身份验证增强总开关 | `0`，完成表和域名配置后再启用 |
| `PasskeyEnabled` | Passkey/WebAuthn | `1` |
| `FaceVerificationEnabled` | 严格人脸网关 | `0` |
| `RequirePasswordChangeStepUp` | 已有强因子时改密需二次验证 | `1` |
| `PasskeyRpId` | WebAuthn RP ID，通常为前端主域名 | 留空时按请求安全解析 |
| `PasskeyOrigins` | 允许的完整 Origin 列表 | 生产环境显式配置 HTTPS Origin |
| `FaceProvider` | 网关供应商标识 | `MicroiFaceGatewayV1` |
| `FaceApiBase` | 严格人脸网关 HTTPS 根地址 | 留空表示未配置 |
| `FaceApiKey` | 网关密钥 | 敏感字段；不注入 V8、客户端或子租户复制 |

旧租户缺少身份验证字段时总开关按关闭处理。生产环境必须使用 HTTPS；`localhost` 仅用于受控开发。RP ID 或 Origin 配错会导致浏览器正确地拒绝凭据。

## 五、平台数据

应用包创建三张 `mci_` 平台安全表：

- `mci_identity_credential`：用户公钥凭据、凭据哈希、签名计数、认证器信息、状态和最后使用时间。
- `mci_identity_device`：凭据与设备摘要、可信状态和最后在线信息。
- `mci_identity_face`：人脸供应商、不透明主体引用、登记和验证状态；不保存人脸原图或模板。

`CredentialIdHash` 必须有唯一索引，登记还会使用租户隔离的分布式租约；唯一约束与幂等检查共同防止双节点重复登记。challenge 保存到共享 Redis 五分钟，敏感操作票据保存两分钟并使用原子 `GETDEL` 消费，不能用进程内字典代替。

## 六、HTTP API

统一前缀为 `/api/IdentityVerification/`：

- `GetCapabilities`：读取租户能力；匿名只返回开关，登录用户额外返回本人是否已登记因子。
- `BeginPasskeyRegistration` / `CompletePasskeyRegistration`：登记 Passkey，要求普通 DiyToken 登录会话。
- `BeginPasskeyAuthentication` / `CompletePasskeyAuthentication`：登录或步进验证。
- `ListAuthenticators` / `RenameAuthenticator` / `RevokeAuthenticator`：管理本人凭据。
- `BeginFaceVerification` / `CompleteFaceVerification`：创建严格人脸会话并轮询完成。

业务页面优先使用 `V8.Identity` 或平台个人设置页，不要自行拼接 WebAuthn 二进制结构。后端业务统一调用 `V8.Method.ConsumeIdentityVerificationTicket`，不要新增“验证成功布尔值”或可重复使用的自定义 Token。

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

1. 先安装/更新包含三张表、索引和 SaaS 字段的官方应用包，并回读物理表、元数据和索引。
2. 配置生产域名、`PasskeyRpId` 和 `PasskeyOrigins`；需要严格人脸时再配置网关。
3. 先在测试租户启用 Passkey，登记至少两个恢复因子或保留管理员重置路径。
4. 验证 PC 和手机登录、本人改密、凭据撤销、重复票据、过期票据、跨用户/跨租户票据。
5. 多节点同时完成同一登记、验证中断、Redis 短暂故障和滚动升级；断言凭据唯一、票据最多消费一次、DiyToken 权限不扩大。
6. 最后再启用严格人脸，并完成真实供应商/活体检测和隐私合规验收。

浏览器虚拟认证器可以验证 WebAuthn 协议和页面流程，但不能宣称通过了真实 Windows Hello、Face ID、指纹硬件或第三方活体检测；这些必须在目标设备和供应商环境单独验收。
