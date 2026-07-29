using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RestSharp;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public partial class DiyHttp : IMicroiHttp
    {
        // 使用静态 RestClient 实例复用连接，避免 Socket 耗尽
        private static readonly RestClient _sharedClient = new RestClient(new RestClientOptions
        {
            ThrowOnAnyError = false,
            // Respect per-request V8.Http Timeout values; RestSharp uses the lower value between
            // RestClientOptions.Timeout and RestRequest.Timeout.
            Timeout = System.Threading.Timeout.InfiniteTimeSpan
        });

        // 严格 SSRF 模式使用独立连接池并禁止自动重定向，避免已通过校验的公网地址
        // 再跳转到私网。默认兼容模式继续使用历史 _sharedClient 行为。
        private static readonly RestClient _strictSsrfClient = new RestClient(new RestClientOptions
        {
            ThrowOnAnyError = false,
            FollowRedirects = false,
            Timeout = System.Threading.Timeout.InfiniteTimeSpan
        });

        #region SSRF 防护
        /// <summary>
        /// 是否启用严格 SSRF（Server-Side Request Forgery）防护，默认关闭。
        /// 未显式开启时完全保留历史 HTTP 行为，不做协议、URL 凭据、私网或云元数据拦截。
        /// 显式开启后才执行 ValidateSsrfUrl 的完整校验。
        ///
        /// 配置来源：主租户 sys_osclients.SsrfProtectionEnabled。
        /// </summary>
        private static bool IsStrictSsrfProtectionEnabled()
        {
            return ConfigHelper.GetRuntimeConfigurationBool(
                "SsrfProtection:Enabled",
                false);
        }

        /// <summary>
        /// 严格模式下的 SSRF 主机白名单来自主租户
        /// sys_osclients.SsrfAllowedHosts。
        /// </summary>
        private static HashSet<string> GetSsrfAllowedHosts()
        {
            var configuredHosts = ConfigHelper.GetRuntimeConfigurationValue(
                                      "SsrfProtection:AllowedHosts")
                                  ?? "";

            return new HashSet<string>(
                configuredHosts
                .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim().ToLowerInvariant())
                .Where(s => !string.IsNullOrEmpty(s)),
                StringComparer.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 校验 URL 是否被 SSRF 策略允许。返回 (allowed, reason)。
        /// 防护策略：
        ///   1. 仅允许 http/https 协议
        ///   2. 阻止解析到私网/回环/链路本地/云元数据 IP 的目标
        ///   3. 阻止 169.254.169.254（AWS/Azure/阿里云元数据服务）
        ///   4. 显式白名单可绕过（通过 SsrfAllowedHosts 配置）
        /// 注：DNS rebinding 攻击通过解析后再次校验真实 IP 缓解。
        /// </summary>
        private static (bool allowed, string reason) ValidateSsrfUrl(string url, bool forceStrict = false)
        {
            if (!forceStrict && !IsStrictSsrfProtectionEnabled()) return (true, null);
            if (string.IsNullOrWhiteSpace(url)) return (false, "URL 为空");
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                return (false, "URL 格式非法");
            }
            // 仅允许 HTTP(S)
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            {
                return (false, $"不允许的协议: {uri.Scheme}");
            }
            if (!string.IsNullOrEmpty(uri.UserInfo))
            {
                return (false, "URL 不允许包含用户凭据");
            }
            var host = uri.Host?.ToLowerInvariant() ?? "";
            // 显式白名单
            if (GetSsrfAllowedHosts().Contains(host)) return (true, null);

            // 解析 IP（如果 host 已经是 IP 直接用；否则 DNS 查）
            IPAddress[] addresses;
            if (IPAddress.TryParse(host, out var directIp))
            {
                addresses = new[] { directIp };
            }
            else
            {
                // 阻止常见的 localhost 别名
                if (host == "localhost" || host.EndsWith(".localhost", StringComparison.Ordinal))
                {
                    return (false, $"禁止访问回环地址: {host}");
                }
                try
                {
                    addresses = Dns.GetHostAddresses(host);
                }
                catch (Exception ex)
                {
                    return (false, $"DNS 解析失败: {ex.Message}");
            }
        }

            foreach (var ip in addresses)
            {
                if (IsBlockedIp(ip))
                {
                    return (false, $"禁止访问内网/特殊地址: {host} -> {ip}");
                }
            }
            return (true, null);
        }

        private static string RedactUrlForLog(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return string.Empty;
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                var withoutQuery = url.Split(new[] { '?', '#' }, 2)[0];
                return withoutQuery.Substring(0, Math.Min(256, withoutQuery.Length));
            }

            var host = uri.HostNameType == UriHostNameType.IPv6 ? $"[{uri.Host}]" : uri.IdnHost;
            var port = uri.IsDefaultPort ? string.Empty : ":" + uri.Port;
            return $"{uri.Scheme}://{host}{port}{uri.AbsolutePath}";
        }

        /// <summary>
        /// 判断 IP 是否在禁用范围（回环 / 私网 / 链路本地 / 云元数据）
        /// </summary>
        private static bool IsBlockedIp(IPAddress ip)
        {
            if (ip == null) return false;
            if (IPAddress.IsLoopback(ip)) return true;                     // 127.0.0.0/8, ::1
            // AWS / Azure / 阿里云元数据服务
            var ipStr = ip.ToString();
            if (ipStr == "169.254.169.254" || ipStr == "100.100.100.200") return true;
            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                var bytes = ip.GetAddressBytes();
                // 0.0.0.0/8
                if (bytes[0] == 0) return true;
                // 10.0.0.0/8
                if (bytes[0] == 10) return true;
                // 172.16.0.0/12
                if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
                // 192.168.0.0/16
                if (bytes[0] == 192 && bytes[1] == 168) return true;
                // 169.254.0.0/16 链路本地
                if (bytes[0] == 169 && bytes[1] == 254) return true;
                // 224.0.0.0/4 多播
                if (bytes[0] >= 224 && bytes[0] <= 239) return true;
            }
            else if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            {
                if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal) return true;
                if (ip.IsIPv6Multicast) return true;
                // ULA fc00::/7
                var bytes = ip.GetAddressBytes();
                if ((bytes[0] & 0xfe) == 0xfc) return true;
                // IPv4-mapped 检测
                if (ip.IsIPv4MappedToIPv6)
                {
                    return IsBlockedIp(ip.MapToIPv4());
                }
            }
            return false;
        }

        #endregion

        public DiyHttpParam DynamicToDiyHttpParam(dynamic dynamicParam)
        {
            //JsonSerializerSettings settings = new JsonSerializerSettings
            //{
            //    FloatParseHandling = FloatParseHandling.Integer
            //};
            //JObject jobjParam = JObject.FromObject(dynamicParam, JsonSerializer.CreateDefault(settings));
            //JObject jobjParam = JObject.FromObject(dynamicParam);

            string json = JsonHelper.Serialize(dynamicParam);
            JObject jobjParam = JObject.Parse(json);

            //foreach (var item in NeedFloatToInt)
            //{
            //    jobjParam[item] = jobjParam[item].Val<int?>();
            //}
            DiyHttpParam param = jobjParam.ToObject<DiyHttpParam>(DiyCommon.JsonConfig);//这里时间格式化没有用
            return param;
        }
        public async Task<V8EngineHttpResponse> GetResponseAsync(dynamic dynamicParam)
        {
            DiyHttpParam diyHttpParam = DynamicToDiyHttpParam(dynamicParam);
            var response = await GetResponseAsync(diyHttpParam);
            return ToV8EngineHttpResponse(response);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <returns></returns>
        public V8EngineHttpResponse GetResponse(dynamic dynamicParam)
        {
            return GetResponseAsync(dynamicParam).GetAwaiter().GetResult();
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <returns></returns>
        public async Task<Stream> GetStreamAsync(dynamic dynamicParam)
        {
            DiyHttpParam diyHttpParam = DynamicToDiyHttpParam(dynamicParam);
            return await GetStream(diyHttpParam);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <returns></returns>
        public Stream GetStream(dynamic dynamicParam)
        {
            return GetStreamAsync(dynamicParam).GetAwaiter().GetResult();
        }
        public async Task<string> GetAsync(dynamic dynamicParam)
        {
            DiyHttpParam diyHttpParam = DynamicToDiyHttpParam(dynamicParam);
            return await Get(diyHttpParam);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <returns></returns>
        public string Get(dynamic dynamicParam)
        {
            return GetAsync(dynamicParam).GetAwaiter().GetResult();
        }
        public string Post(dynamic dynamicParam)
        {
            return PostAsync(dynamicParam).GetAwaiter().GetResult();
        }
        public string Post(string url, dynamic dynamicParam)
        {
            DiyHttpParam diyHttpParam = DynamicToDiyHttpParam(dynamicParam);
            diyHttpParam.Url = url;
            return PostString(diyHttpParam).GetAwaiter().GetResult();
        }
        public async Task<string> PostAsync(dynamic dynamicParam)
        {
            DiyHttpParam diyHttpParam = DynamicToDiyHttpParam(dynamicParam);
            //return await DiyHttp.Post<string>(diyHttpParam);//这样当timeout会抛出异常
            return await PostString(diyHttpParam);//这样当timeout不会抛出异常
        }
        public async Task<V8EngineHttpResponse> PostResponseAsync(dynamic dynamicParam)
        {
            DiyHttpParam diyHttpParam = DynamicToDiyHttpParam(dynamicParam);
            var response = await PostResponse(diyHttpParam);
            return ToV8EngineHttpResponse(response);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <returns></returns>
        public V8EngineHttpResponse PostResponse(dynamic dynamicParam)
        {
            return PostResponseAsync(dynamicParam).GetAwaiter().GetResult();
        }

        public async Task<string> PatchAsync(dynamic dynamicParam)
        {
            DiyHttpParam diyHttpParam = DynamicToDiyHttpParam(dynamicParam);
            return await Patch(diyHttpParam);
        }

        public string Patch(dynamic dynamicParam)
        {
            return PatchAsync(dynamicParam).GetAwaiter().GetResult();
        }

        public async Task<V8EngineHttpResponse> PatchResponseAsync(dynamic dynamicParam)
        {
            DiyHttpParam diyHttpParam = DynamicToDiyHttpParam(dynamicParam);
            var response = await PatchResponse(diyHttpParam);
            return ToV8EngineHttpResponse(response);
        }

        public V8EngineHttpResponse PatchResponse(dynamic dynamicParam)
        {
            return PatchResponseAsync(dynamicParam).GetAwaiter().GetResult();
        }

        private static V8EngineHttpResponse ToV8EngineHttpResponse(RestResponse response)
        {
            var result = new V8EngineHttpResponse
            {
                Headers = new List<V8EngineHttpResponseHeaders>(),
                Content = response?.Content,
                ErrorMessage = response?.ErrorMessage,
                RawBytes = response?.RawBytes,
                StatusCode = response == null ? 0 : (int)response.StatusCode
            };
            if (response?.Headers != null)
            {
                foreach (var item in response.Headers)
                {
                    result.Headers.Add(new V8EngineHttpResponseHeaders
                    {
                        Name = item.Name,
                        Value = item.Value
                    });
                }
            }
            return result;
        }
        private class RestClientAndRequest
        {
            public RestClient Client { get; set; }
            public RestRequest Request { get; set; }
        }
        /// <summary>
        /// 传入Url、PostParam
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        private RestClientAndRequest GetRestClientAndRequest(DiyHttpParam param)
        {
            //ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls12 | SecurityProtocolType.Ssl3;

            // 默认关闭并完全保留历史 HTTP 行为；只有显式开启严格 SSRF 模式后
            // ValidateSsrfUrl 才会拦截协议、URL 凭据、私网和云元数据地址。
            var strictSsrf = param.RequireSsrfProtection || IsStrictSsrfProtectionEnabled();
            var (allowed, reason) = ValidateSsrfUrl(param.Url, strictSsrf);
            if (!allowed)
            {
                MicroiEngine.QueueSystemLog(null, "Security", "SsrfRequestBlocked", "SSRF 防护已拦截外部请求", $"{reason}; URL={RedactUrlForLog(param.Url)}", 3);
                throw new InvalidOperationException(
                    $"SSRF 防护已拦截此请求：{reason}。如需放行请在 SaaS 引擎配置 SsrfAllowedHosts。");
            }

            // 两种模式分别复用连接池：默认模式保留历史自动重定向；严格模式禁止自动重定向。
            RestClient client = strictSsrf
                ? _strictSsrfClient
                : _sharedClient;

            // client.RemoteCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true; // 禁用证书验证

            var httpMethod = (param.Method ?? "GET").Trim().ToUpperInvariant();
            var restMethod = httpMethod == "POST"
                ? Method.Post
                : httpMethod == "PATCH"
                    ? Method.Patch
                    : Method.Get;
            RestRequest request = new RestRequest(param.Url, restMethod);
            if (param.ParamType?.ToLower() == "json")
            {
                // request = new RestRequest(param.Url, param.Method?.ToLower() == "post" ? Method.Post : Method.Get, DataFormat.Json);
                //{ Json, Xml, Binary, None }
                request.RequestFormat = RestSharp.DataFormat.Json;
            }
            else
            {
                // request = new RestRequest(param.Url, param.Method?.ToLower() == "post" ? Method.Post : Method.Get);
                request.RequestFormat = RestSharp.DataFormat.None;
            }

            var bodyParam = httpMethod == "PATCH" ? param.PatchParam : param.PostParam;
            var bodyParamString = httpMethod == "PATCH" ? param.PatchParamString : param.PostParamString;

            if (param.ParamType?.ToLower() == "xml")
            {
                request.RequestFormat = RestSharp.DataFormat.Xml;
                request.AddParameter("application/xml", bodyParamString, ParameterType.RequestBody);
            }

            if (param.ParamType?.ToLower() == "binary")
            {
                request.RequestFormat = RestSharp.DataFormat.Binary;
            }

            #region 处理Headers参数
            if (param.Headers != null)
            {
                var headers = JObject.FromObject(param.Headers);
                foreach (var item in headers)
                {
                    request.AddHeader(item.Key, item.Value?.ToString());
                }
            }
            if (param.Header != null)
            {
                var headers = JObject.FromObject(param.Header);
                foreach (var item in headers)
                {
                    request.AddHeader(item.Key, item.Value?.ToString());
                }
            }
            #endregion

            if (param.GetParam != null)
            {
                var getParams = JObject.FromObject(param.GetParam);
                foreach (var item in getParams)
                {
                    request.AddQueryParameter(item.Key, item.Value?.ToString());
                }
            }

            if (bodyParam != null)
            {
                if (param.ParamType?.ToLower() == "json")
                {
                    //AddJsonBody可传入new { AAA = 1 } object对象。也可传入序列化后的json字符串，但就是不能使用param.PostParam这个object
                    request.AddJsonBody(JsonHelper.Serialize(bodyParam));
                }
                else
                {
                    var postParams = JObject.FromObject(bodyParam);
                    foreach (var item in postParams)
                    {
                        request.AddParameter(item.Key, item.Value?.ToString());
                    }
                }
            }
            if (!bodyParamString.DosIsNullOrWhiteSpace()
                && param.ParamType?.ToLower() == "json"
                )
            {
                request.AddJsonBody(bodyParamString);
            }

            // System.Threading.Thread.Sleep(2000);
            request.Timeout = TimeSpan.FromSeconds(param.TimeOut <= 0 ? 600 : param.TimeOut);
            // client.Encoding = param.Encoding;

            //处理文件上传
            if (param.FilesByte != null && param.FilesByte.Any())
            {
                foreach (var item in param.FilesByte)
                {
                    request.AddFile(item.Key, item.Value, item.Key);
                }

            }
            if (param.FilesStream != null && param.FilesStream.Any())
            {
                foreach (var item in param.FilesStream)
                {
                    request.AddFile(item.Key, StreamHelper.StreamToBytes(item.Value), item.Key);
                }

            }

            if (param.FilesByteBase64 != null && param.FilesByteBase64.Any())
            {
                foreach (var item in param.FilesByteBase64)
                {
                    request.AddFile(item.Key, Convert.FromBase64String(item.Value), item.Key);
                }
            }

            if (param.FilesByteString != null && param.FilesByteString.Any())
            {
                foreach (var item in param.FilesByteString)
                {
                    var fileByte = Encoding.UTF8.GetBytes(item.Value);
                    request.AddFile(item.Key, fileByte, item.Key);
                }

            }


            return new RestClientAndRequest()
            {
                Client = client,
                Request = request
            };
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<string> Post(DiyHttpParam param)
        {
            return await PostString(param);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<RestResponse> PostResponse(DiyHttpParam param)
        {
            param.Method = "POST";
            var restObj = GetRestClientAndRequest(param);
            var response = await restObj.Client.ExecutePostAsync(restObj.Request);
            return response;
        }

        /// <summary>
        /// PATCH 请求返回字符串。
        /// </summary>
        public async Task<string> Patch(DiyHttpParam param)
        {
            var response = await PatchResponse(param);
            if (!response.ErrorMessage.DosIsNullOrWhiteSpace())
            {
                return response.ErrorMessage;
            }
            return response.Content;
        }

        /// <summary>
        /// PATCH 请求返回完整 RestResponse。
        /// </summary>
        public async Task<RestResponse> PatchResponse(DiyHttpParam param)
        {
            param.Method = "PATCH";
            var restObj = GetRestClientAndRequest(param);
            return await restObj.Client.ExecuteAsync(restObj.Request);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<RestResponse> Download(DiyHttpParam param)
        {
            param.Method = "GET";
            var restObj = GetRestClientAndRequest(param);
            //var response = await restObj.Client.ExecutePostAsync(restObj.Request);
            var response = await restObj.Client.ExecuteAsync(restObj.Request);
            byte[] imageBytes = response.RawBytes; // 图片的字节数组
            return response;
        }

        /// <summary>
        /// 传入Url、PostParam
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<T> Post<T>(DiyHttpParam param)
        {
            param.Method = "POST";
            var restObj = GetRestClientAndRequest(param);
            var response = await restObj.Client.PostAsync<T>(restObj.Request);////这样当timeout会抛出异常
            return response;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<string> PostString(DiyHttpParam param)
        {
            param.Method = "POST";
            var restObj = GetRestClientAndRequest(param);
            var response = await restObj.Client.ExecutePostAsync(restObj.Request);////这样当timeout不会抛出异常
            if (!response.ErrorMessage.DosIsNullOrWhiteSpace())
            {
                return response.ErrorMessage;
            }
            return response.Content;
        }
        // / <summary>
        // / 传入Url、PostParam
        // / </summary>
        // / <param name="param"></param>
        // / <returns></returns>
        //public static async Task<T> PostXml<T>(DiyHttpParam param)
        //{
        //    param.Method = "POST";
        //    var restObj = GetRestClientAndRequest(param);
        //    var response = await restObj.Client.ExecutePostAsync(restObj.Request);
        //    XmlDeserializer xml = new XmlDeserializer();
        //    var result = xml.Deserialize<T>(response);
        //    return result;
        //}

        //public static async Task<dynamic> PostXml(DiyHttpParam param)
        //{
        //    param.Method = "POST";
        //    var restObj = GetRestClientAndRequest(param);
        //    var response = await restObj.Client.ExecutePostAsync(restObj.Request);
        //    //XmlDeserializer xml = new XmlDeserializer();
        //    //var result = xml.Deserialize<T>(response);
        //    var result = DeserializeFromXml<dynamic>(response.Content);
        //    return result;
        //}

        //public static List<T> DeserializeFromXml<T>(string xml)
        //{
        //    XmlSerializer ser = new XmlSerializer(typeof(List<T>));
        //    using (StringReader sr = new StringReader(xml))
        //    {
        //        return (List<T>)ser.Deserialize(sr);
        //    }
        //}

        /// <summary>
        /// 传入Url、PostParam
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<string> Get(DiyHttpParam param)
        {
            param.Method = "GET";
            var restObj = GetRestClientAndRequest(param);
            // var result = await restObj.Client.GetAsync<string>(restObj.Request);
            // var result = await restObj.Client.GetAsync(restObj.Request);
            var response = await restObj.Client.ExecuteGetAsync(restObj.Request);
            if (!response.ErrorMessage.DosIsNullOrWhiteSpace())
            {
                return response.ErrorMessage;
            }
            return response.Content;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<RestResponse> GetResponseAsync(DiyHttpParam param)
        {
            param.Method = "GET";
            var restObj = GetRestClientAndRequest(param);
            var response = await restObj.Client.ExecuteGetAsync(restObj.Request);
            return response;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="url"></param>
        /// <returns></returns>
        public async Task<string> Get(string url)
        {
            var restObj = GetRestClientAndRequest(new DiyHttpParam()
            {
                Url = url,
                Method = "GET"
            });
            return await restObj.Client.GetAsync<string>(restObj.Request);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <typeparam name="T"></typeparam>
        /// <returns></returns>
        public async Task<T> Get<T>(DiyHttpParam param)
        {
            param.Method = "GET";
            var restObj = GetRestClientAndRequest(param);
            return await restObj.Client.GetAsync<T>(restObj.Request);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<Stream> GetStream(DiyHttpParam param)
        {
            param.Method = "GET";
            var restObj = GetRestClientAndRequest(param);
            return new MemoryStream(restObj.Client.DownloadData(restObj.Request));
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="url"></param>
        /// <returns></returns>
        public async Task<Stream> GetStream(string url)
        {
            var restObj = GetRestClientAndRequest(new DiyHttpParam()
            {
                Url = url,
                Method = "GET"
            });
            return new MemoryStream(restObj.Client.DownloadData(restObj.Request));
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<byte[]> GetByte(DiyHttpParam param)
        {
            param.Method = "GET";
            var restObj = GetRestClientAndRequest(param);
            return restObj.Client.DownloadData(restObj.Request);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="url"></param>
        /// <returns></returns>
        public async Task<byte[]> GetByte(string url)
        {
            var restObj = GetRestClientAndRequest(new DiyHttpParam()
            {
                Url = url,
                Method = "GET"
            });
            return restObj.Client.DownloadData(restObj.Request);
        }
    }
}
