using System;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// Platform bootstrap atoms that must remain available even when a tenant has
    /// not yet received the matching Managed ApiEngine resource.  This is not a
    /// business facade: it only exposes the same fixed, browser-safe projection
    /// used by the official platform-sys-config engine so a legacy bootstrap route
    /// can recover independently from an incomplete application-package upgrade.
    /// </summary>
    public static class PlatformBootstrapCompatibilityService
    {
        public static async Task<DosResult> GetPublicSysConfigAsync(
            string osClient,
            string lang = null)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "OsClient不能为空。");
            }

            try
            {
                var source = await MicroiEngine.FormEngine
                    .GetSysConfig(osClient, lang)
                    .ConfigureAwait(false);
                if (source == null)
                {
                    return new DosResult(0, null, "系统设置读取失败。");
                }

                var projection = source.Data == null
                    ? null
                    : TenantConfigurationSecurity.CreatePublicSysConfigProjection(
                        source.Data,
                        osClient);
                var loginPublicKey = ConfigHelper.GetRuntimeConfigurationValue(
                    "Security:LoginRsaPublicKey");
                if (projection != null && !loginPublicKey.DosIsNullOrWhiteSpace())
                {
                    // The public key is deliberately part of the anonymous
                    // bootstrap projection.  Private key material never enters
                    // this result or the V8 runtime.
                    projection["LoginRsaPublicKey"] = loginPublicKey
                        .Replace("\\n", "\n")
                        .Trim();
                }

                var result = new DosResult(
                    source.Code,
                    projection,
                    source.Msg,
                    null,
                    source.DataAppend);
                foreach (var property in source.DynamicProperties)
                {
                    result.DynamicProperties[property.Key] = property.Value;
                }
                return result;
            }
            catch (Exception)
            {
                return new DosResult(0, null, "系统设置读取失败，请稍后重试。");
            }
        }
    }
}
