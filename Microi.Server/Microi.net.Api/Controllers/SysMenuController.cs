using Aop.Api.Domain;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Senparc.CO2NET.Utilities;
using static Microi.net.SysRoleLimitLogic;

namespace Microi.net.Api
{
    /// <summary>
    ///
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class SysMenuController : Controller
    {
        private static SysMenuLogic _sysMenuLogic = new SysMenuLogic();

        private static async Task DefaultParam(SysMenuParam param)
        {
            try
            {
                var currentTokenDynamic = await DiyToken.GetCurrentToken();
                param._CurrentUser = currentTokenDynamic?.CurrentUser;
                param.OsClient = currentTokenDynamic?.OsClient;
            }
            catch (Exception ex)
            {
                throw new Exception("DefaultParam初始化异常：" + ex.Message);
            }
        }

        /// <summary>
        ///
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddSysMenu(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.AddSysMenu(param);
            return Json(result);
        }

        /// <summary>
        ///
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelSysMenu(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.DelSysMenu(param);
            return Json(result);
        }

        /// <summary>
        ///
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptSysMenu(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.UptSysMenu(param);
            return Json(result);
        }

        /// <summary>
        ///
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysMenu(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.GetSysMenu(param);
            return Json(result);
        }

        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysMenuModel(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.GetSysMenuModel(param);
            return Json(result);
        }

        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysMenuStep(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.GetSysMenuStep(param);
            return Json(result);
        }

        /// <summary>
        /// 获取角色菜单权限（李赛赛）
        /// </summary>
        /// <param name="paramLog"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetSysRoleLimitByMenuId(SysRoleLimitParam paramLog)
        {
            var param = paramLog;

            #region 取当前登录会员信息

            var sysUser = await DiyToken.GetCurrentToken();

            #endregion 取当前登录会员信息

            param.OsClient = sysUser?.OsClient;
            
            var result = await new SysRoleLimitLogic().GetSysRoleLimitByMenuId(param);
            return Json(result);
        }

        [HttpGet, HttpPost]
        public async Task<JsonResult> UpdateSysRoleLimitByMenuId(SysRoleLimitParam paramLog)
        {
            var param = paramLog;

            #region 取当前登录会员信息

            var sysUser = await DiyToken.GetCurrentToken();

            #endregion 取当前登录会员信息

            param.OsClient = sysUser?.OsClient;
            
    
            var jsonStr = paramLog.Type;

            if (string.IsNullOrEmpty(jsonStr))
            {
                // 处理空值情况
                return Json(new { code = 0, msg = "参数错误：Type为空" });
            }

            if (string.IsNullOrEmpty(jsonStr))
                return Json(new { code = 0, msg = "参数错误：Type为空" });

            try
            {
                var jArray = JArray.Parse(jsonStr);

                foreach (var item in jArray)
                {
                    string id = (string)item["Id"];
                    string permissionStr = item["Permission"]?.ToString();
                    await new SysRoleLimitLogic().UpdateSysRoleLimitByMenuId(param.OsClient, id, permissionStr);
                }

                return Json(new { code = 1, msg = "成功" });
            }
            catch (Exception ex)
            {
                return Json(new { code = 0, msg = $"JSON解析失败：{ex.Message}" });
            }

            return Json(new DosResult(1));
        }
    }
}