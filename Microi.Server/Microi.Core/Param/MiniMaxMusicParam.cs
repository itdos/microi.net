namespace Microi.net
{
    /// <summary>
    /// MiniMax 音乐生成请求。音乐生成是同步上游调用，但 RequestId 仍必须稳定，
    /// 以防网络重试重复消耗 Token Plan / 按量额度。
    /// </summary>
    public sealed class MiniMaxMusicGenerateParam
    {
        public string RequestId { get; set; }
        public string AiModelId { get; set; }
        public string Prompt { get; set; }
        public string Model { get; set; } = "music-3.0";
        public bool IsInstrumental { get; set; } = true;
        public int SampleRate { get; set; } = 44100;
        public int Bitrate { get; set; } = 256000;
        public string Format { get; set; } = "mp3";
        /// <summary>
        /// 官方 Music API 明确退役当前账号时，官方开源 MiniMax-Music3
        /// 推理回退所生成的时长。正式 Music API 自行决定歌曲长度，不发送该字段。
        /// </summary>
        public int DurationSeconds { get; set; } = 20;
    }
}
