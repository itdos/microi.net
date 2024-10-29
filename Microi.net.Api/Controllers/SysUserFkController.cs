using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<SysUser>))]
    [Route("api/[controller]/[action]")]
    //[Error]
    public class SysUserFkController : Controller
    {
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptSysUserFk(SysUserFkParam param)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;

            var result = await new SysUserFkLogic().UptSysUserFk(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddSysUserFk(SysUserFkParam param)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;

            var result = await new SysUserFkLogic().AddSysUserFk(param);
            return Json(result);
        }

        /// <summary>
        /// 删除。必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelSysUserFk(SysUserFkParam param)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;

            var result = await new SysUserFkLogic().DelSysUserFk(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> GetSysUserFk(SysUserFkParam param)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;


            var msg = "";
            var dataCount = 0;
            //注意：此方法特殊，需要提前传入dbSession
            //DbSession dbSession = OsClient.GetClient(param.OsClient).Db;

            var listSysUserFk = await new SysUserFkLogic().GetSysUserFk(param);//, dbSession

            return Json(new DosResult(msg.DosIsNullOrWhiteSpace() ? 1 : 0, listSysUserFk, msg, dataCount));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> GetSysUserFkModel(SysUserFkParam param)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;


            var msg = "";
            var dataCount = 0;
            var listSysUserFk = await new SysUserFkLogic().GetSysUserFkModel(param);

            return Json(new DosResult(msg.DosIsNullOrWhiteSpace() ? 1 : 0, listSysUserFk, msg, dataCount));
        }

    }
}
