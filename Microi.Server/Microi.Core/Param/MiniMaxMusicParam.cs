namespace Microi.net
{
    /// <summary>
    /// MiniMax 音乐生成请求。音乐生成是同步上游调用，但 RequestId 仍必须稳定，
    /// 以防网络重试重复消耗 Token Plan / 按量额度。
    /// </summary>
    public sealed class MiniMaxMusicGenerateParam
    {
        public string RequestId { get; set; }
        public string Prompt { get; set; }
        public string Model { get; set; } = "music-3.0";
        public bool IsInstrumental { get; set; } = true;
        public int SampleRate { get; set; } = 44100;
        public int Bitrate { get; set; } = 256000;
        public string Format { get; set; } = "mp3";
    }
}
