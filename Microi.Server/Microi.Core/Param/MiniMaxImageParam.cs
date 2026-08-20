namespace Microi.net
{
    /// <summary>
    /// MiniMax 图片生成请求。MiniMax-M3 负责对话与意图理解，真正的图片输出
    /// 由同一服务端订阅下的 image-01 专用模型完成。
    /// </summary>
    public sealed class MiniMaxImageGenerateParam
    {
        public string RequestId { get; set; }
        public string Prompt { get; set; }
        public string Model { get; set; } = "image-01";
        public string AspectRatio { get; set; } = "1:1";
        public int Count { get; set; } = 1;
    }
}
