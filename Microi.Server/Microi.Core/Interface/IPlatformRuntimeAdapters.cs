using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// Reloads committed SaaS configuration through the closed bootstrap host.
    /// The open V8 runtime never initializes or evaluates product licenses.
    /// </summary>
    public interface IOsClientRuntime
    {
        DosResult ReloadSingleOsClient(string osClient);
        V8DatabaseCollection GetAllClientDataBase(OsClientSecret clientModel);
    }

    /// <summary>
    /// Narrow authorization-explanation capability exposed by FormEngine.
    /// </summary>
    public interface IFormEngineAuthorizationExplainRuntime
    {
        Task<DosResult> ExplainClientTableAuthorizationAsync(
            DiyTableRowParam param,
            string operation);
    }
}
