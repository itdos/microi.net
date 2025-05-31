#if NETSTANDARD || NETCOREAPP
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
#else
using System.Web;
#endif
using Newtonsoft.Json;
using System;
//using UEditor.Core.Handlers;
using Dos.Common;

namespace Microi.net
{
    public class UEditorService
    {
#if NETSTANDARD || NETCOREAPP
        public UEditorService(Microsoft.AspNetCore.Hosting.IHostingEnvironment env)
        {
            // .net core的名字起的比较怪而已，并不是我赋值赋错了
            if (string.IsNullOrWhiteSpace(UeditorConfig.WebRootPath))
            {
                UeditorConfig.WebRootPath = env.ContentRootPath;
            }

            UeditorConfig.EnvName = env.EnvironmentName;
        }
#else
        private UEditorService()
        {

        }

        private static UEditorService _instance;

        public static UEditorService Instance
        {
            get
            {
                if (_instance == null)
                {
                    _instance = new UEditorService();
                }
                return _instance;
            }
        }
#endif
        /// <summary>
        /// 上传并返回结果，已处理跨域Jsonp请求
        /// 传入Path是指哪个客户，比如说Tzy、Tdx、Nbgysh等。然后会指定存储到对应文件夹目录下。
        /// </summary>
        /// <param name="context"></param>
        /// <returns></returns>
        public UEditorResponse UploadAndGetResponse(HttpContext context, string Path)
        {
#if NETSTANDARD || NETCOREAPP
             var action = context.Request.Query["action"];
#else
            var action = context.Request.QueryString["action"];
#endif
            
            object result;
            if (AppConsts.Action.Config.Equals(action, StringComparison.OrdinalIgnoreCase))
            {
                var configHandle = new ConfigHandler();
                result = configHandle.Process();
            }
            else
            {
                var handle = HandelFactory.GetHandler(action, context, Path);
                result = handle.Process().Result;
            }
            string resultJson = JsonConvert.SerializeObject(result, new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore
            });
            string contentType = "text/plain";
#if NETSTANDARD || NETCOREAPP
             string jsonpCallback = context.Request.Query["callback"];
#else
            string jsonpCallback = context.Request.QueryString["callback"];
#endif
            if (!jsonpCallback.IsNullOrWhiteSpaceUEditor())
            {
                contentType = "application/javascript";
                resultJson = string.Format("{0}({1});", jsonpCallback, resultJson);
                UEditorResponse response = new UEditorResponse(contentType, resultJson);
                return response;
            }
            else
            {
                UEditorResponse response = new UEditorResponse(contentType, resultJson);
                return response;
            }
        }

        /// <summary>
        /// 单纯的上传并返回结果，未处理跨域Jsonp请求
        /// </summary>
        /// <param name="context"></param>
        /// <returns></returns>
        public object Upload(HttpContext context, string Path)
        {
#if NETSTANDARD || NETCOREAPP
             var action = context.Request.Query["action"];
#else
            var action = context.Request.QueryString["action"];
#endif 
            object result;
            if (AppConsts.Action.Config.Equals(action, StringComparison.OrdinalIgnoreCase))
            {
                result = new ConfigHandler();
            }
            else
            {
                var handle = HandelFactory.GetHandler(action, context, Path);
                result = handle.Process().Result;
            }
            return result;
        }
    }
}
