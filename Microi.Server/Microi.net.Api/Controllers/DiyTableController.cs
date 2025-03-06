using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class DiyTableController : Controller
    {
        private static FormEngine? _formEngine;// new FormEngine();
        private readonly IMicroiOffice _microiOfficeInterface;
        private readonly IMicroiWeChat _templateMessageInterface;
        /// <summary>
        /// 
        /// </summary>
        public DiyTableController(IMicroiWeChat templateMessageInterface, IMicroiOffice microiOfficeInterface)
        {
            _templateMessageInterface = templateMessageInterface;
            _formEngine = new FormEngine(_templateMessageInterface);
            _microiOfficeInterface = microiOfficeInterface;
        }
        /// <summary>
        /// 
        /// </summary>
        private static DiyTableLogic _diyTableLogic = new DiyTableLogic();
        /// <summary>
        /// 
        /// </summary>

        private static async Task DefaultParam(DiyTableRowParam param)
        {
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            param._CurrentSysUser = currentToken.CurrentUser;
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentToken.OsClient;
            param._InvokeType = InvokeType.Client.ToString();

        }
        private static async Task DefaultDiyTableParam(DiyTableParam param)
        {
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            param._CurrentSysUser = sysUser.CurrentUser;
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = sysUser.OsClient;
            param._InvokeType = InvokeType.Client.ToString();
        }
        ///// <summary>
        ///// 清空某张表的数据，仅超级管理员权限，谨慎操作。
        ///// </summary>
        ///// <param name="param"></param>
        ///// <returns></returns>
        //[HttpPost, HttpGet]
        //public async Task<JsonResult> TruncateTable(DiyTableRowParam param)
        //{
        //    if (param.TableName.DosIsNullOrWhiteSpace())
        //    {
        //        return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
        //    }
        //    try
        //    {
        //        #region 取当前登录会员信息
        //        var sysUser = await DiyToken.GetCurrentToken<SysUser>();
        //        #endregion
        //        if (sysUser.CurrentUser._IsAdmin != true)
        //        {
        //            return Json(new DosResult(0, null, "你没有权限此操作！"));
        //        }
        //        param.OsClient = sysUser.OsClient;
        //        var osClient = OsClient.GetClient(param.OsClient);
        //        var dbResult = osClient.Db.FromSql("truncate " + param.TableName).ExecuteNonQuery();
        //        return Json(new DosResult(1, null, "操作成功！"));
        //    }
        //    catch (Exception ex)
        //    {
        //        return Json(new DosResult(0, null, ex.Message));
        //    }
        //}
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetDiyDocumentTree(DiyDocumentParam param)
        {
            param.OsClient = "iTdos";
            param.IsDeleted = 0;
            param.Display = 1;
            var result = await _diyTableLogic.GetDiyDocumentTree(param);
            return Json(result);
        }
        /// <summary>
        /// 将非diy表加载为diy表。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> LoadNotDiyTable(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await _diyTableLogic.LoadNotDiyTable(param);
            return Json(result);
        }
        /// <summary>   
        /// 获取所有非diy表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetNotDiyTable(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await _diyTableLogic.GetNotDiyTable(param);
            return Json(result);
        }

        /// <summary>
        /// 获取系统设置，必传OsClient
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        [AllowAnonymous]
        public async Task<JsonResult> GetSysConfig(DiyTableRowParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            }

            //缓存
            var cache = new MicroiCacheRedis(param.OsClient);
            var sysConfigCache = await cache.GetAsync<dynamic>($"Microi:{param.OsClient}:SysConfig");
            if (sysConfigCache != null)
            {
                return Json(new DosResult(1, sysConfigCache));
            }

            param.TableName = "Sys_Config";
            param._SearchEqual = new Dictionary<string, string>();
            param._SearchEqual.Add("IsEnable", "1");

            var result = await _diyTableLogic.GetDiyTableRowModel<dynamic>(param);
            if (result.Code == 1)
            {
                await cache.SetAsync<dynamic>($"Microi:{param.OsClient}:SysConfig", result.Data);
            }
            //获取登陆身份信息
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            if (currentToken != null && !currentToken.CurrentUser.TenantId.DosIsNullOrWhiteSpace())
            {
                //取租户配置信息
                var sysConfigTenantResult  = await _formEngine.GetFormDataAsync(new {
                    FormEngineKey = "Sys_ConfigTenant",
                    _Where = new List<DiyWhere>() {
                        new DiyWhere(){
                            Name = "IsEnable",
                            Value = "1",
                            Type = "="
                        },
                        new DiyWhere(){
                            Name = "TenantId",
                            Value = currentToken.CurrentUser.TenantId,
                            Type = "="
                        }
                    },
                    OsClient = param.OsClient,
                });
                if (sysConfigTenantResult.Code == 1)
                {
                    result.Data.SysShortTitle = sysConfigTenantResult.Data.SysShortTitle;
                    result.Data.SysLogo = sysConfigTenantResult.Data.SysLogo;
                    result.Data.SysLogoHeight = sysConfigTenantResult.Data.SysLogoHeight;
                }
            }


            return Json(result);
        }

        #region DiyTable
        /// <summary>
        /// 新增一张表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddDiyTable(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await _diyTableLogic.AddDiyTable(param);
            return Json(result);
        }
        /// <summary>
        /// 删除一张表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> DelDiyTable(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await _diyTableLogic.DelDiyTable(param);
            return Json(result);
        }
        /// <summary>
        /// 修改一张表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> UptDiyTable(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await _diyTableLogic.UptDiyTable(param);
            return Json(result);
        }
        /// <summary>
        /// 获取一张表信息
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetDiyTableModel(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await _diyTableLogic.GetDiyTableModel(param);
            return Json(result);
        }
        /// <summary>
        /// 生成一个Guid
        /// </summary>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        [AllowAnonymous]
        public async Task<JsonResult> NewGuid()
        {
            var newGuid = Guid.NewGuid();
            return Json(new DosResult(1, newGuid));
        }
        /// <summary>
        /// 获取表列表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetDiyTable(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            param.IsDeleted = 0;
            var listSysUser = await _diyTableLogic.GetDiyTable(param);
            return Json(listSysUser);
        }

        /// <summary>
        /// 批量新增diy数据，带事务。
        /// </summary>
        /// <param name="paramList"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddDiyTableRowBatch(DiyTableRowParam paramList)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            if (paramList != null && paramList._List != null && paramList._List.Any())
            {
                foreach (var param in paramList._List)
                {
                    //param._CurrentSysUser = sysUser.CurrentUser;
                    //param.OsClient = sysUser.OsClient;
                    await DefaultParam(param);
                }
                var result = await _diyTableLogic.AddDiyTableRowBatch(paramList._List);
                return Json(result);
            }
            return Json(new DosResult(0, null, DiyMessage.GetLang(paramList.OsClient,  "ParamError", paramList._Lang)));
        }
        /// <summary>
        /// 新增一条diy数据。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> AddDiyTableRow(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.AddDiyTableRow(param);
            return Json(result);
        }

        /// <summary>
        /// 删除diy数据，非物理删除，仅仅是标记IsDeleted=1
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> DelDiyTableRow(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.DelDiyTableRow(param);
            return Json(result);
        }
        /// <summary>
        /// 批量删除diy数据，带事务，非物理删除，仅仅是标记IsDeleted=1
        /// </summary>
        /// <param name="paramList"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelDiyTableRowBatch(DiyTableRowParam paramList)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            if (paramList != null && paramList._List != null && paramList._List.Any())
            {
                foreach (var param in paramList._List)
                {
                    //param._CurrentSysUser = sysUser.CurrentUser;
                    //param.OsClient = sysUser.OsClient;
                    await DefaultParam(param);
                }
                var result = await _diyTableLogic.DelDiyTableRowBatch(paramList._List);
                return Json(result);
            }
            return Json(new DosResult(0, null, DiyMessage.GetLang(paramList.OsClient,  "ParamError", paramList._Lang)));
        }

        /// <summary>
        /// 修改diy数据
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> UptDiyTableRow(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.UptDiyTableRow(param);
            return Json(result);
        }
        /// <summary>
        /// 根据条件进行批量修改，必传TableId或TableName，_SearchEqual，_RowModel。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptDiyDataListByWhere(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.UptDiyDataListByWhere(param);
            return Json(result);
        }
        /// <summary>
        /// 根据条件进行批量删除，必传TableId或TableName，_SearchEqual
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelDiyDataListByWhere(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.DelDiyDataListByWhere(param);
            return Json(result);
        }
        
        /// <summary>
        /// 批量修改diy数据，带事务。
        /// </summary>
        /// <param name="paramList"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptDiyTableRowBatch(DiyTableRowParam paramList)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            if (paramList != null && paramList._List != null && paramList._List.Any())
            {
                foreach (var param in paramList._List)
                {
                    //param._CurrentSysUser = sysUser.CurrentUser;
                    //param.OsClient = sysUser.OsClient;
                    await DefaultParam(param);
                }
                var result = await _diyTableLogic.UptDiyTableRowBatch(paramList._List);
                return Json(result);
            }
            return Json(new DosResult(0,  null, DiyMessage.GetLang(paramList.OsClient,  "ParamError", paramList._Lang)));
        }

        
        /// <summary>
        /// 匿名获取数据，必传：OsClient、TableId或Name
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetDiyTableRowAnonymous(DiyTableRowParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            }
            param.IsDeleted = 0;
            param._IsAnonymous = true;
            var result = await _diyTableLogic.GetDiyTableRow(param);
            return Json(result);
        }
        /// <summary>
        /// 匿名新增数据，必传：OsClient、TableId或Name
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> AddDiyTableRowAnonymous(DiyTableRowParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            }

            param.IsDeleted = 0;
            param._IsAnonymous = true;
            var result = await _diyTableLogic.AddDiyTableRow(param);
            return Json(result);
        }

        /// <summary>
        /// 获取diy数据列表。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetDiyTableRow(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.GetDiyTableRow(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetDiyTableRowTree(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.GetDiyTableRowTree(param);
            return Json(result);
        }


        /// <summary>
        /// 匿名获取数据，必传：OsClient、TableId或Name
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetDiyTableRowModelAnonymous(DiyTableRowParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            }
            param.IsDeleted = 0;
            param._IsAnonymous = true;
            var result = await _diyTableLogic.GetDiyTableRowModel<dynamic>(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetDiyTableRowModel(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.GetDiyTableRowModel<dynamic>(param);
            return Json(result);
        }
        #endregion
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetDiyFieldSqlData(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.GetDiyFieldSqlData(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetFieldsData(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.GetFieldsData(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> RunSqlGetList(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.RunSqlGetList(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> RunSqlGetModel(DiyTableRowParam param)
        {
            await DefaultParam(param);
            var result = await _diyTableLogic.RunSqlGetModel(param);
            return Json(result);
        }

        /// <summary>
        /// 获取导入diy数据的进度
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetImportDiyTableRowStep(DiyTableRowParam param)
        {
            await DefaultParam(param);
            if (param.OsClient.DosIsNullOrWhiteSpace() || param.TableId.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            }
            //var stepSign = "ImportDiyTableRowStep:" + param.TableId;
            var stepSign = $"Microi:{param.OsClient}:ImportTableDataStep:{param.TableId}";
            var DiyCacheBase = new MicroiCacheRedis(param.OsClient);
            var importStep = await DiyCacheBase.GetAsync<List<string>>(stepSign);
            if (importStep == null)
            {
                importStep = new List<string>();
            }
            return Json(new DosResult(1, importStep));
        }
        /// <summary>
        /// 清除导入进度缓存。清除后可强制重新开始导入，此功能谨慎使用，只适合在长时间进度卡住不动的情况下使用。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelImportDiyTableRowStep(DiyTableRowParam param)
        {
            await DefaultParam(param);
            if (param.OsClient.DosIsNullOrWhiteSpace() || param.TableId.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            }
            var startSign = $"Microi:{param.OsClient}:ImportTableDataStart:{param.TableId}";
            var stepSign = $"Microi:{param.OsClient}:ImportTableDataStep:{param.TableId}";
            var DiyCacheBase = new MicroiCacheRedis(param.OsClient);
            await DiyCacheBase.SetAsync(startSign, "0");
            await DiyCacheBase.DeleteAsync(stepSign);
            return Json(new DosResult(1));
        }
        /// <summary>
        /// 导入diy数据
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> ImportDiyTableRow(DiyTableRowParam param)
        {
            await DefaultParam(param);
            //var result = await _diyTableLogic.ImportDiyTableRow(param);
            // var result = await _diyTableLogic.ImportTableData(param);
            var result = await _microiOfficeInterface.ImportExcel(param, HttpContext);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [AllowAnonymous]
        [HttpPost, HttpGet]
        public async Task<ActionResult> ExportDiyTableRowFromBody([FromBody] DiyTableRowParam param)
        {
            return await ExportDiyTableRow(param);
        }
        /// <summary>
        /// 导出diy数据列表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        [AllowAnonymous]
        public async Task<ActionResult> ExportDiyTableRow(DiyTableRowParam param)
        {
            if (param.TableId.DosIsNullOrWhiteSpace())
            {
                return new ContentResult() { Content = DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang) };
            }

            var tokenModel = await DiyToken.GetCurrentToken<SysUser>(param.authorization, param.OsClient);
            var tokenModelJobj = await DiyToken.GetCurrentToken<JObject>(param.authorization, param.OsClient);
            if (tokenModel != null)
            {
                param.OsClient = tokenModel.OsClient;
                param._CurrentSysUser = tokenModel.CurrentUser;
                param._CurrentUser = tokenModelJobj.CurrentUser;
            }
            else
            {
                return new ContentResult() { Content = DiyMessage.GetLang(param.OsClient,  "NoLogin", param._Lang) };
            }

            param.IsDeleted = 0;

            DbSession dbSessionStart = OsClient.GetClient(param.OsClient).Db;

            var diyTableModelStart = dbSessionStart.From<DiyTable>()
                                        .Select(new DiyTable().GetFields())
                                        .Where(d => d.Id == param.TableId)
                                        .First();
            if (diyTableModelStart == null)
            {
                return new ContentResult() { Content = "不存在的DiyTable数据，TableId：" + (param.TableId ?? "")};
            }
            // var result = await _diyTableLogic.ExportDiyTableRow(param);
            var result = await _microiOfficeInterface.ExportExcel(param);
            if (result.Code != 1)
            {
                return new ContentResult() { Content = result.Msg };
            }
            return File(result.Data, "application/vnd.ms-excel", "导出"
                    + (diyTableModelStart.Description.DosIsNullOrWhiteSpace()
                        ? diyTableModelStart.Name.Replace("Diy_", "")
                        : diyTableModelStart.Description)
                    + " - "
                    + DateTime.Now.ToString("yyyyMMddHHmmss") + ".xls");
        }
    }
}