using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    //[ApiController]
    //[Error]
    [Route("api/[controller]/[action]")]
    public class SysRichTextController : Controller
    {
        #region SysRichText
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [ServiceFilter(typeof(DiyFilter<SysUser>))]
        [HttpPost]
        public async Task<JsonResult> AddSysRichText(SysRichTextParam param)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;

            var result = await new SysRichTextLogic().AddSysRichText(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [ServiceFilter(typeof(DiyFilter<SysUser>))]
        [HttpPost]
        public async Task<JsonResult> DelSysRichText(SysRichTextParam param)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;

            var result = await new SysRichTextLogic().DelSysRichText(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [ServiceFilter(typeof(DiyFilter<SysUser>))]
        [HttpPost]
        public async Task<JsonResult> UptSysRichText(SysRichTextParam param)
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;

            var result = await new SysRichTextLogic().UptSysRichText(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [ServiceFilter(typeof(DiyFilter<SysUser>))]
        [HttpPost]
        public async Task<JsonResult> GetSysRichText(SysRichTextParam param)
        {

            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;

            var msg = "";
            var dataCount = 0;
            var listSysUser = await new SysRichTextLogic().GetSysRichText(param);

            return Json(new BaseResult(msg.DosIsNullOrWhiteSpace(), listSysUser, dataCount, msg));
        }
        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> GetSysRichText_Biz(SysRichTextParam param)
        {
            //#region 取当前登录会员信息
            //var sysUser = await CommonMethod.GetCurrentSysUserToken<SysUser>(HttpContext);
            //#endregion
            //param.OsClient = sysUser.OsClient;
            //param._CurrentSysUser = sysUser.Model;

            var msg = "";
            var dataCount = 0;
            var listSysUser = await new SysRichTextLogic().GetSysRichText(param);
            return Json(new BaseResult(msg.DosIsNullOrWhiteSpace(), listSysUser, dataCount, msg));
        }

        [HttpPost]
        public async Task<JsonResult> GetSysRichTextStep(SysRichTextParam param)
        {

            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;
            var msg = "";
            var listSysUser = await new SysRichTextLogic().GetSysRichTextStep(param);
            return Json(new BaseResult(msg.DosIsNullOrWhiteSpace(), listSysUser, msg));
        }

        [HttpPost]
        public async Task<JsonResult> GetSysRichTextModel(SysRichTextParam param)
        {

            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            param.OsClient = sysUser.OsClient;
            param._CurrentSysUser = sysUser.CurrentUser;

            var msg = "";
            var listSysUser = await new SysRichTextLogic().GetSysRichTextModel(param);
            return Json(new BaseResult(msg.DosIsNullOrWhiteSpace(), listSysUser, msg));
        }
        //[SysUserSession]
        //    [HttpPost]
        //    public async Task<JsonResult> GetSysRichTextPa(SysRichTextParam param)
        //    {

        //        #region 取当前登录会员信息
        //        var sysUser = await CommonHandler.GetCurrentSysUser(HttpContext);
        //        #endregion


        //        var msg = "";
        //        var dataCount = 0;
        //        var listSysUser = await new SysRichTextLogic().GetPa();

        //        return Json(new BaseResult(msg.DosIsNullOrWhiteSpace(), listSysUser, dataCount, msg));
        //    }
        #endregion

    }
}