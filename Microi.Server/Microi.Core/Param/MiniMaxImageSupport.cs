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
        public string Resolution { get; set; }
        public int Count { get; set; }
        public string Operation { get; set; }
        public IReadOnlyList<NormalizedMiniMaxImageReference> ReferenceImages { get; set; }
        public int? Width { get; set; }
        public int? Height { get; set; }
        public long? Seed { get; set; }
        public string PostProcess { get; set; }
        public string RequestBody { get; set; }
        public string Fingerprint { get; set; }
    }

    public sealed class NormalizedMiniMaxImageReference
    {
        public string FileName { get; set; }
        public byte[] Bytes { get; set; }
        public string Extension { get; set; }
        public string ContentType { get; set; }
        public string Sha256 { get; set; }
    }

    /// <summary>MiniMax 图片生成参数白名单与确定性语义识别。</summary>
    public static class MiniMaxImageSupport
    {
        /// <summary>图片 API 只接受供应商官方 HTTPS 源；不能借模型配置形成任意 URL 请求。</summary>
        public static bool IsOfficialApiOrigin(Uri uri)
        {
            return uri != null && uri.Scheme == Uri.UriSchemeHttps && uri.IsDefaultPort
                && string.IsNullOrEmpty(uri.UserInfo)
                && (string.Equals(uri.Host, "api.minimaxi.com", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(uri.Host, "api.minimax.cn", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(uri.Host, "api.minimax.io", StringComparison.OrdinalIgnoreCase));
        }

        private static readonly HashSet<string> AllowedAspectRatios = new HashSet<string>(StringComparer.Ordinal)
        {
            "1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"
        };
        private static readonly HashSet<string> AllowedOperations = new HashSet<string>(StringComparer.Ordinal)
        {
            "text-to-image", "image-to-image", "upscale", "erase", "outpaint",
            "remove-watermark", "id-photo", "multi-composite", "redraw",
            "remove-background", "background-replace", "colorize", "restore",
            "portrait-retouch", "product-scene", "relight", "style-transfer",
            "poster", "avatar", "logo", "sketch-to-image"
        };
        private static readonly HashSet<string> ReferenceRequiredOperations = new HashSet<string>(StringComparer.Ordinal)
        {
            "image-to-image", "upscale", "erase", "outpaint", "remove-watermark",
            "id-photo", "multi-composite", "redraw", "remove-background",
            "background-replace", "colorize", "restore", "portrait-retouch",
            "product-scene", "relight", "style-transfer", "avatar", "sketch-to-image"
        };
        private const int MaxReferenceCount = 4;
        private const int MaxReferenceBytes = 10 * 1024 * 1024;
        private const int MaxReferenceTotalBytes = 24 * 1024 * 1024;

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
            var model = (param.Model ?? "image-01").Trim();
            if (!Regex.IsMatch(model, @"^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$"))
            {
                error = "所选模型尚未接入图片协议，请在 AI 引擎中选择支持图片的模型。";
                return false;
            }
            var aspectRatio = (param.AspectRatio ?? "1:1").Trim();
            if (!AllowedAspectRatios.Contains(aspectRatio))
            {
                error = "图片比例只允许 1:1、16:9、4:3、3:2、2:3、3:4、9:16 或 21:9。";
                return false;
            }
            var count = param.Count == 0 ? 1 : param.Count;
            var resolution = param.Resolution?.Trim().ToUpperInvariant();
            if (!string.IsNullOrEmpty(resolution) && !new[] { "1K", "2K", "4K" }.Contains(resolution))
            {
                error = "图片分辨率档位只支持 1K、2K、4K。";
                return false;
            }
            if (count < 1 || count > 4)
            {
                error = "单次对话只允许生成 1-4 张图片。";
                return false;
            }

            var operation = (param.Operation ?? "text-to-image").Trim().ToLowerInvariant();
            if (!AllowedOperations.Contains(operation))
            {
                error = "当前不支持该 AI 图片工具。";
                return false;
            }
            var references = new List<NormalizedMiniMaxImageReference>();
            var sourceReferences = param.ReferenceImages ?? new List<MiniMaxImageReferenceParam>();
            if (sourceReferences.Count > MaxReferenceCount)
            {
                error = $"单次最多允许 {MaxReferenceCount} 张参考图。";
                return false;
            }
            long referenceTotalBytes = 0;
            for (var index = 0; index < sourceReferences.Count; index++)
            {
                var source = sourceReferences[index];
                if (!TryDecodeReference(source, out var reference, out var referenceError))
                {
                    error = $"第 {index + 1} 张参考图无效：{referenceError}";
                    return false;
                }
                referenceTotalBytes += reference.Bytes.LongLength;
                if (referenceTotalBytes > MaxReferenceTotalBytes)
                {
                    error = $"参考图合计不能超过 {MaxReferenceTotalBytes / 1024 / 1024} MB。";
                    return false;
                }
                references.Add(reference);
            }
            if (ReferenceRequiredOperations.Contains(operation) && references.Count == 0)
            {
                error = "当前图片工具至少需要上传一张参考图。";
                return false;
            }
            if (operation == "text-to-image" && references.Count > 0)
            {
                error = "文生图不接收参考图，请切换到图生图或其它编辑工具。";
                return false;
            }
            if (operation == "multi-composite" && references.Count < 2)
            {
                error = "多图合成至少需要两张参考图。";
                return false;
            }

            int? width = param.Width;
            int? height = param.Height;
            if (width.HasValue != height.HasValue)
            {
                error = "自定义图片尺寸必须同时提供 Width 和 Height。";
                return false;
            }
            if (width.HasValue && (width.Value < 512 || width.Value > 2048 || width.Value % 8 != 0
                || height.Value < 512 || height.Value > 2048 || height.Value % 8 != 0))
            {
                error = "自定义图片宽高必须为 512-2048 之间且能被 8 整除。";
                return false;
            }
            var postProcess = (param.PostProcess ?? string.Empty).Trim().ToLowerInvariant();
            if (postProcess != string.Empty && postProcess != "remove-solid-background")
            {
                error = "当前不支持该图片后处理方式。";
                return false;
            }

            var body = new JObject
            {
                ["model"] = model,
                ["prompt"] = prompt,
                ["aspect_ratio"] = aspectRatio,
                ["response_format"] = "base64",
                ["n"] = count,
                // 参考图编辑必须保留用户操作语义，避免提示词扩写器把“移除”等命令改成新场景。
                ["prompt_optimizer"] = references.Count == 0,
                ["aigc_watermark"] = false
            };
            if (width.HasValue)
            {
                body.Remove("aspect_ratio");
                body["width"] = width.Value;
                body["height"] = height.Value;
            }
            if (param.Seed.HasValue) body["seed"] = param.Seed.Value;
            var requestBody = body.ToString(Formatting.None);
            var fingerprintSource = new JObject
            {
                ["request"] = body,
                ["operation"] = operation,
                ["post_process"] = postProcess,
                ["reference_sha256"] = new JArray(references.Select(item => item.Sha256))
            };
            // 旧客户端省略该字段时保持历史指纹；显式切换路由必须成为另一份请求。
            if (!string.IsNullOrWhiteSpace(param.AiModelId)) fingerprintSource["ai_model_id"] = param.AiModelId.Trim();
            if (!string.IsNullOrEmpty(resolution)) fingerprintSource["resolution"] = resolution;
            normalized = new NormalizedMiniMaxImageRequest
            {
                RequestId = requestId,
                Prompt = prompt,
                Model = model,
                AspectRatio = aspectRatio,
                Resolution = resolution,
                Count = count,
                Operation = operation,
                ReferenceImages = references,
                Width = width,
                Height = height,
                Seed = param.Seed,
                PostProcess = postProcess,
                RequestBody = requestBody,
                Fingerprint = Sha256(fingerprintSource.ToString(Formatting.None))
            };
            return true;
        }

        private static bool TryDecodeReference(
            MiniMaxImageReferenceParam source,
            out NormalizedMiniMaxImageReference reference,
            out string error)
        {
            reference = null;
            error = null;
            if (source == null || string.IsNullOrWhiteSpace(source.DataUrl))
            {
                error = "图片内容不能为空。";
                return false;
            }
            var value = source.DataUrl.Trim();
            var commaIndex = value.IndexOf(',');
            if (!value.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase) || commaIndex < 0
                || value.Substring(0, commaIndex).IndexOf(";base64", StringComparison.OrdinalIgnoreCase) < 0)
            {
                error = "只允许 image Data URL。";
                return false;
            }
            var encoded = value.Substring(commaIndex + 1);
            if (encoded.Length > ((long)MaxReferenceBytes + 2L) / 3L * 4L + 4096L)
            {
                error = $"单张图片不能超过 {MaxReferenceBytes / 1024 / 1024} MB。";
                return false;
            }
            byte[] bytes;
            try { bytes = Convert.FromBase64String(Regex.Replace(encoded, @"\s+", string.Empty)); }
            catch
            {
                error = "Base64 格式不正确。";
                return false;
            }
            if (bytes.Length == 0 || bytes.Length > MaxReferenceBytes)
            {
                error = $"单张图片必须大于 0 且不能超过 {MaxReferenceBytes / 1024 / 1024} MB。";
                return false;
            }
            if (!TryResolveImageFormat(bytes, out var extension, out var contentType))
            {
                error = "只允许 JPEG、PNG 或 WebP 图片。";
                return false;
            }
            var safeStem = Regex.Replace(
                System.IO.Path.GetFileNameWithoutExtension(source.FileName ?? string.Empty),
                @"[^A-Za-z0-9._-]+",
                "-").Trim('-', '.');
            if (string.IsNullOrWhiteSpace(safeStem)) safeStem = "reference";
            if (safeStem.Length > 60) safeStem = safeStem.Substring(0, 60);
            reference = new NormalizedMiniMaxImageReference
            {
                FileName = $"{safeStem}.{extension}",
                Bytes = bytes,
                Extension = extension,
                ContentType = contentType,
                Sha256 = Sha256(bytes)
            };
            return true;
        }

        private static bool TryResolveImageFormat(byte[] bytes, out string extension, out string contentType)
        {
            extension = null;
            contentType = null;
            if (bytes == null || bytes.Length < 12) return false;
            if (bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff)
            {
                extension = "jpg";
                contentType = "image/jpeg";
                return true;
            }
            if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4e && bytes[3] == 0x47)
            {
                extension = "png";
                contentType = "image/png";
                return true;
            }
            if (bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F'
                && bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P')
            {
                extension = "webp";
                contentType = "image/webp";
                return true;
            }
            return false;
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

        private static string Sha256(byte[] value)
        {
            using var sha = SHA256.Create();
            return string.Concat(sha.ComputeHash(value ?? Array.Empty<byte>())
                .Select(item => item.ToString("x2")));
        }
    }
}
