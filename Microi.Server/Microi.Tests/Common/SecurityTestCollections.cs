using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

[CollectionDefinition("SaaSRuntimeConfiguration", DisableParallelization = true)]
public sealed class SaaSRuntimeConfigurationCollection
{
    public const string Name = "SaaSRuntimeConfiguration";
}

[CollectionDefinition("TenantContextGlobal", DisableParallelization = true)]
public sealed class TenantContextGlobalCollection
{
}

internal static class SaaSRuntimeConfigurationScope
{
    private static readonly object SyncRoot = new();

    public static void Run(JObject model, Action action)
    {
        lock (SyncRoot)
        {
            var osClient = OsClientExtend.GetConfigOsClient();
            var originalDefaultOsClient = OsClientDefault.OsClient;
            if (string.IsNullOrWhiteSpace(osClient))
            {
                osClient = "runtime-settings-test";
                OsClientDefault.OsClient = osClient;
            }

            var hadOriginal = OsClientExtend.ClientList.TryGetValue(osClient, out var original);
            try
            {
                OsClientExtend.ClientList[osClient] = new OsClientSecret
                {
                    OsClient = osClient,
                    OsClientModel = model
                };
                action();
            }
            finally
            {
                if (hadOriginal)
                {
                    OsClientExtend.ClientList[osClient] = original;
                }
                else
                {
                    OsClientExtend.ClientList.TryRemove(osClient, out _);
                }
                OsClientDefault.OsClient = originalDefaultOsClient;
            }
        }
    }

    public static void RunSsrf(bool? enabled, string? allowedHosts, Action action)
    {
        var model = new JObject();
        if (enabled.HasValue) model["SsrfProtectionEnabled"] = enabled.Value ? 1 : 0;
        if (!string.IsNullOrWhiteSpace(allowedHosts)) model["SsrfAllowedHosts"] = allowedHosts;
        Run(model, action);
    }
}
