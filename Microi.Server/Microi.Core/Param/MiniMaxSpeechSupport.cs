using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace Microi.net
{
    public sealed class NormalizedMiniMaxSpeechRequest
    {
        public string RequestId { get; set; }
        public string Text { get; set; }
        public string Speaker { get; set; }
        public string VoiceId { get; set; }
        public string Model { get; set; }
        public int SampleRate { get; set; }
        public int Bitrate { get; set; }
        public int Channel { get; set; }
        public string Format { get; set; }
        public string RequestBody { get; set; }
        public string Fingerprint { get; set; }
        public string TextHash { get; set; }
    }

    /// <summary>
    /// MiniMax 办公室剧情短对白参数白名单。固定男女演员音色，避免 V8 调用方
    /// 越权使用克隆音色或把供应商运行参数变成未审计的通用代理。
    /// </summary>
    public static class MiniMaxSpeechSupport
    {
        private static readonly IReadOnlyDictionary<string, string> SpeakerVoices =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["female"] = "female-tianmei",
                ["male"] = "male-qn-jingying"
            };

        private static readonly HashSet<string> AllowedEmotions =
            new HashSet<string>(new[] { "calm", "happy", "sad", "surprised" }, StringComparer.OrdinalIgnoreCase);

        public static bool TryNormalize(
            MiniMaxSpeechGenerateParam param,
            out NormalizedMiniMaxSpeechRequest normalized,
            out string error)
        {
            normalized = null;
            error = null;
            if (param == null)
            {
                error = "MiniMax 对白参数不能为空。";
                return false;
            }
            var requestId = (param.RequestId ?? string.Empty).Trim();
            if (requestId.Length < 8 || requestId.Length > 160
                || requestId.Any(ch => !(char.IsLetterOrDigit(ch) || ".:_-".Contains(ch))))
            {
                error = "RequestId 只允许 8-160 位字母、数字、点、下划线、冒号或短横线。";
                return false;
            }
            var text = CollapseWhitespace(param.Text);
            if (text.Length < 1 || text.Length > 800)
            {
                error = "单段对白长度必须为 1-800 个字符；长对白应拆成可校准字幕的短句。";
                return false;
            }
            var speaker = (param.Speaker ?? "female").Trim().ToLowerInvariant();
            if (!SpeakerVoices.TryGetValue(speaker, out var expectedVoice))
            {
                error = "Speaker 只允许 female 或 male。";
                return false;
            }
            var voiceId = string.IsNullOrWhiteSpace(param.VoiceId)
                ? expectedVoice
                : param.VoiceId.Trim();
            if (!string.Equals(voiceId, expectedVoice, StringComparison.OrdinalIgnoreCase))
            {
                error = $"{speaker} 角色只允许使用固定系统音色 {expectedVoice}。";
                return false;
            }
            var model = (param.Model ?? "speech-2.8-hd").Trim().ToLowerInvariant();
            if (model != "speech-2.8-hd")
            {
                error = "对白画质优先规范固定使用 speech-2.8-hd。";
                return false;
            }
            var speed = param.Speed == 0 ? 1m : param.Speed;
            var volume = param.Volume == 0 ? 1m : param.Volume;
            if (speed < 0.8m || speed > 1.2m)
            {
                error = "办公室对白语速只允许 0.8-1.2。";
                return false;
            }
            if (volume < 0.8m || volume > 1.2m)
            {
                error = "办公室对白音量只允许 0.8-1.2。";
                return false;
            }
            if (param.Pitch < -2 || param.Pitch > 2)
            {
                error = "办公室对白音调只允许 -2 到 2。";
                return false;
            }
            var emotion = (param.Emotion ?? "calm").Trim().ToLowerInvariant();
            if (!AllowedEmotions.Contains(emotion))
            {
                error = "Emotion 只允许 calm、happy、sad 或 surprised。";
                return false;
            }
            var sampleRate = param.SampleRate == 0 ? 32000 : param.SampleRate;
            var bitrate = param.Bitrate == 0 ? 128000 : param.Bitrate;
            var channel = param.Channel == 0 ? 1 : param.Channel;
            var format = (param.Format ?? "mp3").Trim().ToLowerInvariant();
            if (sampleRate != 32000 || bitrate != 128000 || channel != 1 || format != "mp3")
            {
                error = "对白交付固定使用 32000Hz、128kbps、单声道 MP3。";
                return false;
            }
            var body = new JObject
            {
                ["model"] = model,
                ["text"] = text,
                ["stream"] = false,
                ["language_boost"] = "Chinese",
                ["voice_setting"] = new JObject
                {
                    ["voice_id"] = voiceId,
                    ["speed"] = speed,
                    ["vol"] = volume,
                    ["pitch"] = param.Pitch,
                    ["emotion"] = emotion
                },
                ["audio_setting"] = new JObject
                {
                    ["sample_rate"] = sampleRate,
                    ["bitrate"] = bitrate,
                    ["format"] = format,
                    ["channel"] = channel
                },
                ["subtitle_enable"] = true,
                ["subtitle_type"] = "sentence",
                ["output_format"] = "hex",
                ["aigc_watermark"] = false
            }.ToString(Formatting.None);
            normalized = new NormalizedMiniMaxSpeechRequest
            {
                RequestId = requestId,
                Text = text,
                Speaker = speaker,
                VoiceId = voiceId,
                Model = model,
                SampleRate = sampleRate,
                Bitrate = bitrate,
                Channel = channel,
                Format = format,
                RequestBody = body,
                Fingerprint = Sha256(body),
                TextHash = Sha256(text)
            };
            return true;
        }

        public static string BuildIdempotencyKey(string osClient, string userId, string requestId)
        {
            return $"Microi:{NormalizeSegment(osClient)}:Ai:MiniMaxSpeech:{Sha256(userId)}:{Sha256(requestId)}";
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
