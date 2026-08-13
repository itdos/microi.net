namespace Microi.net
{
    /// <summary>
    /// MiniMax 短对白语音合成请求。仅开放固定男女系统音色和高画质模型，
    /// 供应商 Key、URL 与 Authorization 均由可信服务端注入。
    /// </summary>
    public sealed class MiniMaxSpeechGenerateParam
    {
        public string RequestId { get; set; }
        public string Text { get; set; }
        public string Speaker { get; set; } = "female";
        public string VoiceId { get; set; }
        public string Model { get; set; } = "speech-2.8-hd";
        public decimal Speed { get; set; } = 1m;
        public decimal Volume { get; set; } = 1m;
        public int Pitch { get; set; }
        public string Emotion { get; set; } = "calm";
        public int SampleRate { get; set; } = 32000;
        public int Bitrate { get; set; } = 128000;
        public int Channel { get; set; } = 1;
        public string Format { get; set; } = "mp3";
    }
}
