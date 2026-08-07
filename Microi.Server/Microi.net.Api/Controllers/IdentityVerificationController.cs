using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Fido2NetLib;
using Fido2NetLib.Objects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net.Api
{
    /// <summary>
    /// DiyToken 的强身份验证扩展：Passkey/设备生物识别、严格人脸网关和一次性二次认证票据。
    /// WebAuthn 只验证公钥凭据；成功登录后仍由 DiyToken 生成平台 Token。
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public sealed class IdentityVerificationController : Controller
    {
        private const string CredentialTable = "mci_identity_credential";
        private const string TotpTable = "mci_identity_totp";
        private const string DeviceTable = "mci_identity_device";
        private const string FaceTable = "mci_identity_face";
        private static readonly TimeSpan ChallengeLifetime = TimeSpan.FromMinutes(5);
        private readonly IHttpClientFactory _httpClientFactory;

        public IdentityVerificationController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public sealed class BeginPasskeyRegistrationRequest
        {
            public string DeviceName { get; set; }
        }

        public sealed class CompletePasskeyRegistrationRequest
        {
            public string ChallengeId { get; set; }
            public JObject Response { get; set; }
            public string DeviceName { get; set; }
            public string Did { get; set; }
        }

        public sealed class BeginAuthenticationRequest
        {
            public string OsClient { get; set; }
            public string Account { get; set; }
            public string Purpose { get; set; } = "Login";
            public string ActionHash { get; set; }
        }

        public sealed class CompleteAuthenticationRequest
        {
            public string OsClient { get; set; }
            public string ChallengeId { get; set; }
            public JObject Response { get; set; }
            public string Did { get; set; }
            public string _ClientType { get; set; }
        }

        public sealed class AuthenticatorMutationRequest
        {
            public string Id { get; set; }
            public string DeviceName { get; set; }
        }

        public sealed class AuthenticatorPolicyRequest
        {
            public string Id { get; set; }
            public string Type { get; set; }
            public bool AllowPasswordlessLogin { get; set; }
            public bool AllowStepUp { get; set; }
        }

        public sealed class CompleteTotpEnrollmentRequest
        {
            public string ChallengeId { get; set; }
            public string Code { get; set; }
            public string DeviceName { get; set; }
            public bool AllowPasswordlessLogin { get; set; } = true;
            public bool AllowStepUp { get; set; } = true;
        }

        public sealed class VerifyTotpRequest
        {
            public string OsClient { get; set; }
            public string Account { get; set; }
            public string Code { get; set; }
            public string Purpose { get; set; } = "Login";
            public string ActionHash { get; set; }
            public string Did { get; set; }
            public string _ClientType { get; set; }
        }

        public sealed class BeginFaceRequest
        {
            public string OsClient { get; set; }
            public string Account { get; set; }
            public string Purpose { get; set; } = "Login";
            public string ActionHash { get; set; }
            public string Mode { get; set; } = "Verify";
            public string ReturnUrl { get; set; }
        }

        public sealed class CompleteFaceRequest
        {
            public string OsClient { get; set; }
            public string ChallengeId { get; set; }
            public string Did { get; set; }
            public string _ClientType { get; set; }
        }

        private sealed class ChallengeState
        {
            public string Type { get; set; }
            public string OsClient { get; set; }
            public string UserId { get; set; }
            public string Account { get; set; }
            public string UserName { get; set; }
            public string Purpose { get; set; }
            public string ActionHash { get; set; }
            public string RelyingPartyId { get; set; }
            public string Origin { get; set; }
            public string OptionsJson { get; set; }
            public string DeviceName { get; set; }
            public string FaceMode { get; set; }
            public string ProviderSessionId { get; set; }
            public string ProviderSubjectReference { get; set; }
            public string TotpSecretCipher { get; set; }
            public string CreatedAt { get; set; }
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> GetCapabilities([FromBody] BeginAuthenticationRequest request)
        {
            var osClientResult = await ResolveOsClientAsync(request?.OsClient, allowAnonymous: true).ConfigureAwait(false);
            if (osClientResult.Code != 1) return Json(osClientResult);
            var osClient = osClientResult.Data;
            var options = IdentityVerificationOptions.Resolve(osClient);
            var hasPasskey = false;
            var hasPasswordlessPasskey = false;
            var hasStepUpPasskey = false;
            var hasTotp = false;
            var hasPasswordlessTotp = false;
            var hasStepUpTotp = false;
            var hasFace = false;
            try
            {
                var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
                if (currentToken?.CurrentUser != null
                    && string.Equals(currentToken.OsClient, osClient, StringComparison.OrdinalIgnoreCase)
                    && !UserAccessKeySecurity.IsSession(currentToken.CurrentUser))
                {
                    var userId = currentToken.CurrentUser["Id"]?.ToString();
                    var credentials = await ListCredentialsByUserAsync(osClient, userId).ConfigureAwait(false);
                    hasPasskey = credentials.Count > 0;
                    hasPasswordlessPasskey = credentials.Any(item => PolicyEnabled(item, "AllowPasswordlessLogin"));
                    hasStepUpPasskey = credentials.Any(item => PolicyEnabled(item, "AllowStepUp"));
                    var totp = await FindTotpByUserAsync(osClient, userId).ConfigureAwait(false);
                    hasTotp = totp != null;
                    hasPasswordlessTotp = totp != null && PolicyEnabled(totp, "AllowPasswordlessLogin");
                    hasStepUpTotp = totp != null && PolicyEnabled(totp, "AllowStepUp");
                    hasFace = await FindFaceBindingAsync(osClient, userId).ConfigureAwait(false) != null;
                }
            }
            catch { }
            var externalProviders = ExternalLoginProviderCatalog.Resolve(osClient)
                .OrderBy(item => item.Sort)
                .Select(item => new
                {
                    item.Key,
                    item.Name,
                    item.Description,
                    item.Kind,
                    item.Icon,
                    item.Enabled,
                    Configured = item.Configured,
                    Available = item.Configured
                })
                .ToArray();
            return Json(new DosResult(1, new
            {
                Enabled = options.Enabled,
                PasskeyEnabled = options.Enabled && options.PasskeyEnabled,
                TotpEnabled = options.Enabled && options.TotpEnabled,
                FaceEnabled = options.Enabled && options.FaceEnabled && !options.FaceApiBase.DosIsNullOrWhiteSpace(),
                PasswordChangeStepUp = options.RequirePasswordChangeStepUp,
                PasskeyRequiresSecureContext = true,
                SessionSystem = "DiyToken",
                StoresBiometricImages = false,
                HasPasskey = hasPasskey,
                HasPasswordlessPasskey = hasPasswordlessPasskey,
                HasStepUpPasskey = hasStepUpPasskey,
                HasTotp = hasTotp,
                HasPasswordlessTotp = hasPasswordlessTotp,
                HasStepUpTotp = hasStepUpTotp,
                HasFace = hasFace,
                ExternalProviders = externalProviders
            }));
        }

        [HttpPost]
        public async Task<JsonResult> BeginPasskeyRegistration([FromBody] BeginPasskeyRegistrationRequest request)
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var currentToken = token.Data;
            var options = IdentityVerificationOptions.Resolve(currentToken.OsClient);
            if (!options.Enabled || !options.PasskeyEnabled)
                return Json(new DosResult(0, null, "当前租户未启用 Passkey。"));

            try
            {
                var origin = ResolveRequestOrigin(options);
                var rpId = ResolveRelyingPartyId(options, origin);
                var userId = currentToken.CurrentUser["Id"]?.ToString();
                var account = currentToken.CurrentUser["Account"]?.ToString() ?? userId;
                var userName = currentToken.CurrentUser["Name"]?.ToString() ?? account;
                var credentials = await ListCredentialsByUserAsync(currentToken.OsClient, userId).ConfigureAwait(false);
                var descriptors = credentials.Select(ToDescriptor).ToList();
                var fido = CreateFido(rpId, userName, origin);
                var publicKey = fido.RequestNewCredential(new RequestNewCredentialParams
                {
                    User = new Fido2User
                    {
                        Id = Encoding.UTF8.GetBytes(userId),
                        Name = account,
                        DisplayName = userName
                    },
                    ExcludeCredentials = descriptors,
                    AuthenticatorSelection = new AuthenticatorSelection
                    {
                        ResidentKey = ResidentKeyRequirement.Required,
                        UserVerification = UserVerificationRequirement.Required
                    },
                    AttestationPreference = AttestationConveyancePreference.None,
                    Extensions = new AuthenticationExtensionsClientInputs { CredProps = true }
                });
                var state = new ChallengeState
                {
                    Type = "PasskeyRegistration",
                    OsClient = currentToken.OsClient,
                    UserId = userId,
                    Account = account,
                    UserName = userName,
                    Purpose = "RegisterPasskey",
                    RelyingPartyId = rpId,
                    Origin = origin,
                    OptionsJson = publicKey.ToJson(),
                    DeviceName = NormalizeDeviceName(request?.DeviceName),
                    CreatedAt = DateTimeOffset.UtcNow.ToString("O")
                };
                var challengeId = await StoreChallengeAsync(state).ConfigureAwait(false);
                return Json(new DosResult(1, new
                {
                    ChallengeId = challengeId,
                    PublicKey = JObject.Parse(publicKey.ToJson()),
                    ExpiresInSeconds = (int)ChallengeLifetime.TotalSeconds
                }));
            }
            catch (Exception ex)
            {
                QueueAudit(currentToken.OsClient, currentToken.CurrentUser, "BeginPasskeyRegistration", false, ex.Message);
                return Json(new DosResult(0, null, "创建 Passkey 登记请求失败：" + SafeMessage(ex)));
            }
        }

        [HttpPost]
        public async Task<JsonResult> CompletePasskeyRegistration(
            [FromBody] CompletePasskeyRegistrationRequest request,
            CancellationToken cancellationToken)
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var currentToken = token.Data;
            var stateResult = await ConsumeChallengeAsync(currentToken.OsClient, request?.ChallengeId).ConfigureAwait(false);
            if (stateResult.Code != 1) return Json(stateResult);
            var state = stateResult.Data;
            if (state.Type != "PasskeyRegistration"
                || !string.Equals(state.UserId, currentToken.CurrentUser["Id"]?.ToString(), StringComparison.Ordinal))
            {
                return Json(new DosResult(0, null, "Passkey 登记请求与当前用户不匹配。"));
            }

            try
            {
                var response = DeserializeFido<AuthenticatorAttestationRawResponse>(request.Response);
                var fido = CreateFido(state.RelyingPartyId, state.UserName, state.Origin);
                var originalOptions = CredentialCreateOptions.FromJson(state.OptionsJson);
                var credential = await fido.MakeNewCredentialAsync(new MakeNewCredentialParams
                {
                    AttestationResponse = response,
                    OriginalOptions = originalOptions,
                    IsCredentialIdUniqueToUserCallback = async (args, _) =>
                        await FindCredentialByIdAsync(state.OsClient, args.CredentialId).ConfigureAwait(false) == null
                }, cancellationToken).ConfigureAwait(false);

                var deviceName = NormalizeDeviceName(request?.DeviceName);
                if (deviceName.Length == 0) deviceName = state.DeviceName;
                if (deviceName.Length == 0) deviceName = "我的 Passkey";
                var saveResult = await SaveCredentialAsync(
                    state,
                    credential,
                    deviceName,
                    request?.Did,
                    cancellationToken).ConfigureAwait(false);
                if (saveResult.Code != 1) return Json(saveResult);
                QueueAudit(state.OsClient, currentToken.CurrentUser, "RegisterPasskey", true, saveResult.Data?.ToString());
                return Json(new DosResult(1, saveResult.Data, "Passkey 登记成功。"));
            }
            catch (Exception ex)
            {
                QueueAudit(state.OsClient, currentToken.CurrentUser, "RegisterPasskey", false, ex.Message);
                return Json(new DosResult(0, null, "Passkey 登记失败：" + SafeMessage(ex)));
            }
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> BeginPasskeyAuthentication([FromBody] BeginAuthenticationRequest request)
        {
            var purpose = "";
            try
            {
                purpose = IdentityVerificationSecurity.NormalizePurpose(request?.Purpose ?? "Login");
                var isLogin = string.Equals(purpose, "Login", StringComparison.Ordinal);
                var osClientResult = await ResolveOsClientAsync(request?.OsClient, allowAnonymous: isLogin).ConfigureAwait(false);
                if (osClientResult.Code != 1) return Json(osClientResult);
                var osClient = osClientResult.Data;
                var options = IdentityVerificationOptions.Resolve(osClient);
                if (!options.Enabled || !options.PasskeyEnabled)
                    return Json(new DosResult(0, null, "当前租户未启用 Passkey。"));

                string userId;
                string account;
                string userName;
                if (isLogin)
                {
                    var user = await FindEnabledUserByAccountAsync(osClient, request?.Account).ConfigureAwait(false);
                    userId = user?["Id"]?.ToString() ?? "";
                    account = user?["Account"]?.ToString() ?? (request?.Account ?? "").Trim();
                    userName = user?["Name"]?.ToString() ?? account;
                }
                else
                {
                    var token = await RequireUserTokenAsync().ConfigureAwait(false);
                    if (token.Code != 1) return Json(token);
                    if (!string.Equals(token.Data.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
                        return Json(new DosResult(0, null, "禁止跨租户发起身份验证。"));
                    userId = token.Data.CurrentUser["Id"]?.ToString();
                    account = token.Data.CurrentUser["Account"]?.ToString();
                    userName = token.Data.CurrentUser["Name"]?.ToString() ?? account;
                }

                var actionHash = IdentityVerificationSecurity.NormalizeActionHash(request?.ActionHash, !isLogin);
                var credentials = userId.DosIsNullOrWhiteSpace()
                    ? new List<JObject>()
                    : await ListCredentialsByUserAsync(osClient, userId).ConfigureAwait(false);
                credentials = credentials
                    .Where(item => PolicyEnabled(item, isLogin ? "AllowPasswordlessLogin" : "AllowStepUp"))
                    .ToList();
                var origin = ResolveRequestOrigin(options);
                var rpId = ResolveRelyingPartyId(options, origin);
                var fido = CreateFido(rpId, userName.DosIsNullOrWhiteSpace() ? "Microi" : userName, origin);
                var publicKey = fido.GetAssertionOptions(new GetAssertionOptionsParams
                {
                    AllowedCredentials = credentials.Select(ToDescriptor).ToList(),
                    UserVerification = UserVerificationRequirement.Required,
                    Extensions = new AuthenticationExtensionsClientInputs { Extensions = true }
                });
                var challengeId = await StoreChallengeAsync(new ChallengeState
                {
                    Type = "PasskeyAuthentication",
                    OsClient = osClient,
                    UserId = userId,
                    Account = account,
                    UserName = userName,
                    Purpose = purpose,
                    ActionHash = actionHash,
                    RelyingPartyId = rpId,
                    Origin = origin,
                    OptionsJson = publicKey.ToJson(),
                    CreatedAt = DateTimeOffset.UtcNow.ToString("O")
                }).ConfigureAwait(false);
                return Json(new DosResult(1, new
                {
                    ChallengeId = challengeId,
                    PublicKey = JObject.Parse(publicKey.ToJson()),
                    ExpiresInSeconds = (int)ChallengeLifetime.TotalSeconds
                }));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "创建 Passkey 验证请求失败：" + SafeMessage(ex)));
            }
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> CompletePasskeyAuthentication(
            [FromBody] CompleteAuthenticationRequest request,
            CancellationToken cancellationToken)
        {
            var osClientResult = await ResolveOsClientAsync(request?.OsClient, allowAnonymous: true).ConfigureAwait(false);
            if (osClientResult.Code != 1) return Json(osClientResult);
            var stateResult = await ConsumeChallengeAsync(osClientResult.Data, request?.ChallengeId).ConfigureAwait(false);
            if (stateResult.Code != 1) return Json(stateResult);
            var state = stateResult.Data;
            if (state.Type != "PasskeyAuthentication")
                return Json(new DosResult(0, null, "Passkey 验证请求类型无效。"));

            try
            {
                var response = DeserializeFido<AuthenticatorAssertionRawResponse>(request.Response);
                var stored = await FindCredentialByIdAsync(state.OsClient, response.RawId).ConfigureAwait(false);
                if (stored == null) return Json(new DosResult(0, null, "Passkey 不存在或已被撤销。"));
                var isLogin = string.Equals(state.Purpose, "Login", StringComparison.Ordinal);
                if (!PolicyEnabled(stored, isLogin ? "AllowPasswordlessLogin" : "AllowStepUp"))
                    return Json(new DosResult(0, null, isLogin
                        ? "该 Passkey 未开启免密码登录。"
                        : "该 Passkey 未开启二次授权验证。"));
                var credentialUserId = stored["UserId"]?.ToString();
                if (!state.UserId.DosIsNullOrWhiteSpace()
                    && !string.Equals(state.UserId, credentialUserId, StringComparison.Ordinal))
                {
                    return Json(new DosResult(0, null, "Passkey 与请求账号不匹配。"));
                }

                var originalOptions = AssertionOptions.FromJson(state.OptionsJson);
                var fido = CreateFido(state.RelyingPartyId, state.UserName, state.Origin);
                var result = await fido.MakeAssertionAsync(new MakeAssertionParams
                {
                    AssertionResponse = response,
                    OriginalOptions = originalOptions,
                    StoredPublicKey = Convert.FromBase64String(stored["PublicKey"]?.ToString() ?? ""),
                    StoredSignatureCounter = stored["SignCount"]?.Value<uint>() ?? 0,
                    IsUserHandleOwnerOfCredentialIdCallback = (args, _) => Task.FromResult(
                        string.Equals(
                            stored["UserHandle"]?.ToString(),
                            Convert.ToBase64String(args.UserHandle ?? Array.Empty<byte>()),
                            StringComparison.Ordinal)
                        && CryptographicOperations.FixedTimeEquals(args.CredentialId, response.RawId))
                }, cancellationToken).ConfigureAwait(false);

                await TouchCredentialAsync(state.OsClient, stored, result, request?.Did, HttpContext).ConfigureAwait(false);
                var user = await GetEnabledUserForTokenAsync(state.OsClient, credentialUserId).ConfigureAwait(false);
                if (user == null) return Json(new DosResult(0, null, "系统用户不存在或已停用。"));
                QueueAudit(state.OsClient, user, "PasskeyVerified", true, stored["Id"]?.ToString());

                if (isLogin)
                {
                    return await CreateDiyTokenLoginResultAsync(
                        state.OsClient,
                        user,
                        request?._ClientType,
                        request?.Did,
                        "PasskeyOrBiometric").ConfigureAwait(false);
                }

                var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
                if (currentToken?.CurrentUser == null
                    || !string.Equals(currentToken.OsClient, state.OsClient, StringComparison.OrdinalIgnoreCase)
                    || !string.Equals(currentToken.CurrentUser["Id"]?.ToString(), credentialUserId, StringComparison.Ordinal))
                {
                    Response.StatusCode = 401;
                    return Json(new DosResult(1001, null, "当前登录身份与 Passkey 用户不匹配。"));
                }
                var ticket = await IdentityVerificationSecurity.IssueTicketAsync(
                    state.OsClient,
                    credentialUserId,
                    state.Purpose,
                    state.ActionHash,
                    "Passkey",
                    stored["Id"]?.ToString(),
                    request?.Did).ConfigureAwait(false);
                return Json(ticket);
            }
            catch (Exception ex)
            {
                QueueAudit(state.OsClient, null, "PasskeyVerified", false, ex.Message);
                return Json(new DosResult(0, null, "Passkey 验证失败：" + SafeMessage(ex)));
            }
        }

        [HttpPost]
        public async Task<JsonResult> ListAuthenticators()
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var userId = token.Data.CurrentUser["Id"]?.ToString();
            var credentials = await ListCredentialsByUserAsync(token.Data.OsClient, userId).ConfigureAwait(false);
            var data = credentials.Select(item => new
            {
                Id = item["Id"]?.ToString(),
                DeviceName = item["DeviceName"]?.ToString(),
                AaGuid = item["AaGuid"]?.ToString(),
                Transports = (ParseTransports(item["Transports"]?.ToString()) ?? Array.Empty<AuthenticatorTransport>())
                    .Select(value => value.ToString())
                    .ToArray(),
                BackupEligible = item["BackupEligible"]?.Value<int>() == 1,
                BackedUp = item["BackedUp"]?.Value<int>() == 1,
                CreateTime = item["CreateTime"]?.ToString(),
                LastUsedTime = item["LastUsedTime"]?.ToString(),
                AllowPasswordlessLogin = PolicyEnabled(item, "AllowPasswordlessLogin"),
                AllowStepUp = PolicyEnabled(item, "AllowStepUp"),
                State = item["State"]?.Value<int>() ?? 0
            }).ToList();
            return Json(new DosResult(1, data));
        }

        [HttpPost]
        public async Task<JsonResult> RenameAuthenticator([FromBody] AuthenticatorMutationRequest request)
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var credential = await FindOwnedCredentialAsync(token.Data, request?.Id).ConfigureAwait(false);
            if (credential == null) return Json(new DosResult(0, null, "Passkey 不存在。"));
            var name = NormalizeDeviceName(request?.DeviceName);
            if (name.Length == 0) return Json(new DosResult(0, null, "设备名称不能为空。"));
            var result = await MicroiEngine.FormEngine.UptFormDataAsync(CredentialTable, new
            {
                Id = credential["Id"]?.ToString(), DeviceName = name, OsClient = token.Data.OsClient
            }).ConfigureAwait(false);
            return Json(result);
        }

        [HttpPost]
        public async Task<JsonResult> RevokeAuthenticator([FromBody] AuthenticatorMutationRequest request)
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var credential = await FindOwnedCredentialAsync(token.Data, request?.Id).ConfigureAwait(false);
            if (credential == null) return Json(new DosResult(0, null, "Passkey 不存在。"));
            var result = await MicroiEngine.FormEngine.UptFormDataAsync(CredentialTable, new
            {
                Id = credential["Id"]?.ToString(), State = 0, IsDeleted = 1, OsClient = token.Data.OsClient
            }).ConfigureAwait(false);
            QueueAudit(token.Data.OsClient, token.Data.CurrentUser, "RevokePasskey", result.Code == 1, credential["Id"]?.ToString());
            return Json(result);
        }

        [HttpPost]
        public async Task<JsonResult> UpdateAuthenticatorPolicy([FromBody] AuthenticatorPolicyRequest request)
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var type = (request?.Type ?? "").Trim();
            JObject authenticator;
            string table;
            if (string.Equals(type, "Passkey", StringComparison.OrdinalIgnoreCase))
            {
                authenticator = await FindOwnedCredentialAsync(token.Data, request?.Id).ConfigureAwait(false);
                table = CredentialTable;
            }
            else if (string.Equals(type, "Totp", StringComparison.OrdinalIgnoreCase))
            {
                authenticator = await FindOwnedTotpAsync(token.Data, request?.Id).ConfigureAwait(false);
                table = TotpTable;
            }
            else
            {
                return Json(new DosResult(0, null, "身份验证器类型无效。"));
            }
            if (authenticator == null) return Json(new DosResult(0, null, "身份验证器不存在或已撤销。"));
            var result = await MicroiEngine.FormEngine.UptFormDataAsync(table, new
            {
                Id = authenticator["Id"]?.ToString(),
                AllowPasswordlessLogin = request.AllowPasswordlessLogin ? 1 : 0,
                AllowStepUp = request.AllowStepUp ? 1 : 0,
                OsClient = token.Data.OsClient
            }).ConfigureAwait(false);
            QueueAudit(token.Data.OsClient, token.Data.CurrentUser, "UpdateAuthenticatorPolicy", result.Code == 1,
                $"{type}:{authenticator["Id"]}");
            return Json(result.Code == 1
                ? new DosResult(1, new
                {
                    Id = authenticator["Id"]?.ToString(),
                    Type = type,
                    request.AllowPasswordlessLogin,
                    request.AllowStepUp
                }, "身份验证用途已更新。")
                : result);
        }

        [HttpPost]
        public async Task<JsonResult> BeginTotpEnrollment()
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var options = IdentityVerificationOptions.Resolve(token.Data.OsClient);
            if (!options.Enabled || !options.TotpEnabled)
                return Json(new DosResult(0, null, "当前租户未启用 Authenticator 动态验证码。"));
            var userId = token.Data.CurrentUser["Id"]?.ToString();
            var account = token.Data.CurrentUser["Account"]?.ToString() ?? userId;
            var secret = IdentityVerificationSecurity.GenerateTotpSecret();
            var challengeId = await StoreChallengeAsync(new ChallengeState
            {
                Type = "TotpEnrollment",
                OsClient = token.Data.OsClient,
                UserId = userId,
                Account = account,
                UserName = token.Data.CurrentUser["Name"]?.ToString() ?? account,
                Purpose = "RegisterTotp",
                TotpSecretCipher = IdentityVerificationSecurity.ProtectTotpSecret(token.Data.OsClient, secret),
                CreatedAt = DateTimeOffset.UtcNow.ToString("O")
            }).ConfigureAwait(false);
            var issuer = options.TotpIssuer;
            var label = Uri.EscapeDataString($"{issuer}:{account}");
            var uri = $"otpauth://totp/{label}?secret={Uri.EscapeDataString(secret)}"
                + $"&issuer={Uri.EscapeDataString(issuer)}&algorithm=SHA1&digits=6&period=30";
            QueueAudit(token.Data.OsClient, token.Data.CurrentUser, "BeginTotpEnrollment", true, null);
            return Json(new DosResult(1, new
            {
                ChallengeId = challengeId,
                Secret = secret,
                OtpAuthUri = uri,
                Issuer = issuer,
                Account = account,
                ExpiresInSeconds = (int)ChallengeLifetime.TotalSeconds
            }));
        }

        [HttpPost]
        public async Task<JsonResult> CompleteTotpEnrollment([FromBody] CompleteTotpEnrollmentRequest request)
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var stateResult = await ConsumeChallengeAsync(token.Data.OsClient, request?.ChallengeId).ConfigureAwait(false);
            if (stateResult.Code != 1) return Json(stateResult);
            var state = stateResult.Data;
            if (state.Type != "TotpEnrollment"
                || !string.Equals(state.UserId, token.Data.CurrentUser["Id"]?.ToString(), StringComparison.Ordinal))
                return Json(new DosResult(0, null, "Authenticator 登记请求与当前用户不匹配。"));
            byte[] secret = null;
            try
            {
                secret = IdentityVerificationSecurity.UnprotectTotpSecret(state.OsClient, state.TotpSecretCipher);
                var counter = IdentityVerificationSecurity.FindMatchingTotpCounter(
                    secret, request?.Code, DateTimeOffset.UtcNow);
                if (counter < 0) return Json(new DosResult(0, null, "动态验证码不正确，请重新扫码登记。"));
                var existing = await FindTotpByUserAsync(state.OsClient, state.UserId).ConfigureAwait(false);
                var name = NormalizeDeviceName(request?.DeviceName);
                if (name.Length == 0) name = "Microsoft Authenticator";
                var model = new
                {
                    Id = existing?["Id"]?.ToString() ?? Guid.NewGuid().ToString(),
                    UserId = state.UserId,
                    UserName = state.UserName,
                    DeviceName = name,
                    SecretCipher = state.TotpSecretCipher,
                    SecretVersion = "totp-v1",
                    Issuer = IdentityVerificationOptions.Resolve(state.OsClient).TotpIssuer,
                    EnrolledTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    LastAcceptedCounter = counter,
                    AllowPasswordlessLogin = request?.AllowPasswordlessLogin == false ? 0 : 1,
                    AllowStepUp = request?.AllowStepUp == false ? 0 : 1,
                    State = 1,
                    IsDeleted = 0,
                    OsClient = state.OsClient
                };
                var result = existing == null
                    ? await MicroiEngine.FormEngine.AddFormDataAsync(TotpTable, model).ConfigureAwait(false)
                    : await MicroiEngine.FormEngine.UptFormDataAsync(TotpTable, model).ConfigureAwait(false);
                QueueAudit(state.OsClient, token.Data.CurrentUser, "RegisterTotp", result.Code == 1, model.Id);
                return Json(result.Code == 1
                    ? new DosResult(1, new
                    {
                        model.Id,
                        model.DeviceName,
                        AllowPasswordlessLogin = model.AllowPasswordlessLogin == 1,
                        AllowStepUp = model.AllowStepUp == 1
                    }, "Authenticator 登记成功。")
                    : result);
            }
            catch (Exception ex)
            {
                QueueAudit(state.OsClient, token.Data.CurrentUser, "RegisterTotp", false, ex.Message);
                return Json(new DosResult(0, null, "Authenticator 登记失败：" + SafeMessage(ex)));
            }
            finally
            {
                if (secret != null) CryptographicOperations.ZeroMemory(secret);
            }
        }

        [HttpPost]
        public async Task<JsonResult> ListTotpAuthenticators()
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var item = await FindTotpByUserAsync(token.Data.OsClient, token.Data.CurrentUser["Id"]?.ToString()).ConfigureAwait(false);
            return Json(new DosResult(1, item == null ? Array.Empty<object>() : new object[]
            {
                new
                {
                    Id = item["Id"]?.ToString(),
                    DeviceName = item["DeviceName"]?.ToString(),
                    Issuer = item["Issuer"]?.ToString(),
                    EnrolledTime = item["EnrolledTime"]?.ToString(),
                    LastUsedTime = item["LastUsedTime"]?.ToString(),
                    AllowPasswordlessLogin = PolicyEnabled(item, "AllowPasswordlessLogin"),
                    AllowStepUp = PolicyEnabled(item, "AllowStepUp"),
                    State = item["State"]?.Value<int>() ?? 0
                }
            }));
        }

        [HttpPost]
        public async Task<JsonResult> RevokeTotpAuthenticator([FromBody] AuthenticatorMutationRequest request)
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var item = await FindOwnedTotpAsync(token.Data, request?.Id).ConfigureAwait(false);
            if (item == null) return Json(new DosResult(0, null, "Authenticator 不存在。"));
            var result = await MicroiEngine.FormEngine.UptFormDataAsync(TotpTable, new
            {
                Id = item["Id"]?.ToString(), State = 0, IsDeleted = 1, SecretCipher = "", OsClient = token.Data.OsClient
            }).ConfigureAwait(false);
            QueueAudit(token.Data.OsClient, token.Data.CurrentUser, "RevokeTotp", result.Code == 1, item["Id"]?.ToString());
            return Json(result);
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> VerifyTotp([FromBody] VerifyTotpRequest request)
        {
            var purpose = IdentityVerificationSecurity.NormalizePurpose(request?.Purpose ?? "Login");
            var isLogin = string.Equals(purpose, "Login", StringComparison.Ordinal);
            var osClientResult = await ResolveOsClientAsync(request?.OsClient, allowAnonymous: isLogin).ConfigureAwait(false);
            if (osClientResult.Code != 1) return Json(osClientResult);
            var osClient = osClientResult.Data;
            var options = IdentityVerificationOptions.Resolve(osClient);
            if (!options.Enabled || !options.TotpEnabled)
                return Json(new DosResult(0, null, "当前租户未启用 Authenticator 动态验证码。"));
            if (!await AllowTotpAttemptAsync(osClient, request?.Account).ConfigureAwait(false))
                return Json(new DosResult(0, null, "验证尝试过于频繁，请稍后再试。"));

            CurrentToken currentToken = null;
            JObject user;
            if (isLogin)
            {
                user = await FindEnabledUserByAccountAsync(osClient, request?.Account).ConfigureAwait(false);
            }
            else
            {
                var token = await RequireUserTokenAsync().ConfigureAwait(false);
                if (token.Code != 1) return Json(token);
                currentToken = token.Data;
                if (!string.Equals(currentToken.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
                    return Json(new DosResult(0, null, "禁止跨租户发起身份验证。"));
                user = currentToken.CurrentUser;
            }
            var userId = user?["Id"]?.ToString();
            var item = await FindTotpByUserAsync(osClient, userId).ConfigureAwait(false);
            if (user == null || item == null || !PolicyEnabled(item, isLogin ? "AllowPasswordlessLogin" : "AllowStepUp"))
                return Json(new DosResult(0, null, "账号或动态验证码不正确，或该用途未启用。"));

            byte[] secret = null;
            try
            {
                secret = IdentityVerificationSecurity.UnprotectTotpSecret(osClient, item["SecretCipher"]?.ToString());
                var counter = IdentityVerificationSecurity.FindMatchingTotpCounter(
                    secret, request?.Code, DateTimeOffset.UtcNow);
                if (counter < 0) return Json(new DosResult(0, null, "账号或动态验证码不正确，或该用途未启用。"));
                var replayKey = $"Microi:{osClient}:IdentityVerification:TOTP:Replay:{item["Id"]}:{counter}";
                var accepted = await MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase()
                    .StringSetAsync(replayKey, "1", TimeSpan.FromSeconds(90), When.NotExists)
                    .ConfigureAwait(false);
                if (!accepted) return Json(new DosResult(0, null, "该动态验证码已使用，请等待下一组验证码。"));
                await MicroiEngine.FormEngine.UptFormDataAsync(TotpTable, new
                {
                    Id = item["Id"]?.ToString(),
                    LastAcceptedCounter = counter,
                    LastUsedTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    LastUsedIP = IPHelper.GetClientIP(HttpContext).Data,
                    OsClient = osClient
                }).ConfigureAwait(false);
                var tokenUser = await GetEnabledUserForTokenAsync(osClient, userId).ConfigureAwait(false);
                if (tokenUser == null) return Json(new DosResult(0, null, "系统用户不存在或已停用。"));
                QueueAudit(osClient, tokenUser, "TotpVerified", true, item["Id"]?.ToString());
                if (isLogin)
                    return await CreateDiyTokenLoginResultAsync(
                        osClient, tokenUser, request?._ClientType, request?.Did, "AuthenticatorTOTP").ConfigureAwait(false);
                var actionHash = IdentityVerificationSecurity.NormalizeActionHash(request?.ActionHash, true);
                return Json(await IdentityVerificationSecurity.IssueTicketAsync(
                    osClient, userId, purpose, actionHash, "AuthenticatorTOTP", item["Id"]?.ToString(), request?.Did)
                    .ConfigureAwait(false));
            }
            catch (Exception ex)
            {
                QueueAudit(osClient, user, "TotpVerified", false, ex.Message);
                return Json(new DosResult(0, null, "Authenticator 验证失败：" + SafeMessage(ex)));
            }
            finally
            {
                if (secret != null) CryptographicOperations.ZeroMemory(secret);
            }
        }

        /// <summary>
        /// 创建严格人脸核验会话。核心平台仅调用 Microi Face Gateway v1 协议并保存不透明主体引用，
        /// 人脸采集、活体检测和模板保管都由经选择的供应商/独立服务承担。
        /// </summary>
        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> BeginFaceVerification([FromBody] BeginFaceRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var purpose = IdentityVerificationSecurity.NormalizePurpose(request?.Purpose ?? "Login");
                var isLogin = string.Equals(purpose, "Login", StringComparison.Ordinal);
                var osClientResult = await ResolveOsClientAsync(request?.OsClient, allowAnonymous: isLogin).ConfigureAwait(false);
                if (osClientResult.Code != 1) return Json(osClientResult);
                var osClient = osClientResult.Data;
                var options = IdentityVerificationOptions.Resolve(osClient);
                if (!options.Enabled || !options.FaceEnabled || options.FaceApiBase.DosIsNullOrWhiteSpace())
                    return Json(new DosResult(0, null, "当前租户未配置严格人脸验证服务。"));

                var mode = string.Equals(request?.Mode, "Enroll", StringComparison.OrdinalIgnoreCase) ? "Enroll" : "Verify";
                JObject user;
                if (isLogin)
                {
                    if (mode == "Enroll") return Json(new DosResult(0, null, "登录前不能登记人脸。"));
                    user = await FindEnabledUserByAccountAsync(osClient, request?.Account).ConfigureAwait(false);
                }
                else
                {
                    var token = await RequireUserTokenAsync().ConfigureAwait(false);
                    if (token.Code != 1) return Json(token);
                    if (!string.Equals(token.Data.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
                        return Json(new DosResult(0, null, "禁止跨租户发起人脸验证。"));
                    user = token.Data.CurrentUser;
                }
                if (user == null) return Json(new DosResult(0, null, "无法创建人脸验证会话。"));
                var actionHash = IdentityVerificationSecurity.NormalizeActionHash(request?.ActionHash, !isLogin);
                var subjectReference = CreateFaceSubjectReference(osClient, user["Id"]?.ToString());
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(20);
                ApplyFaceAuthorization(client, options);
                var payload = new JObject
                {
                    ["TenantReference"] = IdentityVerificationSecurity.HashIdentifier(Encoding.UTF8.GetBytes(osClient)),
                    ["SubjectReference"] = subjectReference,
                    ["Mode"] = mode,
                    ["Purpose"] = purpose,
                    ["ReturnUrl"] = NormalizeReturnUrl(request?.ReturnUrl),
                    ["RequestId"] = IdentityVerificationSecurity.NewOpaqueValue()
                };
                using var content = new StringContent(payload.ToString(Formatting.None), Encoding.UTF8, "application/json");
                using var response = await client.PostAsync(
                    options.FaceApiBase + "/v1/verification/sessions",
                    content,
                    cancellationToken).ConfigureAwait(false);
                var responseText = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                if (!response.IsSuccessStatusCode)
                    return Json(new DosResult(0, null, "人脸验证服务暂不可用。"));
                var provider = JObject.Parse(responseText);
                var sessionId = provider["SessionId"]?.ToString() ?? provider["sessionId"]?.ToString();
                var sessionUrl = provider["SessionUrl"]?.ToString() ?? provider["sessionUrl"]?.ToString();
                if (sessionId.DosIsNullOrWhiteSpace() || !IsSafeSessionUrl(sessionUrl, options.FaceApiBase))
                    return Json(new DosResult(0, null, "人脸验证服务返回了无效会话。"));

                var challengeId = await StoreChallengeAsync(new ChallengeState
                {
                    Type = "FaceVerification",
                    OsClient = osClient,
                    UserId = user["Id"]?.ToString(),
                    Account = user["Account"]?.ToString(),
                    UserName = user["Name"]?.ToString(),
                    Purpose = purpose,
                    ActionHash = actionHash,
                    FaceMode = mode,
                    ProviderSessionId = sessionId,
                    ProviderSubjectReference = subjectReference,
                    CreatedAt = DateTimeOffset.UtcNow.ToString("O")
                }).ConfigureAwait(false);
                return Json(new DosResult(1, new
                {
                    ChallengeId = challengeId,
                    SessionUrl = sessionUrl,
                    ExpiresInSeconds = (int)ChallengeLifetime.TotalSeconds,
                    StoresBiometricImagesInMicroi = false
                }));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "创建人脸验证会话失败：" + SafeMessage(ex)));
            }
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> CompleteFaceVerification([FromBody] CompleteFaceRequest request, CancellationToken cancellationToken)
        {
            var osClientResult = await ResolveOsClientAsync(request?.OsClient, allowAnonymous: true).ConfigureAwait(false);
            if (osClientResult.Code != 1) return Json(osClientResult);
            // 人脸供应商通常需要前端轮询。未通过前只读取挑战，验证成功后才原子消费，
            // 避免第一次查询“处理中”就让会话永久失效。
            var stateResult = await GetChallengeAsync(osClientResult.Data, request?.ChallengeId).ConfigureAwait(false);
            if (stateResult.Code != 1) return Json(stateResult);
            var state = stateResult.Data;
            if (state.Type != "FaceVerification") return Json(new DosResult(0, null, "人脸验证会话类型无效。"));

            try
            {
                var options = IdentityVerificationOptions.Resolve(state.OsClient);
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(20);
                ApplyFaceAuthorization(client, options);
                using var response = await client.GetAsync(
                    options.FaceApiBase + "/v1/verification/sessions/" + Uri.EscapeDataString(state.ProviderSessionId),
                    cancellationToken).ConfigureAwait(false);
                var responseText = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                if (!response.IsSuccessStatusCode) return Json(new DosResult(0, null, "人脸验证结果查询失败。"));
                var provider = JObject.Parse(responseText);
                var status = (provider["Status"]?.ToString() ?? provider["status"]?.ToString() ?? "").Trim();
                var verified = provider["Verified"]?.Value<bool?>()
                    ?? provider["verified"]?.Value<bool?>()
                    ?? string.Equals(status, "Verified", StringComparison.OrdinalIgnoreCase);
                var subject = provider["SubjectReference"]?.ToString() ?? provider["subjectReference"]?.ToString();
                if (!verified)
                    return Json(new DosResult(2, null, "人脸验证仍在进行中。"));
                if (!FixedEquals(subject, state.ProviderSubjectReference))
                    return Json(new DosResult(0, null, "人脸验证主体不匹配。"));

                var consumed = await ConsumeChallengeAsync(state.OsClient, request?.ChallengeId).ConfigureAwait(false);
                if (consumed.Code != 1) return Json(consumed);
                state = consumed.Data;

                var user = await GetEnabledUserForTokenAsync(state.OsClient, state.UserId).ConfigureAwait(false);
                if (user == null) return Json(new DosResult(0, null, "系统用户不存在或已停用。"));
                if (state.FaceMode == "Enroll")
                {
                    var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
                    if (currentToken?.CurrentUser == null
                        || !string.Equals(currentToken.CurrentUser["Id"]?.ToString(), state.UserId, StringComparison.Ordinal))
                        return Json(new DosResult(1001, null, "登记人脸前请重新登录。"));
                    var save = await UpsertFaceBindingAsync(state, options.FaceProvider).ConfigureAwait(false);
                    QueueAudit(state.OsClient, user, "EnrollFace", save.Code == 1, null);
                    return Json(save);
                }

                await TouchFaceBindingAsync(state).ConfigureAwait(false);
                QueueAudit(state.OsClient, user, "FaceVerified", true, null);
                if (string.Equals(state.Purpose, "Login", StringComparison.Ordinal))
                {
                    return await CreateDiyTokenLoginResultAsync(
                        state.OsClient,
                        user,
                        request?._ClientType,
                        request?.Did,
                        "StrictFace").ConfigureAwait(false);
                }
                var token = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
                if (token?.CurrentUser == null
                    || !string.Equals(token.CurrentUser["Id"]?.ToString(), state.UserId, StringComparison.Ordinal))
                    return Json(new DosResult(1001, null, "当前登录身份与人脸用户不匹配。"));
                return Json(await IdentityVerificationSecurity.IssueTicketAsync(
                    state.OsClient,
                    state.UserId,
                    state.Purpose,
                    state.ActionHash,
                    "FaceLiveness",
                    state.ProviderSubjectReference,
                    request?.Did).ConfigureAwait(false));
            }
            catch (Exception ex)
            {
                QueueAudit(state.OsClient, null, "FaceVerified", false, ex.Message);
                return Json(new DosResult(0, null, "完成人脸验证失败：" + SafeMessage(ex)));
            }
        }

        private static async Task<DosResult<CurrentToken>> RequireUserTokenAsync()
        {
            var token = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            if (token?.CurrentUser == null)
                return new DosResult<CurrentToken>(1001, null, "登录身份已过期。请重新登录。");
            if (UserAccessKeySecurity.IsSession(token.CurrentUser))
                return new DosResult<CurrentToken>(0, null, "访问密钥会话不能管理生物识别凭据。");
            return new DosResult<CurrentToken>(1, token);
        }

        private static async Task<DosResult<string>> ResolveOsClientAsync(string requestedOsClient, bool allowAnonymous)
        {
            try
            {
                var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
                if (currentToken?.CurrentUser != null)
                {
                    if (!requestedOsClient.DosIsNullOrWhiteSpace()
                        && !string.Equals(requestedOsClient.Trim(), currentToken.OsClient, StringComparison.OrdinalIgnoreCase))
                        return new DosResult<string>(0, null, "请求租户与当前登录身份不一致。");
                    return new DosResult<string>(1, currentToken.OsClient);
                }
            }
            catch { }
            if (!allowAnonymous) return new DosResult<string>(1001, null, "请先登录。 ");
            try
            {
                var osClient = TenantConfigurationSecurity.NormalizeTenantId(requestedOsClient);
                return OsClientExtend.GetClient(osClient) == null
                    ? new DosResult<string>(0, null, "租户不存在。")
                    : new DosResult<string>(1, osClient);
            }
            catch { return new DosResult<string>(0, null, "OsClient 无效。"); }
        }

        private string ResolveRequestOrigin(IdentityVerificationOptions options)
        {
            var incoming = Request.Headers.Origin.FirstOrDefault()?.Trim();
            if (incoming.DosIsNullOrWhiteSpace()) incoming = $"{Request.Scheme}://{Request.Host.Value}";
            if (!Uri.TryCreate(incoming, UriKind.Absolute, out var uri)
                || (uri.Scheme != Uri.UriSchemeHttps && !(uri.Scheme == Uri.UriSchemeHttp && IsLoopbackHost(uri.Host))))
                throw new InvalidOperationException("Passkey 只允许 HTTPS 或本机开发地址。 ");
            var origin = uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
            if (options.PasskeyOrigins.Count > 0
                && !options.PasskeyOrigins.Any(item => string.Equals(item.TrimEnd('/'), origin, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException(
                    $"当前站点 {origin} 不在租户 PasskeyOrigins 白名单中。"
                    + "请由租户管理员进入“系统设置 → 登录与身份”，添加当前完整 Origin（含 https:// 和端口），保存后重试。 ");
            return origin;
        }

        private string ResolveRelyingPartyId(IdentityVerificationOptions options, string origin)
        {
            return IdentityVerificationSecurity.NormalizePasskeyRelyingPartyId(options.PasskeyRpId, origin);
        }

        private static Fido2 CreateFido(string rpId, string rpName, string origin)
        {
            return new Fido2(new Fido2Configuration
            {
                ServerDomain = rpId,
                ServerName = rpName.DosIsNullOrWhiteSpace() ? "Microi吾码" : rpName,
                Origins = new HashSet<string>(new[] { origin }, StringComparer.OrdinalIgnoreCase),
                Timeout = 120000,
                ChallengeSize = 32
            });
        }

        private static T DeserializeFido<T>(JObject response)
        {
            if (response == null) throw new ArgumentException("浏览器验证响应不能为空。 ");
            return System.Text.Json.JsonSerializer.Deserialize<T>(response.ToString(Formatting.None))
                ?? throw new ArgumentException("浏览器验证响应格式无效。 ");
        }

        private static string ChallengeKey(string osClient, string id)
        {
            return $"Microi:{osClient}:IdentityVerification:Challenge:{id}";
        }

        private static async Task<string> StoreChallengeAsync(ChallengeState state)
        {
            var id = IdentityVerificationSecurity.NewOpaqueValue();
            var cache = MicroiEngine.CacheTenant.Cache(state.OsClient);
            var written = await cache.GetIDatabase().StringSetAsync(
                ChallengeKey(state.OsClient, id),
                JsonConvert.SerializeObject(state),
                ChallengeLifetime,
                When.NotExists).ConfigureAwait(false);
            if (!written) throw new InvalidOperationException("验证挑战写入失败。 ");
            return id;
        }

        private static async Task<DosResult<ChallengeState>> ConsumeChallengeAsync(string osClient, string challengeId)
        {
            if (!IdentityVerificationSecurity.IsOpaqueValue(challengeId))
                return new DosResult<ChallengeState>(0, null, "验证请求格式无效。 ");
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var value = await cache.GetIDatabase()
                .StringGetDeleteAsync(ChallengeKey(osClient, challengeId.Trim()))
                .ConfigureAwait(false);
            if (!value.HasValue) return new DosResult<ChallengeState>(0, null, "验证请求不存在、已过期或已使用。 ");
            var state = JsonConvert.DeserializeObject<ChallengeState>(value.ToString());
            return state == null || !string.Equals(state.OsClient, osClient, StringComparison.OrdinalIgnoreCase)
                ? new DosResult<ChallengeState>(0, null, "验证请求租户不匹配。 ")
                : new DosResult<ChallengeState>(1, state);
        }

        private static async Task<DosResult<ChallengeState>> GetChallengeAsync(string osClient, string challengeId)
        {
            if (!IdentityVerificationSecurity.IsOpaqueValue(challengeId))
                return new DosResult<ChallengeState>(0, null, "验证请求格式无效。 ");
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var value = await cache.GetIDatabase()
                .StringGetAsync(ChallengeKey(osClient, challengeId.Trim()))
                .ConfigureAwait(false);
            if (!value.HasValue) return new DosResult<ChallengeState>(0, null, "验证请求不存在、已过期或已使用。 ");
            var state = JsonConvert.DeserializeObject<ChallengeState>(value.ToString());
            return state == null || !string.Equals(state.OsClient, osClient, StringComparison.OrdinalIgnoreCase)
                ? new DosResult<ChallengeState>(0, null, "验证请求租户不匹配。 ")
                : new DosResult<ChallengeState>(1, state);
        }

        private static async Task<JObject> FindEnabledUserByAccountAsync(string osClient, string account)
        {
            account = (account ?? "").Trim();
            if (account.Length is < 1 or > 128) return null;
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "Account", Type = "=", Value = account },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private static async Task<JObject> GetEnabledUserForTokenAsync(string osClient, string userId)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    Id = userId,
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).ConfigureAwait(false);
                if (result.Code != 1 || result.Data == null) return null;
                var user = MicroiEngine.V8Method.SetSysUserRoleInfo(result.Data, osClient);
                user["Pwd"] = "";
                return user;
            }
            catch { return null; }
        }

        private static async Task<List<JObject>> ListCredentialsByUserAsync(string osClient, string userId)
        {
            if (userId.DosIsNullOrWhiteSpace()) return new List<JObject>();
            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync(CredentialTable, new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "UserId", Type = "=", Value = userId },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    },
                    _OrderBy = "CreateTime",
                    _OrderByType = "DESC",
                    _PageIndex = 1,
                    _PageSize = 100
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null
                    ? JArray.FromObject(result.Data).OfType<JObject>().ToList()
                    : new List<JObject>();
            }
            catch { return new List<JObject>(); }
        }

        private static async Task<JObject> FindCredentialByIdAsync(string osClient, byte[] credentialId)
        {
            var hash = IdentityVerificationSecurity.HashIdentifier(credentialId);
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync(CredentialTable, new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "CredentialIdHash", Type = "=", Value = hash },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private static async Task<JObject> FindOwnedCredentialAsync(CurrentToken token, string id)
        {
            if (id.DosIsNullOrWhiteSpace()) return null;
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync(CredentialTable, new
                {
                    Id = id,
                    OsClient = token.OsClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "UserId", Type = "=", Value = token.CurrentUser["Id"]?.ToString() },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private static bool PolicyEnabled(JObject item, string fieldName)
        {
            var value = item?[fieldName];
            if (value == null || value.Type == JTokenType.Null || value.Type == JTokenType.Undefined)
                return true;
            if (value.Type == JTokenType.Boolean) return value.Value<bool>();
            if (value.Type == JTokenType.Integer) return value.Value<long>() != 0;
            var text = value.ToString().Trim();
            if (bool.TryParse(text, out var boolean)) return boolean;
            return !long.TryParse(text, out var number) || number != 0;
        }

        private static async Task<JObject> FindTotpByUserAsync(string osClient, string userId)
        {
            if (userId.DosIsNullOrWhiteSpace()) return null;
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync(TotpTable, new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "UserId", Type = "=", Value = userId },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private static async Task<JObject> FindOwnedTotpAsync(CurrentToken token, string id)
        {
            if (id.DosIsNullOrWhiteSpace()) return null;
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync(TotpTable, new
                {
                    Id = id,
                    OsClient = token.OsClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "UserId", Type = "=", Value = token.CurrentUser["Id"]?.ToString() },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private async Task<bool> AllowTotpAttemptAsync(string osClient, string account)
        {
            var ip = IPHelper.GetClientIP(HttpContext).Data?.ToString() ?? "unknown";
            var identity = $"{(account ?? "").Trim().ToLowerInvariant()}|{ip}";
            var hash = IdentityVerificationSecurity.HashIdentifier(Encoding.UTF8.GetBytes(identity));
            var key = $"Microi:{osClient}:IdentityVerification:TOTP:Rate:{hash}";
            var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
            var count = await database.StringIncrementAsync(key).ConfigureAwait(false);
            if (count == 1) await database.KeyExpireAsync(key, TimeSpan.FromMinutes(1)).ConfigureAwait(false);
            return count <= 8;
        }

        private async Task<DosResult> SaveCredentialAsync(
            ChallengeState state,
            RegisteredPublicKeyCredential credential,
            string deviceName,
            string did,
            CancellationToken cancellationToken)
        {
            DosResult result = null;
            var hash = IdentityVerificationSecurity.HashIdentifier(credential.Id);
            var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
            {
                Key = $"Microi:{state.OsClient}:IdentityVerification:Register:{hash}",
                OsClient = state.OsClient,
                Expiry = TimeSpan.FromSeconds(10),
                AcquireTimeout = TimeSpan.FromSeconds(3),
                CancellationToken = cancellationToken,
                RetryIntervalMs = 20
            }, async () =>
            {
                if (await FindCredentialByIdAsync(state.OsClient, credential.Id).ConfigureAwait(false) != null)
                {
                    result = new DosResult(0, null, "该 Passkey 已登记。 ");
                    return;
                }
                var id = Guid.NewGuid().ToString();
                result = await MicroiEngine.FormEngine.AddFormDataAsync(CredentialTable, new
                {
                    Id = id,
                    UserId = state.UserId,
                    UserName = state.UserName,
                    CredentialId = IdentityVerificationSecurity.Base64UrlEncode(credential.Id),
                    CredentialIdHash = hash,
                    PublicKey = Convert.ToBase64String(credential.PublicKey),
                    UserHandle = Convert.ToBase64String(credential.User.Id),
                    SignCount = (long)credential.SignCount,
                    AaGuid = credential.AaGuid.ToString(),
                    AttestationFormat = credential.AttestationFormat,
                    Transports = JsonConvert.SerializeObject((credential.Transports ?? Array.Empty<AuthenticatorTransport>()).Select(item => item.ToString())),
                    BackupEligible = credential.IsBackupEligible ? 1 : 0,
                    BackedUp = credential.IsBackedUp ? 1 : 0,
                    DeviceName = deviceName,
                    AllowPasswordlessLogin = 1,
                    AllowStepUp = 1,
                    State = 1,
                    IsDeleted = 0,
                    OsClient = state.OsClient
                }).ConfigureAwait(false);
                if (result.Code == 1)
                {
                    await UpsertDeviceAsync(state, id, hash, deviceName, did).ConfigureAwait(false);
                    result.Data = new { Id = id, DeviceName = deviceName, BackupEligible = credential.IsBackupEligible };
                }
            }).ConfigureAwait(false);
            if (lockResult.Code != 1) return new DosResult(0, null, lockResult.Msg);
            return result ?? new DosResult(0, null, "Passkey 保存失败。 ");
        }

        private static async Task TouchCredentialAsync(string osClient, JObject stored, VerifyAssertionResult result, string did, HttpContext httpContext)
        {
            await MicroiEngine.FormEngine.UptFormDataAsync(CredentialTable, new
            {
                Id = stored["Id"]?.ToString(),
                SignCount = (long)result.SignCount,
                BackedUp = result.IsBackedUp ? 1 : 0,
                LastUsedTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                LastUsedIP = IPHelper.GetClientIP(httpContext).Data,
                OsClient = osClient
            }).ConfigureAwait(false);
        }

        private static async Task UpsertDeviceAsync(ChallengeState state, string credentialRowId, string hash, string deviceName, string did)
        {
            try
            {
                await MicroiEngine.FormEngine.AddFormDataAsync(DeviceTable, new
                {
                    Id = Guid.NewGuid().ToString(),
                    UserId = state.UserId,
                    UserName = state.UserName,
                    CredentialRowId = credentialRowId,
                    CredentialIdHash = hash,
                    DeviceName = deviceName,
                    DidHash = did.DosIsNullOrWhiteSpace() ? "" : IdentityVerificationSecurity.HashIdentifier(Encoding.UTF8.GetBytes(did.Trim())),
                    TrustState = "Verified",
                    LastSeenTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    State = 1,
                    IsDeleted = 0,
                    OsClient = state.OsClient
                }).ConfigureAwait(false);
            }
            catch { }
        }

        private static PublicKeyCredentialDescriptor ToDescriptor(JObject item)
        {
            return new PublicKeyCredentialDescriptor(
                PublicKeyCredentialType.PublicKey,
                Base64UrlDecode(item["CredentialId"]?.ToString()),
                ParseTransports(item["Transports"]?.ToString()));
        }

        private static AuthenticatorTransport[] ParseTransports(string json)
        {
            if (json.DosIsNullOrWhiteSpace()) return null;
            try
            {
                return JArray.Parse(json)
                    .Values<string>()
                    .Select(value => Enum.TryParse<AuthenticatorTransport>(value, true, out var parsed) ? parsed : (AuthenticatorTransport?)null)
                    .Where(value => value.HasValue)
                    .Select(value => value.GetValueOrDefault())
                    .ToArray();
            }
            catch { return null; }
        }

        private static byte[] Base64UrlDecode(string value)
        {
            var text = (value ?? "").Replace('-', '+').Replace('_', '/');
            text = text.PadRight(text.Length + ((4 - text.Length % 4) % 4), '=');
            return Convert.FromBase64String(text);
        }

        private async Task<JsonResult> CreateDiyTokenLoginResultAsync(
            string osClient,
            JObject user,
            string clientType,
            string did,
            string loginMethod)
        {
            var token = await new DiyToken().GetAccessToken(new DiyTokenParam
            {
                CurrentUser = user,
                OsClient = osClient,
                _ClientType = clientType.DosIsNullOrWhiteSpace() ? "PC" : clientType,
                Did = did
            }).ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var sysConfigResult = await MicroiEngine.FormEngine.GetSysConfig(osClient).ConfigureAwait(false);
            dynamic homePage = null;
            try { homePage = (await new SysMenuLogic().GetSysMenuHomePage(new SysMenuParam { OsClient = osClient }).ConfigureAwait(false)).Data; }
            catch { }
            var result = new DosResult<dynamic>(1, user)
            {
                DataAppend = new
                {
                    SysMenuHomePage = homePage,
                    SysConfig = sysConfigResult.Code == 1
                        ? TenantConfigurationSecurity.CreatePublicSysConfigProjection(sysConfigResult.Data, osClient)
                        : null,
                    LoginMethod = loginMethod
                }
            };
            _ = MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
            {
                Id = user["Id"]?.ToString(),
                LastLoginIP = IPHelper.GetClientIP(HttpContext).Data,
                LastLoginTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                OsClient = osClient
            });
            return Json(result);
        }

        private static string CreateFaceSubjectReference(string osClient, string userId)
        {
            var authSecret = OsClientExtend.GetClient(osClient)?.OsClientModel?["AuthSecret"]?.ToString();
            if (authSecret.DosIsNullOrWhiteSpace()) throw new InvalidOperationException("租户 AuthSecret 尚未就绪。 ");
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(authSecret));
            return IdentityVerificationSecurity.Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes($"face:v1:{osClient}:{userId}")));
        }

        private static void ApplyFaceAuthorization(HttpClient client, IdentityVerificationOptions options)
        {
            if (!options.FaceApiKey.DosIsNullOrWhiteSpace())
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", options.FaceApiKey);
            client.DefaultRequestHeaders.Add("X-Microi-Face-Protocol", "1");
        }

        private static string NormalizeReturnUrl(string value)
        {
            var text = (value ?? "").Trim();
            if (text.Length == 0) return "";
            if (!Uri.TryCreate(text, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return "";
            return uri.GetLeftPart(UriPartial.Path);
        }

        private static bool IsSafeSessionUrl(string sessionUrl, string apiBase)
        {
            if (!Uri.TryCreate(sessionUrl, UriKind.Absolute, out var session)
                || session.Scheme != Uri.UriSchemeHttps) return false;
            if (!Uri.TryCreate(apiBase, UriKind.Absolute, out var gateway)) return false;
            return string.Equals(session.Host, gateway.Host, StringComparison.OrdinalIgnoreCase)
                || session.Host.EndsWith("." + gateway.Host, StringComparison.OrdinalIgnoreCase);
        }

        private static async Task<DosResult> UpsertFaceBindingAsync(ChallengeState state, string provider)
        {
            var existing = await FindFaceBindingAsync(state.OsClient, state.UserId).ConfigureAwait(false);
            if (existing == null)
            {
                return await MicroiEngine.FormEngine.AddFormDataAsync(FaceTable, new
                {
                    Id = Guid.NewGuid().ToString(),
                    UserId = state.UserId,
                    UserName = state.UserName,
                    Provider = provider,
                    ProviderSubjectReference = state.ProviderSubjectReference,
                    EnrolledTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    LastVerifiedTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    State = 1,
                    IsDeleted = 0,
                    OsClient = state.OsClient
                }).ConfigureAwait(false);
            }
            return await MicroiEngine.FormEngine.UptFormDataAsync(FaceTable, new
            {
                Id = existing["Id"]?.ToString(),
                Provider = provider,
                ProviderSubjectReference = state.ProviderSubjectReference,
                EnrolledTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                LastVerifiedTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                State = 1,
                IsDeleted = 0,
                OsClient = state.OsClient
            }).ConfigureAwait(false);
        }

        private static async Task TouchFaceBindingAsync(ChallengeState state)
        {
            var existing = await FindFaceBindingAsync(state.OsClient, state.UserId).ConfigureAwait(false);
            if (existing == null || !FixedEquals(existing["ProviderSubjectReference"]?.ToString(), state.ProviderSubjectReference))
                throw new InvalidOperationException("该账号尚未登记人脸。 ");
            await MicroiEngine.FormEngine.UptFormDataAsync(FaceTable, new
            {
                Id = existing["Id"]?.ToString(),
                LastVerifiedTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                OsClient = state.OsClient
            }).ConfigureAwait(false);
        }

        private static async Task<JObject> FindFaceBindingAsync(string osClient, string userId)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync(FaceTable, new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "UserId", Type = "=", Value = userId },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private static string NormalizeDeviceName(string value)
        {
            var text = (value ?? "").Trim();
            if (text.Length > 80) text = text.Substring(0, 80);
            return new string(text.Where(ch => !char.IsControl(ch)).ToArray());
        }

        private static bool IsLoopbackHost(string host)
        {
            return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
                || string.Equals(host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
                || string.Equals(host, "::1", StringComparison.OrdinalIgnoreCase);
        }

        private static bool FixedEquals(string left, string right)
        {
            var leftBytes = Encoding.UTF8.GetBytes(left ?? "");
            var rightBytes = Encoding.UTF8.GetBytes(right ?? "");
            return leftBytes.Length == rightBytes.Length
                && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
        }

        private static string SafeMessage(Exception ex)
        {
            var text = (ex?.Message ?? "未知错误").Replace('\r', ' ').Replace('\n', ' ').Trim();
            return text.Length > 240 ? text.Substring(0, 240) : text;
        }

        private static void QueueAudit(string osClient, JObject currentUser, string action, bool success, string detail)
        {
            MicroiEngine.QueueSysLog(new SysLogParam
            {
                OsClient = osClient,
                UserId = currentUser?["Id"]?.ToString(),
                UserName = currentUser?["Name"]?.ToString(),
                Category = "Security",
                Action = action,
                Source = "IdentityVerification",
                TargetType = "UserIdentity",
                Success = success,
                OccurredAt = DateTime.Now,
                Type = "安全审计",
                Title = action,
                Content = JsonConvert.SerializeObject(new
                {
                    Success = success,
                    Detail = (detail ?? "").Length > 200 ? (detail ?? "").Substring(0, 200) : (detail ?? "")
                }),
                Level = success ? 1 : 2
            });
        }
    }
}
