using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class TenantConfigurationSecurityTests
{
    [Fact]
    public void ControlPlaneDetailUsesMainRuntimeWithoutInitializingTargetTenant()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && !Directory.Exists(Path.Combine(directory.FullName, "Microi.net.Api")))
        {
            directory = directory.Parent;
        }
        Assert.NotNull(directory);

        var source = File.ReadAllText(Path.Combine(
            directory!.FullName,
            "Microi.net.Api",
            "Controllers",
            "FormEngineController.cs"));

        Assert.Contains("OsClient.GetClient(configOsClient)?.OsClientModel", source, StringComparison.Ordinal);
        Assert.DoesNotContain("OsClient.GetClient(targetOsClient)", source, StringComparison.Ordinal);
        Assert.Contains("catch", source, StringComparison.Ordinal);
    }

    [Fact]
    public void CreateV8Projection_RemovesInfrastructureAndConnectionSecrets()
    {
        var source = new JObject
        {
            ["OsClient"] = "tenant_a",
            ["ClientName"] = "Tenant A",
            ["DbConn"] = "server=db;password=root",
            ["AuthSecret"] = "auth-secret",
            ["RedisPwd"] = "redis-secret",
            ["AliOssPrivateAccessKeySecret"] = "oss-secret",
            ["MinIOSecretKey"] = "minio-secret",
            ["MQPassword"] = "mq-secret",
            ["MqttPwd"] = "mqtt-secret",
            ["SearchEngineApiKey"] = "search-secret",
            ["OcrEnabled"] = 1,
            ["OcrEndpoint"] = "http://ocr.internal:8080/ocr",
            ["OcrApiKey"] = "ocr-secret",
            ["OcrHeadersJson"] = "{\"Authorization\":\"Bearer secret\"}",
            ["TranslateProvider"] = "LibreTranslate",
            ["TranslateUrl"] = "http://translate.internal:5000",
            ["TranslateApiKey"] = "translate-secret",
            ["TranslateTimeout"] = 120,
            ["BackendLoginRsaPrivateKey"] = "private-key",
            ["BackendAutoUpgradeDisabled"] = 1,
            ["HDFS"] = "MinIO",
            ["AliOssPublicDomain"] = "https://static.example.com"
        };

        var projection = TenantConfigurationSecurity.CreateV8Projection(source);

        Assert.Equal("tenant_a", projection["OsClient"]?.ToString());
        Assert.Equal("Tenant A", projection["ClientName"]?.ToString());
        Assert.Equal("MinIO", projection["HDFS"]?.ToString());
        Assert.Equal("https://static.example.com", projection["AliOssPublicDomain"]?.ToString());
        Assert.Null(projection["DbConn"]);
        Assert.Null(projection["AuthSecret"]);
        Assert.Null(projection["RedisPwd"]);
        Assert.Null(projection["AliOssPrivateAccessKeySecret"]);
        Assert.Null(projection["MinIOSecretKey"]);
        Assert.Null(projection["MQPassword"]);
        Assert.Null(projection["MqttPwd"]);
        Assert.Null(projection["SearchEngineApiKey"]);
        Assert.Null(projection["OcrEnabled"]);
        Assert.Null(projection["OcrEndpoint"]);
        Assert.Null(projection["OcrApiKey"]);
        Assert.Null(projection["OcrHeadersJson"]);
        Assert.Null(projection["TranslateProvider"]);
        Assert.Null(projection["TranslateUrl"]);
        Assert.Null(projection["TranslateApiKey"]);
        Assert.Null(projection["TranslateTimeout"]);
        Assert.Null(projection["BackendLoginRsaPrivateKey"]);
        Assert.Null(projection["BackendAutoUpgradeDisabled"]);
        Assert.NotNull(projection["InfrastructureIsolation"]);

        // 投影是深拷贝；脚本修改不能写穿运行时 SaaS 配置。
        projection["ClientName"] = "changed";
        Assert.Equal("Tenant A", source["ClientName"]?.ToString());
    }

    [Fact]
    public void SharedInfrastructureInheritance_DoesNotCopyTenantCredentialsOrDatabase()
    {
        var main = new JObject
        {
            ["RedisHost"] = "redis.internal",
            ["RedisPwd"] = "shared-runtime-secret",
            ["SearchEngineScheme"] = "https",
            ["SearchEngineHost"] = "search.internal",
            ["MQUserName"] = "main-admin",
            ["MqttPwd"] = "main-mqtt",
            ["SearchEngineApiKey"] = "main-search-key",
            ["DbConn"] = "main-db"
        };
        var tenant = new JObject { ["OsClient"] = "tenant_a" };

        TenantConfigurationSecurity.InheritMissingSharedInfrastructure(tenant, main);

        Assert.Equal("redis.internal", tenant["RedisHost"]?.ToString());
        Assert.Equal("shared-runtime-secret", tenant["RedisPwd"]?.ToString());
        Assert.Equal("https", tenant["SearchEngineScheme"]?.ToString());
        Assert.Equal("search.internal", tenant["SearchEngineHost"]?.ToString());
        Assert.Null(tenant["MQUserName"]);
        Assert.Null(tenant["MqttPwd"]);
        Assert.Null(tenant["SearchEngineApiKey"]);
        Assert.Null(tenant["DbConn"]);
    }

    [Fact]
    public void ControlPlaneProjection_ShowsOnlyMissingEffectiveInfrastructureAndReturnsNoSaveFields()
    {
        var stored = new JObject
        {
            ["OsClient"] = "tenant_a",
            ["MinIOEndPoint"] = "",
            ["MinIOPublicBucketName"] = "tenant-owned-public",
            ["DbConn"] = "tenant-db",
            ["AuthSecret"] = "tenant-auth"
        };
        var effective = new JObject
        {
            ["MinIOEndPoint"] = "minio.internal:9000",
            ["MinIOSecretKey"] = "shared-minio-secret",
            ["MinIOPublicBucketName"] = "main-public",
            ["RedisPwd"] = "shared-redis-secret",
            ["DbConn"] = "main-db",
            ["AuthSecret"] = "main-auth",
            ["FaceApiKey"] = "tenant-only-secret"
        };

        var projection = TenantConfigurationSecurity.CreateControlPlaneSharedInfrastructureProjection(
            stored,
            effective,
            out var inheritedFields);

        Assert.Equal("minio.internal:9000", projection["MinIOEndPoint"]?.ToString());
        Assert.Equal("shared-minio-secret", projection["MinIOSecretKey"]?.ToString());
        Assert.Equal("shared-redis-secret", projection["RedisPwd"]?.ToString());
        Assert.Equal("tenant-owned-public", projection["MinIOPublicBucketName"]?.ToString());
        Assert.Equal("tenant-db", projection["DbConn"]?.ToString());
        Assert.Equal("tenant-auth", projection["AuthSecret"]?.ToString());
        Assert.Null(projection["FaceApiKey"]);
        Assert.Contains("MinIOEndPoint", inheritedFields);
        Assert.Contains("MinIOSecretKey", inheritedFields);
        Assert.Contains("RedisPwd", inheritedFields);
        Assert.DoesNotContain("MinIOPublicBucketName", inheritedFields);
        Assert.DoesNotContain("DbConn", inheritedFields);
        Assert.DoesNotContain("AuthSecret", inheritedFields);
    }

    [Fact]
    public void LegacySharedTenantCredentials_AreRemovedButTenantOwnedSecretsRemain()
    {
        var main = new JObject
        {
            ["TranslateKey"] = "main-translate",
            ["WeChatAppSecret"] = "main-wechat",
            ["RedisPwd"] = "shared-redis"
        };
        var tenant = new JObject
        {
            ["TranslateKey"] = "main-translate",
            ["WeChatAppSecret"] = "tenant-wechat",
            ["RedisPwd"] = "shared-redis"
        };

        TenantConfigurationSecurity.RemoveLegacySharedTenantCredentials(tenant, main);

        Assert.Null(tenant["TranslateKey"]);
        Assert.Equal("tenant-wechat", tenant["WeChatAppSecret"]?.ToString());
        Assert.Equal("shared-redis", tenant["RedisPwd"]?.ToString());
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("TranslateKey"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("AlidnsKeyId"));
    }

    [Theory]
    [InlineData("business:key", "Microi:tenant_a:business:key")]
    [InlineData("Microi:tenant_a:business:key", "Microi:tenant_a:business:key")]
    [InlineData("SysConfig:tenant_a", "Microi:tenant_a:SysConfig")]
    public void NormalizeCacheKey_ScopesCurrentTenant(string input, string expected)
    {
        Assert.Equal(expected, TenantConfigurationSecurity.NormalizeCacheKey("tenant_a", input));
    }

    [Fact]
    public void NormalizeCacheKey_RejectsForeignTenantPrefix()
    {
        Assert.Throws<InvalidOperationException>(() =>
            TenantConfigurationSecurity.NormalizeCacheKey("tenant_a", "Microi:tenant_b:business:key"));
    }

    [Theory]
    [InlineData("orders", "microi.tenant_a.orders")]
    [InlineData("microi.tenant_a.orders", "microi.tenant_a.orders")]
    public void NormalizeQueueName_ScopesCurrentTenant(string input, string expected)
    {
        Assert.Equal(expected, TenantConfigurationSecurity.NormalizeQueueName("tenant_a", input));
    }

    [Fact]
    public void NormalizeQueueName_RejectsForeignTenantPrefix()
    {
        Assert.Throws<InvalidOperationException>(() =>
            TenantConfigurationSecurity.NormalizeQueueName("tenant_a", "microi.tenant_b.orders"));
    }

    [Theory]
    [InlineData("devices/a/status", "tenant/tenant_a/devices/a/status")]
    [InlineData("tenant_a/devices/a/status", "tenant/tenant_a/devices/a/status")]
    [InlineData("tenant/tenant_a/devices/a/status", "tenant/tenant_a/devices/a/status")]
    public void NormalizeMqttTopic_ScopesCurrentTenant(string input, string expected)
    {
        Assert.Equal(expected, TenantConfigurationSecurity.NormalizeMqttTopic("tenant_a", input));
    }

    [Fact]
    public void NormalizeMqttTopic_RejectsForeignCanonicalPrefix()
    {
        Assert.Throws<InvalidOperationException>(() =>
            TenantConfigurationSecurity.NormalizeMqttTopic("tenant_a", "tenant/tenant_b/devices/a"));
    }

    [Theory]
    [InlineData("tenant/tenant_a/")]
    [InlineData("tenant_a/")]
    public void NormalizeMqttTopic_RejectsEmptyBusinessPath(string input)
    {
        Assert.Throws<ArgumentException>(() =>
            TenantConfigurationSecurity.NormalizeMqttTopic("tenant_a", input));
    }

    [Theory]
    [InlineData("orders", "tenant_a_orders")]
    [InlineData("tenant_a_orders", "tenant_a_orders")]
    public void NormalizeSearchIndex_ScopesCurrentTenant(string input, string expected)
    {
        Assert.Equal(expected, TenantConfigurationSecurity.NormalizeSearchIndex(input, "tenant_a"));
    }

    [Theory]
    [InlineData("*")]
    [InlineData("orders,users")]
    [InlineData("../orders")]
    public void NormalizeSearchIndex_RejectsMultiTargetAndWildcard(string input)
    {
        Assert.ThrowsAny<ArgumentException>(() =>
            TenantConfigurationSecurity.NormalizeSearchIndex(input, "tenant_a"));
    }

    [Theory]
    [InlineData("reports/a.pdf", "/tenant_a/reports/a.pdf")]
    [InlineData("/tenant_a/reports/a.pdf", "/tenant_a/reports/a.pdf")]
    [InlineData("/iTdos/reports/a.pdf", "/itdos/reports/a.pdf")]
    public void NormalizeStoragePath_ScopesCurrentTenant(string input, string expected)
    {
        var tenant = input.Contains("iTdos", StringComparison.Ordinal) ? "iTdos" : "tenant_a";
        Assert.Equal(expected, TenantConfigurationSecurity.NormalizeStoragePath(tenant, input));
    }

    [Theory]
    [InlineData("../secret.txt")]
    [InlineData("folder\\secret.txt")]
    [InlineData("folder//secret.txt")]
    [InlineData("folder/%2f/secret.txt")]
    public void NormalizeStoragePath_RejectsUnsafePaths(string input)
    {
        Assert.ThrowsAny<Exception>(() =>
            TenantConfigurationSecurity.NormalizeStoragePath("tenant_a", input));
    }

    [Fact]
    public void V8Interfaces_DoNotExposeRawRedisOrHdfsHandles()
    {
        var cacheMethods = typeof(IV8Cache).GetMethods().Select(method => method.Name).ToHashSet();
        Assert.DoesNotContain("GetIDatabase", cacheMethods);
        Assert.DoesNotContain("Db", cacheMethods);
        Assert.DoesNotContain("AddConnection", cacheMethods);
        Assert.Contains("Expire", cacheMethods);
        Assert.Contains("SetIfNotExists", cacheMethods);
        Assert.Contains("HashIncrement", cacheMethods);

        var hdfsMethods = typeof(IV8HDFS).GetMethods();
        Assert.DoesNotContain(hdfsMethods, method =>
            method.GetParameters().Any(parameter => parameter.ParameterType == typeof(HDFSParam)));
        Assert.Equal(typeof(IV8Cache), typeof(V8EngineParam).GetProperty("Cache")?.PropertyType);
        Assert.Equal(typeof(IV8HDFS), typeof(V8EngineParam).GetField("HDFS")?.FieldType);
    }

    [Fact]
    public void TenantServiceCredentialCollision_RejectsLegacySharedAccountOrPassword()
    {
        var existing = new[]
        {
            new KeyValuePair<string, string>("main-mqtt", "main-secret"),
            new KeyValuePair<string, string>("tenant-b", "tenant-b-secret")
        };

        Assert.True(TenantConfigurationSecurity.HasTenantServiceCredentialCollision(
            "main-mqtt", "tenant-a-secret", existing));
        Assert.True(TenantConfigurationSecurity.HasTenantServiceCredentialCollision(
            "tenant-a", "main-secret", existing));
        Assert.False(TenantConfigurationSecurity.HasTenantServiceCredentialCollision(
            "tenant-a", "tenant-a-secret", existing));
    }

    [Fact]
    public void MainConfigurationCopy_DefaultsInfrastructureAndSecretsToDenied()
    {
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("DbConn"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("RedisPwd"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("AliOssPrivateAccessKeySecret"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("MQPassword"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("MqttPwd"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("SearchEngineApiKey"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("OcrEnabled"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("OcrEndpoint"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("OcrApiKey"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("TranslateProvider"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("TranslateUrl"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("TranslateApiKey"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("TranslateTimeout"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("BackendLoginRsaPrivateKey"));
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("BackendAutoUpgradeDisabled"));
        Assert.True(TenantConfigurationSecurity.ShouldCopyFromMain("SysTitle"));
    }

    [Theory]
    [InlineData("ClientSecrets")]
    [InlineData("PwdV8")]
    [InlineData("GlobalV8Code")]
    [InlineData("GlobalServerV8Code")]
    [InlineData("AdminPassword")]
    [InlineData("WebhookSecret")]
    [InlineData("AccessToken")]
    [InlineData("ThirdPartyKey")]
    [InlineData("DbConnectionString")]
    public void SysConfigCopy_DeniesCodeAndCredentialLikeFields(string fieldName)
    {
        Assert.True(TenantConfigurationSecurity.IsSensitiveSysConfigField(fieldName));
        Assert.False(TenantConfigurationSecurity.ShouldCopySysConfigFromMain(fieldName));
    }

    [Fact]
    public void SysConfigCopy_AllowsOrdinaryBusinessAndDisplayFields()
    {
        Assert.True(TenantConfigurationSecurity.ShouldCopySysConfigFromMain("SysTitle"));
        Assert.True(TenantConfigurationSecurity.ShouldCopySysConfigFromMain("BusinessTheme"));
        Assert.True(TenantConfigurationSecurity.ShouldCopySysConfigFromMain("EnableCaptcha"));
    }

    [Fact]
    public void V8SysConfigProjection_HidesLegacyMainSecretsAndKeepsTenantBusinessValues()
    {
        var main = new JObject
        {
            ["ClientSecrets"] = "main-client-secret",
            ["PwdV8"] = "main-password-v8",
            ["GlobalServerV8Code"] = "main-server-code",
            ["ThirdPartyKey"] = "main-key",
            ["BusinessTheme"] = "main-theme"
        };
        var historicalTenant = new JObject
        {
            ["ClientSecrets"] = main["ClientSecrets"]!.DeepClone(),
            ["PwdV8"] = main["PwdV8"]!.DeepClone(),
            ["GlobalServerV8Code"] = main["GlobalServerV8Code"]!.DeepClone(),
            ["ThirdPartyKey"] = main["ThirdPartyKey"]!.DeepClone(),
            ["BusinessTheme"] = "tenant-owned-theme",
            ["EnableCaptcha"] = true
        };

        var projection = TenantConfigurationSecurity.CreateV8SysConfigProjection(historicalTenant);

        Assert.Null(projection["ClientSecrets"]);
        Assert.Null(projection["PwdV8"]);
        Assert.Null(projection["GlobalServerV8Code"]);
        Assert.Null(projection["ThirdPartyKey"]);
        Assert.Equal("tenant-owned-theme", projection["BusinessTheme"]?.ToString());
        Assert.True(projection["EnableCaptcha"]?.Value<bool>());

        projection["BusinessTheme"] = "changed";
        Assert.Equal("tenant-owned-theme", historicalTenant["BusinessTheme"]?.ToString());
    }

    [Fact]
    public void PublicSysConfigProjection_HidesServerSecretsButKeepsFrontendProtocolFields()
    {
        var source = new JObject
        {
            ["ClientSecrets"] = "client-secret",
            ["GlobalServerV8Code"] = "server-code",
            ["AccessToken"] = "token",
            ["ThirdPartyKey"] = "key",
            ["PwdV8"] = "frontend-password-v8",
            ["GlobalV8Code"] = "frontend-global-v8",
            ["SysTitle"] = "Tenant Title"
        };

        var projection = TenantConfigurationSecurity.CreatePublicSysConfigProjection(source);

        Assert.Null(projection["ClientSecrets"]);
        Assert.Null(projection["GlobalServerV8Code"]);
        Assert.Null(projection["AccessToken"]);
        Assert.Null(projection["ThirdPartyKey"]);
        Assert.Equal("frontend-password-v8", projection["PwdV8"]?.ToString());
        Assert.Equal("frontend-global-v8", projection["GlobalV8Code"]?.ToString());
        Assert.Equal("Tenant Title", projection["SysTitle"]?.ToString());
    }
}
