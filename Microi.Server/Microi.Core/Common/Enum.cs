using System;

namespace Microi.net
{
    public enum HDFSType
    {
        /// <summary>
        /// 此模式下仅用于调用【public class MicroiHDFS 】下的3个方法
        /// </summary>
        Default,
        MinIO,
        Aliyun,
        AmazonS3
    }
}
