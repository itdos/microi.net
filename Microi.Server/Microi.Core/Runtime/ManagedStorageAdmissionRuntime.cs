using System;
using System.Diagnostics;
using System.Threading;

namespace Microi.net
{
    /// <summary>
    /// 固定 Managed 执行入口的宿主上下文。普通 API 仅比较 Key，不解析服务、不访问存储。
    /// 必须加入 V8 TypeResolver 禁止名单；领取/归还身份不能交给可编辑脚本。
    /// </summary>
    public static class ManagedStorageAdmissionRuntime
    {
        public const string RuntimeKey = "platform-chat-runtime";
        public const string MaintenanceKey = "platform-chat-maintenance";
        private static readonly AsyncLocal<Admission> Ambient = new AsyncLocal<Admission>();
        private static readonly string ProcessInstance = Guid.NewGuid().ToString("N");

        public static IDisposable Enter(string key, string tenant, Func<IManagedStorageAdmissionStore> resolve,
            CancellationToken cancellation = default)
        {
            if (!string.Equals(key, RuntimeKey, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(key, MaintenanceKey, StringComparison.OrdinalIgnoreCase)) return null;
            cancellation.ThrowIfCancellationRequested();
            var store = resolve() ?? throw new InvalidOperationException("ManagedStorageAdmissionUnavailable");
            var admission = new Admission(tenant.ToLowerInvariant(), store,
                string.Equals(key, MaintenanceKey, StringComparison.OrdinalIgnoreCase), Ambient.Value);
            if (!admission.Maintenance)
                admission.Ticket = store.Enter(admission.Tenant, RuntimeKey, Guid.NewGuid().ToString("N"), ProcessInstance);
            try { cancellation.ThrowIfCancellationRequested(); }
            catch { admission.Dispose(); throw; }
            Ambient.Value = admission;
            return admission;
        }

        // Require 由受信任的维护 Key + 超级管理员原子调用。第一次领取排他维护票据，
        // 后续核验仍回读相同 Epoch；End 不能和正在执行的 Step 同时重新开放普通写入。
        public static ManagedStorageGate RequireMaintenance(string tenant, string expectedEpoch)
        {
            var current = Ambient.Value;
            if (current == null || !current.Maintenance
                || !string.Equals(current.Tenant, tenant, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("ManagedStorageMaintenanceContextRequired");
            lock (current.Sync)
            {
                if (current.RootEnded) throw new InvalidOperationException("ManagedStorageExecutionEnded");
                var gate = current.Store.Read(current.Tenant, RuntimeKey);
                if (!gate.WritersDrained || !gate.WriteAdmissionClosed
                    || !string.IsNullOrEmpty(expectedEpoch) && gate.Epoch != expectedEpoch)
                    throw new InvalidOperationException("ManagedStorageMaintenanceNotDrained");
                if (current.Ticket == null)
                    current.Ticket = current.Store.EnterMaintenance(current.Tenant, RuntimeKey, gate.Epoch,
                        Guid.NewGuid().ToString("N"), ProcessInstance);
                return current.Store.Read(current.Tenant, RuntimeKey);
            }
        }

        public static void RequireControlContext(string tenant)
        {
            var current = Ambient.Value;
            if (current == null || !current.Maintenance || current.RootEnded || current.Ticket != null
                || !string.Equals(current.Tenant, tenant, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("ManagedStorageControlContextRequired");
        }

        /// <summary>
        /// 实际 Mongo 写操作的 using 边界。超时返回时已在执行的 I/O 仍保留持久登记，
        /// 直到其 finally 真正结束；继承到后台回调的旧上下文不能在请求结束后重新开始写。
        /// </summary>
        public static IDisposable BeginMutation()
        {
            var current = Ambient.Value;
            if (current == null) return null;
            lock (current.Sync)
            {
                if (current.RootEnded) throw new InvalidOperationException("ManagedStorageExecutionEnded");
                if (current.Ticket == null) throw new InvalidOperationException("ManagedStorageMaintenanceTicketRequired");
                current.Mutations++;
                return new Mutation(current);
            }
        }

        private sealed class Admission : IDisposable
        {
            internal readonly object Sync = new object();
            internal readonly string Tenant;
            internal readonly IManagedStorageAdmissionStore Store;
            internal readonly bool Maintenance;
            internal readonly Admission Previous;
            internal ManagedStorageTicket Ticket;
            internal bool RootEnded, ReleaseAttempted;
            internal int Mutations;
            internal Admission(string tenant, IManagedStorageAdmissionStore store, bool maintenance, Admission previous)
            { Tenant = tenant; Store = store; Maintenance = maintenance; Previous = previous; }
            public void Dispose()
            {
                lock (Sync) { RootEnded = true; }
                if (ReferenceEquals(Ambient.Value, this)) Ambient.Value = Previous;
                ReleaseWhenFinished();
            }
            internal void ReleaseWhenFinished()
            {
                ManagedStorageTicket ticket;
                lock (Sync)
                {
                    if (!RootEnded || Mutations != 0 || ReleaseAttempted || Ticket == null) return;
                    ReleaseAttempted = true; ticket = Ticket;
                }
                try
                {
                    if (!Store.Release(ticket)) Trace.TraceError("ManagedStorageReleaseUnconfirmed; persistent ticket retained");
                }
                catch { Trace.TraceError("ManagedStorageReleaseUnknown; persistent ticket retained"); }
            }
        }
        private sealed class Mutation : IDisposable
        {
            private Admission Owner;
            internal Mutation(Admission owner) { Owner = owner; }
            public void Dispose()
            {
                var owner = Interlocked.Exchange(ref Owner, null);
                if (owner == null) return;
                lock (owner.Sync) { owner.Mutations--; }
                owner.ReleaseWhenFinished();
            }
        }
    }
}
