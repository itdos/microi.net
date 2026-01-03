#if NETSTANDARD || NETCOREAPP
using Microsoft.AspNetCore.Http;
#else
using System.Web;
#endif
using System;
using System.Collections.Generic;
using System.Text;
using Dos.Common;

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
        public Handler GetHandler(string action, HttpContext context, string Path)
        {
            //说明：【customerPath】是后来加上去的，用于区分不同的客户，保存到不同的文件夹。
            var customerPath = (Path.DosIsNullOrWhiteSpace() ? "" : Path + "/") + "upload/";

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
                        AllowExtensions = UeditorConfig.GetStringList("imageAllowFiles"),
                        PathFormat = customerPath + UeditorConfig.GetString("imagePathFormat"),
                        SizeLimit = UeditorConfig.GetInt("imageMaxSize"),
                        UploadFieldName = UeditorConfig.GetString("imageFieldName")
                    });
                case AppConsts.Action.UploadScrawl:
                    return new UploadHandler(context, new UploadConfig()
                    {
                        AllowExtensions = new string[] { ".png" },
                        PathFormat = customerPath + UeditorConfig.GetString("scrawlPathFormat"),
                        SizeLimit = UeditorConfig.GetInt("scrawlMaxSize"),
                        UploadFieldName = UeditorConfig.GetString("scrawlFieldName"),
                        Base64 = true,
                        Base64Filename = "scrawl.png"
                    });
                case AppConsts.Action.UploadVideo:
                    return new UploadHandler(context, new UploadConfig()
                    {
                        AllowExtensions = UeditorConfig.GetStringList("videoAllowFiles"),
                        PathFormat = customerPath + UeditorConfig.GetString("videoPathFormat"),
                        SizeLimit = UeditorConfig.GetInt("videoMaxSize"),
                        UploadFieldName = UeditorConfig.GetString("videoFieldName")
                    });
                case AppConsts.Action.UploadFile:
                    return new UploadHandler(context, new UploadConfig()
                    {
                        AllowExtensions = UeditorConfig.GetStringList("fileAllowFiles"),
                        PathFormat = customerPath + UeditorConfig.GetString("filePathFormat"),
                        SizeLimit = UeditorConfig.GetInt("fileMaxSize"),
                        UploadFieldName = UeditorConfig.GetString("fileFieldName")
                    });

                case AppConsts.Action.ListImage:
                    return new ListFileManager(context, UeditorConfig.GetString("imageManagerListPath"), UeditorConfig.GetStringList("imageManagerAllowFiles"));
                case AppConsts.Action.ListFile:
                    return new ListFileManager(context, UeditorConfig.GetString("fileManagerListPath"), UeditorConfig.GetStringList("fileManagerAllowFiles"));
                case AppConsts.Action.CatchImage:
                    return new CrawlerHandler(context);
                default:
                    return new NotSupportedHandler(context);
            }
        }
    }
}
