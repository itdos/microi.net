using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    //[ApiController]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    //[Error]
    [Route("api/[controller]/[action]")]
    public class SysRoleController : Controller
    {
        private static SysRoleLogic _sysRoleLogic = new SysRoleLogic();

        private static async Task DefaultParam(SysRoleParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param._CurrentUser = currentTokenDynamic?.CurrentUser;
            param.OsClient = currentTokenDynamic?.OsClient;
        }

        /// <summary>
        /// Returns the server-owned direct-table grant policy. The role editor must
        /// not maintain a second hard-coded protection list that can drift from the
        /// authorization boundary.
        /// </summary>
        [HttpGet, HttpPost]
        [PlatformAdminOnly]
        public JsonResult GetDirectTableGrantPolicies()
        {
            return Json(new DosResult(
                1,
                PlatformResourceSecurity.DirectTableGrantPolicies));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> AddSysRole(SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.AddSysRole(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> AddSysRoleFromBody([FromBody] SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.AddSysRole(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> DelSysRole(SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.DelSysRole(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> UptSysRole(SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.UptSysRole(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> UptSysRoleFromBody([FromBody] SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.UptSysRole(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> GetSysRoleModel(SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.GetSysRoleModel(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetSysRole(SysRoleParam param)
        {
            await DefaultParam(param);
            var currentUser = param._CurrentUser as JObject;
            var isPlatformAdministrator =
                PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                    param.OsClient,
                    currentUser);
            if (!isPlatformAdministrator)
            {
                var authorization = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(
                    new DiyTableRowParam
                    {
                        FormEngineKey = "sys_user",
                        OsClient = param.OsClient,
                        _CurrentUser = currentUser,
                        _InvokeType = InvokeType.Client.ToString(),
                        _Lang = param._Lang
                    },
                    "List");
                if (authorization.Code != 1)
                {
                    Response.StatusCode = 403;
                    return Json(authorization);
                }
                var dbSession = OsClientExtend.GetClient(param.OsClient)?.Db;
                var catalog = SysUserManagementSecurity.GetAssignableRoleCatalog(
                    dbSession,
                    currentUser);
                return Json(new DosResult(
                    1,
                    catalog.Select(role => new
                    {
                        role.Id,
                        role.Name,
                        role.Level
                    }).ToList())
                {
                    DataCount = catalog.Count
                });
            }
            param.IsDeleted = 0;
            var result = await _sysRoleLogic.GetSysRole(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> GetSysRoleStep(SysRoleParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 0;
            var result = await _sysRoleLogic.GetSysRoleStep(param);
            return Json(result);
        }
    }
}
