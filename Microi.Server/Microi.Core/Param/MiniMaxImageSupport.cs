using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.net
{
    public sealed class NormalizedMiniMaxImageRequest
    {
        public string RequestId { get; set; }
        public string Prompt { get; set; }
        public string Model { get; set; }
        public string AspectRatio { get; set; }
        public int Count { get; set; }
        public string RequestBody { get; set; }
        public string Fingerprint { get; set; }
    }

    /// <summary>MiniMax 图片生成参数白名单与确定性语义识别。</summary>
    public static class MiniMaxImageSupport
    {
        private static readonly HashSet<string> AllowedAspectRatios = new HashSet<string>(StringComparer.Ordinal)
        {
            "1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"
        };

        public static bool LooksLikeImageGeneration(string value)
        {
            var text = CollapseWhitespace(value);
            if (string.IsNullOrWhiteSpace(text)) return false;
            return Regex.IsMatch(
                text,
                @"(生成|画|绘制|制作|创作|做|来|给我|帮我).{0,12}(一[张幅副]|[张幅副])?.{0,8}(图片|图像|照片|海报|插画|头像|壁纸|美女图|人物图)",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)
                || Regex.IsMatch(text, @"(文生图|text[- ]?to[- ]?image|image generation)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        }

        public static bool TryNormalize(
            MiniMaxImageGenerateParam param,
            out NormalizedMiniMaxImageRequest normalized,
            out string error)
        {
            normalized = null;
            error = null;
            if (param == null)
            {
                error = "MiniMax 图片参数不能为空。";
                return false;
            }

            var requestId = (param.RequestId ?? string.Empty).Trim();
            if (requestId.Length < 8 || requestId.Length > 160
                || requestId.Any(ch => !(char.IsLetterOrDigit(ch) || ".:_-".Contains(ch))))
            {
                error = "RequestId 只允许 8-160 位字母、数字、点、下划线、冒号或短横线。";
                return false;
            }
            var prompt = CollapseWhitespace(param.Prompt);
            if (prompt.Length < 1 || prompt.Length > 1500)
            {
                error = "图片描述长度必须为 1-1500 个字符。";
                return false;
            }
            var model = (param.Model ?? "image-01").Trim().ToLowerInvariant();
            if (model != "image-01")
            {
                error = "当前对话图片生成只允许 image-01。";
                return false;
            }
            var aspectRatio = (param.AspectRatio ?? "1:1").Trim();
            if (!AllowedAspectRatios.Contains(aspectRatio))
            {
                error = "图片比例只允许 1:1、16:9、4:3、3:2、2:3、3:4、9:16 或 21:9。";
                return false;
            }
            var count = param.Count == 0 ? 1 : param.Count;
            if (count < 1 || count > 4)
            {
                error = "单次对话只允许生成 1-4 张图片。";
                return false;
            }

            var body = new JObject
            {
                ["model"] = model,
                ["prompt"] = prompt,
                ["aspect_ratio"] = aspectRatio,
                ["response_format"] = "base64",
                ["n"] = count,
                ["prompt_optimizer"] = true,
                ["aigc_watermark"] = false
            }.ToString(Formatting.None);
            normalized = new NormalizedMiniMaxImageRequest
            {
                RequestId = requestId,
                Prompt = prompt,
                Model = model,
                AspectRatio = aspectRatio,
                Count = count,
                RequestBody = body,
                Fingerprint = Sha256(body)
            };
            return true;
        }

        public static string BuildIdempotencyKey(string osClient, string userId, string requestId)
        {
            return $"Microi:{NormalizeSegment(osClient)}:Ai:MiniMaxImage:{Sha256(userId)}:{Sha256(requestId)}";
        }

        private static string CollapseWhitespace(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            return Regex.Replace(value.Trim(), @"[\s\p{Cc}]+", " ");
        }

        private static string NormalizeSegment(string value)
        {
            var text = (value ?? string.Empty).Trim().ToLowerInvariant();
            return string.IsNullOrWhiteSpace(text) ? "unknown" : text;
        }

        private static string Sha256(string value)
        {
            using var sha = SHA256.Create();
            return string.Concat(sha.ComputeHash(Encoding.UTF8.GetBytes(value ?? string.Empty))
                .Select(item => item.ToString("x2")));
        }
    }
}
