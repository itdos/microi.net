using System;

namespace Microi.net
{
    /// <summary>宿主专用的持久准入；不挂到 V8.MongoDb，不能由用户参数直接领取或归还。</summary>
    public interface IManagedStorageAdmissionStore
    {
        ManagedStorageTicket Enter(string tenant, string scope, string token, string processInstance);
        ManagedStorageTicket EnterMaintenance(string tenant, string scope, string epoch, string token, string processInstance);
        bool Release(ManagedStorageTicket ticket);
        ManagedStorageGate Begin(string tenant, string scope, string operationId, string proposedEpoch);
        ManagedStorageGate Drain(string tenant, string scope, string epoch);
        ManagedStorageGate Read(string tenant, string scope);
        ManagedStorageGate End(string tenant, string scope, string epoch, long expectedRevision);
    }
    public sealed class ManagedStorageTicket
    {
        public string Tenant { get; set; }
        public string Scope { get; set; }
        public string Token { get; set; }
        public string ProcessInstance { get; set; }
        public bool IsMaintenance { get; set; }
    }
    public sealed class ManagedStorageGate
    {
        public string OsClient { get; set; }
        public string Scope { get; set; }
        public string Phase { get; set; }
        public string Epoch { get; set; }
        public string OperationId { get; set; }
        public long Revision { get; set; }
        public int ActiveCount { get; set; }
        public int MaintenanceActiveCount { get; set; }
        public bool WriteAdmissionClosed => Phase == "Draining" || Phase == "Maintenance";
        public bool WritersDrained => Phase == "Maintenance" && ActiveCount == 0;
    }
}
