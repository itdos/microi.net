using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.ServiceModel.Security;
using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using ITfoxtec.Identity.Saml2;
using ITfoxtec.Identity.Saml2.Schemas;
using ITfoxtec.Identity.Saml2.Schemas.Metadata;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens.Saml2;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    public sealed partial class SsoProtocolRuntime
    {
        public async Task<IActionResult> SamlLogin(string OsClient)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return BadRequest("invalid tenant");
            try
            {
                var httpRequest = await CreateSamlHttpRequestAsync(Request).ConfigureAwait(false);
                var probeConfig = new Saml2Configuration { Issuer = BuildIdpEntityId(tenant.Data) };
                var issuer = httpRequest.Binding.ReadSamlRequest(httpRequest,
                    new Saml2AuthnRequest(probeConfig))?.Issuer;
                var client = await FindOutboundSamlClientAsync(tenant.Data, issuer).ConfigureAwait(false);
                if (client == null) return BadRequest("SAML relying party is not registered");
                var configResult = await BuildOutboundSamlConfigurationAsync(tenant.Data, client).ConfigureAwait(false);
                if (configResult.Code != 1) return StatusCode(503, configResult.Msg);
                var request = new Saml2AuthnRequest(configResult.Data);
                httpRequest.Binding.Unbind(httpRequest, request);
                var freshRequest = await Cache(tenant.Data).StringSetAsync(
                    SamlRequestReplayKey(tenant.Data, request.IdAsString), "1",
                    AuthorizationRequestLifetime, When.NotExists).ConfigureAwait(false);
                if (!freshRequest) return BadRequest("SAML AuthnRequest was already used");
                var acs = request.AssertionConsumerServiceUrl?.AbsoluteUri
                          ?? client.AssertionConsumerServiceUrl
                          ?? client.RedirectUris.FirstOrDefault();
                if (!SsoSecurity.IsExactRedirectUriAllowed(acs, client.RedirectUris,
                        client.AllowLoopbackRedirectUri))
                    return BadRequest("SAML assertion consumer service is not registered");
                var now = DateTimeOffset.UtcNow;
                var pending = new AuthorizationRequestState
                {
                    OsClient = tenant.Data,
                    Protocol = "SAML2",
                    ConnectionKey = client.Key,
                    ClientId = client.EntityId,
                    Service = acs,
                    SamlRequestId = request.IdAsString,
                    RelayState = httpRequest.Binding.RelayState,
                    CreatedAt = now.ToString("O"),
                    ExpiresAt = now.Add(AuthorizationRequestLifetime).ToString("O")
                };
                var session = await GetProviderSessionAsync(tenant.Data).ConfigureAwait(false);
                if (session != null)
                    return await BuildSamlResponseAsync(pending, session.CurrentUser, session.AuthTime).ConfigureAwait(false);
                var requestId = SsoSecurity.NewOpaqueValue();
                var saved = await Cache(tenant.Data).StringSetAsync(AuthorizationRequestKey(tenant.Data, requestId),
                    JsonConvert.SerializeObject(pending), AuthorizationRequestLifetime, When.NotExists).ConfigureAwait(false);
                return saved
                    ? Redirect(BuildFrontendAuthorizationUrl(tenant.Data, requestId))
                    : StatusCode(503, "authorization state failed");
            }
            catch
            {
                return BadRequest("SAML AuthnRequest signature, issuer, destination or ACS validation failed");
            }
        }

        public async Task<IActionResult> SamlComplete(string OsClient, string handoff)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1 || !IsOpaque(handoff)) return BadRequest("SAML handoff is invalid");
            SamlHandoff model = null;
            try
            {
                var raw = await Cache(tenant.Data).StringGetDeleteAsync(SamlHandoffKey(tenant.Data, handoff))
                    .ConfigureAwait(false);
                if (raw.HasValue) model = JsonConvert.DeserializeObject<SamlHandoff>(raw.ToString());
            }
            catch { }
            if (model == null || !IsValidPending(model.Pending, tenant.Data)
                || !DateTimeOffset.TryParse(model.ExpiresAt, out var expires) || expires <= DateTimeOffset.UtcNow)
                return BadRequest("SAML handoff is expired or already used");
            var user = await GetEnabledUserAsync(tenant.Data, model.UserId).ConfigureAwait(false);
            if (user == null) return BadRequest("user is disabled");
            return await BuildSamlResponseAsync(model.Pending, user, model.AuthTime).ConfigureAwait(false);
        }

        public async Task<IActionResult> SamlIdpMetadata(string OsClient)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return NotFound();
            var clients = (await LoadConnectionsAsync(tenant.Data).ConfigureAwait(false))
                .Where(item => item.Enabled && item.IsOutbound && item.Protocol == "SAML2").ToList();
            if (clients.Count == 0) return NotFound();
            var certificate = await LoadOrCreateSamlSigningCertificateAsync(tenant.Data, null).ConfigureAwait(false);
            if (certificate == null) return StatusCode(503, "SAML signing certificate is unavailable");
            var config = new Saml2Configuration
            {
                Issuer = BuildIdpEntityId(tenant.Data),
                SigningCertificate = certificate,
                SignAuthnRequest = true,
                SingleSignOnDestination = new Uri($"{Request.Scheme}://{Request.Host}{Request.PathBase}/saml/{Uri.EscapeDataString(tenant.Data)}/login"),
                SingleLogoutDestination = new Uri($"{Request.Scheme}://{Request.Host}{Request.PathBase}/saml/{Uri.EscapeDataString(tenant.Data)}/logout")
            };
            var descriptor = new EntityDescriptor(config)
            {
                ValidUntil = 365,
                IdPSsoDescriptor = new IdPSsoDescriptor
                {
                    WantAuthnRequestsSigned = true,
                    SigningCertificates = new[] { certificate },
                    SingleSignOnServices = new[]
                    {
                        new SingleSignOnService { Binding = ProtocolBindings.HttpRedirect, Location = config.SingleSignOnDestination },
                        new SingleSignOnService { Binding = ProtocolBindings.HttpPost, Location = config.SingleSignOnDestination }
                    },
                    SingleLogoutServices = new[]
                    {
                        new SingleLogoutService { Binding = ProtocolBindings.HttpPost, Location = config.SingleLogoutDestination },
                        new SingleLogoutService { Binding = ProtocolBindings.HttpRedirect, Location = config.SingleLogoutDestination }
                    },
                    NameIDFormats = new[] { NameIdentifierFormats.Persistent }
                }
            };
            Response.Headers["Cache-Control"] = "public, max-age=300";
            return Content(
                new Saml2Metadata(descriptor).CreateMetadata().ToXml(),
                "application/samlmetadata+xml; charset=utf-8");
        }

        public async Task<IActionResult> SamlSpMetadata(string OsClient, string ConnectionKey)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return NotFound();
            var connection = await FindConnectionAsync(tenant.Data, ConnectionKey,
                SsoSecurity.InboundDirection).ConfigureAwait(false);
            if (connection == null || connection.Protocol != "SAML2") return NotFound();
            var certificate = await LoadOrCreateSamlSigningCertificateAsync(tenant.Data,
                connection.SigningCertificateSettingKey).ConfigureAwait(false);
            if (certificate == null) return StatusCode(503, "SAML signing certificate is unavailable");
            var entityId = BuildSpEntityId(tenant.Data, connection.Key);
            var acs = BuildInboundCallbackUrl("SamlAcs", tenant.Data, connection.Key);
            var config = new Saml2Configuration { Issuer = entityId, SigningCertificate = certificate, SignAuthnRequest = true };
            var descriptor = new EntityDescriptor(config)
            {
                ValidUntil = 365,
                SPSsoDescriptor = new SPSsoDescriptor
                {
                    AuthnRequestsSigned = true,
                    WantAssertionsSigned = connection.RequireSignedAssertions,
                    SigningCertificates = new[] { certificate },
                    EncryptionCertificates = connection.EncryptAssertions ? new[] { certificate } : null,
                    NameIDFormats = new[] { NameIdentifierFormats.Persistent },
                    AssertionConsumerServices = new[]
                    {
                        new AssertionConsumerService
                        {
                            Binding = ProtocolBindings.HttpPost, Location = new Uri(acs), IsDefault = true, Index = 0
                        }
                    }
                }
            };
            Response.Headers["Cache-Control"] = "public, max-age=300";
            return Content(
                new Saml2Metadata(descriptor).CreateMetadata().ToXml(),
                "application/samlmetadata+xml; charset=utf-8");
        }

        public async Task<IActionResult> SamlLogout(string OsClient)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return BadRequest();
            try
            {
                var httpRequest = await CreateSamlHttpRequestAsync(Request).ConfigureAwait(false);
                var probe = new Saml2LogoutRequest(new Saml2Configuration { Issuer = BuildIdpEntityId(tenant.Data) });
                var issuer = httpRequest.Binding.ReadSamlRequest(httpRequest, probe)?.Issuer;
                var client = await FindOutboundSamlClientAsync(tenant.Data, issuer).ConfigureAwait(false);
                if (client == null) return BadRequest("SAML relying party is not registered");
                var configResult = await BuildOutboundSamlConfigurationAsync(tenant.Data, client).ConfigureAwait(false);
                if (configResult.Code != 1) return StatusCode(503, configResult.Msg);
                var logout = new Saml2LogoutRequest(configResult.Data);
                httpRequest.Binding.Unbind(httpRequest, logout);
                var sessionId = Request.Cookies[ProviderCookieName(tenant.Data)];
                if (IsOpaque(sessionId)) await Cache(tenant.Data).KeyDeleteAsync(ProviderSessionKey(tenant.Data, sessionId));
                Response.Cookies.Delete(ProviderCookieName(tenant.Data), new Microsoft.AspNetCore.Http.CookieOptions { Path = "/" });
                var destination = client.SingleLogoutUrl.DosIsNullOrWhiteSpace()
                    ? client.RedirectUris.FirstOrDefault()
                    : client.SingleLogoutUrl;
                if (!SsoSecurity.IsExactRedirectUriAllowed(destination,
                        client.PostLogoutRedirectUris.Concat(client.RedirectUris), client.AllowLoopbackRedirectUri))
                    return BadRequest("SAML logout response destination is not registered");
                var response = new Saml2LogoutResponse(configResult.Data)
                {
                    InResponseToAsString = logout.IdAsString,
                    Status = Saml2StatusCodes.Success,
                    Destination = new Uri(destination)
                };
                var binding = new Saml2PostBinding { RelayState = httpRequest.Binding.RelayState };
                binding.Bind(response);
                return Content(binding.PostContent, "text/html; charset=utf-8");
            }
            catch { return BadRequest("SAML LogoutRequest validation failed"); }
        }

        private static async Task<DosResult<string>> CompleteSamlPendingAsync(
            AuthorizationRequestState pending,
            JObject user,
            long authTime)
        {
            if (pending == null || user == null || pending.Protocol != "SAML2")
                return new DosResult<string>(0, null, "SAML2 授权请求无效。");
            var client = await FindOutboundSamlClientAsync(pending.OsClient, pending.ClientId).ConfigureAwait(false);
            if (client == null || !SsoSecurity.IsExactRedirectUriAllowed(pending.Service,
                    client.RedirectUris, client.AllowLoopbackRedirectUri))
                return new DosResult<string>(0, null, "SAML2 Relying Party 配置已变更。");
            var handoff = SsoSecurity.NewOpaqueValue();
            var now = DateTimeOffset.UtcNow;
            var payload = new SamlHandoff
            {
                Pending = pending,
                UserId = user["Id"]?.ToString(),
                AuthTime = authTime,
                ExpiresAt = now.AddMinutes(2).ToString("O")
            };
            var saved = await Cache(pending.OsClient).StringSetAsync(SamlHandoffKey(pending.OsClient, handoff),
                JsonConvert.SerializeObject(payload), TimeSpan.FromMinutes(2), When.NotExists).ConfigureAwait(false);
            return saved
                ? new DosResult<string>(1, "/api/Sso/SamlComplete?OsClient=" + Uri.EscapeDataString(pending.OsClient)
                                               + "&handoff=" + Uri.EscapeDataString(handoff))
                : new DosResult<string>(0, null, "SAML2 一次性交接票据创建失败。");
        }

        private async Task<IActionResult> BuildSamlResponseAsync(
            AuthorizationRequestState pending,
            JObject user,
            long authTime)
        {
            var client = await FindOutboundSamlClientAsync(pending.OsClient, pending.ClientId).ConfigureAwait(false);
            if (client == null) return BadRequest("SAML relying party is disabled");
            var configResult = await BuildOutboundSamlConfigurationAsync(pending.OsClient, client).ConfigureAwait(false);
            if (configResult.Code != 1) return StatusCode(503, configResult.Msg);
            var pairwiseKey = await GetOrCreateSecretAsync(pending.OsClient, PairwiseKeySetting, 48,
                "SSO pairwise subject 派生密钥").ConfigureAwait(false);
            if (pairwiseKey.DosIsNullOrWhiteSpace()) return StatusCode(503, "pairwise subject key is unavailable");
            var subject = SsoSecurity.CreatePairwiseSubject(pending.OsClient, client.EntityId,
                user["Id"]?.ToString(), pairwiseKey);
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, subject),
                new Claim(ClaimTypes.Name, user["Name"]?.ToString() ?? string.Empty),
                new Claim(ClaimTypes.Upn, user["Account"]?.ToString() ?? string.Empty)
            };
            var email = user["Email"]?.ToString();
            if (!email.DosIsNullOrWhiteSpace()) claims.Add(new Claim(ClaimTypes.Email, email));
            foreach (var role in SsoSecurity.ParseStringList(user["RoleIds"]))
                claims.Add(new Claim(ClaimTypes.Role, role));
            claims.Add(new Claim("auth_time", authTime.ToString(System.Globalization.CultureInfo.InvariantCulture)));
            var identity = new ClaimsIdentity(claims);
            var response = new Saml2AuthnResponse(configResult.Data)
            {
                InResponseToAsString = pending.SamlRequestId,
                Status = Saml2StatusCodes.Success,
                Destination = new Uri(pending.Service),
                SessionIndex = "_" + SsoSecurity.NewOpaqueValue(),
                NameId = new Saml2NameIdentifier(subject, NameIdentifierFormats.Persistent),
                ClaimsIdentity = identity
            };
            response.CreateSecurityToken(client.EntityId, subjectConfirmationLifetime: 5, issuedTokenLifetime: 5);
            var binding = new Saml2PostBinding { RelayState = pending.RelayState };
            QueueAudit(pending.OsClient, user["Id"]?.ToString(), "OutboundSamlAssertionIssued", true,
                client.Key, "SAML2", null);
            SetNoStore();
            binding.Bind(response);
            return Content(binding.PostContent, "text/html; charset=utf-8");
        }

        private async Task<DosResult<Saml2Configuration>> BuildOutboundSamlConfigurationAsync(
            string osClient,
            SsoConnectionOptions client)
        {
            try
            {
                var signing = await LoadOrCreateSamlSigningCertificateAsync(osClient,
                    client.SigningCertificateSettingKey).ConfigureAwait(false);
                var validation = LoadCertificateSetting(osClient, client.ValidationCertificateSettingKey,
                    requirePrivateKey: false);
                if (signing == null || validation == null)
                    return new DosResult<Saml2Configuration>(0, null, "SAML2 签名或 RP 验签证书不可用。");
                var config = new Saml2Configuration
                {
                    Issuer = BuildIdpEntityId(osClient),
                    AllowedIssuer = client.EntityId,
                    SigningCertificate = signing,
                    SignAuthnRequest = true,
                    AuthnResponseSignType = client.RequireSignedAssertions
                        ? Saml2AuthnResponseSignTypes.SignAssertionAndResponse
                        : Saml2AuthnResponseSignTypes.SignResponse,
                    CertificateValidationMode = X509CertificateValidationMode.None,
                    RevocationMode = X509RevocationMode.NoCheck,
                    AudienceRestricted = true
                };
                config.AllowedAudienceUris.Add(client.EntityId);
                config.SignatureValidationCertificates.Add(validation);
                if (client.EncryptAssertions)
                {
                    var encryption = LoadCertificateSetting(osClient, client.EncryptionCertificateSettingKey,
                        requirePrivateKey: false);
                    if (encryption == null)
                        return new DosResult<Saml2Configuration>(0, null, "SAML2 已要求加密断言，但 RP 加密证书不可用。");
                    config.EncryptionCertificate = encryption;
                }
                return new DosResult<Saml2Configuration>(1, config);
            }
            catch { return new DosResult<Saml2Configuration>(0, null, "SAML2 Relying Party 配置无效。"); }
        }

        private static async Task<SsoConnectionOptions> FindOutboundSamlClientAsync(string osClient, string entityId)
        {
            if (entityId.DosIsNullOrWhiteSpace()) return null;
            return (await LoadConnectionsAsync(osClient).ConfigureAwait(false)).FirstOrDefault(item =>
                item.Enabled && item.IsOutbound && item.Protocol == "SAML2"
                && string.Equals(item.EntityId, entityId, StringComparison.Ordinal));
        }

        private static async Task<X509Certificate2> LoadOrCreateSamlSigningCertificateAsync(
            string osClient,
            string configuredKey)
        {
            var key = configuredKey.DosIsNullOrWhiteSpace() ? DefaultSamlSigningSetting : configuredKey;
            var existing = LoadCertificateSetting(osClient, key, requirePrivateKey: true);
            if (existing != null) return existing;
            var lease = SsoSecurity.NewOpaqueValue();
            var lockKey = $"Microi:{osClient}:SSO:SamlCertificateInit:{key}";
            var acquired = await Cache(osClient).StringSetAsync(lockKey, lease, TimeSpan.FromSeconds(45), When.NotExists)
                .ConfigureAwait(false);
            if (!acquired) return null;
            try
            {
                existing = LoadCertificateSetting(osClient, key, requirePrivateKey: true);
                if (existing != null) return existing;
                using var rsa = RSA.Create(3072);
                var request = new CertificateRequest(
                    new X500DistinguishedName("CN=Microi SSO " + osClient),
                    rsa,
                    HashAlgorithmName.SHA256,
                    RSASignaturePadding.Pkcs1);
                request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
                request.CertificateExtensions.Add(new X509KeyUsageExtension(
                    X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
                request.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(request.PublicKey, false));
                using var generated = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5),
                    DateTimeOffset.UtcNow.AddYears(3));
                var password = SsoSecurity.NewOpaqueValue(32);
                var stored = new JObject
                {
                    ["PfxBase64"] = Convert.ToBase64String(generated.Export(X509ContentType.Pfx, password)),
                    ["Password"] = password,
                    ["Thumbprint"] = generated.Thumbprint,
                    ["NotAfter"] = generated.NotAfter.ToUniversalTime().ToString("O")
                }.ToString(Formatting.None);
                var save = await UpsertSecretSettingAsync(osClient, key, stored, "SSO",
                    "SAML2 RSA-SHA256 租户签名证书（自动生成，可由管理员轮换）").ConfigureAwait(false);
                return save.Code == 1 ? LoadCertificateSetting(osClient, key, true) : null;
            }
            finally
            {
                await Cache(osClient).ScriptEvaluateAsync(
                    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                    new RedisKey[] { lockKey }, new RedisValue[] { lease }).ConfigureAwait(false);
            }
        }

        private static X509Certificate2 LoadCertificateSetting(string osClient, string key, bool requirePrivateKey)
        {
            var raw = LoadSecretSetting(osClient, key);
            if (raw.DosIsNullOrWhiteSpace()) return null;
            try
            {
                X509Certificate2 certificate;
                if (raw.TrimStart().StartsWith("{", StringComparison.Ordinal))
                {
                    var json = JObject.Parse(raw);
                    var pfx = json["PfxBase64"]?.ToString();
                    var password = json["Password"]?.ToString();
                    if (!pfx.DosIsNullOrWhiteSpace())
                        certificate = X509CertificateLoader.LoadPkcs12(Convert.FromBase64String(pfx), password,
                            X509KeyStorageFlags.EphemeralKeySet | X509KeyStorageFlags.Exportable);
                    else
                        certificate = LoadPemCertificate(
                            json["CertificatePem"]?.ToString(), json["PrivateKeyPem"]?.ToString());
                }
                else if (raw.Contains("-----BEGIN CERTIFICATE-----", StringComparison.Ordinal))
                {
                    certificate = LoadPemCertificate(raw, raw);
                }
                else
                {
                    certificate = X509CertificateLoader.LoadCertificate(Convert.FromBase64String(raw));
                }
                return requirePrivateKey && !certificate.HasPrivateKey ? null : certificate;
            }
            catch { return null; }
        }

        /// <summary>
        /// netstandard2.1 兼容的 PEM 证书加载；私钥只在内存中导入并附加到公开证书，
        /// 不把密钥内容写入临时文件、日志或 V8 返回值。
        /// </summary>
        private static X509Certificate2 LoadPemCertificate(string certificatePem, string privateKeyPem)
        {
            var certificateBytes = ReadPemBlock(certificatePem, "CERTIFICATE");
            if (certificateBytes == null) return null;
            var certificate = X509CertificateLoader.LoadCertificate(certificateBytes);
            if ((privateKeyPem ?? string.Empty).IndexOf("PRIVATE KEY", StringComparison.Ordinal) < 0)
                return certificate;

            using var rsa = RSA.Create();
            var pkcs8 = ReadPemBlock(privateKeyPem, "PRIVATE KEY");
            if (pkcs8 != null)
            {
                rsa.ImportPkcs8PrivateKey(pkcs8, out _);
            }
            else
            {
                var pkcs1 = ReadPemBlock(privateKeyPem, "RSA PRIVATE KEY");
                if (pkcs1 == null) return null;
                rsa.ImportRSAPrivateKey(pkcs1, out _);
            }
            var withPrivateKey = certificate.CopyWithPrivateKey(rsa);
            certificate.Dispose();
            return withPrivateKey;
        }

        private static byte[] ReadPemBlock(string source, string label)
        {
            var begin = "-----BEGIN " + label + "-----";
            var end = "-----END " + label + "-----";
            var start = (source ?? string.Empty).IndexOf(begin, StringComparison.Ordinal);
            if (start < 0) return null;
            start += begin.Length;
            var finish = source.IndexOf(end, start, StringComparison.Ordinal);
            if (finish < 0) return null;
            var base64 = source.Substring(start, finish - start)
                .Replace("\r", string.Empty)
                .Replace("\n", string.Empty)
                .Replace(" ", string.Empty)
                .Replace("\t", string.Empty);
            try { return Convert.FromBase64String(base64); }
            catch { return null; }
        }

        private static string SamlHandoffKey(string osClient, string handoff) =>
            $"Microi:{osClient}:SSO:SamlHandoff:{handoff}";

        private static string SamlRequestReplayKey(string osClient, string requestId) =>
            $"Microi:{osClient}:SSO:SamlRequest:{SsoSecurity.HashOpaqueToken(requestId)}";
    }
}
