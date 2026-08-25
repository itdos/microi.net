#if NETSTANDARD || NETCOREAPP
using Microsoft.AspNetCore.Http;
#else
using System.Web;
#endif
using System;
using System.Collections.Generic;
using System.Text;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    public class HandelFactory
    {
        /// <summary>
        /// 传入Path是指哪个客户，比如说Tzy、Tdx、Nbgysh等。然后会指定存储到对应文件夹目录下。
        /// </summary>
        /// <param name="action"></param>
        /// <param name="context"></param>
        /// <param name="Path"></param>
        /// <returns></returns>
        public Handler GetHandler(string action, HttpContext context, JObject config)
        {
            //临时解决
            if (action.DosIsNullOrWhiteSpace())
            {
                action = AppConsts.Action.UploadImage;
            }

            switch (action)
            {
                case AppConsts.Action.UploadImage:
                    return new UploadHandler(context, new UploadConfig
                    {
                        AllowExtensions = UeditorConfig.GetStringList(config, "imageAllowFiles"),
                        SizeLimit = UeditorConfig.GetInt(config, "imageMaxSize"),
                        UploadFieldName = UeditorConfig.GetString(config, "imageFieldName")
                    });
                case AppConsts.Action.UploadScrawl:
                    return new UploadHandler(context, new UploadConfig()
                    {
                        AllowExtensions = new string[] { ".png" },
                        SizeLimit = UeditorConfig.GetInt(config, "scrawlMaxSize"),
                        UploadFieldName = UeditorConfig.GetString(config, "scrawlFieldName"),
                        Base64 = true,
                        Base64Filename = "scrawl.png"
                    });
                case AppConsts.Action.UploadVideo:
                    return new UploadHandler(context, new UploadConfig()
                    {
                        AllowExtensions = UeditorConfig.GetStringList(config, "videoAllowFiles"),
                        SizeLimit = UeditorConfig.GetInt(config, "videoMaxSize"),
                        UploadFieldName = UeditorConfig.GetString(config, "videoFieldName")
                    });
                case AppConsts.Action.UploadFile:
                    return new UploadHandler(context, new UploadConfig()
                    {
                        AllowExtensions = UeditorConfig.GetStringList(config, "fileAllowFiles"),
                        SizeLimit = UeditorConfig.GetInt(config, "fileMaxSize"),
                        UploadFieldName = UeditorConfig.GetString(config, "fileFieldName")
                    });

                case AppConsts.Action.ListImage:
                case AppConsts.Action.ListFile:
                    // 历史实现递归枚举宿主本地目录，无法映射当前租户私有 HDFS 权限，
                    // 且会造成跨租户文件名泄漏。上传继续兼容，旧本地文件管理动作关闭。
                    return new NotSupportedHandler(context);
                case AppConsts.Action.CatchImage:
                    // Remote image crawling is intentionally disabled. The legacy
                    // implementation followed redirects and fetched user-controlled
                    // URLs from the API network, which is an SSRF primitive.
                    return new NotSupportedHandler(context);
                default:
                    return new NotSupportedHandler(context);
            }
        }
    }
}
