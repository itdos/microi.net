namespace Microi.net
{
    /// <summary>
    /// 用户在 AI 图像工作台提交的参考图。浏览器只提交内存 Data URL，
    /// 后端会在调用供应商前写入当前租户私有 HDFS，并只把短效审计代理地址
    /// 交给 MiniMax；供应商地址不会回传或持久化到对话记录。
    /// </summary>
    public sealed class MiniMaxImageReferenceParam
    {
        public string FileName { get; set; }
        public string DataUrl { get; set; }
    }

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
        public string Operation { get; set; } = "text-to-image";
        public System.Collections.Generic.List<MiniMaxImageReferenceParam> ReferenceImages { get; set; }
        public int? Width { get; set; }
        public int? Height { get; set; }
        public long? Seed { get; set; }
        public string PostProcess { get; set; }
    }
}
