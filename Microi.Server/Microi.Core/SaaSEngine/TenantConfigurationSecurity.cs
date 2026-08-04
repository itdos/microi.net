using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// SaaS 租户共享基础设施的安全边界。
    ///
    /// 共享 Redis、对象存储、RabbitMQ Broker、MQTT Broker 与搜索集群可以由多个租户复用，
    /// 但它们的管理配置、连接凭据和底层命名空间不得暴露给 V8，也不得复制到新租户记录。
    /// 本类只保存确定性规则，不保存进程内业务状态，可安全用于多节点部署。
    /// </summary>
    public static class TenantConfigurationSecurity
    {
        private static readonly Regex TenantIdRegex = new Regex(
            @"^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex QueueNameRegex = new Regex(
            @"^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex SearchNameRegex = new Regex(
            @"^[a-z0-9][a-z0-9_-]{0,199}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly HashSet<string> SharedInfrastructureFieldSet =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                // Redis / Sentinel
                "NoSqlType", "CacheConnectionType", "RedisHost", "RedisPort", "RedisPwd",
                "RedisDataBase", "RedisTimeout", "SentinelHost", "SentinelPort",
                "SentinelServiceName", "SentinelPwd",

                // Object storage (Aliyun OSS / MinIO / Amazon S3)
                "HDFS", "NetworkIsInternet", "UseAliOssPublic", "UseAliOssPrivate",
                "UseAliOssImgProcess", "AliOssImgProcess", "AliOssPublicAccessKeyId",
                "AliOssPublicAccessKeySecret", "AliOssPublicEndpoint", "AliOssPublicBucketName",
                "AliOssPublicDomain", "AliOssPrivateAccessKeyId", "AliOssPrivateAccessKeySecret",
                "AliOssPrivateEndpoint", "AliOssPrivateBucketName", "AliOssPrivateDomain",
                "MinIOAccessKey", "MinIOSecretKey", "MinIOEndPoint", "MinIOEndPointInternet",
                "MinIOEndPointSSL", "MinIOPrivateEndPointSSL", "MinIOPrivateBucketName",
                "MinIOPublicBucketName", "MinIORegion", "CloudFrontPublicPemId",
                "CloudFrontPrivateCDN", "CloudFrontPrivatePemXml",

                // Shared RabbitMQ broker settings. Tenant user/password/vhost are deliberately excluded.
                "MQHost", "MQPort", "MQType", "MQListenerTime", "MQUseTls", "MQTlsServerName",

                // Shared embedded/external MQTT broker listener settings. Tenant credentials are separate.
                "MqttPort", "MqttWsPort", "MqttTlsPort", "MqttUseTls", "MqttCertPath",
                "MqttCertPassword",

                // Shared search cluster endpoint. Tenant API key/user are separate.
                "SearchEngineScheme", "SearchEngineHost", "SearchEnginePort"
            };

        private static readonly HashSet<string> TenantServiceCredentialFieldSet =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "MQUserName", "MQPassword", "MQVitrualHost",
                "MqttEnable", "MqttAccount", "MqttPwd", "MqttApiEngine",
                "MqttAllowAnonymous", "MqttTopicIsolation",
                "SearchEngineApiKey", "SearchEngineUserName", "SearchEnginePassword"
            };

        private static readonly HashSet<string> NonShareableTenantCredentialFieldSet =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "MQUserName", "MQPassword", "MQVitrualHost",
                "MqttAccount", "MqttPwd",
                "SearchEngineApiKey", "SearchEngineUserName", "SearchEnginePassword",
                // 历史标准库字段中这两个名称不含 Secret/Password/AccessKey，
                // 但仍是主租户第三方服务凭据，绝不能复制给子租户。
                "TranslateKey", "AlidnsKeyId"
            };

        private static readonly HashSet<string> V8AlwaysHiddenFieldSet =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "AuthSecret", "AuthSecretRotateVersion", "ClientSecrets",
                "DbConn", "DbReadConn", "DbMongoConnection",
                "FileCabinetSecret"
            };

        private static readonly HashSet<string> V8SafePublicInfrastructureFieldSet =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "HDFS", "AliOssPublicDomain"
            };

        private static readonly HashSet<string> NeverCopyIdentityFieldSet =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Id", "CreateTime", "CreateUser", "UpdateTime", "UpdateUser", "IsDeleted",
                "OsClient", "IsEnable", "ClientName", "OsClientType", "OsClientNetwork",
                "DbConn", "DbType", "DbReadConn", "DbReadType", "DbMongoConnection",
                "AuthSecret", "AuthSecretRotateVersion", "DomainName", "ServerTag",
                "OwnerUserId", "OwnerPhone"
            };

        private static readonly HashSet<string> SysConfigNeverCopyFieldSet =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Id", "CreateTime", "CreateUser", "UpdateTime", "UpdateUser", "IsDeleted",
                "ClientSecrets", "PwdV8", "GlobalV8Code", "GlobalServerV8Code"
            };

        private static readonly HashSet<string> PublicSysConfigAlwaysHiddenFieldSet =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "ClientSecrets", "GlobalServerV8Code"
            };

        private static readonly HashSet<string> V8SysConfigAlwaysHiddenFieldSet =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "ClientSecrets", "PwdV8", "GlobalServerV8Code"
            };

        public static IReadOnlyCollection<string> SharedInfrastructureFields =>
            SharedInfrastructureFieldSet.ToArray();

        public static IReadOnlyCollection<string> TenantServiceCredentialFields =>
            TenantServiceCredentialFieldSet.ToArray();

        public static string NormalizeTenantId(string osClient)
        {
            var value = (osClient ?? string.Empty).Trim();
            if (!TenantIdRegex.IsMatch(value))
            {
                throw new ArgumentException("OsClient 只能包含字母、数字、下划线和中划线，长度为1-50。", nameof(osClient));
            }
            return value;
        }

        public static bool IsSharedInfrastructureField(string fieldName)
        {
            return !string.IsNullOrWhiteSpace(fieldName)
                   && SharedInfrastructureFieldSet.Contains(fieldName.Trim());
        }

        public static bool IsTenantServiceCredentialField(string fieldName)
        {
            return !string.IsNullOrWhiteSpace(fieldName)
                   && TenantServiceCredentialFieldSet.Contains(fieldName.Trim());
        }

        public static bool IsNonShareableTenantCredentialField(string fieldName)
        {
            var name = (fieldName ?? string.Empty).Trim();
            return name.Length > 0
                   && (NonShareableTenantCredentialFieldSet.Contains(name)
                       || IsSensitiveConfigurationField(name));
        }

        public static bool IsSensitiveConfigurationField(string fieldName)
        {
            var name = (fieldName ?? string.Empty).Trim();
            if (name.Length == 0) return false;

            return name.IndexOf("pwd", StringComparison.OrdinalIgnoreCase) >= 0
                   || name.IndexOf("password", StringComparison.OrdinalIgnoreCase) >= 0
                   || name.IndexOf("secret", StringComparison.OrdinalIgnoreCase) >= 0
                   || name.IndexOf("token", StringComparison.OrdinalIgnoreCase) >= 0
                   || name.IndexOf("apikey", StringComparison.OrdinalIgnoreCase) >= 0
                   || name.IndexOf("accesskey", StringComparison.OrdinalIgnoreCase) >= 0
                   || name.IndexOf("credential", StringComparison.OrdinalIgnoreCase) >= 0
                   || name.IndexOf("privatekey", StringComparison.OrdinalIgnoreCase) >= 0
                   || name.EndsWith("conn", StringComparison.OrdinalIgnoreCase)
                   || name.EndsWith("connection", StringComparison.OrdinalIgnoreCase)
                   || name.EndsWith("connectionstring", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// sys_config 由主库同步到子租户时的独立安全边界。除明确的代码/身份字段外，
        /// 密码、Secret、Token、Key、Credential、Connection 等未来新增字段默认拒绝复制。
        /// </summary>
        public static bool IsSensitiveSysConfigField(string fieldName)
        {
            var name = (fieldName ?? string.Empty).Trim();
            if (name.Length == 0) return true;
            if (SysConfigNeverCopyFieldSet.Contains(name)) return true;

            return IsSensitiveConfigurationField(name)
                   || name.IndexOf("key", StringComparison.OrdinalIgnoreCase) >= 0
                   || name.IndexOf("connection", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        /// <summary>
        /// 新租户只允许从主库复制普通展示/业务配置；可执行代码、身份字段和任何疑似凭据
        /// 一律留给空库模板或租户自身配置，避免历史主库秘密跨租户持久化。
        /// </summary>
        public static bool ShouldCopySysConfigFromMain(string fieldName)
        {
            return !IsSensitiveSysConfigField(fieldName);
        }

        /// <summary>
        /// 新租户只复制无敏感信息的业务/展示配置。共享基础设施在运行时从主租户解析，
        /// tenant credential 则必须单独生成，二者都不能从主租户行复制。
        /// </summary>
        public static bool ShouldCopyFromMain(string fieldName)
        {
            var name = (fieldName ?? string.Empty).Trim();
            if (name.Length == 0) return false;
            if (NeverCopyIdentityFieldSet.Contains(name)
                || SharedInfrastructureFieldSet.Contains(name)
                || TenantServiceCredentialFieldSet.Contains(name)
                || IsNonShareableTenantCredentialField(name))
            {
                return false;
            }

            // Future service fields must default to non-copy even before every database is upgraded.
            return !name.StartsWith("Redis", StringComparison.OrdinalIgnoreCase)
                   && !name.StartsWith("Sentinel", StringComparison.OrdinalIgnoreCase)
                   && !name.StartsWith("MinIO", StringComparison.OrdinalIgnoreCase)
                   && !name.StartsWith("AliOss", StringComparison.OrdinalIgnoreCase)
                   && !name.StartsWith("CloudFront", StringComparison.OrdinalIgnoreCase)
                   && !name.StartsWith("SearchEngine", StringComparison.OrdinalIgnoreCase)
                   && !name.StartsWith("Backend", StringComparison.OrdinalIgnoreCase)
                   && !name.StartsWith("Ocr", StringComparison.OrdinalIgnoreCase)
                   && !name.StartsWith("Translate", StringComparison.OrdinalIgnoreCase)
                   && !name.StartsWith("Mqtt", StringComparison.OrdinalIgnoreCase)
                   && !name.StartsWith("MQ", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 把主租户共享基础设施的缺失字段补到运行时快照；不持久化、不覆盖租户显式配置。
        /// </summary>
        public static JObject InheritMissingSharedInfrastructure(JObject tenantModel, JObject mainModel)
        {
            if (tenantModel == null) throw new ArgumentNullException(nameof(tenantModel));
            if (mainModel == null) return tenantModel;

            foreach (var field in SharedInfrastructureFieldSet)
            {
                if (IsMissing(tenantModel[field]) && !IsMissing(mainModel[field]))
                {
                    tenantModel[field] = mainModel[field].DeepClone();
                }
            }
            return tenantModel;
        }

        /// <summary>
        /// 历史版本曾把主租户第三方凭据复制进子租户行。仅当子租户值与主租户值完全一致时，
        /// 从运行时快照移除该值；子租户自行配置且不同的业务凭据继续可用。
        /// 共享 Redis/对象存储等服务字段由受控代理隔离，不在这里清除。
        /// </summary>
        public static JObject RemoveLegacySharedTenantCredentials(JObject tenantModel, JObject mainModel)
        {
            if (tenantModel == null) throw new ArgumentNullException(nameof(tenantModel));
            if (mainModel == null) return tenantModel;

            foreach (var property in tenantModel.Properties().ToList())
            {
                if (SharedInfrastructureFieldSet.Contains(property.Name)
                    || !IsNonShareableTenantCredentialField(property.Name)
                    || IsMissing(property.Value))
                {
                    continue;
                }

                var mainProperty = mainModel.Properties().FirstOrDefault(item =>
                    string.Equals(item.Name, property.Name, StringComparison.OrdinalIgnoreCase));
                if (mainProperty == null || IsMissing(mainProperty.Value)) continue;
                if (JToken.DeepEquals(property.Value, mainProperty.Value)) property.Remove();
            }
            return tenantModel;
        }

        /// <summary>
        /// 创建 V8 可见的独立快照。绝不返回运行模型原引用，避免脚本写穿全局配置。
        /// </summary>
        public static JObject CreateV8Projection(JObject source)
        {
            var projection = source == null ? new JObject() : (JObject)source.DeepClone();
            var publicValues = new Dictionary<string, JToken>(StringComparer.OrdinalIgnoreCase);
            foreach (var field in V8SafePublicInfrastructureFieldSet)
            {
                if (!IsMissing(projection[field])) publicValues[field] = projection[field].DeepClone();
            }

            foreach (var property in projection.Properties().ToList())
            {
                if (V8AlwaysHiddenFieldSet.Contains(property.Name)
                    || SharedInfrastructureFieldSet.Contains(property.Name)
                    || TenantServiceCredentialFieldSet.Contains(property.Name)
                    || property.Name.StartsWith("Redis", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("Sentinel", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("AliOss", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("MinIO", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("CloudFront", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("SearchEngine", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("Backend", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("Ocr", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("Translate", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("Mqtt", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("MQ", StringComparison.OrdinalIgnoreCase))
                {
                    property.Remove();
                }
            }

            foreach (var pair in publicValues) projection[pair.Key] = pair.Value;
            projection["InfrastructureIsolation"] = new JObject
            {
                ["Mode"] = "ServerManaged",
                ["CacheNamespace"] = "Microi:{OsClient}:*",
                ["FileNamespace"] = "/{OsClient}/...",
                ["SearchNamespace"] = "{OsClient}_*",
                ["MqttNamespace"] = "tenant/{OsClient}/#"
            };
            return projection;
        }

        /// <summary>
        /// 创建接口引擎可见的 sys_config 独立快照。服务器端全局代码及所有疑似凭据
        /// 不进入 V8；普通租户自有业务配置保持原值。PwdV8 由后端认证流程内部消费，
        /// 不需要作为 V8.SysConfig 数据再次暴露。
        /// </summary>
        public static JObject CreateV8SysConfigProjection(object source)
        {
            var projection = ToIndependentJObject(source);
            foreach (var property in projection.Properties().ToList())
            {
                if (V8SysConfigAlwaysHiddenFieldSet.Contains(property.Name)
                    || IsSensitiveSysConfigField(property.Name))
                {
                    property.Remove();
                }
            }
            return projection;
        }

        /// <summary>
        /// 创建匿名 GetSysConfig API 的公开快照。GlobalV8Code 与 PwdV8 是既有前端协议，
        /// 可继续返回；服务器端代码、ClientSecrets 及其它疑似凭据必须隐藏。
        /// </summary>
        public static JObject CreatePublicSysConfigProjection(object source)
        {
            var projection = ToIndependentJObject(source);
            foreach (var property in projection.Properties().ToList())
            {
                if (string.Equals(property.Name, "PwdV8", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(property.Name, "GlobalV8Code", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                if (PublicSysConfigAlwaysHiddenFieldSet.Contains(property.Name)
                    || IsSensitiveSysConfigField(property.Name))
                {
                    property.Remove();
                }
            }
            return projection;
        }

        private static JObject ToIndependentJObject(object source)
        {
            if (source == null) return new JObject();
            if (source is JObject sourceObject) return (JObject)sourceObject.DeepClone();

            try
            {
                return JObject.FromObject(source);
            }
            catch
            {
                // 安全投影无法识别原对象时失败关闭，绝不把原引用回传给 V8 或匿名 API。
                return new JObject();
            }
        }

        public static string NormalizeCacheKey(string osClient, string key)
        {
            var tenant = NormalizeTenantId(osClient);
            var value = (key ?? string.Empty).Trim();
            RejectControlCharacters(value, nameof(key));
            if (value.Length == 0) throw new ArgumentException("缓存 Key 不能为空。", nameof(key));

            var prefix = $"Microi:{tenant}:";
            // 兼容历史 V8 写法 SysConfig:{OsClient}。服务端实际缓存键一直是
            // Microi:{OsClient}:SysConfig，不能因安全代理再重复拼接一次租户。
            if (string.Equals(value, $"SysConfig:{tenant}", StringComparison.OrdinalIgnoreCase))
            {
                return prefix + "SysConfig";
            }
            if (value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                var suffix = value.Substring(prefix.Length);
                if (suffix.Length == 0) throw new ArgumentException("缓存 Key 缺少业务名称。", nameof(key));
                return prefix + suffix;
            }
            if (value.StartsWith("Microi:", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"禁止访问租户[{tenant}]命名空间之外的缓存 Key。");
            }
            return prefix + value;
        }

        public static string NormalizeQueueName(string osClient, string queueName)
        {
            var tenant = NormalizeTenantId(osClient).ToLowerInvariant();
            var value = (queueName ?? string.Empty).Trim();
            RejectControlCharacters(value, nameof(queueName));
            var prefix = $"microi.{tenant}.";
            if (value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                value = value.Substring(prefix.Length);
            }
            else if (value.StartsWith("microi.", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("禁止访问其他租户的 RabbitMQ 队列。");
            }

            if (!QueueNameRegex.IsMatch(value))
            {
                throw new ArgumentException("RabbitMQ 队列名只能包含字母、数字、点、下划线和中划线。", nameof(queueName));
            }
            return prefix + value;
        }

        public static string NormalizeMqttTopic(string osClient, string topic, bool allowLegacyOwnPrefix = true)
        {
            var tenant = NormalizeTenantId(osClient);
            var normalizedTenant = tenant.ToLowerInvariant();
            var value = (topic ?? string.Empty).Trim().TrimStart('/');
            RejectControlCharacters(value, nameof(topic));
            if (value.Length == 0) throw new ArgumentException("MQTT Topic 不能为空。", nameof(topic));
            if (value.Contains("\\") || value.Contains("//") || value.Split('/').Any(segment => segment == "." || segment == ".."))
            {
                throw new ArgumentException("MQTT Topic 包含非法路径段。", nameof(topic));
            }

            var prefix = $"tenant/{normalizedTenant}/";
            if (value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                var suffix = value.Substring(prefix.Length);
                if (suffix.Length == 0) throw new ArgumentException("MQTT Topic 缺少业务路径。", nameof(topic));
                return prefix + suffix;
            }
            if (value.StartsWith("tenant/", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("禁止发布或订阅其他租户的 MQTT Topic。");
            }

            if (allowLegacyOwnPrefix)
            {
                var legacyPrefix = tenant + "/";
                if (value.StartsWith(legacyPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    var suffix = value.Substring(legacyPrefix.Length);
                    if (suffix.Length == 0) throw new ArgumentException("MQTT Topic 缺少业务路径。", nameof(topic));
                    return prefix + suffix;
                }
            }

            var firstSegment = value.Split('/')[0];
            if (OsClientExtend.ClientList.Keys.Any(key =>
                    !string.Equals(key, tenant, StringComparison.OrdinalIgnoreCase)
                    && string.Equals(key, firstSegment, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException("禁止发布或订阅其他租户的 MQTT Topic。");
            }
            return prefix + value;
        }

        /// <summary>
        /// 生成 ES 索引名：{tenant}_{logicalName}。输入已经带当前前缀时不会重复添加。
        /// </summary>
        public static string NormalizeSearchIndex(string requestedIndexOrTable, string osClient)
        {
            var tenant = NormalizeTenantId(osClient).ToLowerInvariant();
            var value = (requestedIndexOrTable ?? string.Empty).Trim().ToLowerInvariant();
            RejectControlCharacters(value, nameof(requestedIndexOrTable));
            if (value == "_all" || value.IndexOfAny(new[] { ',', '*', '?', '/', '\\', ':', ' ' }) >= 0 || value.Contains(".."))
            {
                throw new ArgumentException("搜索索引名包含通配符、多目标或非法路径字符。", nameof(requestedIndexOrTable));
            }

            var prefix = tenant + "_";
            if (value.StartsWith(prefix, StringComparison.Ordinal)) value = value.Substring(prefix.Length);
            else
            {
                foreach (var other in OsClientExtend.ClientList.Keys)
                {
                    if (!string.Equals(other, tenant, StringComparison.OrdinalIgnoreCase)
                        && value.StartsWith(other.ToLowerInvariant() + "_", StringComparison.Ordinal))
                    {
                        throw new InvalidOperationException("禁止访问其他租户的搜索索引。");
                    }
                }
            }

            if (!SearchNameRegex.IsMatch(value))
            {
                throw new ArgumentException("搜索索引逻辑名称只能包含小写字母、数字、下划线和中划线。", nameof(requestedIndexOrTable));
            }
            return prefix + value;
        }

        /// <summary>
        /// 把对象存储路径限定到 /{OsClient}/ 根目录。返回值保留历史前导斜杠格式。
        /// </summary>
        public static string NormalizeStoragePath(string osClient, string path, bool allowEmpty = false)
        {
            var tenant = NormalizeTenantId(osClient);
            var storageTenant = tenant.ToLowerInvariant();
            var value = (path ?? string.Empty).Trim();
            RejectControlCharacters(value, nameof(path));
            if (value.Length == 0)
            {
                if (allowEmpty) return "/" + storageTenant + "/";
                throw new ArgumentException("文件路径不能为空。", nameof(path));
            }

            if (Regex.IsMatch(value, "%2e|%2f|%5c", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
            {
                throw new ArgumentException("文件路径包含不安全的编码字符。", nameof(path));
            }
            if (Uri.TryCreate(value, UriKind.Absolute, out var uri)
                && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            {
                value = Uri.UnescapeDataString(uri.AbsolutePath ?? string.Empty);
            }
            if (value.Contains("\\") || value.Contains("//") || value.Contains(":"))
            {
                throw new ArgumentException("文件路径包含非法字符。", nameof(path));
            }

            value = value.TrimStart('/');
            var segments = value.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length == 0 || segments.Any(segment => segment == "." || segment == ".."))
            {
                throw new ArgumentException("文件路径包含非法路径段。", nameof(path));
            }

            if (string.Equals(segments[0], tenant, StringComparison.OrdinalIgnoreCase))
            {
                segments[0] = storageTenant;
                return "/" + string.Join("/", segments);
            }
            if (OsClientExtend.ClientList.Keys.Any(key =>
                    !string.Equals(key, tenant, StringComparison.OrdinalIgnoreCase)
                    && string.Equals(key, segments[0], StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException("禁止访问其他租户的文件目录。");
            }
            return "/" + storageTenant + "/" + string.Join("/", segments);
        }

        /// <summary>
        /// Upload.Path 是逻辑子目录；它最终仍由 HDFS facade 拼接租户根和日期。
        /// </summary>
        public static string NormalizeUploadSubPath(string osClient, string path)
        {
            var tenant = NormalizeTenantId(osClient);
            var value = (path ?? string.Empty).Trim();
            if (value.Length == 0) return "upload";
            var full = NormalizeStoragePath(tenant, value);
            var ownPrefix = "/" + tenant.ToLowerInvariant() + "/";
            return full.StartsWith(ownPrefix, StringComparison.OrdinalIgnoreCase)
                ? full.Substring(ownPrefix.Length)
                : full.TrimStart('/');
        }

        public static string GenerateRandomCredential(int byteLength = 24)
        {
            if (byteLength < 16) byteLength = 16;
            var bytes = new byte[byteLength];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }

        public static string CreateTenantServiceUserName(string osClient, string prefix)
        {
            var tenant = NormalizeTenantId(osClient).ToLowerInvariant();
            var safePrefix = Regex.Replace((prefix ?? "microi").ToLowerInvariant(), @"[^a-z0-9_]", string.Empty);
            if (safePrefix.Length == 0) safePrefix = "microi";
            byte[] hashBytes;
            using (var sha256 = SHA256.Create())
            {
                hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(tenant));
            }
            var suffix = BitConverter.ToString(hashBytes, 0, 4).Replace("-", string.Empty).ToLowerInvariant();
            var maxTenantLength = Math.Max(1, 48 - safePrefix.Length - suffix.Length - 2);
            if (tenant.Length > maxTenantLength) tenant = tenant.Substring(0, maxTenantLength);
            return $"{safePrefix}_{tenant}_{suffix}";
        }

        /// <summary>
        /// 检查租户服务账号或密码是否与其它租户重复。共享 Broker 上只要任一凭据重复，
        /// 历史客户端就可能结合显式 OsClient/前缀选择错误租户，因此必须 fail-closed。
        /// </summary>
        public static bool HasTenantServiceCredentialCollision(
            string account,
            string password,
            IEnumerable<KeyValuePair<string, string>> otherCredentials)
        {
            var normalizedAccount = (account ?? string.Empty).Trim();
            var normalizedPassword = password ?? string.Empty;
            if (normalizedAccount.Length == 0 || normalizedPassword.Length == 0) return true;

            foreach (var credential in otherCredentials ?? Enumerable.Empty<KeyValuePair<string, string>>())
            {
                var otherAccount = (credential.Key ?? string.Empty).Trim();
                var otherPassword = credential.Value ?? string.Empty;
                if (otherAccount.Length > 0
                    && string.Equals(normalizedAccount, otherAccount, StringComparison.Ordinal))
                {
                    return true;
                }
                if (otherPassword.Length > 0
                    && string.Equals(normalizedPassword, otherPassword, StringComparison.Ordinal))
                {
                    return true;
                }
            }
            return false;
        }

        private static bool IsMissing(JToken token)
        {
            return token == null
                   || token.Type == JTokenType.Null
                   || token.Type == JTokenType.Undefined
                   || (token.Type == JTokenType.String && token.ToString().DosIsNullOrWhiteSpace());
        }

        private static void RejectControlCharacters(string value, string parameterName)
        {
            if ((value ?? string.Empty).Any(char.IsControl))
            {
                throw new ArgumentException("参数包含控制字符。", parameterName);
            }
        }
    }
}
