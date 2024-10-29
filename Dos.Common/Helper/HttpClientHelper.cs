#if !NET40
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Dos.Common
{
    /// <summary>
    /// 
    /// </summary>
    public static class HttpClientHelper
    {
        /// <summary>
        /// 
        /// </summary>
        private static readonly HttpClient _httpClient;
        static HttpClientHelper()
        {
            _httpClient = new HttpClient();
            //_httpClient.Timeout = new TimeSpan(0, 0, 10);
            _httpClient.DefaultRequestHeaders.Connection.Add("keep-alive");
        }
        public static async Task<string> Post(HttpClientParam param)
        {
            return await Post<string>(param);
        }
        /// <summary>
        /// 传入Url、PostParam
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public static async Task<T> Post<T>(HttpClientParam param)
        {
            #region 处理Headers参数
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Connection.Add("keep-alive");
            if (param.Headers != null)
            {
                var headers = JObject.FromObject(param.Headers);
                foreach (var item in headers)
                {
                    _httpClient.DefaultRequestHeaders.TryAddWithoutValidation(item.Key, item.Value.ToString());
                }
            }
            //_httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Authorization", "");
            //_httpClient.DefaultRequestHeaders.TryAddWithoutValidation("Content-Type", "application/x-www-form-urlencoded");
            #endregion

            //body属性传值
            //var str = string.Format("id={0}&content={1}", post.id, post.content);
            // Json属性传值
            //JsonConvert.SerializeObject(post);
            var postParam = "";
            if (param.PostParam != null)
            {
                var postParams = JObject.FromObject(param.PostParam);
                foreach (var item in postParams)
                {
                    postParam += "&" + item.Key + "=" + item.Value.ToString();
                }
                postParam = postParam.TrimStart('&');
            }

            using (var httpContent = new StringContent(postParam, Encoding.UTF8))
            {
                if (!param.ContentType.DosIsNullOrWhiteSpace())
                {
                    httpContent.Headers.ContentType = new MediaTypeHeaderValue(param.ContentType);
                }
                else
                {
                    httpContent.Headers.ContentType = new MediaTypeHeaderValue("application/x-www-form-urlencoded");
                }

                //if (param.Headers != null)
                //{
                //    var headers = JObject.FromObject(param.Headers);
                //    foreach (var item in headers)
                //    {
                //        httpContent.Headers.TryAddWithoutValidation(item.Key, item.Value.ToString());
                //    }
                //}

                var response = await _httpClient.PostAsync(param.Url, httpContent);
                if (typeof(T).Name == "String")
                {
                    var reuslt = (T)Convert.ChangeType(await response.Content.ReadAsStringAsync(), typeof(T));
                    return reuslt;
                }
                else
                {
                    var strResult = await response.Content.ReadAsStringAsync();
                    return JsonConvert.DeserializeObject<T>(strResult);
                }
            }

        }

        /// <summary>
        /// 传入Url、PostParam
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        private static async Task<HttpResponseMessage> GetHttpResponseMessage(HttpClientParam param)
        {
            #region 处理Headers参数
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Connection.Add("keep-alive");
            if (param.Headers != null)
            {
                var headers = JObject.FromObject(param.Headers);
                foreach (var item in headers)
                {
                    _httpClient.DefaultRequestHeaders.TryAddWithoutValidation(item.Key, item.Value.ToString());
                }
            }
            #endregion

            if (param.GetParam != null)
            {
                param.Url += (param.Url.Contains("?") ? "&" : "?");
                var getParams = JObject.FromObject(param.GetParam);
                foreach (var item in getParams)
                {
                    param.Url += item.Key + "=" + item.Value.ToString() + "&";
                }
                param.Url = param.Url.TrimEnd('&');
            }

            var response = await _httpClient.GetAsync(param.Url);
            return response;
        }
        /// <summary>
        /// 传入Url、PostParam
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public static async Task<string> Get(HttpClientParam param)
        {
            var result = await GetHttpResponseMessage(param);

            var response = await result.Content.ReadAsStringAsync();
            return response;
        }
        public static async Task<string> Get(string url)
        {
            var result = await GetHttpResponseMessage(new HttpClientParam()
            {
                Url = url
            });

            var response = await result.Content.ReadAsStringAsync();
            return response;
        }

        public static async Task<T> Get<T>(HttpClientParam param)
        {
            var result = await GetHttpResponseMessage(param);

            var response = await result.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<T>(response);
        }
        public static async Task<Stream> GetStream(HttpClientParam param)
        {
            var result = await GetHttpResponseMessage(param);

            var response = await result.Content.ReadAsStreamAsync();
            return response;
        }
        public static async Task<Stream> GetStream(string url)
        {
            var result = await GetHttpResponseMessage(new HttpClientParam()
            {
                Url = url
            });
            var response = await result.Content.ReadAsStreamAsync();
            return response;
        }
        public static async Task<byte[]> GetByte(HttpClientParam param)
        {
            var result = await GetHttpResponseMessage(param);

            var response = await result.Content.ReadAsByteArrayAsync();
            return response;
        }
        public static async Task<byte[]> GetByte(string url)
        {
            var result = await GetHttpResponseMessage(new HttpClientParam()
            {
                Url = url
            });

            var response = await result.Content.ReadAsByteArrayAsync();
            return response;
        }
    }
}
#endif