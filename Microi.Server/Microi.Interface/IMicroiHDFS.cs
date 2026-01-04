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
    }
}

