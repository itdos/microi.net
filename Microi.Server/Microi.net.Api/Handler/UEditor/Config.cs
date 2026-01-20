using System;
using System.IO;
using System.Linq;
using System.Net.Http;
#if NETSTANDARD || NETCOREAPP
using Aliyun.OSS;
#endif
using Dos.Common;
using Newtonsoft.Json.Linq;
using Microi.net;

namespace Microi.net.Api
{
    /// <summary>
    /// Config 的摘要说明
    /// </summary>
    public static class UeditorConfig
    {
        public static bool NoCache = true;

        private static JObject BuildItems()
        {
            //var osClient = DiyToken.GetCurrentOsClient();
            var osClientModel = OsClient.GetClient();
            //2o023-08-18重新实现
            try
            {
                var sysConfig = osClientModel.Db.FromSql("select * from sys_sonfig where IsEnable = 1 AND IsDeleted <> 1").First<dynamic>();
                return JObject.Parse((string)sysConfig.UEditorConfig);
            }
            catch (Exception ex)
            {
                throw new Exception("获取富文本配置失败，请在系统设置中添加[UEditorConfig]字段（代码编辑器）！");
            }


            var configExtension = Path.GetExtension(ConfigFile);
            var configFileName = ConfigFile.Substring(0, ConfigFile.Length - configExtension.Length);
            var evnConfig = $"{configFileName}.{UeditorConfig.EnvName}{configExtension}";
#if NETSTANDARD || NETCOREAPP
            #region 初始化OSS参数
            //var useAliOss = ConfigHelper.GetAppSettings("UseAliOssPublic") == "1";
            var useAliOss = osClientModel.OsClientModel["UseAliOssPublic"].Val<string>() == "1";
            var endpoint = "";
            var accessKeyId = "";
            var accessKeySecret = "";
            var bucketName = "";
            OssClient ossClient = null;
            #endregion
            if (useAliOss)
            {

                #region OSS 参数初始化
                var limit = "Public";
                //endpoint = ConfigHelper.GetAppSettings("AliOss" + limit + "Endpoint");
                //accessKeyId = ConfigHelper.GetAppSettings("AliOss" + limit + "AccessKeyId");
                //accessKeySecret = ConfigHelper.GetAppSettings("AliOss" + limit + "AccessKeySecret");
                //bucketName = ConfigHelper.GetAppSettings("AliOss" + limit + "BucketName");
                endpoint = osClientModel.OsClientModel["AliOssPublicEndpoint"].Val<string>();
                accessKeyId = osClientModel.OsClientModel["AliOssPublicAccessKeyId"].Val<string>();
                accessKeySecret = osClientModel.OsClientModel["AliOssPublicAccessKeySecret"].Val<string>();
                bucketName = osClientModel.OsClientModel["AliOssPublicBucketName"].Val<string>();
                // 创建OssClient实例。
                ossClient = new OssClient(endpoint, accessKeyId, accessKeySecret);
                #endregion
                var ossObject = ossClient.GetObject(new GetObjectRequest(bucketName, "config/ueditor.json"));
                var jsonStr = new StreamReader(ossObject.Content).ReadToEnd();
                return JObject.Parse(jsonStr);
                //using (var http = new HttpClient())
                //{
                //    //var jsonStrAsync = http.GetStringAsync(ConfigHelper.GetAppSettings("AliOss" + limit + "Domain") + "/config/ueditor.json");
                //    var jsonStrAsync = http.GetStringAsync(osClientModel.AliOssPublicDomain + "/config/ueditor.json");
                //    //jsonStrAsync.Start();
                //    jsonStrAsync.Wait();
                //    var jsonStr = jsonStrAsync.Result;
                //    return JObject.Parse(jsonStr);
                //}

            }
            else
            {
                if (File.Exists(Path.Combine(WebRootPath, evnConfig)))
                {
                    var json = File.ReadAllText(Path.Combine(WebRootPath, evnConfig));
                    return JObject.Parse(json);
                }
                else
                {
                    var configFilePath = Path.Combine(WebRootPath, ConfigFile);
                    if (!File.Exists(configFilePath))
                    {
                        throw new Exception("未找到UEditor配置文件，请检查！");//若有问题，请参阅文档：https://github.com/baiyunchen/UEditor.Core
                    }
                    var json = File.ReadAllText(configFilePath);
                    return JObject.Parse(json);
                }
            }
#else

            if (File.Exists(Path.Combine(WebRootPath, evnConfig)))
            {
                var json = File.ReadAllText(Path.Combine(WebRootPath, evnConfig));
                return JObject.Parse(json);
            }
            else
            {
                var configFilePath = Path.Combine(WebRootPath, ConfigFile);
                if (!File.Exists(configFilePath))
                {
                    throw new Exception("未找到UEditor配置文件，请检查！");//若有问题，请参阅文档：https://github.com/baiyunchen/UEditor.Core
                }
                var json = File.ReadAllText(configFilePath);
                return JObject.Parse(json);
            }
#endif
        }

        public static JObject Items
        {
            get
            {
                if (NoCache || _Items == null)
                {
                    _Items = BuildItems();
                }
                return _Items;
            }
        }

        public static string EnvName { get; set; }

        public static string WebRootPath { get; set; }

        // public static string WwwRootPath { get; set; }

        public static string ConfigFile { set; get; } = "ueditor.json";

        private static JObject _Items;


        public static T GetValue<T>(string key)
        {
            return Items[key].Val<T>();
        }

        public static String[] GetStringList(string key)
        {
            return Items[key].Select(x => x.Value<String>()).ToArray();
        }

        public static String GetString(string key)
        {
            return GetValue<String>(key);
        }

        public static int GetInt(string key)
        {
            return GetValue<int>(key);
        }
    }
}