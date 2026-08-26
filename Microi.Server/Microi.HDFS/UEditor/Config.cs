using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// UEditor 请求级配置。租户配置通过 FormEngine 获取，不使用跨租户静态缓存；
    /// 本地 JSON 只作为缺少历史字段时的兼容默认值。
    /// </summary>
    public static class UeditorConfig
    {
        public static string ConfigFilePath { get; set; } =
            Path.Combine(AppContext.BaseDirectory, "wwwroot", "ueditor.json");

        public static async Task<JObject> LoadForTenantAsync(string osClient)
        {
            var tenant = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            var configResult = await MicroiEngine.FormEngine.GetSysConfig(tenant)
                .ConfigureAwait(false);
            if (configResult?.Code == 1 && configResult.Data != null)
            {
                var data = JsonHelper.ToJObject((object)configResult.Data);
                var value = data?.Properties().FirstOrDefault(property =>
                    string.Equals(
                        property.Name,
                        "UEditorConfig",
                        StringComparison.OrdinalIgnoreCase))?.Value;
                var raw = value?.Type == JTokenType.Object
                    ? value.ToString(Formatting.None)
                    : value?.ToString();
                if (!raw.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        return JObject.Parse(raw);
                    }
                    catch (JsonException)
                    {
                        throw new InvalidOperationException(
                            "当前租户系统设置中的 UEditorConfig 不是合法 JSON。");
                    }
                }
            }

            if (File.Exists(ConfigFilePath))
            {
                return JObject.Parse(await File.ReadAllTextAsync(ConfigFilePath)
                    .ConfigureAwait(false));
            }
            throw new InvalidOperationException(
                "未找到 UEditor 配置；请在系统设置中维护 UEditorConfig，或部署兼容 ueditor.json。");
        }

        public static string[] GetStringList(JObject items, string key)
        {
            return (items?[key] as JArray)?.Values<string>()
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .ToArray() ?? Array.Empty<string>();
        }

        public static string GetString(JObject items, string key)
        {
            return items?[key].Val<string>() ?? string.Empty;
        }

        public static int GetInt(JObject items, string key)
        {
            return items?[key].Val<int>() ?? 0;
        }
    }
}
