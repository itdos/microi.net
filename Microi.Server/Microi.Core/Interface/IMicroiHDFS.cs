using System;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    /// <summary>
    /// Microi分布式存储接口
    /// </summary>
    public interface IMicroiHDFS
    {
        /// <summary>
        /// 可以使用MicroiEngine.HDFS调用
        /// </summary>
        /// <param name="param"></param>
        /// <param name="_httpContext"></param>
        /// <returns></returns>
        Task<DosResult> Upload(DiyUploadParam param, Microsoft.AspNetCore.Http.HttpContext _httpContext = null);
        /// <summary>
        /// 必须使用MicroiEngine.HDFSFactory调用，上传文件。传入ClientModel、Limit、FileFullPath、FileStream
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> PutObject(HDFSParam param);
        /// <summary>
        /// 必须使用MicroiEngine.HDFSFactory调用，判断是否存在此文件。传入ClientModel、Limit、FileFullPath
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult<bool>> ObjectExist(HDFSParam param);
        /// <summary>
        /// 必须使用MicroiEngine.HDFSFactory调用，获取单个私有文件的临时访问地址。传入FileFullPath、ClientModel
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> GetPrivateFileUrl(HDFSParam param);

        /// <summary>
        /// 可以使用MicroiEngine.HDFS调用
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> GetPrivateFileUrl(DiyUploadParam param);
        /// <summary>
        /// 可以使用MicroiEngine.HDFS调用
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> GetPrivateFileByte(DiyUploadParam param);

        /// <summary>
        /// 列出指定前缀下的文件和文件夹。传入ClientModel、Limit、FileFullPath（作为前缀）
        /// </summary>
        Task<DosResult> ListObjects(HDFSParam param);

        /// <summary>
        /// 删除文件。传入ClientModel、Limit、FileFullPath
        /// </summary>
        Task<DosResult> DeleteObject(HDFSParam param);

        /// <summary>
        /// 创建文件夹（上传空对象）。传入ClientModel、Limit、FileFullPath
        /// </summary>
        Task<DosResult> CreateFolder(HDFSParam param);

        /// <summary>
        /// 复制文件。传入ClientModel、Limit、FileFullPath（源）、FileFullPathOrigin（目标）
        /// </summary>
        Task<DosResult> CopyObject(HDFSParam param);

        /// <summary>
        /// 移动文件（复制+删除）。传入ClientModel、Limit、FileFullPath（源）、FileFullPathOrigin（目标）
        /// </summary>
        Task<DosResult> MoveObject(HDFSParam param);
    }
}

