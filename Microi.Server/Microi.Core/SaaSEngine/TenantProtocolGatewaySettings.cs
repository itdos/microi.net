using System;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Reads the small, explicit sys_osclients configuration surface used by legacy
    /// protocol gateways. Each method returns only the fields needed by one protocol;
    /// callers never receive another gateway's secrets and never fall back to the
    /// process main tenant or ConfigHelper's generic runtime reader.
    /// </summary>
    public static class TenantProtocolGatewaySettings
    {
        private const int MaxOriginPolicyLength = 16 * 1024;
        private const int MaxSecretLength = 4 * 1024;

        public static bool TryLoadChanjet(
            string requestedOsClient,
            out ChanjetProtocolGatewaySettings settings)
        {
            settings = null;
            if (!TryLoadTenantModel(requestedOsClient, out var osClient, out var model))
                return false;
            settings = new ChanjetProtocolGatewaySettings(
                osClient,
                ReadText(model, "ChanjetOAuthState", MaxSecretLength),
                ReadText(model, "ChanjetAesKey", MaxSecretLength),
                ReadText(model, "ChanjetAppKey", MaxSecretLength));
            return true;
        }

        public static bool TryLoadOAuthReturnUrlPolicy(
            string requestedOsClient,
            out TenantOAuthReturnUrlPolicy policy)
        {
            policy = null;
            if (!TryLoadTenantModel(requestedOsClient, out var osClient, out var model))
                return false;
            policy = new TenantOAuthReturnUrlPolicy(
                osClient,
                ReadText(model, "OAuthReturnUrlOrigins", MaxOriginPolicyLength));
            return true;
        }

        /// <summary>
        /// Resolves one enabled, non-deleted tenant snapshot. Case-variant duplicates
        /// fail closed instead of selecting an arbitrary tenant configuration.
        /// </summary>
        private static bool TryLoadTenantModel(
            string requestedOsClient,
            out string resolvedOsClient,
            out JObject model)
        {
            resolvedOsClient = string.Empty;
            model = null;
            string osClient;
            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(requestedOsClient);
            }
            catch
            {
                return false;
            }

            var matches = FindTenantMatches(osClient);
            if (matches.Length == 0)
            {
                try
                {
                    // GetClient may hydrate this exact tenant from the shared SaaS cache.
                    // It never substitutes the process main tenant when an explicit key is supplied.
                    OsClientExtend.GetClient(osClient);
                }
                catch
                {
                    return false;
                }
                matches = FindTenantMatches(osClient);
            }

            if (matches.Length != 1) return false;
            var client = matches[0].Value;
            model = client?.OsClientModel;
            if (model == null
                || !string.Equals(client.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
            {
                model = null;
                return false;
            }

            var rowOsClient = model["OsClient"]?.ToString()?.Trim();
            if (!string.IsNullOrWhiteSpace(rowOsClient)
                && !string.Equals(rowOsClient, osClient, StringComparison.OrdinalIgnoreCase))
            {
                model = null;
                return false;
            }
            if (!TryReadBoolean(model["IsEnable"], false, out var isEnabled)
                || !isEnabled
                || !TryReadBoolean(model["IsDeleted"], false, out var isDeleted)
                || isDeleted)
            {
                model = null;
                return false;
            }

            resolvedOsClient = client.OsClient;
            return true;
        }

        private static System.Collections.Generic.KeyValuePair<string, OsClientSecret>[]
            FindTenantMatches(string osClient)
        {
            return OsClientExtend.ClientList
                .Where(pair => string.Equals(pair.Key, osClient, StringComparison.OrdinalIgnoreCase))
                .Take(2)
                .ToArray();
        }

        private static string ReadText(JObject model, string fieldName, int maxLength)
        {
            var value = model?[fieldName]?.ToString()?.Trim() ?? string.Empty;
            if (value.Length > maxLength || value.Any(char.IsControl)) return string.Empty;
            return value;
        }

        private static bool TryReadBoolean(JToken token, bool defaultValue, out bool value)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
            {
                value = defaultValue;
                return true;
            }
            if (token.Type == JTokenType.Boolean)
            {
                value = token.Value<bool>();
                return true;
            }
            var text = token.ToString().Trim();
            if (string.Equals(text, "1", StringComparison.Ordinal)
                || string.Equals(text, "true", StringComparison.OrdinalIgnoreCase))
            {
                value = true;
                return true;
            }
            if (string.Equals(text, "0", StringComparison.Ordinal)
                || string.Equals(text, "false", StringComparison.OrdinalIgnoreCase))
            {
                value = false;
                return true;
            }
            value = false;
            return false;
        }
    }

    public sealed class ChanjetProtocolGatewaySettings
    {
        internal ChanjetProtocolGatewaySettings(
            string osClient,
            string oauthState,
            string aesKey,
            string appKey)
        {
            OsClient = osClient;
            OAuthState = oauthState;
            AesKey = aesKey;
            AppKey = appKey;
        }

        public string OsClient { get; }
        public string OAuthState { get; }
        public string AesKey { get; }
        public string AppKey { get; }
    }

    public sealed class TenantOAuthReturnUrlPolicy
    {
        private const int MaxAllowedOrigins = 64;
        private readonly string _configuredOrigins;

        internal TenantOAuthReturnUrlPolicy(string osClient, string configuredOrigins)
        {
            OsClient = osClient;
            _configuredOrigins = configuredOrigins ?? string.Empty;
        }

        public string OsClient { get; }

        /// <summary>
        /// Same-site relative routes are always allowed. Absolute redirects require an
        /// exact HTTPS origin from this tenant's OAuthReturnUrlOrigins policy.
        /// </summary>
        public bool IsAllowed(string returnUrl)
        {
            if (string.IsNullOrWhiteSpace(returnUrl)) return true;
            var value = returnUrl.Trim();
            if (value.Length > 2048 || value.IndexOfAny(new[] { '\r', '\n', '\\' }) >= 0)
                return false;

            if (value.StartsWith("/", StringComparison.Ordinal)
                && !value.StartsWith("//", StringComparison.Ordinal))
            {
                return Uri.TryCreate(value, UriKind.Relative, out _);
            }

            if (!TryNormalizeHttpsOrigin(value, out var returnOrigin)
                || string.IsNullOrWhiteSpace(_configuredOrigins))
            {
                return false;
            }

            var candidates = _configuredOrigins
                .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Take(MaxAllowedOrigins + 1)
                .ToArray();
            if (candidates.Length > MaxAllowedOrigins) return false;
            return candidates.Any(candidate =>
                TryNormalizeHttpsOrigin(candidate.Trim(), out var allowedOrigin)
                && string.Equals(allowedOrigin, returnOrigin, StringComparison.OrdinalIgnoreCase));
        }

        private static bool TryNormalizeHttpsOrigin(string value, out string origin)
        {
            origin = string.Empty;
            if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
                || !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
                || !string.IsNullOrWhiteSpace(uri.UserInfo))
            {
                return false;
            }
            origin = uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
            return !string.IsNullOrWhiteSpace(origin);
        }
    }
}
