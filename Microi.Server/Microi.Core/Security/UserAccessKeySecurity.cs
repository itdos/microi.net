using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// Browser access keys are long-lived credentials that can only narrow the
    /// live user's permissions. They are exchanged for ordinary short-lived
    /// Microi sessions and are never stored in plaintext.
    /// </summary>
    public static class UserAccessKeySecurity
    {
        public const string TableName = "mci_user_access_key";
        public const string ClaimType = "MicroiAccessKeyId";
        public const string ClientType = "AccessKey";
        public const int MaxActiveKeysPerUser = 20;
        public const int DefaultExpiryDays = 90;
        public const int MaxExpiryDays = 365;
        public const int ExchangeAttemptsPerMinute = 30;

        private static readonly string[] SessionFieldNames =
        {
            "_AccessKeySession",
            "_AccessKeyId",
            "_AccessKeyName",
            "_AccessKeyScopes",
            "_AccessKeyAllowedRoutes",
            "_AccessKeyAllowedTableNames",
            "_AccessKeyAllowedApiEngineKeys",
            "_AccessKeyAllowedDataSourceKeys",
            "_AccessKeyExpiresAt"
        };

        public static bool IsSession(JObject currentUser)
        {
            return currentUser?["_AccessKeySession"]?.Val<bool>() == true;
        }

        public static JObject StripSessionFields(JObject currentUser)
        {
            if (currentUser == null) return null;
            var clone = (JObject)currentUser.DeepClone();
            foreach (var fieldName in SessionFieldNames)
            {
                clone.Remove(fieldName);
            }
            return clone;
        }

        public static IReadOnlyList<string> ParseStringList(JToken value)
        {
            if (value == null
                || value.Type == JTokenType.Null
                || value.Type == JTokenType.Undefined)
            {
                return Array.Empty<string>();
            }

            IEnumerable<JToken> tokens;
            if (value is JArray array)
            {
                tokens = array;
            }
            else
            {
                var raw = value.ToString().Trim();
                if (raw.DosIsNullOrWhiteSpace())
                {
                    return Array.Empty<string>();
                }
                try
                {
                    tokens = JArray.Parse(raw);
                }
                catch
                {
                    tokens = raw
                        .Split(new[] { ',', ';', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(JToken.FromObject);
                }
            }

            return tokens
                .Select(token => token?.Type == JTokenType.Object
                    ? token["Key"]?.ToString() ?? token["Id"]?.ToString()
                    : token?.ToString())
                .Where(item => !item.DosIsNullOrWhiteSpace())
                .Select(item => item.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        public static string SerializeStringList(IEnumerable<string> values)
        {
            return JArray.FromObject((values ?? Array.Empty<string>())
                    .Where(item => !item.DosIsNullOrWhiteSpace())
                    .Select(item => item.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase))
                .ToString(Formatting.None);
        }

        public static string NormalizeRoute(string route)
        {
            var value = (route ?? "").Trim();
            if (value.DosIsNullOrWhiteSpace()) return "";
            if (Uri.TryCreate(value, UriKind.Absolute, out var absolute))
            {
                value = absolute.Fragment?.TrimStart('#') ?? "";
            }
            var queryIndex = value.IndexOf('?');
            if (queryIndex >= 0) value = value.Substring(0, queryIndex);
            var hashIndex = value.IndexOf('#');
            if (hashIndex >= 0) value = value.Substring(hashIndex + 1);
            if (!value.StartsWith("/")) value = "/" + value;
            while (value.Length > 1 && value.EndsWith("/"))
            {
                value = value.Substring(0, value.Length - 1);
            }
            return value;
        }

        public static bool HasScope(JObject currentUser, string scope)
        {
            return !scope.DosIsNullOrWhiteSpace()
                   && ParseStringList(currentUser?["_AccessKeyScopes"])
                       .Contains(scope.Trim(), StringComparer.OrdinalIgnoreCase);
        }

        public static bool IsRouteAllowed(JObject currentUser, string route)
        {
            if (!IsSession(currentUser)) return true;
            var normalized = NormalizeRoute(route);
            return !normalized.DosIsNullOrWhiteSpace()
                   && ParseStringList(currentUser["_AccessKeyAllowedRoutes"])
                       .Select(NormalizeRoute)
                       .Contains(normalized, StringComparer.OrdinalIgnoreCase);
        }

        public static bool IsTableOperationAllowed(
            JObject currentUser,
            string tableName,
            bool isRead,
            bool isExport = false)
        {
            if (!IsSession(currentUser)) return true;
            var requiredScope = isExport ? "form:export" : isRead ? "form:read" : "form:write";
            if (!HasScope(currentUser, requiredScope)) return false;
            return ParseStringList(currentUser["_AccessKeyAllowedTableNames"])
                .Contains((tableName ?? "").Trim(), StringComparer.OrdinalIgnoreCase);
        }

        public static bool IsApiEngineAllowed(JObject currentUser, string apiEngineKey)
        {
            return !IsSession(currentUser)
                   || (HasScope(currentUser, "api-engine:run")
                       && ParseStringList(currentUser["_AccessKeyAllowedApiEngineKeys"])
                           .Contains((apiEngineKey ?? "").Trim(), StringComparer.OrdinalIgnoreCase));
        }

        public static bool IsDataSourceAllowed(JObject currentUser, string dataSourceKey)
        {
            return !IsSession(currentUser)
                   || (HasScope(currentUser, "data-source:run")
                       && ParseStringList(currentUser["_AccessKeyAllowedDataSourceKeys"])
                           .Contains((dataSourceKey ?? "").Trim(), StringComparer.OrdinalIgnoreCase));
        }

        public static bool IsApiPathAllowed(JObject currentUser, string requestPath)
        {
            if (!IsSession(currentUser)) return true;
            var path = (requestPath ?? "").Trim().TrimEnd('/').ToLowerInvariant();
            if (path == "/api/sysuser/tokenlogin"
                || path == "/api/sysuser/getcurrentuser")
            {
                return true;
            }
            if (path.StartsWith("/api/formengine/", StringComparison.Ordinal))
            {
                var action = path.Substring("/api/formengine/".Length);
                var readActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "getformdata",
                    "gettabledata",
                    "gettabletree",
                    "gettabledataanonymous",
                    "getformdataanonymous"
                };
                return readActions.Contains(action) && HasScope(currentUser, "form:read");
            }
            if (path == "/api/apiengine/run")
            {
                return HasScope(currentUser, "api-engine:run");
            }
            if (path == "/api/datasourceengine/run")
            {
                return HasScope(currentUser, "data-source:run");
            }
            if (path.StartsWith("/api/hdfs/", StringComparison.Ordinal))
            {
                return HasScope(currentUser, "file:read");
            }
            return false;
        }

        public static string HashCredential(string credential)
        {
            byte[] bytes;
            using (var sha256 = SHA256.Create())
            {
                bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(credential ?? ""));
            }
            var builder = new StringBuilder(bytes.Length * 2);
            foreach (var value in bytes)
            {
                builder.Append(value.ToString("X2"));
            }
            return builder.ToString();
        }

        public static bool FixedTimeHashEquals(string left, string right)
        {
            if (left.DosIsNullOrWhiteSpace() || right.DosIsNullOrWhiteSpace()) return false;
            var normalizedLeft = left.Trim().ToUpperInvariant();
            var normalizedRight = right.Trim().ToUpperInvariant();
            if (normalizedLeft.Length != 64 || normalizedRight.Length != 64) return false;
            var leftBytes = Encoding.ASCII.GetBytes(normalizedLeft);
            var rightBytes = Encoding.ASCII.GetBytes(normalizedRight);
            return leftBytes.Length == rightBytes.Length
                   && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
        }

        public static (string Credential, string Prefix) GenerateCredential()
        {
            // 48 public bits keep indexed lookup prefixes compact while the
            // 128-bit secret retains mainstream bearer-token strength. The
            // resulting credential is only 41 characters including the
            // vendor prefix and separator.
            var publicBytes = new byte[6];
            var secretBytes = new byte[16];
            using (var random = RandomNumberGenerator.Create())
            {
                random.GetBytes(publicBytes);
                random.GetBytes(secretBytes);
            }
            var prefix = "microi_ak_" + Base64Url(publicBytes);
            return (prefix + "." + Base64Url(secretBytes), prefix);
        }

        public static bool TryGetPrefix(string credential, out string prefix)
        {
            prefix = "";
            var value = (credential ?? "").Trim();
            var separator = value.IndexOf('.');
            if (separator <= 6 || separator >= value.Length - 1) return false;
            prefix = value.Substring(0, separator);
            return prefix.StartsWith("microi_ak_", StringComparison.Ordinal)
                   && prefix.Length <= 50
                   && value.Length <= 200;
        }

        private static string Base64Url(byte[] bytes)
        {
            return Convert.ToBase64String(bytes)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }

        public static bool IsExpiryActive(string expiresAt, DateTime now)
        {
            if (expiresAt.DosIsNullOrWhiteSpace()) return true;
            return DateTime.TryParse(expiresAt, out var expiry) && expiry > now;
        }
    }

    public sealed class UserAccessKeyRuntime
    {
        public string Id { get; set; }
        public string TargetUserId { get; set; }
        public string Name { get; set; }
        public string Scopes { get; set; }
        public string AllowedRoutes { get; set; }
        public string AllowedTableNames { get; set; }
        public string AllowedApiEngineKeys { get; set; }
        public string AllowedDataSourceKeys { get; set; }
        public string ExpiresAt { get; set; }
        public int State { get; set; }
    }

    public static class UserAccessKeyService
    {
        private static readonly TimeSpan RuntimeCacheTtl = TimeSpan.FromSeconds(30);

        private static string RuntimeCacheKey(string osClient, string id)
        {
            return $"Microi:{osClient}:UserAccessKey:Runtime:{id}";
        }

        private static JObject ToPublicRow(object data)
        {
            if (data == null) return null;
            var row = data as JObject ?? JObject.FromObject(data);
            var clone = (JObject)row.DeepClone();
            clone.Remove("SecretHash");
            return clone;
        }

        private static bool IsRuntimeActive(UserAccessKeyRuntime runtime)
        {
            if (runtime == null || runtime.State != 1 || runtime.Id.DosIsNullOrWhiteSpace())
            {
                return false;
            }
            return UserAccessKeySecurity.IsExpiryActive(runtime.ExpiresAt, DateTime.Now);
        }

        private static async Task<UserAccessKeyRuntime> GetRuntimeAsync(
            string osClient,
            string accessKeyId)
        {
            if (osClient.DosIsNullOrWhiteSpace() || accessKeyId.DosIsNullOrWhiteSpace())
            {
                return null;
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var cacheKey = RuntimeCacheKey(osClient, accessKeyId);
            try
            {
                var cached = await cache.GetAsync<UserAccessKeyRuntime>(cacheKey).ConfigureAwait(false);
                if (cached != null) return IsRuntimeActive(cached) ? cached : null;
            }
            catch
            {
            }

            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                UserAccessKeySecurity.TableName,
                new
                {
                    OsClient = osClient,
                    Id = accessKeyId,
                    _SelectFields = new[]
                    {
                        "Id", "TargetUserId", "Name", "Scopes", "AllowedRoutes",
                        "AllowedTableNames", "AllowedApiEngineKeys", "AllowedDataSourceKeys",
                        "ExpiresAt", "State"
                    }
                }).ConfigureAwait(false);
            if (result.Code != 1 || result.Data == null) return null;
            JObject row = JObject.FromObject((object)result.Data);
            var runtime = row.ToObject<UserAccessKeyRuntime>();
            if (!IsRuntimeActive(runtime)) return null;
            try
            {
                await cache.SetAsync(cacheKey, runtime, RuntimeCacheTtl).ConfigureAwait(false);
            }
            catch
            {
            }
            return runtime;
        }

        public static async Task<DosResult<JObject>> ApplySessionScopeAsync(
            JObject sharedCurrentUser,
            string accessKeyId,
            string osClient)
        {
            if (accessKeyId.DosIsNullOrWhiteSpace())
            {
                return new DosResult<JObject>(1, UserAccessKeySecurity.StripSessionFields(sharedCurrentUser));
            }
            var runtime = await GetRuntimeAsync(osClient, accessKeyId).ConfigureAwait(false);
            var cleanUser = UserAccessKeySecurity.StripSessionFields(sharedCurrentUser);
            if (runtime == null
                || cleanUser == null
                || !string.Equals(
                    cleanUser["Id"]?.ToString(),
                    runtime.TargetUserId,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult<JObject>(1001, null, "访问密钥已失效、被吊销或已过期。");
            }

            cleanUser["_AccessKeySession"] = true;
            cleanUser["_AccessKeyId"] = runtime.Id;
            cleanUser["_AccessKeyName"] = runtime.Name ?? "";
            cleanUser["_AccessKeyScopes"] = JArray.FromObject(
                UserAccessKeySecurity.ParseStringList(JToken.FromObject(runtime.Scopes ?? "")));
            cleanUser["_AccessKeyAllowedRoutes"] = JArray.FromObject(
                UserAccessKeySecurity.ParseStringList(JToken.FromObject(runtime.AllowedRoutes ?? "")));
            cleanUser["_AccessKeyAllowedTableNames"] = JArray.FromObject(
                UserAccessKeySecurity.ParseStringList(JToken.FromObject(runtime.AllowedTableNames ?? "")));
            cleanUser["_AccessKeyAllowedApiEngineKeys"] = JArray.FromObject(
                UserAccessKeySecurity.ParseStringList(JToken.FromObject(runtime.AllowedApiEngineKeys ?? "")));
            cleanUser["_AccessKeyAllowedDataSourceKeys"] = JArray.FromObject(
                UserAccessKeySecurity.ParseStringList(JToken.FromObject(runtime.AllowedDataSourceKeys ?? "")));
            cleanUser["_AccessKeyExpiresAt"] = runtime.ExpiresAt ?? "";
            cleanUser["_IsAdmin"] = false;
            return new DosResult<JObject>(1, cleanUser);
        }

        public static async Task<DosResult> CreateAsync(
            string osClient,
            JObject targetUser,
            JObject operatorUser,
            string name,
            IEnumerable<string> scopes,
            IEnumerable<string> allowedRoutes,
            IEnumerable<string> allowedTableNames,
            IEnumerable<string> allowedApiEngineKeys,
            IEnumerable<string> allowedDataSourceKeys,
            bool permanent,
            string expiresAt,
            string remark)
        {
            if (targetUser == null || operatorUser == null)
                return new DosResult(0, null, "用户身份不能为空。");
            var targetUserId = targetUser["Id"]?.ToString();
            if (targetUserId.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "目标用户不能为空。");
            if (UserAccessKeySecurity.IsSession(operatorUser))
                return new DosResult(0, null, "访问密钥会话不能创建新的访问密钥。");

            var normalizedName = (name ?? "").Trim();
            if (normalizedName.DosIsNullOrWhiteSpace() || normalizedName.Length > 200)
                return new DosResult(0, null, "密钥名称不能为空且不能超过200个字符。");

            var normalizedScopes = (scopes ?? new[] { "page:open", "form:read" })
                .Where(item => !item.DosIsNullOrWhiteSpace())
                .Select(item => item.Trim().ToLowerInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            var supportedScopes = new HashSet<string>(new[]
            {
                "page:open", "form:read", "form:write", "form:export",
                "api-engine:run", "data-source:run", "file:read"
            }, StringComparer.OrdinalIgnoreCase);
            if (normalizedScopes.Length == 0 || normalizedScopes.Any(scope => !supportedScopes.Contains(scope)))
                return new DosResult(0, null, "密钥权限范围不合法。");
            if (!normalizedScopes.Contains("page:open", StringComparer.OrdinalIgnoreCase))
                return new DosResult(0, null, "浏览器访问密钥必须包含 page:open 权限。");

            var routes = (allowedRoutes ?? Array.Empty<string>())
                .Select(UserAccessKeySecurity.NormalizeRoute)
                .Where(route => !route.DosIsNullOrWhiteSpace()
                                && !route.Equals("/login", StringComparison.OrdinalIgnoreCase)
                                && !route.Equals("/access-login", StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            if (routes.Length == 0)
                return new DosResult(0, null, "至少需要指定一个允许访问的页面路由。");
            if (routes.Any(route => route.Length > 500))
                return new DosResult(0, null, "页面路由不能超过500个字符。");

            var expiry = DateTime.Now.AddDays(UserAccessKeySecurity.DefaultExpiryDays);
            if (!permanent && !expiresAt.DosIsNullOrWhiteSpace()
                && (!DateTime.TryParse(expiresAt, out expiry)
                    || expiry <= DateTime.Now
                    || expiry > DateTime.Now.AddDays(UserAccessKeySecurity.MaxExpiryDays)))
            {
                return new DosResult(0, null, $"到期时间必须晚于当前时间且不超过{UserAccessKeySecurity.MaxExpiryDays}天。");
            }

            DosResult operationResult = null;
            var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
            {
                Key = $"Microi:{osClient}:UserAccessKey:{targetUserId}:Manage",
                OsClient = osClient,
                Expiry = TimeSpan.FromSeconds(10),
                RetryIntervalMs = 20,
                UseExponentialBackoff = true
            }, async () =>
            {
                var existing = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(
                    UserAccessKeySecurity.TableName,
                    new
                    {
                        OsClient = osClient,
                        _Where = new List<object>
                        {
                            new List<object> { "TargetUserId", "=", targetUserId },
                            new List<object> { "State", "=", 1 }
                        },
                        _SelectFields = new[] { "Id", "ExpiresAt" },
                        _PageIndex = 1,
                        _PageSize = UserAccessKeySecurity.MaxActiveKeysPerUser + 1
                    }).ConfigureAwait(false);
                var activeCount = existing.Code == 1
                    ? existing.Data.Count(item =>
                    {
                        JObject row = JObject.FromObject((object)item);
                        return UserAccessKeySecurity.IsExpiryActive(
                            row["ExpiresAt"]?.ToString(),
                            DateTime.Now);
                    })
                    : 0;
                if (activeCount >= UserAccessKeySecurity.MaxActiveKeysPerUser)
                {
                    operationResult = new DosResult(
                        0,
                        null,
                        $"每个帐号最多允许{UserAccessKeySecurity.MaxActiveKeysPerUser}个未过期的访问密钥。");
                    return;
                }

                var generated = UserAccessKeySecurity.GenerateCredential();
                var id = Ulid.NewUlid().ToString();
                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                var row = new JObject
                {
                    ["Id"] = id,
                    ["TargetUserId"] = targetUserId,
                    ["TargetAccount"] = targetUser["Account"]?.ToString() ?? "",
                    ["Name"] = normalizedName,
                    ["KeyPrefix"] = generated.Prefix,
                    ["SecretHash"] = UserAccessKeySecurity.HashCredential(generated.Credential),
                    ["Scopes"] = UserAccessKeySecurity.SerializeStringList(normalizedScopes),
                    ["AllowedRoutes"] = UserAccessKeySecurity.SerializeStringList(routes),
                    ["AllowedTableNames"] = UserAccessKeySecurity.SerializeStringList(allowedTableNames),
                    ["AllowedApiEngineKeys"] = UserAccessKeySecurity.SerializeStringList(allowedApiEngineKeys),
                    ["AllowedDataSourceKeys"] = UserAccessKeySecurity.SerializeStringList(allowedDataSourceKeys),
                    ["ExpiresAt"] = permanent
                        ? JValue.CreateNull()
                        : new JValue(expiry.ToString("yyyy-MM-dd HH:mm:ss")),
                    ["State"] = 1,
                    ["UseCount"] = 0,
                    ["Remark"] = (remark ?? "").Trim(),
                    ["CreateTime"] = now,
                    ["UpdateTime"] = now,
                    ["CreateUser"] = operatorUser["Id"]?.ToString() ?? "",
                    ["UserId"] = operatorUser["Id"]?.ToString() ?? "",
                    ["UserName"] = operatorUser["Name"]?.ToString() ?? "",
                    ["OsClient"] = osClient,
                    ["IsDeleted"] = 0
                };
                var addResult = await MicroiEngine.FormEngine.AddFormDataAsync(
                    UserAccessKeySecurity.TableName,
                    row).ConfigureAwait(false);
                operationResult = addResult.Code == 1
                    ? new DosResult(1, new
                    {
                        AccessKey = generated.Credential,
                        LoginPath = "/#/access-login?access_key="
                                    + Uri.EscapeDataString(generated.Credential)
                                    + "&redirect="
                                    + Uri.EscapeDataString(routes[0]),
                        Record = ToPublicRow(row)
                    }, "访问密钥创建成功。明文仅本次返回，请立即妥善保存。")
                    : new DosResult(addResult.Code, null, addResult.Msg);
            }).ConfigureAwait(false);

            if (lockResult.Code != 1)
            {
                return new DosResult(
                    lockResult.Code,
                    null,
                    lockResult.Msg.DosIsNullOrWhiteSpace() ? "访问密钥管理繁忙，请稍后重试。" : lockResult.Msg);
            }
            return operationResult ?? new DosResult(0, null, "访问密钥创建失败。");
        }

        public static async Task<DosResult> ListAsync(string osClient, string targetUserId)
        {
            var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(
                UserAccessKeySecurity.TableName,
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "TargetUserId", "=", targetUserId }
                    },
                    _SelectFields = new[]
                    {
                        "Id", "TargetUserId", "TargetAccount", "Name", "KeyPrefix", "Scopes",
                        "AllowedRoutes", "AllowedTableNames", "AllowedApiEngineKeys",
                        "AllowedDataSourceKeys", "ExpiresAt", "State", "RevokedAt",
                        "LastUsedAt", "LastUsedIp", "LastUsedDid", "UseCount", "Remark",
                        "CreateTime", "CreateUser"
                    },
                    _OrderBy = "CreateTime",
                    _OrderByType = "DESC",
                    _PageIndex = 1,
                    _PageSize = 100
                }).ConfigureAwait(false);
            if (result.Code != 1)
                return new DosResult(result.Code, null, result.Msg);
            return new DosResult(
                1,
                ((IEnumerable<dynamic>)result.Data)
                    .Select(item => ToPublicRow((object)item))
                    .ToList(),
                "",
                result.DataCount);
        }

        public static async Task<DosResult> RevokeAsync(
            string osClient,
            string accessKeyId,
            string operatorUserId,
            bool isAdmin)
        {
            var current = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                UserAccessKeySecurity.TableName,
                new
                {
                    OsClient = osClient,
                    Id = accessKeyId,
                    _SelectFields = new[] { "Id", "TargetUserId", "State" }
                }).ConfigureAwait(false);
            if (current.Code != 1 || current.Data == null)
                return new DosResult(0, null, "访问密钥不存在。");
            JObject row = JObject.FromObject((object)current.Data);
            if (!isAdmin
                && !string.Equals(
                    row["TargetUserId"]?.ToString(),
                    operatorUserId,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(0, null, "无权吊销该访问密钥。");
            }
            if (row["State"]?.Val<int>() == 2)
                return new DosResult(1, ToPublicRow(row), "访问密钥已处于吊销状态。");

            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var db = OsClientExtend.GetClient(osClient)?.Db;
            if (db == null)
                return new DosResult(0, null, "租户数据库连接不存在。");

            // A conditional database update is both multi-node safe and idempotent.
            // This control-plane table must not depend on user-configured form events.
            var affected = db.FromSql(
                    "UPDATE mci_user_access_key " +
                    "SET State=@p0, RevokedAt=@p1, RevokedBy=@p2, UpdateTime=@p1 " +
                    "WHERE Id=@p3 AND State=@p4")
                .AddInParameter("@p0", 2)
                .AddInParameter("@p1", now)
                .AddInParameter("@p2", operatorUserId ?? "")
                .AddInParameter("@p3", accessKeyId)
                .AddInParameter("@p4", 1)
                .ExecuteNonQuery();
            if (affected > 0)
            {
                try
                {
                    await MicroiEngine.CacheTenant.Cache(osClient)
                        .RemoveAsync(RuntimeCacheKey(osClient, accessKeyId))
                        .ConfigureAwait(false);
                }
                catch
                {
                }
            }
            row["State"] = 2;
            row["RevokedAt"] = now;
            row["RevokedBy"] = operatorUserId ?? "";
            return new DosResult(1, ToPublicRow(row),
                affected > 0 ? "访问密钥已吊销。" : "访问密钥已处于吊销状态。");
        }

        public static async Task<DosResult> ExchangeAsync(
            string osClient,
            string credential,
            string did,
            string ip)
        {
            if (osClient.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "OsClient不能为空。");
            if (!UserAccessKeySecurity.TryGetPrefix(credential, out var prefix))
                return new DosResult(1002, null, "访问密钥格式不正确。");

            try
            {
                var rateKey = $"Microi:{osClient}:UserAccessKey:ExchangeRate:"
                              + UserAccessKeySecurity.HashCredential(ip ?? "").Substring(0, 16)
                              + ":" + DateTime.UtcNow.ToString("yyyyMMddHHmm");
                var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
                var attempts = await database.StringIncrementAsync(rateKey).ConfigureAwait(false);
                if (attempts == 1)
                    await database.KeyExpireAsync(rateKey, TimeSpan.FromMinutes(2)).ConfigureAwait(false);
                if (attempts > UserAccessKeySecurity.ExchangeAttemptsPerMinute)
                    return new DosResult(0, null, "访问密钥尝试过于频繁，请稍后重试。");
            }
            catch
            {
                // The shared database and cryptographic verification remain authoritative.
                // A transient rate-limit cache failure must not turn a valid kiosk link into
                // an outage, but is recorded for operators.
                MicroiEngine.QueueSystemLog(
                    osClient,
                    "UserAccessKey",
                    "RateLimitUnavailable",
                    "访问密钥兑换限流缓存不可用",
                    "Redis rate limiter unavailable",
                    2);
            }

            var lookup = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                UserAccessKeySecurity.TableName,
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "KeyPrefix", "=", prefix },
                        new List<object> { "State", "=", 1 }
                    },
                    _SelectFields = new[]
                    {
                        "Id", "TargetUserId", "SecretHash", "ExpiresAt", "State"
                    }
                }).ConfigureAwait(false);
            if (lookup.Code != 1 || lookup.Data == null)
                return new DosResult(1002, null, "访问密钥无效。");

            JObject keyRow = JObject.FromObject((object)lookup.Data);
            var calculatedHash = UserAccessKeySecurity.HashCredential((credential ?? "").Trim());
            if (!UserAccessKeySecurity.FixedTimeHashEquals(
                    calculatedHash,
                    keyRow["SecretHash"]?.ToString()))
            {
                return new DosResult(1002, null, "访问密钥无效。");
            }
            var expiresAtText = keyRow["ExpiresAt"]?.ToString();
            if (!UserAccessKeySecurity.IsExpiryActive(expiresAtText, DateTime.Now))
            {
                return new DosResult(1001, null, "访问密钥已过期。");
            }

            var userResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                "sys_user",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Id", "=", keyRow["TargetUserId"]?.ToString() },
                        new List<object> { "State", "=", 1 },
                        new List<object> { "IsDeleted", "<>", 1 }
                    },
                    _SelectFields = new[]
                    {
                        "Id", "No", "Account", "Name", "DeptId", "DeptName", "DeptCode",
                        "DeptIds", "RoleIds", "Phone", "State", "Remark", "Avatar", "Sex",
                        "Email", "Level", "CreateTime", "UpdateTime"
                    }
                }).ConfigureAwait(false);
            if (userResult.Code != 1 || userResult.Data == null)
                return new DosResult(1001, null, "访问密钥所属帐号已停用或不存在。");

            JObject currentUser = new DiyToken().SetSysUserRoleInfo(
                (object)userResult.Data,
                osClient);
            var accessKeyId = keyRow["Id"]?.ToString();
            var tokenResult = await new DiyToken().GetAccessToken(new DiyTokenParam
            {
                CurrentUser = currentUser,
                OsClient = osClient,
                _ClientType = UserAccessKeySecurity.ClientType,
                Did = did,
                AccessKeyId = accessKeyId
            }).ConfigureAwait(false);
            if (tokenResult.Code != 1)
                return new DosResult(tokenResult.Code, null, tokenResult.Msg);

            var scopedUser = await ApplySessionScopeAsync(currentUser, accessKeyId, osClient)
                .ConfigureAwait(false);
            if (scopedUser.Code != 1)
                return new DosResult(scopedUser.Code, null, scopedUser.Msg);

            try
            {
                var db = OsClientExtend.GetClient(osClient)?.Db;
                db?.FromSql(
                        "UPDATE mci_user_access_key " +
                        "SET LastUsedAt=@p0, LastUsedIp=@p1, LastUsedDid=@p2, " +
                        "UseCount=COALESCE(UseCount,0)+1, UpdateTime=@p0 WHERE Id=@p3")
                    .AddInParameter("@p0", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                    .AddInParameter("@p1", (ip ?? "").Trim())
                    .AddInParameter("@p2", (did ?? "").Trim())
                    .AddInParameter("@p3", accessKeyId)
                    .ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(
                    osClient,
                    "UserAccessKey",
                    "UsageAuditFailed",
                    "访问密钥使用审计更新失败",
                    ex.ToString(),
                    2,
                    false,
                    accessKeyId);
            }

            var allowedRouteValues = UserAccessKeySecurity.ParseStringList(
                (JToken)scopedUser.Data["_AccessKeyAllowedRoutes"]);
            var redirectPath = allowedRouteValues
                .Select(route => UserAccessKeySecurity.NormalizeRoute(route))
                .FirstOrDefault();
            return new DosResult(
                1,
                scopedUser.Data,
                "访问密钥兑换成功。",
                null,
                new
                {
                    RedirectPath = redirectPath,
                    ExpiresAt = expiresAtText.DosIsNullOrWhiteSpace() ? null : expiresAtText,
                    Permanent = expiresAtText.DosIsNullOrWhiteSpace()
                });
        }
    }
}
