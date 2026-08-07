using System.Security.Cryptography;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net.Api;

/// <summary>
/// 微信小程序用户发布内容安全服务。审核记录和 access_token 均存放在租户共享 Redis，
/// 任意 API 节点都可以提交、接收回调和完成保存前复核。
/// </summary>
public sealed class WeChatContentSecurityService
{
    public const string CallbackCoreApiEngineKey = "mci-wechat-content-callback-core";
    public const string UnsafeContentMessage = "你发布的内容含违规信息，请修改后重试。";
    public const string CheckingContentMessage = "内容正在进行安全检测，请稍后重试。";
    public const string UnavailableContentMessage = "内容安全检测暂不可用，请稍后重试。";

    private static readonly TimeSpan ReviewLifetime = TimeSpan.FromDays(2);
    private static readonly TimeSpan AccessTokenLockLifetime = TimeSpan.FromSeconds(15);
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
    };

    private readonly IHttpClientFactory _httpClientFactory;

    public WeChatContentSecurityService(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public static bool IsWeChatMiniProgramRequest(HttpContext context, CurrentToken currentToken = null)
    {
        if (context == null) return false;
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            var authenticatedClaim = context.User.Claims
                .FirstOrDefault(item => item.Type == "ClientType")?.Value;
            if (string.Equals(authenticatedClaim, "WxMiniProgram", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        // ASP.NET JwtBearer 不是吾码登录态的唯一事实源。只有请求令牌仍精确存在于
        // 当前租户共享 Redis 登录态中时，才信任缓存记录的终端类型；禁止只解码
        // 未验证签名的 JWT payload 后把 ClientType 当成可信依据。
        var authorization = context.Request.Headers["Authorization"].ToString();
        var activeToken = DiyToken.GetActiveCachedTokenEntry(currentToken, authorization);
        return string.Equals(activeToken?.ClientType, "WxMiniProgram", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<DosResult> SubmitUploadedImagesAsync(
        DosResult uploadResult,
        DiyUploadParam param,
        CancellationToken cancellationToken)
    {
        if (uploadResult?.Code != 1 || uploadResult.Data == null || param == null) return uploadResult;
        var mustCheck = string.Equals(param._ClientType, "WxMiniProgram", StringComparison.OrdinalIgnoreCase)
                        || param.ContentSecurityRequired == true;
        if (!mustCheck) return uploadResult;

        try
        {
            var dataToken = uploadResult.Data as JToken ?? JToken.FromObject(uploadResult.Data);
            var rows = dataToken is JArray array
                ? array.OfType<JObject>().ToList()
                : dataToken is JObject row
                    ? new List<JObject> { row }
                    : new List<JObject>();
            var imageRows = rows.Where(IsImageRow).ToList();
            if (imageRows.Count == 0) return uploadResult;
            if (param.ContentSecurityLoginCode.DosIsNullOrWhiteSpace())
                return Failure(UnavailableContentMessage);

            var settings = LoadSettings(param.OsClient, requireCallback: true);
            var openId = await ExchangeOpenIdAsync(
                    settings,
                    param.ContentSecurityLoginCode,
                    cancellationToken)
                .ConfigureAwait(false);
            var scene = NormalizeScene(param.ContentSecurityScene);
            var userId = param._CurrentUser?["Id"]?.ToString() ?? "";

            foreach (var item in imageRows)
            {
                var path = ReadPath(item);
                var mediaUrl = item.Value<string>("Url") ?? "";
                if (!Uri.TryCreate(mediaUrl, UriKind.Absolute, out var parsedUrl)
                    || parsedUrl.Scheme != Uri.UriSchemeHttps)
                {
                    throw new WeChatContentSecurityException("AuditMediaUrlUnavailable");
                }

                var review = new WeChatContentSecurityReview
                {
                    ReviewId = Guid.NewGuid().ToString("N"),
                    OsClient = param.OsClient,
                    UserId = userId,
                    FilePath = path,
                    OpenId = openId,
                    Scene = scene,
                    Status = WeChatContentSecurityStatus.Pending,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.Add(ReviewLifetime)
                };
                await SaveReviewAsync(review).ConfigureAwait(false);

                try
                {
                    var response = await PostWithAccessTokenAsync(
                            settings,
                            "/wxa/media_check_async",
                            new JObject
                            {
                                ["media_url"] = mediaUrl,
                                ["media_type"] = 2,
                                ["version"] = 2,
                                ["scene"] = scene,
                                ["openid"] = openId
                            },
                            cancellationToken)
                        .ConfigureAwait(false);
                    var traceId = response["trace_id"]?.ToString();
                    if (!IsTraceId(traceId))
                        throw new WeChatContentSecurityException("MissingTraceId");

                    review.TraceId = traceId;
                    review.UpdatedAt = DateTime.UtcNow;
                    await SaveReviewAsync(review).ConfigureAwait(false);
                    await MicroiEngine.CacheTenant.Cache(review.OsClient)
                        .SetAsync(TraceKey(review.OsClient, traceId), review.ReviewId, ReviewLifetime, When.NotExists)
                        .ConfigureAwait(false);

                    // 极端情况下微信回调可能先于提交响应返回；回调先按 trace_id 暂存，
                    // 建立索引后立即收敛，避免永久停留在 Pending。
                    var earlyStatus = await MicroiEngine.CacheTenant.Cache(review.OsClient)
                        .GetAsync<string>(TraceResultKey(review.OsClient, traceId))
                        .ConfigureAwait(false);
                    if (earlyStatus is WeChatContentSecurityStatus.Passed or WeChatContentSecurityStatus.Rejected)
                    {
                        review.Status = earlyStatus;
                        review.Suggest = earlyStatus == WeChatContentSecurityStatus.Passed ? "pass" : "blocked";
                        review.UpdatedAt = DateTime.UtcNow;
                        await SaveReviewAsync(review).ConfigureAwait(false);
                        await MicroiEngine.CacheTenant.Cache(review.OsClient)
                            .RemoveAsync(TraceResultKey(review.OsClient, traceId))
                            .ConfigureAwait(false);
                    }

                    item["ContentSecurityRequired"] = true;
                    item["ContentSecurityReviewId"] = review.ReviewId;
                    item["ContentSecurityStatus"] = review.Status;
                }
                catch
                {
                    review.Status = WeChatContentSecurityStatus.Error;
                    review.UpdatedAt = DateTime.UtcNow;
                    await SaveReviewAsync(review).ConfigureAwait(false);
                    throw;
                }
            }

            uploadResult.Data = dataToken;
            return uploadResult;
        }
        catch (Exception ex)
        {
            LogFailure(param.OsClient, "SubmitMedia", ex);
            return Failure(UnavailableContentMessage);
        }
        finally
        {
            if (param != null) param.ContentSecurityLoginCode = null;
        }
    }

    public async Task<DosResult> GetStatusAsync(string osClient, string reviewId, string userId)
    {
        try
        {
            osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            if (!IsReviewId(reviewId) || userId.DosIsNullOrWhiteSpace()) return Failure(UnavailableContentMessage);
            var review = await GetReviewAsync(osClient, reviewId).ConfigureAwait(false);
            if (review == null
                || review.ExpiresAt <= DateTime.UtcNow
                || !string.Equals(review.UserId, userId, StringComparison.Ordinal))
                return Failure(UnavailableContentMessage);

            return new DosResult(1, new
            {
                review.ReviewId,
                review.Status
            });
        }
        catch
        {
            return Failure(UnavailableContentMessage);
        }
    }

    public async Task<DosResult> ValidateAvatarAsync(
        string osClient,
        string actorUserId,
        string previousAvatar,
        string requestedAvatar)
    {
        try
        {
            var previousPath = ExtractAvatarMetadata(previousAvatar).Path;
            var requested = ExtractAvatarMetadata(requestedAvatar);
            if ((previousPath.DosIsNullOrWhiteSpace() && requested.Path.DosIsNullOrWhiteSpace())
                || (!previousPath.DosIsNullOrWhiteSpace()
                    && !requested.Path.DosIsNullOrWhiteSpace()
                    && PathsEqual(osClient, previousPath, requested.Path)))
                return new DosResult(1);
            if (requested.Path.DosIsNullOrWhiteSpace() || !IsReviewId(requested.ReviewId))
                return Failure(UnsafeContentMessage);

            var review = await GetReviewAsync(osClient, requested.ReviewId).ConfigureAwait(false);
            if (review == null
                || review.ExpiresAt <= DateTime.UtcNow
                || !string.Equals(review.UserId, actorUserId, StringComparison.Ordinal)
                || !PathsEqual(osClient, review.FilePath, requested.Path))
                return Failure(UnsafeContentMessage);

            return review.Status switch
            {
                WeChatContentSecurityStatus.Passed => new DosResult(1),
                WeChatContentSecurityStatus.Pending => Failure(CheckingContentMessage),
                WeChatContentSecurityStatus.Rejected => Failure(UnsafeContentMessage),
                _ => Failure(UnavailableContentMessage)
            };
        }
        catch (Exception ex)
        {
            LogFailure(osClient, "ValidateAvatar", ex);
            return Failure(UnavailableContentMessage);
        }
    }

    public async Task<DosResult> CheckProfileTextAsync(
        string osClient,
        string loginCode,
        IEnumerable<string> values,
        CancellationToken cancellationToken)
    {
        var content = string.Join("\n", (values ?? Array.Empty<string>())
            .Where(value => !value.DosIsNullOrWhiteSpace())
            .Select(value => value.Trim()));
        if (content.DosIsNullOrWhiteSpace()) return new DosResult(1);
        if (loginCode.DosIsNullOrWhiteSpace()) return Failure(UnavailableContentMessage);

        try
        {
            var settings = LoadSettings(osClient, requireCallback: false);
            var openId = await ExchangeOpenIdAsync(settings, loginCode, cancellationToken).ConfigureAwait(false);
            var response = await PostWithAccessTokenAsync(
                    settings,
                    "/wxa/msg_sec_check",
                    new JObject
                    {
                        ["content"] = content,
                        ["version"] = 2,
                        ["scene"] = 1,
                        ["openid"] = openId
                    },
                    cancellationToken)
                .ConfigureAwait(false);
            var suggest = response["result"]?["suggest"]?.ToString();
            return string.Equals(suggest, "pass", StringComparison.OrdinalIgnoreCase)
                ? new DosResult(1)
                : Failure(UnsafeContentMessage);
        }
        catch (Exception ex)
        {
            LogFailure(osClient, "CheckText", ex);
            return Failure(UnavailableContentMessage);
        }
    }

    public string ResolveCallbackChallenge(
        string osClient,
        string signature,
        string messageSignature,
        string timestamp,
        string nonce,
        string echo)
    {
        try
        {
            var settings = LoadSettings(osClient, requireCallback: true);
            if (VerifySignature(settings.MessageToken, signature, timestamp, nonce)) return echo ?? "";
            if (VerifySignature(settings.MessageToken, messageSignature, timestamp, nonce, echo))
                return DecryptMessage(echo, settings.EncodingAesKey, settings.AppId);
            return null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// 微信后台可使用不带查询参数的 --OsClient--{tenant}-- 地址；普通 HTTP
    /// 也可使用 ?OsClient={tenant}。同时提供时必须一致，且不接受旧的 o 别名。
    /// </summary>
    public static bool TryResolveCallbackTenant(
        string routeOsClient,
        string queryOsClient,
        out string osClient)
    {
        osClient = null;
        try
        {
            var routeTenant = routeOsClient.DosIsNullOrWhiteSpace()
                ? null
                : TenantConfigurationSecurity.NormalizeTenantId(routeOsClient);
            var queryTenant = queryOsClient.DosIsNullOrWhiteSpace()
                ? null
                : TenantConfigurationSecurity.NormalizeTenantId(queryOsClient);
            if (routeTenant.DosIsNullOrWhiteSpace() && queryTenant.DosIsNullOrWhiteSpace()) return false;
            if (!routeTenant.DosIsNullOrWhiteSpace()
                && !queryTenant.DosIsNullOrWhiteSpace()
                && !string.Equals(routeTenant, queryTenant, StringComparison.OrdinalIgnoreCase))
                return false;
            osClient = routeTenant ?? queryTenant;
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> ProcessCallbackAsync(
        string osClient,
        string body,
        string signature,
        string messageSignature,
        string timestamp,
        string nonce)
    {
        try
        {
            var settings = LoadSettings(osClient, requireCallback: true);
            osClient = settings.OsClient;
            // zhy: 微信小程序消息推送当前可能使用 JSON，也保留历史 XML；外层先统一识别格式再读取 Encrypt。
            var envelope = ParseCallbackDocument(body);
            var encrypted = envelope.FindFirstValue("Encrypt");
            string payload;
            if (!encrypted.DosIsNullOrWhiteSpace())
            {
                if (!VerifySignature(settings.MessageToken, messageSignature, timestamp, nonce, encrypted))
                    return false;
                payload = DecryptMessage(encrypted, settings.EncodingAesKey, settings.AppId);
            }
            else
            {
                if (!VerifySignature(settings.MessageToken, signature, timestamp, nonce)) return false;
                payload = body;
            }

            // zhy: 安全模式解密后的正文也可能是 JSON 或 XML，因此内层正文必须再次自动识别格式。
            var document = ParseCallbackDocument(payload);
            var traceId = document.FindFirstValue("trace_id", "TraceId");
            if (!IsTraceId(traceId)) return false;
            var suggests = document.FindValues("suggest")
                .Where(item => !item.DosIsNullOrWhiteSpace())
                .ToList();
            if (suggests.Count == 0) return false;
            var completedStatus = suggests.All(item => string.Equals(item, "pass", StringComparison.OrdinalIgnoreCase))
                ? WeChatContentSecurityStatus.Passed
                : WeChatContentSecurityStatus.Rejected;

            // C# 只承担微信协议验签、AES 解密、AppId 校验和安全字段归一化。
            // 审核状态、系统日志和租户扩展逻辑全部由应用商城交付的接口引擎处理，
            // 保存即生效，无需为了业务调整重新编译发布后端。
            var eventId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
                    $"{osClient}|{traceId}|{completedStatus}")))
                .ToLowerInvariant();
            var result = await MicroiEngine.ApiEngine.RunAsync(
                    CallbackCoreApiEngineKey,
                    new JObject
                    {
                        ["OsClient"] = osClient,
                        ["EventId"] = eventId,
                        ["TraceId"] = traceId,
                        ["Status"] = completedStatus,
                        ["Suggest"] = completedStatus == WeChatContentSecurityStatus.Passed ? "pass" : "blocked",
                        ["Suggests"] = new JArray(suggests),
                        ["ReceivedAtUtc"] = DateTime.UtcNow.ToString("O"),
                        ["ReviewLifetimeSeconds"] = (long)ReviewLifetime.TotalSeconds,
                        ["LockKey"] = $"WechatContentSecurity:Callback:{traceId}"
                    })
                .ConfigureAwait(false);
            return IsSuccessfulApiEngineResult(result);
        }
        catch (Exception ex)
        {
            LogFailure(osClient, "ProcessCallback", ex);
            return false;
        }
    }

    public static bool VerifySignature(string token, string signature, params string[] parts)
    {
        if (token.DosIsNullOrWhiteSpace() || signature.DosIsNullOrWhiteSpace()) return false;
        var values = new[] { token }.Concat(parts ?? Array.Empty<string>())
            .Select(value => value ?? "")
            .OrderBy(value => value, StringComparer.Ordinal);
        var digest = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(string.Concat(values))))
            .ToLowerInvariant();
        var expected = Encoding.ASCII.GetBytes(digest);
        var supplied = Encoding.ASCII.GetBytes(signature.Trim().ToLowerInvariant());
        return expected.Length == supplied.Length && CryptographicOperations.FixedTimeEquals(expected, supplied);
    }

    internal static bool IsSuccessfulApiEngineResult(object result)
    {
        if (result == null) return false;
        try
        {
            var token = result is string text
                ? JToken.Parse(text)
                : result as JToken ?? JToken.FromObject(result);
            return token is JObject model && model.Value<int?>("Code") == 1;
        }
        catch
        {
            return false;
        }
    }

    public static string DecryptMessage(string encrypted, string encodingAesKey, string expectedAppId)
    {
        if (encodingAesKey.DosIsNullOrWhiteSpace())
            throw new WeChatContentSecurityException("MissingEncodingAesKey");
        var keyText = encodingAesKey.Trim();
        var key = Convert.FromBase64String(keyText + new string('=', (4 - keyText.Length % 4) % 4));
        var cipher = Convert.FromBase64String(encrypted);
        using var aes = Aes.Create();
        aes.Key = key;
        aes.IV = key.Take(16).ToArray();
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.None;
        using var decryptor = aes.CreateDecryptor();
        var plain = decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
        if (plain.Length == 0) throw new WeChatContentSecurityException("EmptyEncryptedMessage");
        var padding = plain[^1];
        if (padding is < 1 or > 32 || padding > plain.Length)
            throw new WeChatContentSecurityException("InvalidEncryptedMessagePadding");
        var unpadded = plain.AsSpan(0, plain.Length - padding).ToArray();
        if (unpadded.Length < 20) throw new WeChatContentSecurityException("InvalidEncryptedMessage");
        var messageLength = ((uint)unpadded[16] << 24)
                            | ((uint)unpadded[17] << 16)
                            | ((uint)unpadded[18] << 8)
                            | unpadded[19];
        if (messageLength > int.MaxValue || 20 + (int)messageLength > unpadded.Length)
            throw new WeChatContentSecurityException("InvalidEncryptedMessageLength");
        var message = Encoding.UTF8.GetString(unpadded, 20, (int)messageLength);
        var appId = Encoding.UTF8.GetString(unpadded, 20 + (int)messageLength,
            unpadded.Length - 20 - (int)messageLength);
        if (!string.Equals(appId, expectedAppId, StringComparison.Ordinal))
            throw new WeChatContentSecurityException("EncryptedMessageAppIdMismatch");
        return message;
    }

    private async Task<JObject> PostWithAccessTokenAsync(
        Settings settings,
        string path,
        JObject payload,
        CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 2; attempt++)
        {
            var accessToken = await GetAccessTokenAsync(settings, cancellationToken).ConfigureAwait(false);
            var client = _httpClientFactory.CreateClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(12));
            using var content = new StringContent(
                payload.ToString(Newtonsoft.Json.Formatting.None),
                Encoding.UTF8,
                "application/json");
            using var response = await client.PostAsync(
                    $"https://api.weixin.qq.com{path}?access_token={Uri.EscapeDataString(accessToken)}",
                    content,
                    timeout.Token)
                .ConfigureAwait(false);
            var json = JObject.Parse(await response.Content.ReadAsStringAsync(timeout.Token).ConfigureAwait(false));
            var errorCode = json.Value<int?>("errcode") ?? 0;
            if (errorCode == 0) return json;
            if (attempt == 0 && errorCode is 40014 or 42001)
            {
                await MicroiEngine.CacheTenant.Cache(settings.OsClient)
                    .RemoveAsync(AccessTokenKey(settings.OsClient, settings.AppId))
                    .ConfigureAwait(false);
                continue;
            }
            throw new WeChatContentSecurityException("WechatApiError:" + errorCode);
        }
        throw new WeChatContentSecurityException("WechatApiRetryExhausted");
    }

    private async Task<string> ExchangeOpenIdAsync(
        Settings settings,
        string loginCode,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(12));
        var url = "https://api.weixin.qq.com/sns/jscode2session"
                  + $"?appid={Uri.EscapeDataString(settings.AppId)}"
                  + $"&secret={Uri.EscapeDataString(settings.AppSecret)}"
                  + $"&js_code={Uri.EscapeDataString(loginCode.Trim())}"
                  + "&grant_type=authorization_code";
        using var response = await client.GetAsync(url, timeout.Token).ConfigureAwait(false);
        var json = JObject.Parse(await response.Content.ReadAsStringAsync(timeout.Token).ConfigureAwait(false));
        var openId = json["openid"]?.ToString();
        if (openId.DosIsNullOrWhiteSpace())
            throw new WeChatContentSecurityException("CodeExchangeError:" + (json.Value<int?>("errcode") ?? -1));
        return openId;
    }

    private async Task<string> GetAccessTokenAsync(Settings settings, CancellationToken cancellationToken)
    {
        var cache = MicroiEngine.CacheTenant.Cache(settings.OsClient);
        var database = cache.GetIDatabase();
        var tokenKey = AccessTokenKey(settings.OsClient, settings.AppId);
        var cached = await database.StringGetAsync(tokenKey).ConfigureAwait(false);
        if (!cached.IsNullOrEmpty) return cached.ToString();

        var lockKey = tokenKey + ":Lock";
        var owner = Guid.NewGuid().ToString("N");
        var acquired = await database.LockTakeAsync(lockKey, owner, AccessTokenLockLifetime).ConfigureAwait(false);
        if (!acquired)
        {
            for (var i = 0; i < 10; i++)
            {
                await Task.Delay(200, cancellationToken).ConfigureAwait(false);
                cached = await database.StringGetAsync(tokenKey).ConfigureAwait(false);
                if (!cached.IsNullOrEmpty) return cached.ToString();
            }
            throw new WeChatContentSecurityException("AccessTokenBusy");
        }

        try
        {
            cached = await database.StringGetAsync(tokenKey).ConfigureAwait(false);
            if (!cached.IsNullOrEmpty) return cached.ToString();
            var client = _httpClientFactory.CreateClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(12));
            var url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential"
                      + $"&appid={Uri.EscapeDataString(settings.AppId)}"
                      + $"&secret={Uri.EscapeDataString(settings.AppSecret)}";
            using var response = await client.GetAsync(url, timeout.Token).ConfigureAwait(false);
            var json = JObject.Parse(await response.Content.ReadAsStringAsync(timeout.Token).ConfigureAwait(false));
            var token = json["access_token"]?.ToString();
            if (token.DosIsNullOrWhiteSpace())
                throw new WeChatContentSecurityException("AccessTokenError:" + (json.Value<int?>("errcode") ?? -1));
            var expiresIn = Math.Max(300, (json.Value<int?>("expires_in") ?? 7200) - 300);
            await database.StringSetAsync(tokenKey, token, TimeSpan.FromSeconds(expiresIn)).ConfigureAwait(false);
            return token;
        }
        finally
        {
            await database.LockReleaseAsync(lockKey, owner).ConfigureAwait(false);
        }
    }

    private Settings LoadSettings(string osClient, bool requireCallback)
    {
        osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
        var model = OsClientExtend.GetClient(osClient)?.OsClientModel;
        var settings = new Settings
        {
            OsClient = osClient,
            AppId = model?["WeChatMiniProgramAppId"]?.ToString()?.Trim(),
            AppSecret = model?["WeChatMiniProgramAppSecret"]?.ToString()?.Trim(),
            MessageToken = model?["WeChatMiniProgramMessageToken"]?.ToString()?.Trim(),
            EncodingAesKey = (model?["WeChatMiniProgramAESKey"]
                              ?? model?["WeChatMiniProgramEncodingAESKey"])
                ?.ToString()?.Trim()
        };
        if (settings.AppId.DosIsNullOrWhiteSpace() || settings.AppSecret.DosIsNullOrWhiteSpace())
            throw new WeChatContentSecurityException("MissingMiniProgramCredential");
        if (requireCallback && settings.MessageToken.DosIsNullOrWhiteSpace())
            throw new WeChatContentSecurityException("MissingMessageToken");
        return settings;
    }

    private static XDocument ParseXml(string xml)
    {
        var settings = new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
            MaxCharactersInDocument = 1024 * 1024
        };
        using var textReader = new StringReader(xml ?? "");
        using var reader = XmlReader.Create(textReader, settings);
        return XDocument.Load(reader, LoadOptions.None);
    }

    private static ParsedCallbackDocument ParseCallbackDocument(string content)
    {
        // zhy: 不依赖 Content-Type，按去除空白后的首字符识别 JSON/XML，兼容微信网关可能缺失或改写请求头。
        var text = (content ?? "").Trim();
        if (text.Length > 0 && text[0] == '\uFEFF') text = text[1..].TrimStart();
        if (text.DosIsNullOrWhiteSpace())
            throw new WeChatContentSecurityException("EmptyCallbackBody");
        if (text[0] == '<') return new ParsedCallbackDocument(ParseXml(text), null);
        if (text[0] is not ('{' or '['))
            throw new WeChatContentSecurityException("UnsupportedCallbackFormat");

        // zhy: JSON 限制最大嵌套深度并拒绝重复字段，避免歧义字段覆盖和恶意深层载荷。
        using var stringReader = new StringReader(text);
        using var jsonReader = new JsonTextReader(stringReader)
        {
            DateParseHandling = DateParseHandling.None,
            MaxDepth = 64
        };
        var json = JToken.ReadFrom(jsonReader, new JsonLoadSettings
        {
            DuplicatePropertyNameHandling = DuplicatePropertyNameHandling.Error
        });
        if (jsonReader.Read()) throw new WeChatContentSecurityException("TrailingCallbackContent");
        return new ParsedCallbackDocument(null, json);
    }

    // zhy: 测试入口仅返回指定安全字段，不暴露完整微信回调正文或任何租户密钥。
    private static IReadOnlyList<string> ReadCallbackValues(string content, params string[] names) =>
        ParseCallbackDocument(content).FindValues(names);

    private sealed class ParsedCallbackDocument
    {
        private readonly XDocument _xml;
        private readonly JToken _json;

        public ParsedCallbackDocument(XDocument xml, JToken json)
        {
            _xml = xml;
            _json = json;
        }

        public string FindFirstValue(params string[] names) => FindValues(names).FirstOrDefault();

        public IReadOnlyList<string> FindValues(params string[] names)
        {
            var set = new HashSet<string>(names ?? Array.Empty<string>(), StringComparer.OrdinalIgnoreCase);
            if (_xml != null)
                return _xml.Descendants()
                    .Where(item => set.Contains(item.Name.LocalName))
                    .Select(item => item.Value?.Trim())
                    .Where(item => !item.DosIsNullOrWhiteSpace())
                    .ToList();

            return EnumerateJsonTokens(_json)
                .OfType<JProperty>()
                .Where(property => set.Contains(property.Name)
                                   && property.Value is JValue
                                   && property.Value.Type is not (JTokenType.Null or JTokenType.Undefined))
                .Select(property => property.Value.ToString().Trim())
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .ToList();
        }

        private static IEnumerable<JToken> EnumerateJsonTokens(JToken token)
        {
            if (token == null) yield break;
            yield return token;
            if (token is not JContainer container) yield break;
            foreach (var child in container.Children())
            foreach (var descendant in EnumerateJsonTokens(child))
                yield return descendant;
        }
    }

    private async Task SaveReviewAsync(WeChatContentSecurityReview review)
    {
        await MicroiEngine.CacheTenant.Cache(review.OsClient)
            .SetAsync(ReviewKey(review.OsClient, review.ReviewId), review, ReviewLifetime)
            .ConfigureAwait(false);
    }

    private static async Task<WeChatContentSecurityReview> GetReviewAsync(string osClient, string reviewId)
    {
        if (!IsReviewId(reviewId)) return null;
        return await MicroiEngine.CacheTenant.Cache(osClient)
            .GetAsync<WeChatContentSecurityReview>(ReviewKey(osClient, reviewId))
            .ConfigureAwait(false);
    }

    private static bool IsImageRow(JObject row)
    {
        var extension = Path.GetExtension(ReadPath(row));
        if (extension.DosIsNullOrWhiteSpace()) extension = Path.GetExtension(row.Value<string>("Name") ?? "");
        return ImageExtensions.Contains(extension ?? "");
    }

    private static string ReadPath(JObject row) =>
        row?.Value<string>("Path") ?? row?.Value<string>("FilePathName") ?? "";

    private static (string Path, string ReviewId) ExtractAvatarMetadata(string value)
    {
        var text = (value ?? "").Trim();
        if (text.DosIsNullOrWhiteSpace()) return ("", "");
        try
        {
            var token = JToken.Parse(text);
            var row = token is JArray array ? array.OfType<JObject>().FirstOrDefault() : token as JObject;
            return row == null
                ? (text, "")
                : (ReadPath(row), row.Value<string>("ContentSecurityReviewId") ?? "");
        }
        catch
        {
            return (text, "");
        }
    }

    private static bool PathsEqual(string osClient, string left, string right)
    {
        try
        {
            return string.Equals(
                TenantConfigurationSecurity.NormalizeStoragePath(osClient, left),
                TenantConfigurationSecurity.NormalizeStoragePath(osClient, right),
                StringComparison.Ordinal);
        }
        catch
        {
            return false;
        }
    }

    private static int NormalizeScene(int? scene) => scene is >= 1 and <= 4 ? scene.Value : 1;
    private static bool IsReviewId(string value) =>
        !value.DosIsNullOrWhiteSpace() && value.Length == 32 && value.All(Uri.IsHexDigit);
    private static bool IsTraceId(string value) =>
        !value.DosIsNullOrWhiteSpace()
        && value.Length <= 128
        && value.All(character => char.IsLetterOrDigit(character) || character is '-' or '_');
    private static string ReviewKey(string osClient, string reviewId) =>
        $"Microi:{osClient}:WechatContentSecurity:Review:{reviewId}";
    private static string TraceKey(string osClient, string traceId) =>
        $"Microi:{osClient}:WechatContentSecurity:Trace:{traceId}";
    private static string TraceResultKey(string osClient, string traceId) =>
        $"Microi:{osClient}:WechatContentSecurity:TraceResult:{traceId}";
    private static string AccessTokenKey(string osClient, string appId) =>
        $"Microi:{osClient}:WechatContentSecurity:AccessToken:{appId}";
    private static DosResult Failure(string message) => new(0, null, message);

    private static void LogFailure(string osClient, string action, Exception exception)
    {
        try
        {
            // 不记录请求 URL、login code、openid、用户内容或密钥。
            MicroiEngine.QueueSystemLog(
                osClient,
                "ContentSecurity",
                "WeChat" + action + "Failed",
                "微信内容安全服务调用失败",
                exception is WeChatContentSecurityException ? exception.Message : exception.GetType().Name,
                2);
        }
        catch
        {
            // 日志失败不能改变失败关闭语义。
        }
    }

    private sealed class Settings
    {
        public string OsClient { get; init; }
        public string AppId { get; init; }
        public string AppSecret { get; init; }
        public string MessageToken { get; init; }
        public string EncodingAesKey { get; init; }
    }
}

public static class WeChatContentSecurityStatus
{
    public const string Pending = "Pending";
    public const string Passed = "Passed";
    public const string Rejected = "Rejected";
    public const string Error = "Error";
}

public sealed class WeChatContentSecurityReview
{
    public string ReviewId { get; set; }
    public string OsClient { get; set; }
    public string UserId { get; set; }
    public string FilePath { get; set; }
    public string OpenId { get; set; }
    public string TraceId { get; set; }
    public string Status { get; set; }
    public string Suggest { get; set; }
    public int Scene { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public sealed class WeChatContentSecurityException : Exception
{
    public WeChatContentSecurityException(string message) : base(message) { }
}
