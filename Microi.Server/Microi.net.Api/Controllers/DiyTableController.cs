using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class DiyTableController : Controller
    {
        /// <summary>
        /// 
        /// </summary>
        private static async Task DefaultParam(DiyTableRowParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentTokenDynamic.OsClient;
            param._InvokeType = InvokeType.Client.ToString();

        }
        private static async Task DefaultDiyTableParam(DiyTableParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentTokenDynamic.OsClient;
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
            var result = await MicroiEngine.FormEngine.GetDiyDocumentTree(param);
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
            var result = await MicroiEngine.FormEngine.LoadNotDiyTableAsync(param);
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
            var result = await MicroiEngine.FormEngine.GetNotDiyTable(param);
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
            var result = await MicroiEngine.FormEngine.GetSysConfig(param.OsClient);
            return Json(result);

            // //缓存
            // var cache = MicroiEngine.CacheTenant.Cache(param.OsClient);
            // var sysConfigCache = await cache.GetAsync<dynamic>($"Microi:{param.OsClient}:SysConfig");
            // if (sysConfigCache != null)
            // {
            //     return Json(new DosResult(1, sysConfigCache));
            // }

            // param.TableName = "Sys_Config";
            // param._SearchEqual = new Dictionary<string, string>();
            // param._SearchEqual.Add("IsEnable", "1");

            // var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(param);
            // if (result.Code == 1)
            // {
            //     await cache.SetAsync<dynamic>($"Microi:{param.OsClient}:SysConfig", result.Data);
            // }
            // //获取登陆身份信息
            // var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            // if (currentToken != null && !currentToken.CurrentUser.TenantId.DosIsNullOrWhiteSpace())
            // {
            //     //取租户配置信息
            //     var sysConfigTenantResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
            //     {
            //         FormEngineKey = "Sys_ConfigTenant",
            //         _Where = new List<DiyWhere>() {
            //             new DiyWhere(){
            //                 Name = "IsEnable",
            //                 Value = "1",
            //                 Type = "="
            //             },
            //             new DiyWhere(){
            //                 Name = "TenantId",
            //                 Value = currentToken.CurrentUser.TenantId,
            //                 Type = "="
            //             }
            //         },
            //         OsClient = param.OsClient,
            //     });
            //     if (sysConfigTenantResult.Code == 1)
            //     {
            //         result.Data.SysShortTitle = sysConfigTenantResult.Data.SysShortTitle;
            //         result.Data.SysLogo = sysConfigTenantResult.Data.SysLogo;
            //         result.Data.SysLogoHeight = sysConfigTenantResult.Data.SysLogoHeight;
            //     }
            // }


            // return Json(result);
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
            var result = await MicroiEngine.FormEngine.AddDiyTable(param);
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
            var result = await MicroiEngine.FormEngine.DelDiyTable(param);
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
            var result = await MicroiEngine.FormEngine.UptDiyTable(param);
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
            var result = await MicroiEngine.FormEngine.GetDiyTableModel(param);
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
            var newGuid = Ulid.NewUlid().ToString();
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
            var listSysUser = await MicroiEngine.FormEngine.GetDiyTable(param);
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
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            #endregion
            if (paramList != null && paramList._List != null && paramList._List.Any())
            {
                foreach (var param in paramList._List)
                {
                    param.OsClient = currentTokenDynamic?.OsClient;
                    await DefaultParam(param);
                }
                var result = await MicroiEngine.FormEngine.AddFormDataBatchAsync(paramList._List);
                return Json(result);
            }
            return Json(new DosResult(0, null, DiyMessage.GetLang(currentTokenDynamic?.OsClient, "ParamError", paramList?._Lang)));
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
            var result = await MicroiEngine.FormEngine.AddFormDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.DelFormDataAsync(param);
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
            var sysUser = await DiyToken.GetCurrentToken<JObject>();
            #endregion
            if (paramList != null && paramList._List != null && paramList._List.Any())
            {
                foreach (var param in paramList._List)
                {
                    param.OsClient = sysUser?.OsClient;
                    await DefaultParam(param);
                }
                var result = await MicroiEngine.FormEngine.DelFormDataBatchAsync(paramList._List);
                return Json(result);
            }
            return Json(new DosResult(0, null, DiyMessage.GetLang(paramList.OsClient, "ParamError", paramList._Lang)));
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
            var result = await MicroiEngine.FormEngine.UptFormDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.UptFormDataByWhereAsync(param);
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
            var result = await MicroiEngine.FormEngine.DelFormDataByWhereAsync(param);
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
            var sysUser = await DiyToken.GetCurrentToken<JObject>();
            #endregion
            if (paramList != null && paramList._List != null && paramList._List.Any())
            {
                foreach (var param in paramList._List)
                {
                    param.OsClient = sysUser?.OsClient;
                    await DefaultParam(param);
                }
                var result = await MicroiEngine.FormEngine.UptFormDataBatchAsync(paramList._List);
                return Json(result);
            }
            return Json(new DosResult(0, null, DiyMessage.GetLang(paramList?.OsClient, "ParamError", paramList?._Lang)));
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
            var result = await MicroiEngine.FormEngine.GetTableDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.AddFormDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.GetTableDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.GetTableDataTreeAsync(param);
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
            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(param);
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
            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(param);
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
            var result = await MicroiEngine.FormEngine.GetDiyFieldSqlData(param);
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
            var result = await MicroiEngine.FormEngine.GetFieldsData(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        // [HttpPost, HttpGet]  
        // public async Task<JsonResult> RunSqlGetList(DiyTableRowParam param)
        // {
        //     await DefaultParam(param);
        //     var result = await MicroiEngine.FormEngine.RunSqlGetList(param);
        //     return Json(result);
        // }
        // /// <summary>
        // /// 
        // /// </summary>
        // /// <param name="param"></param>
        // /// <returns></returns>
        // [HttpPost, HttpGet]  
        // public async Task<JsonResult> RunSqlGetModel(DiyTableRowParam param)
        // {
        //     await DefaultParam(param);
        //     var result = await MicroiEngine.FormEngine.RunSqlGetModel(param);
        //     return Json(result);
        // }

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
            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(param.OsClient);
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
            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(param.OsClient);
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
            //var result = await MicroiEngine.FormEngine.ImportDiyTableRow(param);
            // var result = await MicroiEngine.FormEngine.ImportTableData(param);
            var result = await MicroiEngine.Office.ImportExcel(param, HttpContext);
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

            var tokenModelJobj = await DiyToken.GetCurrentToken<JObject>(param.authorization, param.OsClient);
            if (tokenModelJobj != null)
            {
                param.OsClient = tokenModelJobj.OsClient;
                param._CurrentUser = tokenModelJobj.CurrentUser;
            }
            else
            {
                return new ContentResult() { Content = DiyMessage.GetLang(param.OsClient, "NoLogin", param._Lang) };
            }

            param.IsDeleted = 0;

            IMicroiDbSession dbSessionStart = OsClient.GetClient(param.OsClient).Db;

            var diyTableModelStart = dbSessionStart.From<DiyTable>()
                                        .Select(new DiyTable().GetFields())
                                        .Where(d => d.Id == param.TableId)
                                        .First();
            if (diyTableModelStart == null)
            {
                return new ContentResult() { Content = "不存在的DiyTable数据，TableId：" + (param.TableId ?? "") };
            }
            // var result = await MicroiEngine.FormEngine.ExportDiyTableRow(param);
            var result = await MicroiEngine.Office.ExportExcelAsync(param);
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