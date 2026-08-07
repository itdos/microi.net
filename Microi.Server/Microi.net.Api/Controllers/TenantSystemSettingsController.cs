using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 租户自有系统设置管理。普通值保存在当前租户业务库；Secret 只接受明文写入此
    /// 可信端点并立即转换为认证密文，列表永不返回密文或明文。
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public sealed class TenantSystemSettingsController : Controller
    {
        public sealed class SaveSettingRequest
        {
            public string Id { get; set; }
            public string ConfigKey { get; set; }
            public string Value { get; set; }
            public string ValueType { get; set; } = "String";
            public string Category { get; set; }
            public string Description { get; set; }
            public bool IsPublic { get; set; }
            public bool IsSecret { get; set; }
            public bool IsEnabled { get; set; } = true;
            public int Sort { get; set; }
        }

        public sealed class SettingMutationRequest
        {
            public string Id { get; set; }
            public string Ticket { get; set; }
        }

        [HttpPost]
        [AllowAnonymous]
        public JsonResult GetPublic([FromBody] JObject request)
        {
            var osClient = request?["OsClient"]?.ToString();
            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
                if (OsClientExtend.GetClient(osClient) == null)
                    return Json(new DosResult(0, null, "租户不存在。"));
                Response.Headers.CacheControl = "no-store";
                return Json(new DosResult(1, TenantSystemSettingsSecurity.LoadPublicProjection(osClient)));
            }
            catch
            {
                return Json(new DosResult(0, null, "OsClient 无效。"));
            }
        }

        [HttpPost]
        public async Task<JsonResult> List()
        {
            var tokenResult = await RequireAdministratorAsync().ConfigureAwait(false);
            if (tokenResult.Code != 1) return Json(tokenResult);
            Response.Headers.CacheControl = "no-store";
            var snapshot = TenantSystemSettingsSecurity.LoadSnapshot(tokenResult.Data.OsClient);
            var rows = snapshot.Values
                .OrderBy(item => item.Sort)
                .ThenBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                .Select(item => new
                {
                    item.Id,
                    ConfigKey = item.Key,
                    ConfigValue = item.IsSecret ? "" : item.Value,
                    item.ValueType,
                    item.Category,
                    item.Description,
                    item.IsPublic,
                    item.IsSecret,
                    item.IsEnabled,
                    item.Sort,
                    item.ValueSource,
                    HasSecret = item.IsSecret && !item.SecretCipher.DosIsNullOrWhiteSpace()
                })
                .ToList();
            return Json(new DosResult(1, rows));
        }

        [HttpPost]
        public async Task<JsonResult> Save([FromBody] SaveSettingRequest request)
        {
            var tokenResult = await RequireAdministratorAsync().ConfigureAwait(false);
            if (tokenResult.Code != 1) return Json(tokenResult);
            if (request == null) return Json(new DosResult(0, null, "设置内容不能为空。"));

            var osClient = tokenResult.Data.OsClient;
            string key;
            try { key = TenantSystemSettingsSecurity.NormalizeKey(request.ConfigKey); }
            catch (Exception ex) { return Json(new DosResult(0, null, ex.Message)); }
            var value = request.Value ?? string.Empty;
            if (value.Length > 1024 * 1024) return Json(new DosResult(0, null, "设置值不能超过 1MB。"));
            var isSecret = request.IsSecret || TenantSystemSettingsSecurity.IsSensitiveKey(key);
            var isPublic = request.IsPublic && !isSecret;

            var existing = await FindSettingAsync(osClient, request.Id, key).ConfigureAwait(false);
            var id = existing?["Id"]?.ToString() ?? Guid.NewGuid().ToString();
            var secretCipher = existing?["SecretCipher"]?.ToString() ?? string.Empty;
            if (isSecret)
            {
                if (!value.DosIsNullOrWhiteSpace())
                {
                    try { secretCipher = TenantSystemSettingsSecurity.ProtectSecret(osClient, key, value); }
                    catch { return Json(new DosResult(0, null, "Secret 加密失败，请稍后重试。")); }
                }
                if (secretCipher.DosIsNullOrWhiteSpace())
                    return Json(new DosResult(0, null, "首次保存 Secret 时必须填写值。"));
                value = string.Empty;
            }
            else
            {
                secretCipher = string.Empty;
            }

            var form = new JObject
            {
                ["Id"] = id,
                ["ConfigKey"] = key,
                ["ConfigValue"] = value,
                ["SecretCipher"] = secretCipher,
                ["ValueType"] = isSecret ? "String" : TenantSystemSettingsSecurity.NormalizeValueType(request.ValueType),
                ["Category"] = NormalizeText(request.Category, 100),
                ["Description"] = NormalizeText(request.Description, 500),
                ["IsPublic"] = isPublic ? 1 : 0,
                ["IsSecret"] = isSecret ? 1 : 0,
                ["IsEnabled"] = request.IsEnabled ? 1 : 0,
                ["Sort"] = Math.Max(-100000, Math.Min(100000, request.Sort)),
                ["ValueSource"] = "Tenant",
                ["OsClient"] = osClient
            };
            DosResult result = existing == null
                ? await MicroiEngine.FormEngine.AddFormDataAsync(TenantSystemSettingsSecurity.TableName, form).ConfigureAwait(false)
                : await MicroiEngine.FormEngine.UptFormDataAsync(TenantSystemSettingsSecurity.TableName, form).ConfigureAwait(false);
            QueueAudit(tokenResult.Data, "SaveTenantSystemSetting", result.Code == 1, id, key);
            if (result.Code != 1) return Json(result);
            return Json(new DosResult(1, new
            {
                Id = id,
                ConfigKey = key,
                IsPublic = isPublic,
                IsSecret = isSecret,
                HasSecret = isSecret
            }, "系统设置已保存。"));
        }

        [HttpPost]
        public async Task<JsonResult> GetRevealChallenge([FromBody] SettingMutationRequest request)
        {
            var tokenResult = await RequireAdministratorAsync().ConfigureAwait(false);
            if (tokenResult.Code != 1) return Json(tokenResult);
            var item = await FindSettingByIdAsync(tokenResult.Data.OsClient, request?.Id).ConfigureAwait(false);
            if (item == null || item["IsSecret"]?.Val<int>() != 1)
                return Json(new DosResult(0, null, "Secret 设置不存在。"));
            return Json(new DosResult(1, new
            {
                Purpose = "RevealSystemSetting",
                ActionHash = TenantSystemSettingsSecurity.ComputeRevealActionHash(tokenResult.Data.OsClient, request.Id)
            }));
        }

        [HttpPost]
        public async Task<JsonResult> Reveal([FromBody] SettingMutationRequest request)
        {
            var tokenResult = await RequireAdministratorAsync().ConfigureAwait(false);
            if (tokenResult.Code != 1) return Json(tokenResult);
            Response.Headers.CacheControl = "no-store";
            Response.Headers.Pragma = "no-cache";
            var item = await FindSettingByIdAsync(tokenResult.Data.OsClient, request?.Id).ConfigureAwait(false);
            if (item == null || item["IsSecret"]?.Val<int>() != 1)
                return Json(new DosResult(0, null, "Secret 设置不存在。"));
            var actionHash = TenantSystemSettingsSecurity.ComputeRevealActionHash(tokenResult.Data.OsClient, request.Id);
            var ticketResult = await IdentityVerificationSecurity.ConsumeTicketAsync(
                tokenResult.Data.OsClient,
                tokenResult.Data.CurrentUser["Id"]?.ToString(),
                request?.Ticket,
                "RevealSystemSetting",
                actionHash).ConfigureAwait(false);
            if (ticketResult.Code != 1) return Json(ticketResult);
            try
            {
                var plainText = TenantSystemSettingsSecurity.UnprotectSecret(
                    tokenResult.Data.OsClient,
                    item["ConfigKey"]?.ToString(),
                    item["SecretCipher"]?.ToString());
                QueueAudit(tokenResult.Data, "RevealTenantSystemSetting", true, request.Id, item["ConfigKey"]?.ToString());
                return Json(new DosResult(1, new { Value = plainText, ClearAfterSeconds = 30 }));
            }
            catch
            {
                QueueAudit(tokenResult.Data, "RevealTenantSystemSetting", false, request?.Id, item["ConfigKey"]?.ToString());
                return Json(new DosResult(0, null, "Secret 无法解密，请重新填写并保存。"));
            }
        }

        [HttpPost]
        public async Task<JsonResult> Delete([FromBody] SettingMutationRequest request)
        {
            var tokenResult = await RequireAdministratorAsync().ConfigureAwait(false);
            if (tokenResult.Code != 1) return Json(tokenResult);
            var item = await FindSettingByIdAsync(tokenResult.Data.OsClient, request?.Id).ConfigureAwait(false);
            if (item == null) return Json(new DosResult(0, null, "设置不存在。"));
            var result = await MicroiEngine.FormEngine.DelFormDataAsync(TenantSystemSettingsSecurity.TableName, new
            {
                Id = request.Id,
                OsClient = tokenResult.Data.OsClient
            }).ConfigureAwait(false);
            QueueAudit(tokenResult.Data, "DeleteTenantSystemSetting", result.Code == 1, request.Id, item["ConfigKey"]?.ToString());
            return Json(result);
        }

        private static async Task<DosResult<CurrentToken>> RequireAdministratorAsync()
        {
            var token = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            if (token?.CurrentUser == null)
                return new DosResult<CurrentToken>(1001, null, "登录身份已过期。请重新登录。");
            if (UserAccessKeySecurity.IsSession(token.CurrentUser))
                return new DosResult<CurrentToken>(0, null, "访问密钥会话不能管理系统 Secret。");
            if ((token.CurrentUser["Level"]?.Val<int>() ?? 0) < 999)
                return new DosResult<CurrentToken>(0, null, "只有超级管理员可以管理租户系统设置。");
            return new DosResult<CurrentToken>(1, token);
        }

        private static async Task<JObject> FindSettingAsync(string osClient, string id, string key)
        {
            if (!id.DosIsNullOrWhiteSpace()) return await FindSettingByIdAsync(osClient, id).ConfigureAwait(false);
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync(TenantSystemSettingsSecurity.TableName, new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "ConfigKey", Type = "=", Value = key },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private static async Task<JObject> FindSettingByIdAsync(string osClient, string id)
        {
            if (id.DosIsNullOrWhiteSpace()) return null;
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync(TenantSystemSettingsSecurity.TableName, new
                {
                    Id = id,
                    OsClient = osClient
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private static string NormalizeText(string value, int maxLength)
        {
            var text = new string((value ?? string.Empty).Where(ch => !char.IsControl(ch)).ToArray()).Trim();
            return text.Length <= maxLength ? text : text.Substring(0, maxLength);
        }

        private static void QueueAudit(CurrentToken token, string action, bool success, string id, string key)
        {
            MicroiEngine.QueueSysLog(new SysLogParam
            {
                OsClient = token?.OsClient,
                UserId = token?.CurrentUser?["Id"]?.ToString(),
                UserName = token?.CurrentUser?["Name"]?.ToString(),
                Category = "Security",
                Action = action,
                Source = "TenantSystemSettings",
                TargetType = "SystemSetting",
                Success = success,
                OccurredAt = DateTime.Now,
                Type = "安全审计",
                Title = action,
                Content = JsonConvert.SerializeObject(new { Success = success, SettingId = id, ConfigKey = key }),
                Level = success ? 1 : 2
            });
        }
    }
}
