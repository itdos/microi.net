using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>Trusted host diagnostic capability; callers must enforce tenant administrator authorization.</summary>
    public interface IMemoryDiagnosticsRuntime
    {
        Task<JObject> QueryAsync(string action, string tenant, string incidentId, CancellationToken cancellationToken);
    }

    /// <summary>Idempotent, tenant-partitioned shared incident history. Local WAL remains the outage fallback.</summary>
    public interface IMemoryIncidentRepository
    {
        Task SaveAsync(string tenant, JObject incident, CancellationToken cancellationToken);
        Task<IReadOnlyList<JObject>> ListAsync(string tenant, int take, CancellationToken cancellationToken);
        Task<JObject> GetAsync(string tenant, string incidentId, CancellationToken cancellationToken);
        Task<JObject> GetMemoryStatusAsync(string tenant, CancellationToken cancellationToken);
    }
}
