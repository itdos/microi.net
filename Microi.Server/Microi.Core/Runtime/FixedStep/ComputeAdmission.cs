#nullable enable annotations
using System;
using System.Collections.Generic;

namespace Microi.FixedStep
{
/// <summary>覆盖HTTP/V8和pump所有计算入口；超额快速拒绝，不在Jint事务内堆积等待队列。</summary>
public sealed class ComputeAdmission
{
    private readonly object gate=new object();
    private readonly HashSet<string> tenants=new HashSet<string>(StringComparer.Ordinal);
    private readonly Func<bool> underMemoryPressure;
    private int inFlight;
    public ComputeAdmission(Func<bool> underMemoryPressure){this.underMemoryPressure=underMemoryPressure??throw new ArgumentNullException(nameof(underMemoryPressure));}
    public IDisposable TryEnter(string tenant)
    {
        Guard.Id(tenant);
        lock(gate)
        {
            if(underMemoryPressure())throw new InvalidOperationException("HostMemoryPressure");
            if(inFlight>=2||tenants.Contains(tenant))throw new InvalidOperationException("KernelBusy");
            inFlight++;tenants.Add(tenant);return new Lease(this,tenant);
        }
    }
    private sealed class Lease : IDisposable
    {
        private ComputeAdmission? owner;private readonly string tenant;
        internal Lease(ComputeAdmission owner,string tenant){this.owner=owner;this.tenant=tenant;}
        public void Dispose(){var current=System.Threading.Interlocked.Exchange(ref owner,null);if(current==null)return;lock(current.gate){current.inFlight--;current.tenants.Remove(tenant);}}
    }
}
}
