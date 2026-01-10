using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NPOI.SS.Formula.Functions;
using System.Diagnostics;
using System.Text;

namespace Microi.net.Api
{
    /// <summary>
    /// DIY框架一些通用接口
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class OsController : Controller
    {
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public JsonResult GetOsVersion()
        {
            return Json(new DosResult(1, "v3.10.24"));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        //[HttpGet, HttpPost]        //[AllowAnonymous]
        //public async Task<ActionResult> CreateQRCode()
        //{
        //    JObject param = new JObject();
        //    param.Add("ApiEngineKey", "");
        //    var result = await _apiEngine.RunAsync(param);
        //    return Json(result);
        //}

        /// <summary>
        /// 
        /// </summary>
        /// <param name="qrCodeContent"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public ActionResult CreateQRCode(string qrCodeContent)
        {
            if (qrCodeContent.DosIsNullOrWhiteSpace())
            {
                qrCodeContent = "测试内容";
            }
            var stream = Dos.Common.ImageHelper.CreateQRCode(qrCodeContent);

            using (BinaryReader binReader = new BinaryReader(stream))
            {
                byte[] bytes = binReader.ReadBytes(Convert.ToInt32(stream.Length));
                var base64Str = Convert.ToBase64String(bytes);
                return Content(base64Str);//data:image/png;base64,
            }
            //return Content(inputString);
            //return File(stream, "image/png");
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public JsonResult GetMicroiNetVersion()
        {
            var fv = FileVersionInfo.GetVersionInfo("Microi.net.dll");
            return Json(new DosResult(1, fv.FileVersion));
        }

        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetOsClientByDomain(string Domain, string Lang = "")
        {
            var param = new DiyTableRowParam();
            param.TableName = "Sys_OsClients";
            param.OsClient = OsClient.GetConfigOsClient();
            if (Lang.DosIsNullOrWhiteSpace())
            {
                Lang = DiyMessage.Lang;
            }
            if (Domain.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            }

            //指定条件
            //param._SearchEqual = new Dictionary<string, string>() {
            //    { "DomainName", Domain},
            //    { "IsDeleted", "0"},
            //    { "IsEnable", "1"},
            //};

            Domain = Domain.ToLower();

            //2025-12-01 Anderson：增加支持http、https
            if (Domain.Contains("http://") || Domain.Contains("https://"))
            {
                Domain = Domain.Replace("http://", "").Replace("https://", "");
            }

            //2026-01-01 Anderson：从内存中获取
            var cacheResult = OsClient.ClientList.FirstOrDefault(item
                => item.Value.DomainName == Domain
                || item.Value.DomainName == "http://" + Domain
                || item.Value.DomainName == "https://" + Domain
                || item.Value.DomainName.Split(';').Contains(Domain)
                || item.Value.DomainName.Split(';').Contains("http://" + Domain)
                || item.Value.DomainName.Split(';').Contains("https://" + Domain)
            );
            if (cacheResult.Value != null)
            {
                return Json(new DosResult(1, new
                {
                    OsClient = cacheResult.Value.OsClient
                }));
            }
            return Json(new DosResult(1, new
            {
                OsClient = OsClient.GetConfigOsClient(),
            }));


            //先用等号查询，性能更高
            //旧版写法，仍支持
            // param._Where = new List<DiyWhere>() {
            //     new DiyWhere(){ GroupStart = true, Name = "DomainName", Value = Domain, Type = "=" },
            //     new DiyWhere(){ AndOr = "OR", Name = "DomainName", Value = "http://" + Domain, Type = "=" },
            //     new DiyWhere(){ AndOr = "OR", Name = "DomainName", Value = "https://" + Domain, Type = "=", GroupEnd = true },
            //     new DiyWhere(){ Name = "IsEnable", Value = "1", Type = "=" },
            // };
            //新版写法
            param._Where = new List<List<object>>() {
                new List<object>{ "(", "DomainName", "=", Domain },
                new List<object>{ "OR", "DomainName", "=", "http://" + Domain },
                new List<object>{ "OR", "DomainName", "=", "https://" + Domain, ")"},
                new List<object>{ "IsEnable", "=", 1 },
            };
            //指定查询列
            param._SelectFields = new List<string>() { "DomainName", "OsClient" };
            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(param);
            if (result.Code != 1)
            {
                //等号查询没有数据时，再用like查询
                //旧版写法，仍支持
                // param._Where = new List<DiyWhere>() {
                //     new DiyWhere(){ GroupStart = true, Name = "DomainName", Value = "$" + Domain + "$", Type = "Like" },
                //     new DiyWhere(){ AndOr = "OR", Name = "DomainName", Value = "$" + "http://" + Domain + "$", Type = "Like" },
                //     new DiyWhere(){ AndOr = "OR", Name = "DomainName", Value = "$" + "https://" + Domain + "$", Type = "Like", GroupEnd = true  },
                //     new DiyWhere(){ Name = "IsEnable", Value = "1", Type = "=" },
                // };
                //新版写法
                param._Where = new List<List<object>>() {
                    new List<object>{ "(", "DomainName", "Like", "$" + Domain + "$" },
                    new List<object>{ "OR", "DomainName", "Like", "," + Domain },
                    new List<object>{ "OR", "DomainName", "Like", ";" + "http://" + Domain },
                    new List<object>{ "OR", "DomainName", "Like", ";" + "https://" + Domain },
                    new List<object>{ "OR", "DomainName", "Like", "http://" + Domain + ";" },
                    new List<object>{ "OR", "DomainName", "Like", "https://" + Domain + ";" },
                    new List<object>{ "OR", "DomainName", "Like", "$" + "http://" + Domain + "$" },
                    new List<object>{ "OR", "DomainName", "Like", "$" + "https://" + Domain + "$", ")" },
                    new List<object>{ "IsEnable", "=", 1 },
                };
                result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(param);
                if (result.Code != 1)
                {
                    return Json(new DosResult(1, new
                    {
                        OsClient = OsClient.GetConfigOsClient(),
                    }));
                }
            }
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="Version"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        // [AllowAnonymous]
        public async Task CheckServer(string OsClient)
        {
            var resultHtml = "";

            var dockerOsClient = (Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? "");
            resultHtml += "<br>环境变量OsClient为：" + dockerOsClient;
            resultHtml += "<br>环境变量OsClientType为：" + (Environment.GetEnvironmentVariable("OsClientType", EnvironmentVariableTarget.Process) ?? "");
            resultHtml += "<br>环境变量OsClientNetwork为：" + (Environment.GetEnvironmentVariable("OsClientNetwork", EnvironmentVariableTarget.Process) ?? "");
            resultHtml += "<br>配置文件OsClient为：" + (ConfigHelper.GetAppSettings("OsClient") ?? "");
            resultHtml += "<br>配置文件OsClientType为：" + (ConfigHelper.GetAppSettings("OsClientType") ?? "");
            resultHtml += "<br>配置文件OsClientNetwork为：" + (ConfigHelper.GetAppSettings("OsClientNetwork") ?? "");

            var osClientStr = OsClient;
            if (osClientStr.DosIsNullOrWhiteSpace())
            {
                osClientStr = dockerOsClient;
                if (osClientStr.DosIsNullOrWhiteSpace())
                {
                    osClientStr = (ConfigHelper.GetAppSettings("OsClient") ?? "");
                }
            }

            //获取ClientModel
            try
            {
                var osClientModel = Microi.net.OsClient.GetClient(osClientStr);
                resultHtml += "<br>获取ClientModel成功：" + osClientModel.OsClient;
                //数据库连接
                try
                {
                    var sysConfigModel = osClientModel.Db.FromSql("SELECT * FROM sys_config").First<dynamic>();//SysConfig
                    if (sysConfigModel != null)
                    {
                        resultHtml += "<br>测试数据库连接成功：" + (sysConfigModel.SysTitle ?? "") + "-" + (sysConfigModel.CompanyName ?? "");
                    }
                }
                catch (Exception ex)
                {
                    resultHtml += "<br>测试数据库连接失败：" + ex.Message;
                }
                //redis连接
                try
                {
                    var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClientStr);
                    DiyCacheBase.Set("CheckServer", "Test");
                    resultHtml += "<br>测试Redis成功：" + osClientModel.RedisHost;
                }
                catch (Exception ex)
                {
                    resultHtml += "<br>测试Redis失败：" + (osClientModel.RedisHost ?? "") + ":" + (osClientModel.RedisPort ?? "") + "。" + ex.Message;
                }
                //测试MongoDB
                try
                {
                    var host = new MongodbHost()
                    {
                        Connection = osClientModel.DbMongoConnection,
                        DataBase = "sys_log_" + osClientModel.OsClient.ToString().ToLower(),
                        Table = "CheckServer"
                    };
                    var count = await TMongodbHelper<SysLog>.InsertAsync(host, new SysLog()
                    {
                        Remark = "CheckServer"
                    });
                    resultHtml += "<br>测试MongoDB成功！";
                }
                catch (Exception ex)
                {
                    resultHtml += "<br>测试MongoDB失败：" + ex.Message;
                }
            }
            catch (Exception ex)
            {


                resultHtml += "<br>获取ClientModel失败：" + ex.Message;
            }

            Response.ContentType = "text/html; charset=utf-8";
            var data = Encoding.UTF8.GetBytes(resultHtml);
            await Response.Body.WriteAsync(data, 0, data.Length);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        // [AllowAnonymous]
        public async Task OsClientInit()
        {
            var resultHtml = "";

            try
            {
                new OsClient().Init(true);
                resultHtml = JsonConvert.SerializeObject(new DosResult(1));
            }
            catch (Exception ex)
            {
                resultHtml = JsonConvert.SerializeObject(
                    new DosResult(0, null, ex.Message
                        , 0, new
                        {
                            DetailMsg = (ex.InnerException == null ? "" : (ex.InnerException.Message ?? "")) + "。-->" + ex.StackTrace
                        }
                ));
            }
            Response.ContentType = "text/html; charset=utf-8";
            var data = Encoding.UTF8.GetBytes(resultHtml);
            await Response.Body.WriteAsync(data, 0, data.Length);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        // [HttpGet, HttpPost]
        // public async Task DynamicApiEngineInit()
        // {
        //     var resultHtml = "";
        //     try
        //     {
        //         var currentToken = await DiyToken.GetCurrentToken();
        //         var clientModel = OsClient.GetClient(currentToken.OsClient);
        //         var result = await new DynamicRoute().Init(clientModel);
        //         resultHtml = JsonConvert.SerializeObject(result);
        //     }
        //     catch (Exception ex)
        //     {


        //         resultHtml = JsonConvert.SerializeObject(new DosResult(0, null,
        //                         "DynamicApiEngineInit。 " + ex.Message));// + "。-->" + (ex.InnerException == null ? "" : (ex.InnerException.Message ?? "")) + "。-->" + ex.StackTrace
        //     }

        //     Response.ContentType = "text/html; charset=utf-8";
        //     var data = Encoding.UTF8.GetBytes(resultHtml);
        //     await Response.Body.WriteAsync(data, 0, data.Length);
        // }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="OsClient"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public string GetOsClient()
        {
            var osClient = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process);
            osClient = osClient.DosIsNullOrWhiteSpace() ? ConfigHelper.GetAppSettings("OsClient") : osClient;

            var osClientType = Environment.GetEnvironmentVariable("OsClientType", EnvironmentVariableTarget.Process);
            osClientType = osClientType.DosIsNullOrWhiteSpace() ? ConfigHelper.GetAppSettings("OsClientType") : osClientType;

            var osClientNetwork = Environment.GetEnvironmentVariable("OsClientNetwork", EnvironmentVariableTarget.Process);
            osClientNetwork = osClientNetwork.DosIsNullOrWhiteSpace() ? ConfigHelper.GetAppSettings("OsClientNetwork") : osClientNetwork;

            return JsonConvert.SerializeObject(new
            {
                OsClient = osClient,
                OsClientType = osClientType,
                OsClientNetwork = osClientNetwork,
            });
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="OsClient"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public string GetHID()
        {
            var hid = DiyLicense.GetHardwareID();
            return hid;
        }

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        // [HttpPost]
        // public async Task<JsonResult> GetDesktop()
        // {
        //     #region 取当前登录会员信息
        //     var sysUser = await DiyToken.GetCurrentToken<SysUser>();
        //     #endregion
        //     var result = new List<SysMenu>();
        //     if (sysUser.CurrentUser.Account.ToLower() == "admin")
        //     {
        //         var tmpResult = await new SysMenuLogic().GetSysMenuStep(new SysMenuParam());
        //         if (tmpResult.Code != 1)
        //         {
        //             return Json(tmpResult);
        //         }
        //         result = tmpResult.Data;
        //     }
        //     else
        //     {
        //         ////取当前用户所有角色
        //         //var roleIds = await new SysUserFkLogic().GetSysUserFk(new SysUserFkParam()
        //         //{
        //         //    UserId = sysUser.CurrentUser.Id,
        //         //    Type = "Role",
        //         //    OsClient = sysUser.OsClient
        //         //});
        //         ////再取这些角色拥有的菜单
        //         //var menuIds = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
        //         //{
        //         //    RoleIds = roleIds.Select(d => d.FkId).ToList(),
        //         //    Type = "Menu",
        //         //    OsClient = sysUser.OsClient
        //         //});
        //         ////最后取菜单列表
        //         //var tmpResult = await new SysMenuLogic().GetSysMenuStep(new SysMenuParam()
        //         //{
        //         //    Ids = menuIds.Select(d => d.FkId).ToList(),
        //         //    OsClient = sysUser.OsClient
        //         //});
        //         //if (tmpResult.Code != 1)
        //         //{
        //         //    return Json(tmpResult);
        //         //}
        //         //result = tmpResult.Data;
        //     }
        //     return Json(new DosResult()
        //     {
        //         Code = 1,
        //         Data = result
        //     });
        // }

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public JsonResult GetDateTimeNow()
        {
            return Json(new DosResult(1, DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss")));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="OsClient"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public JsonResult MicroiNetInitCheck(string OsClient)
        {
            return Json(new DosResult(1, DiyStartup.MicroiNetInitCheck()));
        }
    }
}
