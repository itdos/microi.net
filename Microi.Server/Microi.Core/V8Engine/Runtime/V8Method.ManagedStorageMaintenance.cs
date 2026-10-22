using System;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        public DosResult RequireManagedStorageMaintenance(dynamic dynamicParam)
        {
            var denied = ResolveTrustedManagedCurrentUser(ManagedStorageAdmissionRuntime.MaintenanceKey, true,
                DiyCommon.MaxRoleLevel, out var tenant, out var user);
            if (denied != null) return denied;
            try
            {
                var input = JsonHelper.ToJObject(dynamicParam);
                if (input.Value<string>("Scope") != ManagedStorageAdmissionRuntime.RuntimeKey)
                    return new DosResult(0, null, "不支持的维护范围。");
                return new DosResult(1, JObject.FromObject(ManagedStorageAdmissionRuntime.RequireMaintenance(tenant,
                    input.Value<string>("ExpectedEpoch") ?? "")));
            }
            catch { return new DosResult(0, null, "维护准入尚未确认或已有操作进行中；保持关闭并重新读取状态。"); }
        }

        public DosResult ManageManagedStorageMaintenance(dynamic dynamicParam)
        {
            // 固定 Key、可信当前租户、超级管理员及非访问密钥会话；不读取客户端身份或排空 boolean。
            var denied = ResolveTrustedManagedCurrentUser(ManagedStorageAdmissionRuntime.MaintenanceKey, true,
                DiyCommon.MaxRoleLevel, out var tenant, out var user);
            if (denied != null) return denied;
            try
            {
                ManagedStorageAdmissionRuntime.RequireControlContext(tenant);
                var input = JsonHelper.ToJObject(dynamicParam);
                if (input.Value<string>("Scope") != ManagedStorageAdmissionRuntime.RuntimeKey)
                    return new DosResult(0, null, "不支持的维护范围。");
                var store = MicroiEngine.TryGetService<IManagedStorageAdmissionStore>()
                    ?? throw new InvalidOperationException("ManagedStorageAdmissionUnavailable");
                var scope = ManagedStorageAdmissionRuntime.RuntimeKey;
                var epoch = input.Value<string>("Epoch") ?? "";
                ManagedStorageGate result;
                switch (input.Value<string>("Operation"))
                {
                    case "Begin": result = store.Begin(tenant, scope, input.Value<string>("OperationId"), Guid.NewGuid().ToString("N")); break;
                    case "Drain": result = store.Drain(tenant, scope, epoch); break;
                    case "Status": result = store.Read(tenant, scope); break;
                    case "End":
                        if (input["ExpectedRevision"]?.Type != JTokenType.Integer)
                            return new DosResult(0, null, "结束维护必须提供刚读取的准入版本。");
                        result = store.End(tenant, scope, epoch, input.Value<long>("ExpectedRevision")); break;
                    default: return new DosResult(0, null, "未知维护操作。");
                }
                return new DosResult(1, JObject.FromObject(result));
            }
            catch { return new DosResult(0, null, "维护状态未知、租户尚未排空或已有操作进行中；请重新读取状态。"); }
        }
    }
}
