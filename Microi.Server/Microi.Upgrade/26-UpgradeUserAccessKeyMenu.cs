using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Moves the system-account access-key entry into sys_menu.MoreBtns.
    /// The button uses the platform's generic custom-component dialog host,
    /// while tenant/module configuration owns where and whether it is rendered.
    /// </summary>
    public sealed class Upgrade26
    {
        public static string Version = "6.9.8.1";
        public const string SystemAccountMenuId = "33441a33-de79-4e8a-ae65-b96175e1d334";
        public const string AccessKeyButtonId = "c79d5af2-d364-4d96-8d16-3e170c979f11";

        public const string AccessKeyButtonCode = @"var user = V8.Form || {};
if (!user.Id) {
  V8.Tips(""缺少用户Id，无法管理访问密钥。"", false);
  return;
}

V8.OpenDialog({
  ComponentName: ""UserAccessKeyPanel"",
  Title: ""访问密钥 - "" + (user.Name || user.Account || """"),
  TitleIcon: ""fas fa-key"",
  Width: ""min(980px, calc(100vw - 32px))"",
  OpenType: ""Dialog"",
  DataAppend: { User: user }
});";

        public const string AccessKeyButtonShowCode = @"var currentUser = V8.CurrentUser || {};
var currentUserId = String(currentUser.Id || """").toLowerCase();
var targetUserId = String((V8.Form && V8.Form.Id) || """").toLowerCase();
V8.Result = typeof V8.OpenDialog === ""function""
  && currentUser._AccessKeySession !== true
  && !!targetUserId
  && (currentUser._IsAdmin === true
    || Number(currentUser.Level || 0) >= 9999
    || currentUserId === targetUserId);";

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var menuResult = await MicroiEngine.FormEngine.GetFormDataAsync(
                    "sys_menu",
                    new
                    {
                        OsClient = osClient,
                        Id = SystemAccountMenuId,
                        _SelectFields = new[] { "Id", "ModuleEngineKey", "MoreBtns" }
                    });
                if (menuResult.Code != 1 || menuResult.Data == null)
                {
                    messages.Add("系统账号模块不存在，无法安装访问密钥动态按钮。");
                    return messages;
                }

                JObject menu = JsonHelper.ToJObject((object)menuResult.Data) ?? new JObject();
                var moreButtons = ReconcileMoreButtons(menu["MoreBtns"].Val<string>(), out var changed);
                if (!changed) return messages;

                UpgradeExecutionLeaseContext.ThrowIfLost();
                var updateResult = await UpgradeTrustedFormEngine.UpdateAsync(
                    "sys_menu",
                    osClient,
                    new JObject
                    {
                        ["Id"] = SystemAccountMenuId,
                        ["OsClient"] = osClient,
                        ["MoreBtns"] = moreButtons
                    });
                if (updateResult.Code != 1)
                {
                    messages.Add("安装系统账号访问密钥动态按钮失败：" + updateResult.Msg);
                    return messages;
                }

                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_menu:{SystemAccountMenuId.ToLowerInvariant()}");
                var moduleEngineKey = menu["ModuleEngineKey"].Val<string>();
                if (!moduleEngineKey.DosIsNullOrWhiteSpace())
                {
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_menu:{moduleEngineKey.ToLowerInvariant()}");
                }
            }
            catch (Exception ex)
            {
                messages.Add("安装系统账号访问密钥动态按钮失败：" + ex.Message);
            }
            return messages;
        }

        public static string ReconcileMoreButtons(string currentJson, out bool changed)
        {
            JArray buttons;
            if (string.IsNullOrWhiteSpace(currentJson))
            {
                buttons = new JArray();
            }
            else
            {
                JToken parsed;
                try
                {
                    parsed = JToken.Parse(currentJson);
                }
                catch (JsonException ex)
                {
                    throw new FormatException("系统账号 MoreBtns 不是有效 JSON，已停止写入以保护现有按钮。", ex);
                }
                buttons = parsed as JArray
                    ?? throw new FormatException("系统账号 MoreBtns 必须是 JSON 数组，已停止写入以保护现有按钮。");
            }

            var canonical = BuildAccessKeyButton();
            var matches = buttons
                .OfType<JObject>()
                .Where(IsAccessKeyButton)
                .ToList();
            if (matches.Count == 1 && JToken.DeepEquals(matches[0], canonical))
            {
                changed = false;
                return currentJson;
            }

            foreach (var match in matches)
            {
                match.Remove();
            }
            buttons.Add(canonical);
            changed = true;
            return buttons.ToString(Formatting.None);
        }

        public static JObject BuildAccessKeyButton()
        {
            return new JObject
            {
                ["Id"] = AccessKeyButtonId,
                ["Sort"] = 88,
                ["Name"] = "访问密钥",
                ["Icon"] = "fas fa-key",
                ["BtnStyle"] = "warning",
                ["IsVisible"] = true,
                ["ShowRow"] = true,
                ["V8CodeShow"] = AccessKeyButtonShowCode,
                ["V8Code"] = AccessKeyButtonCode
            };
        }

        private static bool IsAccessKeyButton(JObject button)
        {
            if (string.Equals(
                button["Id"].Val<string>(),
                AccessKeyButtonId,
                StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (!string.Equals(button["Name"].Val<string>(), "访问密钥", StringComparison.Ordinal))
            {
                return false;
            }

            var code = button["V8Code"].Val<string>();
            return code.IndexOf("OpenUserAccessKeys", StringComparison.Ordinal) >= 0
                || code.IndexOf("UserAccessKeyPanel", StringComparison.Ordinal) >= 0;
        }
    }
}
