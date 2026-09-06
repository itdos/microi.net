using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>实际实现的媒体协议能力目录，不能把任意聊天模型当作图片/音乐模型。</summary>
    public static class AiMediaModelSupport
    {
        public static string Protocol(string model)
        {
            var value = (model ?? "").Trim().ToLowerInvariant();
            if (value == "image-01" || value == "image-01-live") return "minimax-image";
            if (value == "minimax-code-image") return "minimax-connector-image";
            if (value.StartsWith("gpt-image-", StringComparison.Ordinal)) return "openai-image";
            if (value.StartsWith("music-", StringComparison.Ordinal)) return "minimax-music";
            if (value.StartsWith("speech-", StringComparison.Ordinal)) return "minimax-speech";
            if (value.StartsWith("minimax-hailuo-", StringComparison.Ordinal)
                || value.StartsWith("t2v-", StringComparison.Ordinal) || value.StartsWith("i2v-", StringComparison.Ordinal)) return "minimax-video";
            return null;
        }

        public static JArray ModelsForConfiguredRecord(string model)
        {
            // 旧版把 MiniMax 全媒体账号登记在 M3 聊天模型行；只在服务端目录中兼容展开，
            // 浏览器始终提交实际媒体模型，并保留用户明确选择的 mic_ai.Id。
            var models = string.Equals(model, "MiniMax-M3", StringComparison.OrdinalIgnoreCase)
                ? new[] { "image-01", "image-01-live", "music-3.0", "speech-2.8-hd", "MiniMax-Hailuo-2.3", "MiniMax-Hailuo-2.3-Fast", "MiniMax-Hailuo-02" }
                : new[] { model };
            return new JArray(models.Where(x => Protocol(x) != null).Select(Describe));
        }

        public static JObject Describe(string model)
        {
            var protocol = Protocol(model);
            var capability = protocol?.Substring(protocol.LastIndexOf('-') + 1);
            return new JObject
            {
                ["Id"] = model, ["Name"] = model, ["Capability"] = capability,
                ["Protocol"] = protocol, ["SupportsReferences"] = capability == "image",
                ["SupportsExactDimensions"] = model == "image-01",
                ["ReferenceMode"] = protocol == "minimax-image" ? "character-redraw" : capability == "image" ? "image-edit" : "",
                ["MaxReferenceCount"] = protocol == "minimax-image" ? 1 : capability == "image" ? 4 : 0,
                ["MaxCount"] = capability == "image" ? 4 : 1
            };
        }

        /// <summary>显式目录优先；协议与模型名分离，新增供应商无需修改前端白名单。</summary>
        public static JArray ConfiguredModels(string model, string defaultProtocol, string json)
        {
            defaultProtocol = defaultProtocol?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(json))
            {
                if ((defaultProtocol == "openai-image" || defaultProtocol == "minimax-connector-image") && IsValidModelId(model))
                    return new JArray(ProjectDescriptor(model, model, "image", defaultProtocol));
                return ModelsForConfiguredRecord(model);
            }
            if (json.Length > 65536) throw new InvalidOperationException("媒体模型目录超过 64KB。");
            JArray source;
            try { source = JArray.Parse(json); }
            catch { throw new InvalidOperationException("媒体模型目录必须为 JSON 数组。"); }
            if (source.Count > 50) throw new InvalidOperationException("一条 AI 引擎最多配置 50 个媒体模型。");
            var result = new JArray();
            var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in source.OfType<JObject>())
            {
                var id = item["Id"]?.ToString()?.Trim();
                var capability = item["Capability"]?.ToString()?.Trim().ToLowerInvariant();
                var protocol = item["Protocol"]?.ToString()?.Trim().ToLowerInvariant();
                if (!IsValidModelId(id) || !ids.Add(id)
                    || !new[] { "image", "music", "video", "speech" }.Contains(capability))
                    throw new InvalidOperationException("媒体目录的 Id 必须唯一且 Capability 为 image/music/video/speech。");
                if (string.IsNullOrEmpty(protocol)) protocol = defaultProtocol;
                if (protocol == "minimax") protocol = "minimax-" + capability;
                if (string.IsNullOrWhiteSpace(protocol) || protocol == "auto") protocol = Protocol(id);
                result.Add(ProjectDescriptor(id, item["Name"]?.ToString(), capability, protocol));
            }
            if (result.Count != source.Count) throw new InvalidOperationException("媒体目录的每一项必须是模型对象。");
            return result;
        }

        public static JObject ProjectDescriptor(string id, string name, string capability, string protocol)
        {
            var supported = IsValidModelId(id) && ((protocol == "minimax-" + capability && new[] { "image", "music", "video", "speech" }.Contains(capability))
                || (new[] { "openai-image", "minimax-connector-image" }.Contains(protocol) && capability == "image"));
            return new JObject
            {
                ["Id"] = id, ["Name"] = string.IsNullOrWhiteSpace(name) ? id : name.Substring(0, Math.Min(100, name.Length)),
                ["Capability"] = capability, ["Protocol"] = protocol, ["Supported"] = supported,
                ["SupportsReferences"] = capability == "image", ["SupportsExactDimensions"] = id == "image-01",
                ["ReferenceMode"] = protocol == "minimax-image" ? "character-redraw" : capability == "image" ? "image-edit" : "",
                ["MaxReferenceCount"] = protocol == "minimax-image" ? 1 : capability == "image" ? 4 : 0,
                ["MaxCount"] = capability == "image" ? 4 : 1,
                // Connector 目录没有暴露底层图像模型；Id 是工具路由名，不冒充 M3 生图模型。
                ["ModelIdentity"] = protocol == "minimax-connector-image" ? "provider-tool" : "model",
                ["Resolutions"] = new JArray(protocol == "minimax-connector-image" ? new[] { "1K", "2K", "4K" } : Array.Empty<string>()),
                ["AspectRatios"] = new JArray(protocol == "openai-image" ? new[] { "1:1", "3:2", "2:3" }
                    : protocol == "minimax-connector-image" ? new[] { "1:1", "16:9", "9:16", "4:3", "3:4", "21:9" }
                    : id == "image-01-live" ? new[] { "1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16" }
                    : new[] { "1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9" })
            };
        }

        public static bool IsValidModelId(string model)
            => model != null && Regex.IsMatch(model, @"^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$");

        /// <summary>调用供应商之前校验真实协议规格，不能让前端尺寸选项制造虚假的精确编辑承诺。</summary>
        public static string ValidateImageSettings(MiniMaxImageGenerateParam request, string protocol)
        {
            if (request == null) return "图片参数不能为空。";
            if (protocol == "minimax-image" && (request.ReferenceImages?.Count ?? 0) > 1)
                return "所选 MiniMax 图像模型只支持一张人物参考图；多图编辑请使用支持该能力的图像编辑模型。";
            if (protocol == "minimax-image" && RequiresImageEditing(request.Operation))
                return "所选 MiniMax 图像模型支持人物参考重绘，不能执行当前局部/结构编辑。请在 AI 引擎中配置并选择支持图像编辑的模型。";
            if (request.Width.HasValue && (request.Model != "image-01" || protocol != "minimax-image"))
                return "所选模型不支持自定义宽高，请使用模型支持的图片比例。";
            if (request.Model == "image-01-live" && request.AspectRatio == "21:9")
                return "image-01-live 不支持 21:9，请选择其它比例。";
            if (protocol == "openai-image" && !new[] { "1:1", "3:2", "2:3" }.Contains(request.AspectRatio ?? "1:1"))
                return "当前 GPT Image 协议支持 1:1、3:2、2:3 比例。";
            if (protocol == "minimax-connector-image" && !new[] { "1:1", "16:9", "9:16", "4:3", "3:4", "21:9" }.Contains(request.AspectRatio ?? "1:1"))
                return "MiniMax Code 图片工具支持 1:1、16:9、9:16、4:3、3:4、21:9 比例。";
            if (!string.IsNullOrWhiteSpace(request.Resolution) && protocol != "minimax-connector-image")
                return "所选图片协议不支持 Resolution，请按模型目录选择参数。";
            if (protocol == "minimax-connector-image" && request.Seed.HasValue)
                return "MiniMax Code 图片工具没有开放 Seed 参数。";
            return null;
        }

        // 人物参考 API 没有局部蒙版、场景保持或物体编辑契约；不能仅凭提示词把这些工具伪装成已支持。
        public static bool RequiresImageEditing(string operation)
            => new[] { "sketch-to-image", "upscale", "erase", "outpaint", "remove-watermark",
                "background-replace", "colorize", "restore", "remove-background", "product-scene",
                "multi-composite", "relight" }.Contains((operation ?? "").Trim().ToLowerInvariant());

        public static bool Allows(string configuredModel, string requestedModel, string capability)
            => ModelsForConfiguredRecord(configuredModel).OfType<JObject>().Any(x =>
                string.Equals(x["Id"]?.ToString(), requestedModel, StringComparison.OrdinalIgnoreCase)
                && x["Capability"]?.ToString() == capability);

        public static bool IsGateway(string name, string model)
            => new[] { name, model }.Any(x => string.Equals(x, "Microi.AI中转站", StringComparison.OrdinalIgnoreCase));
    }
}
