using System;
using System.Collections;
using System.Linq;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Microi.Unity
{
    [DisallowMultipleComponent]
    public sealed class MicroiApiClient : MonoBehaviour
    {
        [Header("Microi API")]
        [SerializeField] private string apiBaseUrl = "";
        [SerializeField] private string osClient = "";
        [SerializeField, Min(1)] private int timeoutSeconds = 30;
        [SerializeField] private string deviceId = "";
        [SerializeField] private bool notifyWebGlHostWhenReady = true;

        [NonSerialized] private string authorizationToken = "";

        public string ApiBaseUrl => apiBaseUrl;
        public string OsClient => osClient;
        public bool HasAuthorization => !string.IsNullOrWhiteSpace(authorizationToken);

        public event Action<string> AuthorizationRotated;
        public event Action<MicroiHostContext> HostContextApplied;

        private void Awake()
        {
            if (string.IsNullOrWhiteSpace(gameObject.name) || gameObject.name.StartsWith("GameObject", StringComparison.Ordinal))
            {
                gameObject.name = "MicroiApiClient";
            }
        }

        private void Start()
        {
            if (notifyWebGlHostWhenReady)
            {
                MicroiWebGLBridge.NotifyReady();
            }
        }

        public void Configure(string baseUrl, string tenantOsClient, string did = null)
        {
            apiBaseUrl = NormalizeBaseUrl(baseUrl);
            osClient = NormalizeHeaderValue(tenantOsClient, 128);
            if (did != null)
            {
                deviceId = NormalizeHeaderValue(did, 256);
            }
        }

        public void SetAuthorization(string tokenOrBearerValue)
        {
            authorizationToken = NormalizeToken(tokenOrBearerValue);
        }

        public void ClearAuthorization()
        {
            authorizationToken = string.Empty;
        }

        /// <summary>
        /// WebGL宿主使用 Unity SendMessage 调用。Authorization 只存内存，不写场景或日志。
        /// </summary>
        public void ApplyMicroiHostContext(string contextJson)
        {
            if (string.IsNullOrWhiteSpace(contextJson))
            {
                return;
            }

            try
            {
                var context = JsonUtility.FromJson<MicroiHostContext>(contextJson);
                if (context == null)
                {
                    return;
                }

                Configure(context.ApiBaseUrl, context.OsClient, context.Did);
                SetAuthorization(context.Authorization);
                HostContextApplied?.Invoke(context);
            }
            catch (Exception exception)
            {
                Debug.LogWarning($"Microi host context is invalid: {exception.Message}");
            }
        }

        public IEnumerator Post<TRequest, TData>(
            string apiEngineKey,
            TRequest payload,
            Action<MicroiDosResult<TData>> onSuccess,
            Action<MicroiRawResponse> onFailure = null)
        {
            var json = ReferenceEquals(payload, null) ? "{}" : JsonUtility.ToJson(payload);
            MicroiRawResponse response = null;
            yield return PostJson(apiEngineKey, json, value => response = value);

            if (response != null && response.IsSuccess && response.TryDeserialize<TData>(out var result))
            {
                onSuccess?.Invoke(result);
                yield break;
            }

            onFailure?.Invoke(response);
        }

        public IEnumerator PostJson(string apiEngineKey, string json, Action<MicroiRawResponse> completed)
        {
            if (!IsSafeApiEngineKey(apiEngineKey))
            {
                completed?.Invoke(CreateLocalError("ApiEngineKey 只允许字母、数字、点、下划线和短横线。"));
                yield break;
            }

            if (string.IsNullOrWhiteSpace(apiBaseUrl))
            {
                completed?.Invoke(CreateLocalError("尚未配置 Microi ApiBaseUrl。"));
                yield break;
            }

            var url = $"{NormalizeBaseUrl(apiBaseUrl)}/apiengine/{Uri.EscapeDataString(apiEngineKey)}";
            var body = Encoding.UTF8.GetBytes(string.IsNullOrWhiteSpace(json) ? "{}" : json);

            using (var request = new UnityWebRequest(url, UnityWebRequest.kHttpVerbPOST))
            {
                // Capture the exact token used by this request. If another response or a
                // host-context change rotates the token first, this late response must not
                // overwrite the newer in-memory session.
                var requestAuthorizationToken = authorizationToken;
                request.uploadHandler = new UploadHandlerRaw(body);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.timeout = Mathf.Max(1, timeoutSeconds);
                request.SetRequestHeader("Content-Type", "application/json; charset=utf-8");
                request.SetRequestHeader("Accept", "application/json");
                request.SetRequestHeader("apiengine", "1");

                if (!string.IsNullOrWhiteSpace(osClient))
                {
                    request.SetRequestHeader("osclient", osClient);
                }

                if (!string.IsNullOrWhiteSpace(deviceId))
                {
                    request.SetRequestHeader("did", deviceId);
                }

                if (!string.IsNullOrWhiteSpace(requestAuthorizationToken))
                {
                    request.SetRequestHeader("authorization", $"Bearer {requestAuthorizationToken}");
                }

                yield return request.SendWebRequest();

                ApplyRotatedAuthorization(request.GetResponseHeader("authorization"), requestAuthorizationToken);

                var rawJson = request.downloadHandler == null ? string.Empty : request.downloadHandler.text;
                var response = ParseResponse(request.responseCode, rawJson);
                if (request.result == UnityWebRequest.Result.ConnectionError ||
                    request.result == UnityWebRequest.Result.DataProcessingError ||
                    request.responseCode < 200 || request.responseCode >= 300)
                {
                    response.TransportError = string.IsNullOrWhiteSpace(request.error)
                        ? $"HTTP {request.responseCode}"
                        : request.error;
                }

                completed?.Invoke(response);
            }
        }

        private void ApplyRotatedAuthorization(string responseAuthorization, string requestAuthorizationToken)
        {
            var rotatedToken = NormalizeToken(responseAuthorization);
            if (string.IsNullOrWhiteSpace(rotatedToken) || string.Equals(rotatedToken, authorizationToken, StringComparison.Ordinal))
            {
                return;
            }

            if (!string.Equals(authorizationToken, requestAuthorizationToken, StringComparison.Ordinal))
            {
                return;
            }

            authorizationToken = rotatedToken;
            AuthorizationRotated?.Invoke(rotatedToken);
            MicroiWebGLBridge.NotifyAuthorizationRotated(rotatedToken, requestAuthorizationToken);
        }

        private static MicroiRawResponse ParseResponse(long status, string rawJson)
        {
            var response = new MicroiRawResponse
            {
                HttpStatus = status,
                RawJson = rawJson ?? string.Empty,
                Code = 0,
                Msg = string.Empty,
                DataCount = 0
            };

            if (string.IsNullOrWhiteSpace(rawJson))
            {
                return response;
            }

            try
            {
                var envelope = JsonUtility.FromJson<MicroiDosEnvelope>(rawJson);
                if (envelope != null)
                {
                    response.Code = envelope.Code;
                    response.Msg = envelope.Msg ?? string.Empty;
                    response.DataCount = envelope.DataCount;
                }
            }
            catch (Exception)
            {
                response.TransportError = "响应不是有效的 Microi DosResult JSON。";
            }

            return response;
        }

        private static MicroiRawResponse CreateLocalError(string message)
        {
            return new MicroiRawResponse
            {
                HttpStatus = 0,
                Code = 0,
                Msg = message,
                RawJson = string.Empty,
                TransportError = message
            };
        }

        private static string NormalizeBaseUrl(string value)
        {
            if (string.IsNullOrWhiteSpace(value) ||
                !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp) ||
                !string.IsNullOrEmpty(uri.UserInfo) ||
                !string.IsNullOrEmpty(uri.Query) ||
                !string.IsNullOrEmpty(uri.Fragment))
            {
                return string.Empty;
            }

            return uri.GetLeftPart(UriPartial.Path).TrimEnd('/');
        }

        private static string NormalizeToken(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var trimmed = value.Trim();
            const string prefix = "Bearer ";
            var token = trimmed.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                ? trimmed.Substring(prefix.Length).Trim()
                : trimmed;
            return token.Length <= 16384 && token.All(character => !char.IsControl(character))
                ? token
                : string.Empty;
        }

        private static string NormalizeHeaderValue(string value, int maximumLength)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var normalized = value.Trim();
            return normalized.Length <= maximumLength && normalized.All(character => !char.IsControl(character))
                ? normalized
                : string.Empty;
        }

        private static bool IsSafeApiEngineKey(string key)
        {
            if (string.IsNullOrWhiteSpace(key) || key.Length > 128)
            {
                return false;
            }

            foreach (var character in key)
            {
                if (!char.IsLetterOrDigit(character) && character != '.' && character != '_' && character != '-')
                {
                    return false;
                }
            }

            return true;
        }
    }
}
