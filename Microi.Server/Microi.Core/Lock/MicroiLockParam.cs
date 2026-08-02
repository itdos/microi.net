using System;
using System.Threading;

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
        /// 获取锁的最长等待时间。小于等于零时兼容旧行为，继续使用 Expiry；
        /// 它不影响成功获取后的 Redis TTL 与续租周期。
        /// </summary>
        public TimeSpan AcquireTimeout { get; set; } = TimeSpan.Zero;

        /// <summary>
        /// 获取锁等待阶段的取消信号。回调内部仍应使用自己的业务取消信号。
        /// </summary>
        public CancellationToken CancellationToken { get; set; } = CancellationToken.None;

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

        /// <summary>
        /// 回调执行期间是否按持有者令牌自动续租。长任务必须显式开启，
        /// 普通短事务保持旧行为，避免无上限地延长历史调用。
        /// </summary>
        public bool AutoRenew { get; set; } = false;

        /// <summary>
        /// 自动续租允许持有锁的最长时间。AutoRenew=true 时必须大于零，
        /// 达到上限后停止续租并将本次调用判为失败，防止挂死回调永久占锁。
        /// </summary>
        public TimeSpan MaxLeaseDuration { get; set; } = TimeSpan.Zero;
    }
}
