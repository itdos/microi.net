namespace Microi.net
{
    /// <summary>
    /// MiniMax 视频生成请求。RequestId 是调用方稳定幂等键；同一用户、租户和
    /// RequestId 只能对应同一份生成参数，避免有限额度被网络重试重复消耗。
    /// </summary>
    public sealed class MiniMaxVideoCreateParam
    {
        public string RequestId { get; set; }
        public string Prompt { get; set; }
        public string Model { get; set; } = "MiniMax-Hailuo-2.3";
        public int Duration { get; set; } = 6;
        public string Resolution { get; set; } = "768P";
        public string FirstFrameImage { get; set; }
        public string LastFrameImage { get; set; }
    }

    public sealed class MiniMaxVideoTaskParam
    {
        public string TaskHandle { get; set; }
    }

    public sealed class MiniMaxVideoFileParam
    {
        public string FileHandle { get; set; }
    }
}
