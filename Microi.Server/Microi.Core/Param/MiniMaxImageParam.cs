namespace Microi.net
{
    /// <summary>
    /// 用户在 AI 图像工作台提交的参考图。浏览器只提交内存 Data URL，
    /// 后端会在调用供应商前写入当前租户私有 HDFS，再把经过校验的原始字节
    /// 交给供应商；供应商密钥与参考图私有地址不会回传到对话记录。
    /// </summary>
    public sealed class MiniMaxImageReferenceParam
    {
        public string FileName { get; set; }
        public string DataUrl { get; set; }
    }

    /// <summary>
    /// 通用图片请求（类型名保留兼容）。实际模型与协议由当前租户 mic_ai 决定；
    /// 聊天模型、image-01 人物参考与 MiniMax Code 图像编辑工具是不同调用链。
    /// </summary>
    public sealed class MiniMaxImageGenerateParam
    {
        public string RequestId { get; set; }
        /// <summary>当前租户 mic_ai 记录 Id；客户端不能提交 Endpoint 或 ApiKey。</summary>
        public string AiModelId { get; set; }
        public string Prompt { get; set; }
        public string Model { get; set; } = "image-01";
        public string AspectRatio { get; set; } = "1:1";
        /// <summary>仅在所选协议声明支持时传入 1K / 2K / 4K。</summary>
        public string Resolution { get; set; }
        public int Count { get; set; } = 1;
        public string Operation { get; set; } = "text-to-image";
        public System.Collections.Generic.List<MiniMaxImageReferenceParam> ReferenceImages { get; set; }
        public int? Width { get; set; }
        public int? Height { get; set; }
        public long? Seed { get; set; }
        public string PostProcess { get; set; }
    }
}
