using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Reads the opt-in Chanjet V2 callback settings from the current tenant's
    /// mci_system_setting store. The legacy sys_osclients compatibility fields are
    /// intentionally not extended or reused as the V2 source of truth.
    /// </summary>
    public static class ChanjetV2ProtocolGatewaySettings
    {
        public const string EnabledKey = "Integration.Chanjet.CallbackV2.Enabled";
        public const string AesKeySetting = "Integration.Chanjet.CallbackV2.AesKey";
        public const string AppKeysSetting = "Integration.Chanjet.CallbackV2.AppKeys";

        private const int MaxAppKeys = 32;
        private const int MaxAppKeyLength = 128;

        public static bool TryLoad(
            string requestedOsClient,
            out ChanjetV2GatewaySettings settings)
        {
            settings = null;

            // Reuse the existing exact, enabled, non-deleted tenant resolution atom.
            // TryLoadChanjet does not require the legacy Chanjet values to be non-empty.
            if (!TenantProtocolGatewaySettings.TryLoadChanjet(
                    requestedOsClient,
                    out var tenantSettings))
            {
                return false;
            }

            try
            {
                var snapshot = TenantSystemSettingsSecurity.LoadSnapshot(tenantSettings.OsClient);
                if (!TenantSystemSettingsSecurity.GetBool(snapshot, EnabledKey, false))
                    return false;

                var aesKey = TenantSystemSettingsSecurity.GetText(
                    snapshot,
                    AesKeySetting,
                    string.Empty,
                    decryptSecret: true);
                var appKeys = TenantSystemSettingsSecurity.GetText(
                    snapshot,
                    AppKeysSetting,
                    string.Empty,
                    decryptSecret: true);
                return TryCreate(tenantSettings.OsClient, aesKey, appKeys, out settings);
            }
            catch
            {
                settings = null;
                return false;
            }
        }

        internal static bool TryCreate(
            string osClient,
            string aesKey,
            string configuredAppKeys,
            out ChanjetV2GatewaySettings settings)
        {
            settings = null;
            var normalizedTenant = (osClient ?? string.Empty).Trim();
            var normalizedAesKey = (aesKey ?? string.Empty).Trim();
            var aesKeyLength = Encoding.UTF8.GetByteCount(normalizedAesKey);
            if (normalizedTenant.Length == 0
                || (aesKeyLength != 16 && aesKeyLength != 24 && aesKeyLength != 32))
            {
                return false;
            }

            if (!TryParseAppKeys(configuredAppKeys, out var appKeys)) return false;
            settings = new ChanjetV2GatewaySettings(
                normalizedTenant,
                normalizedAesKey,
                appKeys);
            return true;
        }

        private static bool TryParseAppKeys(
            string configuredAppKeys,
            out IReadOnlyCollection<string> appKeys)
        {
            appKeys = Array.Empty<string>();
            var raw = (configuredAppKeys ?? string.Empty).Trim();
            if (raw.Length == 0 || raw.Length > 8 * 1024) return false;

            IEnumerable<string> candidates;
            if (raw.StartsWith("[", StringComparison.Ordinal))
            {
                try
                {
                    var parsed = JArray.Parse(raw);
                    if (parsed.Any(item => item.Type != JTokenType.String)) return false;
                    candidates = parsed.Select(item => item.ToString());
                }
                catch
                {
                    return false;
                }
            }
            else
            {
                candidates = raw.Split(
                    new[] { ',', ';', '\r', '\n' },
                    StringSplitOptions.RemoveEmptyEntries);
            }

            var normalized = new List<string>();
            // Chanjet appKey values are opaque credentials. Preserve their exact
            // casing both while de-duplicating configuration and while matching a
            // callback, otherwise two distinct provider keys could collapse.
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var candidate in candidates)
            {
                var value = (candidate ?? string.Empty).Trim();
                if (value.Length == 0
                    || value.Length > MaxAppKeyLength
                    || value.Any(char.IsControl))
                {
                    return false;
                }
                if (seen.Add(value)) normalized.Add(value);
                if (normalized.Count > MaxAppKeys) return false;
            }

            if (normalized.Count == 0) return false;
            appKeys = normalized;
            return true;
        }
    }

    public sealed class ChanjetV2GatewaySettings
    {
        private readonly IReadOnlyCollection<string> _allowedAppKeys;

        internal ChanjetV2GatewaySettings(
            string osClient,
            string aesKey,
            IReadOnlyCollection<string> allowedAppKeys)
        {
            OsClient = osClient;
            AesKey = aesKey;
            _allowedAppKeys = allowedAppKeys ?? Array.Empty<string>();
        }

        public string OsClient { get; }
        public string AesKey { get; }
        public int AllowedAppKeyCount => _allowedAppKeys.Count;

        public bool IsAllowedAppKey(string appKey)
        {
            return _allowedAppKeys.Any(candidate =>
                FixedTimeText.Equals(candidate, appKey));
        }
    }

    internal static class FixedTimeText
    {
        internal static bool Equals(string left, string right)
        {
            if (left == null || right == null) return false;
            using (var sha = System.Security.Cryptography.SHA256.Create())
            {
                var leftBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(left));
                var rightBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(right));
                var different = 0;
                for (var index = 0; index < leftBytes.Length; index++)
                {
                    different |= leftBytes[index] ^ rightBytes[index];
                }
                return different == 0;
            }
        }
    }
}
