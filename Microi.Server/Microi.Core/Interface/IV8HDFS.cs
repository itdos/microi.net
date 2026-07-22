using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// V8 可见的对象存储最小能力面。
    ///
    /// 与 IMicroiHDFS 不同，本接口不暴露 HDFSParam、ClientModel、底层存储客户端或
    /// 任意租户配置；实现必须把所有路径和 OsClient 固定到当前 V8 租户。
    /// </summary>
    public interface IV8HDFS
    {
        Task<DosResult> Upload(DiyUploadParam param);
        Task<DosResult> GetPrivateFileUrl(DiyUploadParam param);
        Task<DosResult> GetPrivateFileByte(DiyUploadParam param);
        Task<DosResult> ListObjects(DiyUploadParam param);
        Task<DosResult> DeleteObject(DiyUploadParam param);
        Task<DosResult> CreateFolder(DiyUploadParam param);
        Task<DosResult> RenameObject(DiyUploadParam param);
        Task<DosResult> MoveObject(DiyUploadParam param);
    }
}
