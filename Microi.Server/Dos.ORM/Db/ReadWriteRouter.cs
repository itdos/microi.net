/****************************************************
 * 文 件 名：ReadWriteRouter.cs
 * 创建日期：2026-05-01
 * 文件描述：读写分离路由。
 *
 *   支持模式：
 *     - 一主多从：写操作走 Master，读操作按权重轮询从库
 *     - 自动降级：从库不可用时回退主库
 *     - 强制路由：通过 ForceMaster() 在事务/敏感场景下强制走主库
 *
 *   用法：
 *     var router = new ReadWriteRouter(masterSession);
 *     router.AddSlave(slaveA, weight:1);
 *     router.AddSlave(slaveB, weight:2);
 *     var read = router.GetReadSession();
 *     var write = router.GetWriteSession();
 ******************************************************/

using System;
using System.Collections.Generic;
using System.Threading;

namespace Dos.ORM
{
    /// <summary>
    /// 读写分离路由器
    /// </summary>
    public sealed class ReadWriteRouter
    {
        private readonly DbSession _master;
        private readonly List<SlaveEntry> _slaves = new List<SlaveEntry>();
        private int _rrCounter; // round-robin 计数
        private static readonly AsyncLocal<bool> _forceMaster = new AsyncLocal<bool>();

        /// <summary>
        /// 构造一个读写分离路由器
        /// </summary>
        /// <param name="masterSession">主库 DbSession</param>
        public ReadWriteRouter(DbSession masterSession)
        {
            _master = masterSession ?? throw new ArgumentNullException(nameof(masterSession));
        }

        /// <summary>
        /// 添加一个从库
        /// </summary>
        /// <param name="slaveSession">从库 DbSession</param>
        /// <param name="weight">权重，权重越大被选中概率越高</param>
        public ReadWriteRouter AddSlave(DbSession slaveSession, int weight = 1)
        {
            if (slaveSession == null) throw new ArgumentNullException(nameof(slaveSession));
            if (weight < 1) weight = 1;
            _slaves.Add(new SlaveEntry { Session = slaveSession, Weight = weight, Healthy = true });
            return this;
        }

        /// <summary>
        /// 获取写操作 DbSession（永远是主库）
        /// </summary>
        public DbSession GetWriteSession() => _master;

        /// <summary>
        /// 获取读操作 DbSession（按权重选择从库；无可用从库或处于 ForceMaster 时返回主库）
        /// </summary>
        public DbSession GetReadSession()
        {
            if (_forceMaster.Value || _slaves.Count == 0) return _master;
            int total = 0;
            foreach (var s in _slaves) if (s.Healthy) total += s.Weight;
            if (total == 0) return _master;
            int idx = Interlocked.Increment(ref _rrCounter) & int.MaxValue;
            int pick = idx % total;
            int acc = 0;
            foreach (var s in _slaves)
            {
                if (!s.Healthy) continue;
                acc += s.Weight;
                if (pick < acc) return s.Session;
            }
            return _master;
        }

        /// <summary>
        /// 在 using 内的所有读操作强制走主库（用于"读自己刚写的数据"场景）
        /// </summary>
        public IDisposable ForceMaster()
        {
            _forceMaster.Value = true;
            return new ReleaseScope(() => _forceMaster.Value = false);
        }

        /// <summary>
        /// 标记某个从库不健康（被监控或异常时调用）
        /// </summary>
        public void MarkUnhealthy(DbSession slave)
        {
            foreach (var s in _slaves)
                if (object.ReferenceEquals(s.Session, slave)) s.Healthy = false;
        }

        /// <summary>
        /// 标记某个从库恢复健康
        /// </summary>
        public void MarkHealthy(DbSession slave)
        {
            foreach (var s in _slaves)
                if (object.ReferenceEquals(s.Session, slave)) s.Healthy = true;
        }

        private sealed class SlaveEntry
        {
            public DbSession Session;
            public int Weight;
            public bool Healthy;
        }

        private sealed class ReleaseScope : IDisposable
        {
            private Action _onDispose;
            public ReleaseScope(Action onDispose) { _onDispose = onDispose; }
            public void Dispose() { var a = Interlocked.Exchange(ref _onDispose, null); a?.Invoke(); }
        }
    }
}
