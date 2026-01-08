using System;

namespace Microi.net
{
    /// <summary>
    /// 分布式锁参数
    /// </summary>
    public class MicroiLockParam
    {
        /// <summary>
        /// 锁的键名
        /// </summary>
        public string Key { get; set; }

        /// <summary>
        /// 操作系统客户端标识
        /// </summary>
        public string OsClient { get; set; }

        /// <summary>
        /// 锁的过期时间
        /// </summary>
        public TimeSpan Expiry { get; set; }

        /// <summary>
        /// 语言设置
        /// </summary>
        public string _Lang { get; set; }

        /// <summary>
        /// 获取锁的最大重试次数（默认不限制，由Expiry时间控制）
        /// </summary>
        public int MaxRetryCount { get; set; } = 0;

        /// <summary>
        /// 重试间隔的基础毫秒数
        /// </summary>
        public int RetryIntervalMs { get; set; } = 10;

        /// <summary>
        /// 是否使用指数退避策略
        /// </summary>
        public bool UseExponentialBackoff { get; set; } = true;
    }
}