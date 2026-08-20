using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.net
{
    public sealed class NormalizedMiniMaxMusicRequest
    {
        public string RequestId { get; set; }
        public string Prompt { get; set; }
        public string Model { get; set; }
        public int SampleRate { get; set; }
        public int Bitrate { get; set; }
        public string Format { get; set; }
        public string RequestBody { get; set; }
        public string Fingerprint { get; set; }
    }

    /// <summary>
    /// MiniMax 配乐参数白名单。首期能力有意只开放纯音乐 MP3，避免歌词、翻唱
    /// 参考音频和版权边界被普通 V8 调用绕过。
    /// </summary>
    public static class MiniMaxMusicSupport
    {
        public static bool LooksLikeMusicGeneration(string value)
        {
            var text = CollapseWhitespace(value);
            if (string.IsNullOrWhiteSpace(text)) return false;
            var hasMusicTarget = Regex.IsMatch(
                text,
                @"(音乐|歌曲|配乐|背景音乐|纯音乐|旋律|伴奏|bgm)",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            var hasGenerationAction = Regex.IsMatch(
                text,
                @"(生成|创作|制作|作曲|谱曲|编曲|写一首|来一首|做一首|给我一首|帮我.{0,8}(做|写|生成|创作))",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            return hasMusicTarget && hasGenerationAction
                || Regex.IsMatch(text, @"(text[- ]?to[- ]?music|music generation)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        }

        public static bool TryNormalize(
            MiniMaxMusicGenerateParam param,
            out NormalizedMiniMaxMusicRequest normalized,
            out string error)
        {
            normalized = null;
            error = null;
            if (param == null)
            {
                error = "MiniMax 音乐参数不能为空。";
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
            if (prompt.Length < 1 || prompt.Length > 2000)
            {
                error = "纯音乐 Prompt 长度必须为 1-2000 个字符。";
                return false;
            }
            if (!param.IsInstrumental)
            {
                error = "当前安全原子能力只允许生成无人声纯音乐；带歌词歌曲需要独立版权审核流程。";
                return false;
            }
            var model = (param.Model ?? "music-2.6").Trim().ToLowerInvariant();
            if (model != "music-2.6")
            {
                error = "当前 MiniMax 官方音乐生成只允许 music-2.6。";
                return false;
            }
            var sampleRate = param.SampleRate == 0 ? 44100 : param.SampleRate;
            if (sampleRate != 44100)
            {
                error = "当前音乐交付规范固定使用 44100Hz。";
                return false;
            }
            var bitrate = param.Bitrate == 0 ? 256000 : param.Bitrate;
            if (bitrate != 256000)
            {
                error = "当前音乐交付规范固定使用 256kbps。";
                return false;
            }
            var format = (param.Format ?? "mp3").Trim().ToLowerInvariant();
            if (format != "mp3")
            {
                error = "当前音乐交付规范只允许 MP3。";
                return false;
            }
            var body = new JObject
            {
                ["model"] = model,
                ["prompt"] = prompt,
                ["is_instrumental"] = true,
                ["audio_setting"] = new JObject
                {
                    ["sample_rate"] = sampleRate,
                    ["bitrate"] = bitrate,
                    ["format"] = format
                }
            }.ToString(Formatting.None);
            normalized = new NormalizedMiniMaxMusicRequest
            {
                RequestId = requestId,
                Prompt = prompt,
                Model = model,
                SampleRate = sampleRate,
                Bitrate = bitrate,
                Format = format,
                RequestBody = body,
                Fingerprint = Sha256(body)
            };
            return true;
        }

        public static string BuildIdempotencyKey(string osClient, string userId, string requestId)
        {
            return $"Microi:{NormalizeSegment(osClient)}:Ai:MiniMaxMusic:{Sha256(userId)}:{Sha256(requestId)}";
        }

        private static string CollapseWhitespace(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            var builder = new StringBuilder(value.Length);
            var previousWhitespace = false;
            foreach (var ch in value.Trim())
            {
                var whitespace = char.IsWhiteSpace(ch) || char.IsControl(ch);
                if (whitespace)
                {
                    if (!previousWhitespace) builder.Append(' ');
                }
                else builder.Append(ch);
                previousWhitespace = whitespace;
            }
            return builder.ToString();
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
