using System;

namespace Microi.net
{
    public class CreateV8EngineParam
    {
        /// <summary>
        /// V8引擎执行超时时间，默认1分钟，单位秒
        /// </summary>
        public int Timeout { get; set; } = 60;
        /// <summary>
        /// 【最大语句数】执行的JavaScript语句数量上限
        /// 1亿条语句约等于：10万条数据 × 每条1000条语句的处理逻辑
        /// 超出后抛出 StatementsCountOverflowException
        /// </summary>
        public int MaxStatements { get; set; } = 100_000_000;
        /// <summary>
        ///  【内存限制】V8引擎可使用的最大内存（2GB）
        /// 防止恶意代码或内存泄漏导致服务器OOM
        /// 超出后抛出 MemoryLimitExceededException
        /// 单位MB
        /// </summary>
        public int LimitMemory { get; set; } = 2048;//2GB
        /// <summary>
        /// 【递归深度限制】函数调用栈的最大深度
        ///  防止无限递归导致栈溢出，10000层足够大多数场景
        /// 超出后抛出 RecursionDepthOverflowException
        /// </summary>
        public int LimitRecursion { get; set; } = 10_000;
    }

}

