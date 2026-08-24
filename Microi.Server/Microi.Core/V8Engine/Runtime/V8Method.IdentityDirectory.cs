using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private const int IdentityDirectoryMaxResponseBytes = 2 * 1024 * 1024;
        private const int IdentityDirectoryMaxPageSize = 200;

        /// <summary>
        /// 读取当前租户配置的 SCIM 目录。C# 只处理协议、SSRF 防护和密钥隔离，
        /// 字段映射、差异计划、冲突和写入仍由接口引擎编排。
        /// </summary>
        public DosResult ReadIdentityDirectoryPage(dynamic dynamicParam)
        {
            var denied = RequireCurrentTenantSuperAdmin(out var osClient, out _);
            if (denied != null) return new DosResult(denied.Code, denied.Data, denied.Msg);

            try
            {
                using var allocationScope = BeginTrustedHostAllocationScope();
                var request = ToJObject(dynamicParam);
                var connectorId = GetJsonString(request, "ConnectorId");
                if (connectorId.DosIsNullOrWhiteSpace() || connectorId.Length > 80)
                    return new DosResult(0, null, "ConnectorId 无效。");

                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null) return new DosResult(0, null, "当前租户数据库不可用。");
                var rows = client.Db.FromSql(
                        "SELECT Id,ConnectorKey,ConnectorType,Endpoint,SecretReference,Enabled " +
                        "FROM mci_identity_connector WHERE Id=@ConnectorId AND (IsDeleted<>1 OR IsDeleted IS NULL)")
                    .AddInParameter("@ConnectorId", connectorId)
                    .ToList<dynamic>();
                dynamic connector = rows?.FirstOrDefault();
                if (connector == null) return new DosResult(2, null, "身份连接器不存在。");
                JObject connectorJson = connector as JObject ?? JObject.FromObject((object)connector);
                if (connectorJson["Enabled"].Val<int>() != 1)
                    return new DosResult(0, null, "身份连接器未启用。");
                if (!string.Equals(connectorJson["ConnectorType"]?.ToString(), "SCIM", StringComparison.OrdinalIgnoreCase))
                    return new DosResult(0, null, "可信目录原子能力当前只支持 SCIM；其它目录继续使用租户扩展 Hook。");

                var endpointText = (connectorJson["Endpoint"]?.ToString() ?? string.Empty).Trim();
                Uri resourceUri;
                string resourceType;
                string endpointError;
                if (!TryBuildScimResourceUri(endpointText, request["ResourceType"]?.ToString(), out resourceUri, out resourceType, out endpointError))
                    return new DosResult(0, null, endpointError);

                var secretReference = (connectorJson["SecretReference"]?.ToString() ?? string.Empty).Trim();
                string secretKey;
                try { secretKey = TenantSystemSettingsSecurity.NormalizeKey(secretReference); }
                catch { return new DosResult(0, null, "SecretReference 必须是当前租户系统设置中的合法 Key。"); }
                var settings = TenantSystemSettingsSecurity.LoadSnapshot(osClient);
                if (!settings.TryGetValue(secretKey, out var secretSetting)
                    || !secretSetting.IsEnabled
                    || !secretSetting.IsSecret)
                    return new DosResult(0, null, "SecretReference 未指向已启用的租户密钥设置。");
                var protectedToken = TenantSystemSettingsSecurity.GetText(settings, secretKey, string.Empty, true);
                if (!TryReadBearerToken(protectedToken, out var bearerToken))
                    return new DosResult(0, null, "SCIM 密钥设置必须是 Bearer Token 或仅包含 BearerToken 的 JSON。");

                var startIndex = Math.Max(1, request["StartIndex"].Val<int>());
                var count = request["Count"].Val<int>();
                if (count <= 0) count = 100;
                count = Math.Min(count, IdentityDirectoryMaxPageSize);
                var uriBuilder = new UriBuilder(resourceUri)
                {
                    Query = $"startIndex={startIndex}&count={count}"
                };
                var requestUri = uriBuilder.Uri;

                using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(20));
                var publicAddresses = ResolvePublicIdentityDirectoryAddresses(
                    requestUri.DnsSafeHost,
                    cancellation.Token);
                if (publicAddresses.Count == 0)
                    return new DosResult(0, null, "SCIM 端点解析到私网、环回、链路本地或保留地址，已拒绝访问。");
                // netstandard2.1 没有 SocketsHttpHandler.ConnectCallback。发送前再次解析，
                // 只有两次结果均为公网且至少一个地址稳定时才继续，缩小 DNS 重绑定窗口。
                var confirmedAddresses = ResolvePublicIdentityDirectoryAddresses(
                    requestUri.DnsSafeHost,
                    cancellation.Token);
                if (!publicAddresses.Intersect(confirmedAddresses).Any())
                    return new DosResult(0, null, "SCIM 端点 DNS 结果在请求前发生变化，已拒绝访问。");

                using var handler = new HttpClientHandler
                {
                    AllowAutoRedirect = false,
                    AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
                    UseCookies = false,
                    UseDefaultCredentials = false
                };
                using var http = new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan };
                using var httpRequest = new HttpRequestMessage(HttpMethod.Get, requestUri);
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
                httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/scim+json"));
                httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                httpRequest.Headers.UserAgent.ParseAdd("Microi-Identity-Directory/1.0");
                using var response = http.SendAsync(
                        httpRequest,
                        HttpCompletionOption.ResponseHeadersRead,
                        cancellation.Token)
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                if ((int)response.StatusCode < 200 || (int)response.StatusCode >= 300)
                    return new DosResult(0, new
                    {
                        StatusCode = (int)response.StatusCode,
                        EndpointHost = requestUri.DnsSafeHost
                    }, "SCIM 目录返回非成功状态，响应正文未读取也未写入日志。");
                if (response.Content.Headers.ContentLength > IdentityDirectoryMaxResponseBytes)
                    return new DosResult(0, null, "SCIM 响应超过 2 MB 安全上限。");
                var contentType = response.Content.Headers.ContentType?.MediaType ?? string.Empty;
                if (!contentType.Contains("json", StringComparison.OrdinalIgnoreCase)
                    && !contentType.Contains("scim", StringComparison.OrdinalIgnoreCase))
                    return new DosResult(0, null, "SCIM 响应不是 JSON。");
                using var responseStream = response.Content.ReadAsStreamAsync()
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                var payload = ReadBoundedIdentityDirectoryPayload(responseStream, IdentityDirectoryMaxResponseBytes);
                JObject body;
                try { body = JObject.Parse(payload); }
                catch { return new DosResult(0, null, "SCIM 响应不是有效 JSON，原始内容未返回也未写入日志。"); }
                var normalized = NormalizeScimListResponse(resourceType, body, startIndex, count);
                normalized["ConnectorId"] = connectorId;
                normalized["ConnectorKey"] = connectorJson["ConnectorKey"]?.ToString() ?? string.Empty;
                normalized["EndpointHost"] = requestUri.DnsSafeHost;
                normalized["ETag"] = response.Headers.ETag?.Tag ?? string.Empty;
                return new DosResult(1, normalized);
            }
            catch (OperationCanceledException)
            {
                return new DosResult(0, null, "SCIM 目录请求超时。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "读取 SCIM 目录失败：" + RedactIdentityDirectoryError(ex.Message));
            }
        }

        public static bool IsPublicIdentityDirectoryAddress(IPAddress address)
        {
            if (address == null || IPAddress.IsLoopback(address)) return false;
            if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
            var bytes = address.GetAddressBytes();
            if (address.AddressFamily == AddressFamily.InterNetwork)
            {
                var a = bytes[0];
                var b = bytes[1];
                if (a == 0 || a == 10 || a == 127 || a >= 224) return false;
                if (a == 100 && b >= 64 && b <= 127) return false;
                if (a == 169 && b == 254) return false;
                if (a == 172 && b >= 16 && b <= 31) return false;
                if (a == 192 && b == 168) return false;
                if (a == 192 && b == 0) return false;
                if (a == 198 && (b == 18 || b == 19)) return false;
                return true;
            }
            if (address.AddressFamily != AddressFamily.InterNetworkV6) return false;
            if (address.IsIPv6LinkLocal || address.IsIPv6Multicast || address.IsIPv6SiteLocal) return false;
            return (bytes[0] & 0xfe) != 0xfc;
        }

        private static List<IPAddress> ResolvePublicIdentityDirectoryAddresses(
            string host,
            CancellationToken cancellationToken)
        {
            var dnsTask = Dns.GetHostAddressesAsync(host);
            var completed = System.Threading.Tasks.Task.WhenAny(
                    dnsTask,
                    System.Threading.Tasks.Task.Delay(TimeSpan.FromSeconds(6), cancellationToken))
                .ConfigureAwait(false).GetAwaiter().GetResult();
            if (completed != dnsTask) throw new OperationCanceledException("SCIM DNS 解析超时。", cancellationToken);
            var addresses = dnsTask.ConfigureAwait(false).GetAwaiter().GetResult()
                            ?? Array.Empty<IPAddress>();
            if (addresses.Length == 0 || addresses.Any(address => !IsPublicIdentityDirectoryAddress(address)))
                return new List<IPAddress>();
            return addresses.Distinct().ToList();
        }

        public static JObject NormalizeScimListResponse(
            string resourceType,
            JObject body,
            int fallbackStartIndex = 1,
            int fallbackPageSize = 100)
        {
            resourceType = string.Equals(resourceType, "Groups", StringComparison.OrdinalIgnoreCase)
                ? "Groups"
                : "Users";
            var resources = body?["Resources"] as JArray ?? new JArray();
            var records = new JArray();
            foreach (var resource in resources.OfType<JObject>())
            {
                if (resourceType == "Groups")
                {
                    records.Add(new JObject
                    {
                        ["ExternalId"] = resource["id"]?.ToString() ?? string.Empty,
                        ["Name"] = resource["displayName"]?.ToString() ?? string.Empty,
                        ["Members"] = new JArray((resource["members"] as JArray ?? new JArray())
                            .OfType<JObject>()
                            .Select(member => new JObject
                            {
                                ["ExternalId"] = member["value"]?.ToString() ?? string.Empty,
                                ["Display"] = member["display"]?.ToString() ?? string.Empty
                            }))
                    });
                    continue;
                }
                var enterprise = resource["urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"] as JObject;
                records.Add(new JObject
                {
                    ["ExternalId"] = resource["id"]?.ToString() ?? string.Empty,
                    ["Account"] = resource["userName"]?.ToString() ?? string.Empty,
                    ["Name"] = ResolveScimDisplayName(resource),
                    ["Email"] = ResolvePrimaryScimValue(resource["emails"] as JArray),
                    ["Phone"] = ResolvePrimaryScimValue(resource["phoneNumbers"] as JArray),
                    ["DeptName"] = enterprise?["department"]?.ToString() ?? string.Empty,
                    ["Active"] = resource["active"]?.Type == JTokenType.Boolean
                        ? resource["active"].Value<bool>()
                        : true
                });
            }
            var total = Math.Max(records.Count, body?["totalResults"].Val<int>() ?? records.Count);
            var start = Math.Max(1, body?["startIndex"].Val<int>() ?? fallbackStartIndex);
            var pageSize = Math.Max(records.Count, body?["itemsPerPage"].Val<int>() ?? fallbackPageSize);
            var next = start + records.Count;
            return new JObject
            {
                ["ResourceType"] = resourceType,
                ["Records"] = records,
                ["TotalResults"] = total,
                ["StartIndex"] = start,
                ["ItemsPerPage"] = pageSize,
                ["NextStartIndex"] = next,
                ["HasMore"] = records.Count > 0 && next <= total
            };
        }

        private static bool TryBuildScimResourceUri(
            string endpoint,
            string requestedResourceType,
            out Uri resourceUri,
            out string resourceType,
            out string error)
        {
            resourceUri = null;
            resourceType = string.Equals(requestedResourceType, "Groups", StringComparison.OrdinalIgnoreCase)
                ? "Groups"
                : "Users";
            error = string.Empty;
            if (endpoint.Length == 0 || endpoint.Length > 2000
                || !Uri.TryCreate(endpoint, UriKind.Absolute, out var baseUri)
                || !string.Equals(baseUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
                || !string.IsNullOrEmpty(baseUri.UserInfo)
                || !string.IsNullOrEmpty(baseUri.Query)
                || !string.IsNullOrEmpty(baseUri.Fragment))
            {
                error = "SCIM Endpoint 必须是无凭据、无 Query、无 Fragment 的 HTTPS 绝对地址。";
                return false;
            }
            var path = baseUri.AbsolutePath.TrimEnd('/');
            if (path.EndsWith("/Users", StringComparison.OrdinalIgnoreCase)
                || path.EndsWith("/Groups", StringComparison.OrdinalIgnoreCase))
                path = path.Substring(0, path.LastIndexOf('/'));
            var builder = new UriBuilder(baseUri) { Path = path + "/" + resourceType, Query = string.Empty, Fragment = string.Empty };
            resourceUri = builder.Uri;
            return true;
        }

        private static bool TryReadBearerToken(string protectedValue, out string token)
        {
            token = (protectedValue ?? string.Empty).Trim();
            if (token.StartsWith("{", StringComparison.Ordinal))
            {
                try
                {
                    var json = JObject.Parse(token);
                    if (json.Properties().Any(property => !string.Equals(property.Name, "BearerToken", StringComparison.OrdinalIgnoreCase)))
                    {
                        token = string.Empty;
                        return false;
                    }
                    token = json["BearerToken"]?.ToString()?.Trim() ?? string.Empty;
                }
                catch
                {
                    token = string.Empty;
                    return false;
                }
            }
            return token.Length >= 8 && token.Length <= 8192
                   && token.IndexOfAny(new[] { '\r', '\n' }) < 0;
        }

        private static string ReadBoundedIdentityDirectoryPayload(Stream stream, int maxBytes)
        {
            using var memory = new MemoryStream();
            var buffer = new byte[16 * 1024];
            while (true)
            {
                var read = stream.Read(buffer, 0, buffer.Length);
                if (read <= 0) break;
                if (memory.Length + read > maxBytes) throw new InvalidDataException("SCIM 响应超过 2 MB 安全上限。");
                memory.Write(buffer, 0, read);
            }
            return Encoding.UTF8.GetString(memory.ToArray());
        }

        private static string ResolveScimDisplayName(JObject resource)
        {
            var display = resource?["displayName"]?.ToString()?.Trim();
            if (!string.IsNullOrWhiteSpace(display)) return display;
            var name = resource?["name"] as JObject;
            var formatted = name?["formatted"]?.ToString()?.Trim();
            if (!string.IsNullOrWhiteSpace(formatted)) return formatted;
            return string.Join(" ", new[]
            {
                name?["givenName"]?.ToString()?.Trim(),
                name?["familyName"]?.ToString()?.Trim()
            }.Where(value => !string.IsNullOrWhiteSpace(value)));
        }

        private static string ResolvePrimaryScimValue(JArray values)
        {
            var rows = values?.OfType<JObject>().ToList() ?? new List<JObject>();
            return rows.FirstOrDefault(row => row["primary"].Val<bool>())?["value"]?.ToString()
                   ?? rows.FirstOrDefault()?["value"]?.ToString()
                   ?? string.Empty;
        }

        private static string RedactIdentityDirectoryError(string message)
        {
            var value = (message ?? string.Empty).Replace('\r', ' ').Replace('\n', ' ').Trim();
            if (value.Length > 300) value = value.Substring(0, 300);
            return value;
        }
    }
}
