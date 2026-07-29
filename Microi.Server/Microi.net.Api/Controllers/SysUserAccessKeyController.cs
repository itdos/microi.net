using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// Per-user browser access keys. Management requires a normal authenticated
    /// session; only Exchange is anonymous. Plaintext credentials are returned
    /// exactly once at creation and are never accepted through query parameters.
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class SysUserAccessKeyController : Controller
    {
        public sealed class CreateAccessKeyRequest
        {
            public string TargetUserId { get; set; }
            public string Name { get; set; }
            public List<string> Scopes { get; set; }
            public List<string> AllowedRoutes { get; set; }
            public string RedirectPath { get; set; }
            public List<string> AllowedTableNames { get; set; }
            public List<string> AllowedApiEngineKeys { get; set; }
            public List<string> AllowedDataSourceKeys { get; set; }
            public bool Permanent { get; set; }
            public string ExpiresAt { get; set; }
            public string Remark { get; set; }
        }

        public sealed class ListAccessKeyRequest
        {
            public string TargetUserId { get; set; }
        }

        public sealed class RevokeAccessKeyRequest
        {
            public string Id { get; set; }
        }

        public sealed class ExchangeAccessKeyRequest
        {
            public string AccessKey { get; set; }
            public string OsClient { get; set; }
            public string Did { get; set; }
        }

        private static bool IsPlatformAdmin(JObject currentUser)
        {
            return currentUser?["_IsAdmin"]?.Val<bool>() == true
                   || currentUser?["Level"]?.Val<int>() >= DiyCommon.MaxRoleLevel;
        }

        private static async Task<DosResult<dynamic>> GetActiveUserAsync(
            string osClient,
            string userId)
        {
            return await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                "sys_user",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Id", "=", userId },
                        new List<object> { "State", "=", 1 },
                        new List<object> { "IsDeleted", "<>", 1 }
                    },
                    _SelectFields = new[] { "Id", "Account", "Name", "State", "Level" }
                }).ConfigureAwait(false);
        }

        private static DosResult ValidateManagementTarget(
            CurrentToken currentToken,
            string requestedTargetUserId,
            out string targetUserId)
        {
            targetUserId = requestedTargetUserId?.Trim();
            var currentUser = currentToken?.CurrentUser;
            var currentUserId = currentUser?["Id"]?.ToString();
            if (currentUser == null || currentUserId.DosIsNullOrWhiteSpace())
                return new DosResult(1001, null, "请先登录。");
            if (UserAccessKeySecurity.IsSession(currentUser))
                return new DosResult(0, null, "访问密钥会话不能管理访问密钥。");
            if (targetUserId.DosIsNullOrWhiteSpace()) targetUserId = currentUserId;
            if (!IsPlatformAdmin(currentUser)
                && !string.Equals(targetUserId, currentUserId, StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(0, null, "无权管理其他帐号的访问密钥。");
            }
            return new DosResult(1);
        }

        [HttpPost]
        public async Task<JsonResult> Create([FromBody] CreateAccessKeyRequest request)
        {
            request ??= new CreateAccessKeyRequest();
            var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            var validation = ValidateManagementTarget(
                currentToken,
                request.TargetUserId,
                out var targetUserId);
            if (validation.Code != 1) return Json(validation);

            var targetResult = await GetActiveUserAsync(currentToken.OsClient, targetUserId)
                .ConfigureAwait(false);
            if (targetResult.Code != 1 || targetResult.Data == null)
                return Json(new DosResult(0, null, "目标帐号不存在或已停用。"));

            JObject targetUser = JObject.FromObject((object)targetResult.Data);
            var result = await UserAccessKeyService.CreateAsync(
                    currentToken.OsClient,
                    targetUser,
                    currentToken.CurrentUser,
                    request.Name,
                    request.Scopes,
                    request.AllowedRoutes,
                    request.RedirectPath,
                    request.AllowedTableNames,
                    request.AllowedApiEngineKeys,
                    request.AllowedDataSourceKeys,
                    request.Permanent,
                    request.ExpiresAt,
                    request.Remark)
                .ConfigureAwait(false);
            return Json(result);
        }

        [HttpPost]
        public async Task<JsonResult> List([FromBody] ListAccessKeyRequest request)
        {
            request ??= new ListAccessKeyRequest();
            var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            var validation = ValidateManagementTarget(
                currentToken,
                request.TargetUserId,
                out var targetUserId);
            if (validation.Code != 1) return Json(validation);
            return Json(await UserAccessKeyService.ListAsync(
                    currentToken.OsClient,
                    targetUserId)
                .ConfigureAwait(false));
        }

        [HttpPost]
        public async Task<JsonResult> Revoke([FromBody] RevokeAccessKeyRequest request)
        {
            var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            var validation = ValidateManagementTarget(currentToken, null, out _);
            if (validation.Code != 1) return Json(validation);
            if (request == null || request.Id.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "访问密钥Id不能为空。"));

            return Json(await UserAccessKeyService.RevokeAsync(
                    currentToken.OsClient,
                    request.Id.Trim(),
                    currentToken.CurrentUser["Id"]?.ToString(),
                    IsPlatformAdmin(currentToken.CurrentUser))
                .ConfigureAwait(false));
        }

        [AllowAnonymous]
        [HttpPost]
        public async Task<JsonResult> Exchange([FromBody] ExchangeAccessKeyRequest request)
        {
            request ??= new ExchangeAccessKeyRequest();
            var osClient = request.OsClient.DosIsNullOrWhiteSpace()
                ? DiyToken.GetCurrentOsClient(false)
                : request.OsClient.Trim();
            var ip = IPHelper.GetClientIP(HttpContext).Data ?? "";
            var did = request.Did.DosIsNullOrWhiteSpace()
                ? Request.Headers["did"].ToString()
                : request.Did.Trim();
            return Json(await UserAccessKeyService.ExchangeAsync(
                    osClient,
                    request.AccessKey,
                    did,
                    ip)
                .ConfigureAwait(false));
        }
    }
}
