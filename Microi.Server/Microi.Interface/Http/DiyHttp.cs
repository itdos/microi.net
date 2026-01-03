using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RestSharp;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public partial class DiyHttp : IMicroiHttp
    {
        public DiyHttpParam DynamicToDiyHttpParam(dynamic dynamicParam)
        {
            //JsonSerializerSettings settings = new JsonSerializerSettings
            //{
            //    FloatParseHandling = FloatParseHandling.Integer
            //};
            //JObject jobjParam = JObject.FromObject(dynamicParam, JsonSerializer.CreateDefault(settings));
            //JObject jobjParam = JObject.FromObject(dynamicParam);

            string json = JsonConvert.SerializeObject(dynamicParam);
            JObject jobjParam = JObject.Parse(json);

            //foreach (var item in NeedFloatToInt)
            //{
            //    jobjParam[item] = jobjParam[item]?.Value<int?>();
            //}
            DiyHttpParam param = jobjParam.ToObject<DiyHttpParam>(DiyCommonExtend.JsonConfig);//这里时间格式化没有用
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
            return GetResponseAsync(dynamicParam).Result;
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
            return GetStreamAsync(dynamicParam).Result;
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
            return GetAsync(dynamicParam).Result;
        }
        public string Post(dynamic dynamicParam)
        {
            return PostAsync(dynamicParam).Result;
        }
        public string Post(string url, dynamic dynamicParam)
        {
            DiyHttpParam diyHttpParam = DynamicToDiyHttpParam(dynamicParam);
            diyHttpParam.Url = url;
            return PostString(diyHttpParam).Result;
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
            return PostResponseAsync(dynamicParam).Result;
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

            RestClient client = new RestClient();

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
                    request.AddJsonBody(JsonConvert.SerializeObject(param.PostParam));
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
