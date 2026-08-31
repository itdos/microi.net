using Microi.net;
using Newtonsoft.Json.Linq;
using System.Reflection;

namespace Dos.Common.Tests;

public class SaaSConfigurationCacheV2Tests
{
    [Fact]
    public void CacheKey_IsScopedByControlTenantSchemaAndRuntimeIdentity()
    {
        var key = OsClientExtend.GetSaasConfigurationCacheKey(
            " CongShi ",
            " Product ",
            " Internal ",
            " JunChi ");

        Assert.Equal(
            "Microi:congshi:saas-engine:v2:product:internal:junchi",
            key);

        var internetKey = OsClientExtend.GetSaasConfigurationCacheKey(
            "congshi",
            "Product",
            "Internet",
            "junchi");
        Assert.NotEqual(key, internetKey);
        Assert.Equal(
            "Microi:congshi:saas-engine:v2:product:internet:junchi",
            internetKey);
    }

    [Fact]
    public void Payload_ContainsStrictIdentityAndAnIndependentConfigurationSnapshot()
    {
        var source = new JObject
        {
            ["OsClient"] = "junchi",
            ["ClientName"] = "Junchi"
        };

        var payload = OsClientExtend.CreateSaasConfigurationCachePayload(
            source,
            "congshi",
            "Product",
            "Internal",
            "junchi");

        Assert.NotNull(payload);
        Assert.Equal(OsClientExtend.SaasConfigurationCacheSchema, payload!["Schema"]?.ToString());
        Assert.Equal(OsClientExtend.SaasConfigurationCacheSchemaVersion, payload["SchemaVersion"]?.Value<int>());
        Assert.Equal("product", payload["Identity"]?["OsClientType"]?.ToString());
        Assert.Equal("internal", payload["Identity"]?["OsClientNetwork"]?.ToString());
        Assert.Equal("Product", payload["Configuration"]?["OsClientType"]?.ToString());
        Assert.Equal("Internal", payload["Configuration"]?["OsClientNetwork"]?.ToString());

        source["ClientName"] = "mutated-after-write";
        Assert.Equal("Junchi", payload["Configuration"]?["ClientName"]?.ToString());

        Assert.True(OsClientExtend.TryValidateSaasConfigurationCachePayload(
            payload,
            "CONGSHI",
            "product",
            "internal",
            "JUNCHI",
            out var configuration));
        Assert.Equal("Junchi", configuration["ClientName"]?.ToString());
    }

    [Fact]
    public void Payload_RejectsSchemaEnvelopeAndConfigurationIdentityMismatch()
    {
        var payload = OsClientExtend.CreateSaasConfigurationCachePayload(
            new JObject
            {
                ["OsClient"] = "junchi",
                ["OsClientType"] = "Product",
                ["OsClientNetwork"] = "Internal"
            },
            "congshi",
            "Product",
            "Internal",
            "junchi")!;

        var wrongNetwork = (JObject)payload.DeepClone();
        wrongNetwork["Identity"]!["OsClientNetwork"] = "Internet";
        Assert.False(OsClientExtend.TryValidateSaasConfigurationCachePayload(
            wrongNetwork, "congshi", "Product", "Internal", "junchi", out _));

        var wrongTenant = (JObject)payload.DeepClone();
        wrongTenant["Configuration"]!["OsClient"] = "another-tenant";
        Assert.False(OsClientExtend.TryValidateSaasConfigurationCachePayload(
            wrongTenant, "congshi", "Product", "Internal", "junchi", out _));

        var wrongSchema = (JObject)payload.DeepClone();
        wrongSchema["SchemaVersion"] = 1;
        Assert.False(OsClientExtend.TryValidateSaasConfigurationCachePayload(
            wrongSchema, "congshi", "Product", "Internal", "junchi", out _));

        var malformedSchema = (JObject)payload.DeepClone();
        malformedSchema["SchemaVersion"] = "not-a-number";
        Assert.False(OsClientExtend.TryValidateSaasConfigurationCachePayload(
            malformedSchema, "congshi", "Product", "Internal", "junchi", out _));
    }

    [Fact]
    public void LegacyPayload_IsMigratableOnlyWhenItCarriesMatchingIdentity()
    {
        var identityFree = new JObject
        {
            ["ClientName"] = "untrusted-v1"
        };
        Assert.False(OsClientExtend.TryValidateLegacySaasConfigurationCache(
            identityFree, "Product", "Internal", "junchi", out _));

        var identified = new JObject
        {
            ["OsClient"] = "junchi",
            ["OsClientType"] = "Product",
            ["OsClientNetwork"] = "Internal",
            ["ClientName"] = "trusted-v1"
        };
        Assert.True(OsClientExtend.TryValidateLegacySaasConfigurationCache(
            identified, "product", "internal", "JUNCHI", out var migrated));
        Assert.Equal("trusted-v1", migrated["ClientName"]?.ToString());

        identified["OsClientNetwork"] = "Internet";
        Assert.False(OsClientExtend.TryValidateLegacySaasConfigurationCache(
            identified, "Product", "Internal", "junchi", out _));
    }

    [Fact]
    public void CacheRead_MigratesOnlyIdentifiedLegacyPayloadAndInvalidatesOldL1L2Key()
    {
        var (cache, recorder) = CreateRecordingCache();
        var legacyKey = "Microi:CongShi:saas-engine:JunChi";
        recorder.Values[legacyKey] = new JObject
        {
            ["OsClient"] = "junchi",
            ["OsClientType"] = "Product",
            ["OsClientNetwork"] = "Internal",
            ["ClientName"] = "Junchi"
        };

        var result = OsClientExtend.ReadSaasConfigurationCache(
            cache, "CongShi", "Product", "Internal", "JunChi");

        Assert.Equal("Junchi", result?["ClientName"]?.ToString());
        var v2Key = OsClientExtend.GetSaasConfigurationCacheKey(
            "CongShi", "Product", "Internal", "JunChi");
        Assert.Contains(v2Key, recorder.SetKeys);
        Assert.Contains(legacyKey, recorder.RemovedKeys);
        Assert.False(recorder.Values.ContainsKey(legacyKey));
        Assert.True(OsClientExtend.TryValidateSaasConfigurationCachePayload(
            recorder.Values[v2Key],
            "CongShi", "Product", "Internal", "JunChi", out _));

        var untrustedKey = "Microi:CongShi:saas-engine:no_identity";
        recorder.Values[untrustedKey] = new JObject { ["ClientName"] = "untrusted" };
        Assert.Null(OsClientExtend.ReadSaasConfigurationCache(
            cache, "CongShi", "Product", "Internal", "no_identity"));
        Assert.Contains(untrustedKey, recorder.RemovedKeys);
    }

    [Fact]
    public void CacheRead_RejectsAndInvalidatesMismatchedV2Envelope()
    {
        var (cache, recorder) = CreateRecordingCache();
        var expectedKey = OsClientExtend.GetSaasConfigurationCacheKey(
            "congshi", "Product", "Internal", "junchi");
        recorder.Values[expectedKey] = OsClientExtend.CreateSaasConfigurationCachePayload(
            new JObject
            {
                ["OsClient"] = "junchi",
                ["OsClientType"] = "Product",
                ["OsClientNetwork"] = "Internet"
            },
            "congshi", "Product", "Internet", "junchi")!;

        Assert.Null(OsClientExtend.ReadSaasConfigurationCache(
            cache, "congshi", "Product", "Internal", "junchi"));
        Assert.Contains(expectedKey, recorder.RemovedKeys);
        Assert.False(recorder.Values.ContainsKey(expectedKey));
    }

    [Fact]
    public void ChildProjectionFallback_PreservesOnlyCurrentNodeInfrastructure()
    {
        var merged = new JObject
        {
            ["OsClient"] = "junchi",
            ["RedisHost"] = "l2-wrong-node-host",
            ["RedisPwd"] = "l2-wrong-node-secret",
            ["MinIOEndPoint"] = "l2-wrong-node-minio",
            ["ClientName"] = "Junchi"
        };
        var local = new JObject
        {
            ["RedisHost"] = "current-node-host",
            ["RedisPwd"] = "current-node-secret",
            ["MinIOEndPoint"] = "current-node-minio"
        };
        var localBeforeProjection = (JObject)local.DeepClone();

        Assert.True(OsClientExtend.RestoreSharedInfrastructureFromLocal(
            merged,
            local,
            removeCachedValuesFirst: true));
        Assert.Equal("current-node-host", merged["RedisHost"]?.ToString());
        Assert.Equal("current-node-secret", merged["RedisPwd"]?.ToString());
        Assert.Equal("current-node-minio", merged["MinIOEndPoint"]?.ToString());
        Assert.Equal("Junchi", merged["ClientName"]?.ToString());
        Assert.True(JToken.DeepEquals(localBeforeProjection, local));

        var failClosed = new JObject
        {
            ["RedisHost"] = "l2-untrusted-host",
            ["ClientName"] = "Junchi"
        };
        Assert.False(OsClientExtend.RestoreSharedInfrastructureFromLocal(
            failClosed,
            new JObject(),
            removeCachedValuesFirst: true));
        Assert.Null(failClosed["RedisHost"]);
        Assert.Equal("Junchi", failClosed["ClientName"]?.ToString());

        var noTrustedLocalModel = new JObject
        {
            ["RedisHost"] = "l2-must-not-become-local-fallback",
            ["ClientName"] = "Junchi"
        };
        Assert.False(OsClientExtend.RestoreSharedInfrastructureFromLocal(
            noTrustedLocalModel,
            null,
            removeCachedValuesFirst: true));
        Assert.Null(noTrustedLocalModel["RedisHost"]);
        Assert.Equal("Junchi", noTrustedLocalModel["ClientName"]?.ToString());
    }

    [Fact]
    public void RuntimeInvalidationPaths_UseTheV2AwareHelper()
    {
        var root = FindRepositoryRoot();
        var formEngineLang = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Core", "FormEngine", "FormEngineLang.cs"));
        var provisioning = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Core", "Runtime", "TenantProvisioningService.cs"));
        var v8Method = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Core", "V8Engine", "Runtime", "V8Method.cs"));
        var osClient = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Core", "SaaSEngine", "OsClient.cs"));

        Assert.Contains("InvalidateSaasConfigurationCache(osClient)", formEngineLang, StringComparison.Ordinal);
        Assert.Contains("InvalidateSaasConfigurationCache(osClient, cache)", provisioning, StringComparison.Ordinal);
        Assert.Contains("InvalidateSaasConfigurationCache(osClient, defaultCache)", v8Method, StringComparison.Ordinal);
        Assert.Contains("ReprojectCurrentNodeInfrastructure", osClient, StringComparison.Ordinal);
        Assert.Contains("SetToCache(cache, cacheKey, payload)", osClient, StringComparison.Ordinal);
        Assert.Contains("RemoveCacheKey(cache, cacheKey)", osClient, StringComparison.Ordinal);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Microi.Server", "Microi.net.sln")))
            {
                return directory.FullName;
            }
            if (File.Exists(Path.Combine(directory.FullName, "Microi.net.sln"))
                && Directory.Exists(Path.Combine(directory.FullName, "Microi.Core")))
            {
                return directory.Parent?.FullName ?? directory.FullName;
            }
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Repository root was not found.");
    }

    private static (IMicroiCache Cache, RecordingCacheProxy Recorder) CreateRecordingCache()
    {
        var cache = DispatchProxy.Create<IMicroiCache, RecordingCacheProxy>();
        return (cache, (RecordingCacheProxy)(object)cache);
    }

    public class RecordingCacheProxy : DispatchProxy
    {
        public Dictionary<string, JObject> Values { get; } =
            new(StringComparer.Ordinal);
        public List<string> SetKeys { get; } = new();
        public List<string> RemovedKeys { get; } = new();

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod == null || args == null)
            {
                throw new InvalidOperationException("Invalid cache proxy invocation.");
            }

            var key = args.Length > 0 ? args[0]?.ToString() ?? string.Empty : string.Empty;
            if (targetMethod.Name == nameof(IMicroiCache.Get))
            {
                return Values.TryGetValue(key, out var value)
                    ? (JObject)value.DeepClone()
                    : null;
            }
            if (targetMethod.Name == nameof(IMicroiCache.Set))
            {
                var value = args.Length > 1 ? args[1] as JObject : null;
                if (value == null) return false;
                Values[key] = (JObject)value.DeepClone();
                SetKeys.Add(key);
                return true;
            }
            if (targetMethod.Name == nameof(IMicroiCache.Remove))
            {
                RemovedKeys.Add(key);
                return Values.Remove(key);
            }

            throw new NotSupportedException(targetMethod.Name);
        }
    }
}
