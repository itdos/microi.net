using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// 文件上传的租户动态限制与平台绝对安全上限。
    /// 业务配置只从当前租户 sys_osclients 读取；未填写时使用代码默认值，
    /// 最终结果仍不能突破不可配置的 Absolute* 灾难保护上限。
    /// </summary>
    public sealed class FileUploadSecurityOptions
    {
        public const int DefaultMaxFileMegabytes = 100;
        public const int DefaultMaxTotalMegabytes = 200;
        public const int DefaultMaxFileCount = 10;
        public const int DefaultDailyUserQuotaMegabytes = 2048;
        public const int DefaultDailyTenantQuotaMegabytes = 20480;
        public const int DefaultAbsoluteMaxFileMegabytes = 1024;
        public const int DefaultAbsoluteMaxTotalMegabytes = 2048;
        public const int DefaultAbsoluteMaxFileCount = 100;
        public const int DefaultAbsoluteDailyQuotaMegabytes =
            10 * 1024 * 1024;

        public long MaxFileBytes { get; set; }
        public long MaxTotalBytes { get; set; }
        public int MaxFileCount { get; set; }
        public long DailyUserQuotaBytes { get; set; }
        public long DailyTenantQuotaBytes { get; set; }
        /// <summary>
        /// 是否允许当前租户的交互式文件上传。空配置保持启用；
        /// 关闭后仍保留平台内部受控上传的硬大小限制。
        /// </summary>
        public bool UploadEnabled { get; set; } = true;

        /// <summary>
        /// 按“当前租户 SaaS 配置 > 代码默认值”加载业务限额，
        /// 再应用独立、不可由安装参数放大的 Absolute* 平台灾难保护上限。
        /// </summary>
        public static FileUploadSecurityOptions Load(JObject tenantConfig = null)
        {
            var fallbackDefaults = new FileUploadSecurityOptions
            {
                MaxFileBytes = DefaultMaxFileMegabytes * 1024L * 1024L,
                MaxTotalBytes = DefaultMaxTotalMegabytes * 1024L * 1024L,
                MaxFileCount = DefaultMaxFileCount,
                DailyUserQuotaBytes =
                    DefaultDailyUserQuotaMegabytes * 1024L * 1024L,
                DailyTenantQuotaBytes =
                    DefaultDailyTenantQuotaMegabytes * 1024L * 1024L,
                UploadEnabled = true
            };

            return ApplyTenantOverrides(
                fallbackDefaults,
                tenantConfig,
                CreateCodeAbsoluteCaps());
        }

        /// <summary>
        /// 将 sys_osclients 的租户级配置应用到代码默认值，最后再应用独立绝对上限。
        /// 此方法为纯函数，便于升级兼容和单元测试。
        /// </summary>
        public static FileUploadSecurityOptions ApplyTenantOverrides(
            FileUploadSecurityOptions fallbackDefaults,
            JObject tenantConfig,
            FileUploadSecurityOptions absoluteCaps = null)
        {
            if (fallbackDefaults == null)
                throw new ArgumentNullException(nameof(fallbackDefaults));
            absoluteCaps ??= CreateCodeAbsoluteCaps();

            var result = new FileUploadSecurityOptions
            {
                MaxFileBytes = fallbackDefaults.MaxFileBytes,
                MaxTotalBytes = fallbackDefaults.MaxTotalBytes,
                MaxFileCount = fallbackDefaults.MaxFileCount,
                DailyUserQuotaBytes = fallbackDefaults.DailyUserQuotaBytes,
                DailyTenantQuotaBytes =
                    fallbackDefaults.DailyTenantQuotaBytes,
                UploadEnabled = fallbackDefaults.UploadEnabled
            };
            if (tenantConfig != null)
            {
                if (TryReadBoolean(
                        tenantConfig["FileUploadEnabled"],
                        out var uploadEnabled))
                {
                    result.UploadEnabled = uploadEnabled;
                }

                result.MaxFileBytes = ReadTenantMegabytes(
                    tenantConfig,
                    "FileUploadMaxFileMB",
                    result.MaxFileBytes);
                result.MaxTotalBytes = ReadTenantMegabytes(
                    tenantConfig,
                    "FileUploadMaxRequestMB",
                    result.MaxTotalBytes);
                result.MaxFileCount = ReadTenantPositiveInt(
                    tenantConfig,
                    "FileUploadMaxCount",
                    result.MaxFileCount);
                result.DailyUserQuotaBytes = ReadTenantMegabytes(
                    tenantConfig,
                    "FileUploadDailyUserQuotaMB",
                    result.DailyUserQuotaBytes);
                result.DailyTenantQuotaBytes = ReadTenantMegabytes(
                    tenantConfig,
                    "FileUploadDailyTenantQuotaMB",
                    result.DailyTenantQuotaBytes);
            }

            result.MaxFileBytes = Math.Min(
                result.MaxFileBytes,
                absoluteCaps.MaxFileBytes);
            result.MaxTotalBytes = Math.Min(
                result.MaxTotalBytes,
                absoluteCaps.MaxTotalBytes);
            result.MaxFileCount = Math.Min(
                result.MaxFileCount,
                absoluteCaps.MaxFileCount);
            result.DailyUserQuotaBytes = Math.Min(
                result.DailyUserQuotaBytes,
                absoluteCaps.DailyUserQuotaBytes);
            result.DailyTenantQuotaBytes = Math.Min(
                result.DailyTenantQuotaBytes,
                absoluteCaps.DailyTenantQuotaBytes);
            result.UploadEnabled =
                absoluteCaps.UploadEnabled && result.UploadEnabled;

            // 任一更小的日额度都必须能真正限制单次上传。
            result.MaxTotalBytes = Math.Min(
                result.MaxTotalBytes,
                Math.Min(
                    result.DailyUserQuotaBytes,
                    result.DailyTenantQuotaBytes));
            result.MaxFileBytes = Math.Min(result.MaxFileBytes, result.MaxTotalBytes);
            return result;
        }

        private static long ReadTenantMegabytes(
            JObject tenantConfig,
            string fieldName,
            long fallbackBytes)
        {
            if (!TryReadPositiveLong(tenantConfig?[fieldName], out var megabytes))
            {
                return fallbackBytes;
            }

            try
            {
                return checked(megabytes * 1024L * 1024L);
            }
            catch (OverflowException)
            {
                // 后续绝对上限会把该值安全收敛；不能因溢出静默绕回较小默认值。
                return long.MaxValue;
            }
        }

        private static int ReadTenantPositiveInt(
            JObject tenantConfig,
            string fieldName,
            int fallback)
        {
            if (!TryReadPositiveLong(tenantConfig?[fieldName], out var value))
            {
                return fallback;
            }
            return (int)Math.Min(int.MaxValue, value);
        }

        private static bool TryReadPositiveLong(JToken token, out long value)
        {
            value = 0;
            if (token == null || token.Type == JTokenType.Null) return false;
            var text = token.ToString().Trim();
            return text.Length > 0 && long.TryParse(text, out value) && value > 0;
        }

        private static bool TryReadBoolean(JToken token, out bool value)
        {
            value = true;
            if (token == null || token.Type == JTokenType.Null) return false;
            var text = token.ToString().Trim();
            if (text.Length == 0) return false;
            if (string.Equals(text, "1", StringComparison.OrdinalIgnoreCase)
                || string.Equals(text, "true", StringComparison.OrdinalIgnoreCase))
            {
                value = true;
                return true;
            }
            if (string.Equals(text, "0", StringComparison.OrdinalIgnoreCase)
                || string.Equals(text, "false", StringComparison.OrdinalIgnoreCase))
            {
                value = false;
                return true;
            }
            return false;
        }

        private static FileUploadSecurityOptions CreateCodeAbsoluteCaps()
        {
            return new FileUploadSecurityOptions
            {
                MaxFileBytes =
                    DefaultAbsoluteMaxFileMegabytes * 1024L * 1024L,
                MaxTotalBytes =
                    DefaultAbsoluteMaxTotalMegabytes * 1024L * 1024L,
                MaxFileCount = DefaultAbsoluteMaxFileCount,
                DailyUserQuotaBytes =
                    DefaultAbsoluteDailyQuotaMegabytes * 1024L * 1024L,
                DailyTenantQuotaBytes =
                    DefaultAbsoluteDailyQuotaMegabytes * 1024L * 1024L,
                UploadEnabled = true
            };
        }

    }

    /// <summary>
    /// 所有 HDFS 上传入口共用的安全策略，避免旧 Controller、V8 或移动端入口绕过。
    /// </summary>
    public static class FileUploadSecurity
    {
        private const string DailyQuotaReservationScript = @"
local increment = tonumber(ARGV[1])
local userLimit = tonumber(ARGV[2])
local tenantLimit = tonumber(ARGV[3])
local ttlSeconds = tonumber(ARGV[4])
local userCurrent = tonumber(redis.call('GET', KEYS[1]) or '0')
local tenantCurrent = tonumber(redis.call('GET', KEYS[2]) or '0')
if increment == nil or increment <= 0 then return {-3, userCurrent, tenantCurrent} end
if userCurrent > userLimit - increment then return {-1, userCurrent, tenantCurrent} end
if tenantCurrent > tenantLimit - increment then return {-2, userCurrent, tenantCurrent} end
local userNext = redis.call('INCRBY', KEYS[1], increment)
local tenantNext = redis.call('INCRBY', KEYS[2], increment)
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ttlSeconds) end
if redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], ttlSeconds) end
return {1, userNext, tenantNext}";

        private static readonly HashSet<string> OrdinaryUploadRoots =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "file",
                "img",
                "avatar",
                "editor"
            };

        /// <summary>
        /// 返回可直接定位 SaaS 配置的停用提示。FileUploadEnabled 未配置或为空时
        /// 默认允许上传；只有显式配置为 0/false 或平台全局强制关闭才会进入这里。
        /// </summary>
        public static DosResult CreateTenantUploadDisabledResult(string osClient)
        {
            return new DosResult(
                0,
                null,
                "当前租户已停用文件上传！请在 SaaS 引擎中将 FileUploadEnabled 设为 1，保存并等待租户配置重载后重试。",
                0,
                new
                {
                    ErrorType = "TenantFileUploadDisabled",
                    OsClient = osClient ?? "",
                    ConfigField = "FileUploadEnabled",
                    ExpectedValue = 1,
                    DefaultEnabled = true,
                    DocumentationUrl = "https://microi.net/doc/more/hdfs"
                });
        }

        /// <summary>
        /// 交互式普通用户只能上传私有文件，并只能使用平台预定义的一级目录。
        /// 超级管理员仍可显式选择公有桶和自定义安全子目录。
        /// </summary>
        public static DosResult ApplyInteractivePolicy(DiyUploadParam param, bool isPlatformAdmin)
        {
            if (param == null) return new DosResult(0, null, "上传参数不能为空！");

            param.Limit ??= true;
            if (isPlatformAdmin) return null;

            // Limit、Path 都是客户端可篡改参数，普通用户不能以它们作为授权事实。
            param.Limit = true;
            var requestedPath = (param.Path ?? string.Empty).Trim().Trim('/');
            if (requestedPath.Length == 0)
            {
                param.Path = param.Preview == true ? "img" : "file";
                return null;
            }

            if (requestedPath.Contains("/")
                || !OrdinaryUploadRoots.Contains(requestedPath))
            {
                return new DosResult(0, null, "普通用户只能上传到平台预定义的文件目录！");
            }

            param.Path = requestedPath.ToLowerInvariant();
            return null;
        }

        /// <summary>
        /// 在任何 byte[] / Base64 解码、图片解析和对象存储调用之前验证文件数与字节数。
        /// 当前 provider 需要可确定的 Length，因此拒绝无法安全预估大小的非 Seek 流。
        /// </summary>
        public static DosResult ValidatePayload(
            DiyUploadParam param,
            FileUploadSecurityOptions options = null)
        {
            return ValidatePayload(param, out _, options);
        }

        /// <summary>
        ///zhy：判断上传参数中是否已经包含指定文件名。HDFS 从当前 HTTP multipart 补充文件流前
        ///zhy：使用此方法，避免接口引擎已经把同一文件注入 FilesByteBase64 后，又把原始请求流
        ///zhy：作为第二份上传载荷加入。这里只用于传输表示去重；ValidatePayload 仍会拒绝调用方
        ///zhy：在 Files / FilesByte / FilesByteBase64 之间显式提交的重复文件名。
        /// </summary>
        public static bool ContainsPayloadFileName(DiyUploadParam param, string fileName)
        {
            if (param == null || string.IsNullOrWhiteSpace(fileName)) return false;

            bool Contains<T>(IDictionary<string, T> files)
            {
                return files?.Keys.Any(name => string.Equals(
                    name,
                    fileName,
                    StringComparison.OrdinalIgnoreCase)) == true;
            }

            return Contains(param.Files)
                || Contains(param.FilesByte)
                || Contains(param.FilesByteBase64);
        }

        public static DosResult ValidatePayload(
            DiyUploadParam param,
            out long totalBytes,
            FileUploadSecurityOptions options = null)
        {
            totalBytes = 0;
            if (param == null) return new DosResult(0, null, "上传参数不能为空！");
            options ??= FileUploadSecurityOptions.Load();

            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            long validatedTotalBytes = 0;
            var count = 0;

            DosResult AddFile(string name, long size)
            {
                if (string.IsNullOrWhiteSpace(name))
                    return new DosResult(0, null, "文件名不能为空！");
                if (Path.GetFileName(name).Length > 255)
                    return new DosResult(0, null, "文件名不能超过255个字符！");
                if (!names.Add(name))
                    return new DosResult(0, null, "同一次上传中存在重复文件名：" + name);
                if (size < 0)
                    return new DosResult(0, null, "无法确定文件大小：" + name);
                if (size == 0)
                    return new DosResult(0, null, "文件体积为0：" + name);
                if (size > options.MaxFileBytes)
                    return new DosResult(0, null,
                        $"单个文件不能超过{FormatMegabytes(options.MaxFileBytes)}MB：" + name);

                count++;
                if (count > options.MaxFileCount)
                    return new DosResult(0, null, $"单次最多上传{options.MaxFileCount}个文件！");
                if (validatedTotalBytes > options.MaxTotalBytes - size)
                    return new DosResult(0, null,
                        $"单次上传总大小不能超过{FormatMegabytes(options.MaxTotalBytes)}MB！");
                validatedTotalBytes += size;
                return null;
            }

            foreach (var file in param.Files ?? new Dictionary<string, Stream>())
            {
                if (file.Value == null)
                    return new DosResult(0, null, "文件流不能为空：" + file.Key);
                if (!file.Value.CanSeek)
                    return new DosResult(0, null, "当前上传流无法安全确定大小：" + file.Key);

                long remaining;
                try
                {
                    remaining = file.Value.Length - file.Value.Position;
                }
                catch
                {
                    return new DosResult(0, null, "无法读取文件大小：" + file.Key);
                }

                var error = AddFile(file.Key, remaining);
                if (error != null) return error;
            }

            foreach (var file in param.FilesByte ?? new Dictionary<string, byte[]>())
            {
                var error = AddFile(file.Key, file.Value?.LongLength ?? -1);
                if (error != null) return error;
            }

            foreach (var file in param.FilesByteBase64 ?? new Dictionary<string, string>())
            {
                if (!TryGetBase64DecodedLength(file.Value, out var decodedLength))
                    return new DosResult(0, null, "文件Base64格式不合法：" + file.Key);
                var error = AddFile(file.Key, decodedLength);
                if (error != null) return error;
            }

            if (count == 0)
                return new DosResult(0, null, "未检测到上传文件！");
            totalBytes = validatedTotalBytes;
            return null;
        }

        /// <summary>
        /// 为交互式上传在共享 Redis 中原子预留当天额度。
        /// 用户额度与租户额度在同一个 Lua 脚本内检查和递增，两个 Key 使用相同 hash tag，
        /// 因此可在 Redis Cluster 中保持同槽原子执行。失败上传不退款，防止并发重试绕过配额。
        /// </summary>
        public static async Task<DosResult> ReserveDailyQuotaAsync(
            string osClient,
            string userId,
            long bytes,
            FileUploadSecurityOptions options = null)
        {
            if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace() || bytes <= 0)
            {
                return new DosResult(0, null, "无法确定上传配额身份或文件大小！");
            }

            options ??= FileUploadSecurityOptions.Load();
            if (!options.UploadEnabled)
            {
                return CreateTenantUploadDisabledResult(osClient);
            }
            var utcNow = DateTime.UtcNow;
            var keys = BuildDailyQuotaKeys(osClient, userId, utcNow);
            var ttlSeconds = Math.Max(
                3600L,
                (long)Math.Ceiling((utcNow.Date.AddDays(2) - utcNow).TotalSeconds));

            try
            {
                var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
                var result = await database.ScriptEvaluateAsync(
                    DailyQuotaReservationScript,
                    new RedisKey[] { keys.UserKey, keys.TenantKey },
                    new RedisValue[]
                    {
                        bytes,
                        options.DailyUserQuotaBytes,
                        options.DailyTenantQuotaBytes,
                        ttlSeconds
                    }).ConfigureAwait(false);

                var values = (RedisResult[])result;
                var status = values == null || values.Length == 0 ? -3 : (long)values[0];
                if (status == 1) return null;
                if (status == -1)
                {
                    return new DosResult(0, null,
                        $"当前账号今日上传额度已用尽（上限{FormatMegabytes(options.DailyUserQuotaBytes)}MB）！");
                }
                if (status == -2)
                {
                    return new DosResult(0, null,
                        $"当前租户今日上传额度已用尽（上限{FormatMegabytes(options.DailyTenantQuotaBytes)}MB）！");
                }
                return new DosResult(0, null, "上传配额预留失败！");
            }
            catch
            {
                // 配额依赖不可用时失败关闭，禁止退回无限制上传。
                return new DosResult(0, null, "上传配额服务暂时不可用，请稍后重试！");
            }
        }

        public static FileUploadQuotaKeys BuildDailyQuotaKeys(
            string osClient,
            string userId,
            DateTime utcNow)
        {
            if (osClient.DosIsNullOrWhiteSpace()) throw new ArgumentException("OsClient不能为空！", nameof(osClient));
            if (userId.DosIsNullOrWhiteSpace()) throw new ArgumentException("UserId不能为空！", nameof(userId));

            var date = utcNow.ToUniversalTime().ToString("yyyyMMdd");
            var tenantPart = EncodeKeyPart(osClient.Trim().ToLowerInvariant());
            var userPart = EncodeKeyPart(userId.Trim());
            var hashTag = $"{{UploadQuota:{tenantPart}:{date}}}";
            var prefix = $"Microi:{osClient.Trim()}:UploadQuota:{date}:{hashTag}";
            return new FileUploadQuotaKeys
            {
                UserKey = $"{prefix}:User:{userPart}",
                TenantKey = $"{prefix}:Tenant",
                HashTag = hashTag
            };
        }

        /// <summary>
        /// 只计算 Base64 解码后的长度，不分配解码后的大字节数组。
        /// </summary>
        public static bool TryGetBase64DecodedLength(string value, out long decodedLength)
        {
            decodedLength = 0;
            if (string.IsNullOrWhiteSpace(value)) return true;

            long characterCount = 0;
            var padding = 0;
            var seenPadding = false;
            foreach (var character in value)
            {
                if (char.IsWhiteSpace(character)) continue;

                if (character == '=')
                {
                    seenPadding = true;
                    padding++;
                    if (padding > 2) return false;
                }
                else
                {
                    if (seenPadding
                        || (!(character >= 'A' && character <= 'Z')
                            && !(character >= 'a' && character <= 'z')
                            && !(character >= '0' && character <= '9')
                            && character != '+'
                            && character != '/'))
                    {
                        return false;
                    }
                }
                characterCount++;
            }

            if (characterCount == 0) return true;
            if (characterCount % 4 != 0) return false;

            try
            {
                decodedLength = checked(characterCount / 4 * 3 - padding);
                return decodedLength >= 0;
            }
            catch (OverflowException)
            {
                return false;
            }
        }

        private static long FormatMegabytes(long bytes) =>
            Math.Max(1, bytes / (1024L * 1024L));

        private static string EncodeKeyPart(string value)
        {
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(value ?? string.Empty))
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }
    }

    public sealed class FileUploadQuotaKeys
    {
        public string UserKey { get; set; }
        public string TenantKey { get; set; }
        public string HashTag { get; set; }
    }
}
