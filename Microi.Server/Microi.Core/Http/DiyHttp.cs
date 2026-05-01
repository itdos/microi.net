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
            MaxTimeout = 300000 // 5分钟默认超时
        });

        #region 2026-05-01 SSRF 防护
        /// <summary>
        /// 是否启用 SSRF（Server-Side Request Forgery）防护，默认开启。
        /// 开启后会阻止 V8 脚本和接口引擎发起到 localhost / 私网 / 云元数据服务的 HTTP 请求。
        /// 如需在内部场景显式访问内网，请通过 appsettings.json 设置 "DisableSsrfProtection":"true" 关闭，
        /// 或将目标主机加入 SsrfAllowedHosts 白名单。
        /// </summary>
        private static readonly bool _ssrfProtectionEnabled =
            !string.Equals(ConfigHelper.GetAppSettings("DisableSsrfProtection"), "true",
                StringComparison.OrdinalIgnoreCase);

        /// <summary>
        /// SSRF 主机白名单（通过 appsettings.json "SsrfAllowedHosts" 逗号分隔配置）
        /// </summary>
        private static readonly HashSet<string> _ssrfAllowedHosts = new HashSet<string>(
            (ConfigHelper.GetAppSettings("SsrfAllowedHosts") ?? "")
                .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim().ToLowerInvariant())
                .Where(s => !string.IsNullOrEmpty(s)),
            StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// 校验 URL 是否被 SSRF 策略允许。返回 (allowed, reason)。
        /// 防护策略：
        ///   1. 仅允许 http/https 协议
        ///   2. 阻止解析到私网/回环/链路本地/云元数据 IP 的目标
        ///   3. 阻止 169.254.169.254（AWS/Azure/阿里云元数据服务）
        ///   4. 显式白名单可绕过（通过 SsrfAllowedHosts 配置）
        /// 注：DNS rebinding 攻击通过解析后再次校验真实 IP 缓解。
        /// </summary>
        private static (bool allowed, string reason) ValidateSsrfUrl(string url)
        {
            if (!_ssrfProtectionEnabled) return (true, null);
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
            var host = uri.Host?.ToLowerInvariant() ?? "";
            // 显式白名单
            if (_ssrfAllowedHosts.Contains(host)) return (true, null);

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
            var result = new V8EngineHttpResponse();
            result.Headers = new List<V8EngineHttpResponseHeaders>();
            if (response.Headers != null)
            {
                foreach (var item in response.Headers)
                {
                    result.Headers.Add(new V8EngineHttpResponseHeaders()
                    {
                        Name = item.Name,
                        Value = item.Value,
                        //Type = item.Type,
                        //DataFormat = item.DataFormat,
                        //ContentType = item.ContentType
                    });
                }
            }
            result.Content = response.Content;
            result.RawBytes = response.RawBytes;
            //result.Headers = new Dictionary<string, string>();
            //foreach (var item in response.Headers)
            //{
            //    result.Headers.Add(item.Name, item.va);
            //}
            return result;
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
            var result = new V8EngineHttpResponse();

            result.Headers = new List<V8EngineHttpResponseHeaders>();
            if (response.Headers != null)
            {
                foreach (var item in response.Headers)
                {
                    result.Headers.Add(new V8EngineHttpResponseHeaders()
                    {
                        Name = item.Name,
                        Value = item.Value,
                        //Type = item.Type,
                        //DataFormat = item.DataFormat,
                        //ContentType = item.ContentType
                    });
                }
            }

            result.Content = response.Content;
            result.ErrorMessage = response.ErrorMessage;
            result.RawBytes = response.RawBytes;
            //result.Headers = new Dictionary<string, string>();
            //foreach (var item in response.Headers)
            //{
            //    result.Headers.Add(item.Name, item.va);
            //}
            return result;
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

            // 2026-05-01 SSRF 防护：在所有 HTTP 调用入口校验目标 URL，
            // 拒绝访问 localhost / 私网 / 链路本地 / 云元数据服务等危险地址。
            var (allowed, reason) = ValidateSsrfUrl(param.Url);
            if (!allowed)
            {
                Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】SSRF 防护拦截：{reason} (URL={param.Url})");
                throw new InvalidOperationException($"SSRF 防护已拦截此请求：{reason}。如需放行请配置 SsrfAllowedHosts。");
            }

            // 使用共享的 RestClient 实例，避免每次请求创建新实例导致 Socket 耗尽
            RestClient client = _sharedClient;

            // client.RemoteCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true; // 禁用证书验证

            RestRequest request = new RestRequest(param.Url, param.Method?.ToLower() == "post" ? Method.Post : Method.Get);
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

            if (param.ParamType?.ToLower() == "xml")
            {
                request.RequestFormat = RestSharp.DataFormat.Xml;
                request.AddParameter("application/xml", param.PostParamString, ParameterType.RequestBody);
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

            if (param.PostParam != null)
            {
                if (param.ParamType?.ToLower() == "json")
                {
                    //AddJsonBody可传入new { AAA = 1 } object对象。也可传入序列化后的json字符串，但就是不能使用param.PostParam这个object
                    request.AddJsonBody(JsonHelper.Serialize(param.PostParam));
                }
                else
                {
                    var postParams = JObject.FromObject(param.PostParam);
                    foreach (var item in postParams)
                    {
                        request.AddParameter(item.Key, item.Value?.ToString());
                    }
                }
            }
            if (!param.PostParamString.DosIsNullOrWhiteSpace()
                && param.ParamType?.ToLower() == "json"
                )
            {
                request.AddJsonBody(param.PostParamString);
            }

            // System.Threading.Thread.Sleep(2000);
            request.Timeout = new TimeSpan(0, 0, param.TimeOut == 0 ? 5 : param.TimeOut);
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
