using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>只供未安装上传接口引擎的旧平台兜底，契约与官方 V8 回归样例保持一致。</summary>
    public static class LegacyUploadResponse
    {
        public static bool IsEnabled(object value)
        {
            var text = Convert.ToString(value)?.Trim();
            return text == "1" || string.Equals(text, "true", StringComparison.OrdinalIgnoreCase);
        }

        public static DosResult Apply(DosResult result, bool enabled)
        {
            if (!enabled || result?.Code != 1 || result.Data == null) return result;
            var data = JToken.FromObject(result.Data);
            var rows = data is JArray array ? array.OfType<JObject>()
                : data is JObject row ? new[] { row } : Enumerable.Empty<JObject>();
            foreach (var item in rows)
            {
                var name = Convert.ToString(item["Name"] ?? item["name"]) ?? "";
                var dot = name.LastIndexOf('.');
                var extension = dot < 0 ? "" : name.Substring(dot + 1).ToLowerInvariant();
                // 小写 url 必须来自实际上传结果；私有文件不能拼接 FileServer 绕过授权。
                item["url"] = item["Url"]?.DeepClone() ?? item["url"]?.DeepClone() ?? "";
                item["type"] = new[] { "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "avif", "heic" }.Contains(extension) ? "image"
                    : new[] { "mp4", "mov", "m4v", "webm", "avi", "mkv", "3gp" }.Contains(extension) ? "video"
                    : new[] { "mp3", "wav", "ogg", "m4a", "aac", "flac", "amr" }.Contains(extension) ? "audio" : "file";
                item["size"] = item["Size"]?.DeepClone() ?? item["size"]?.DeepClone() ?? 0;
                item["duration"] = item["Duration"]?.DeepClone() ?? item["duration"]?.DeepClone() ?? 0;
                item["uploading"] = false;
                item["progress"] = 100;
                item["path"] = item["Path"]?.DeepClone() ?? item["path"]?.DeepClone() ?? "";
                item["name"] = dot > 0 ? name.Substring(0, dot) : name;
                item["id"] = item["Id"]?.DeepClone() ?? item["id"]?.DeepClone() ?? "";
            }
            // 旧移动端以数组读取上传结果；兼容开启后单文件同样返回一项数组。
            result.Data = data is JObject ? new JArray(data) : data;
            return result;
        }
    }
}
