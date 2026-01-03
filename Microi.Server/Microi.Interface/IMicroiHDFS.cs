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
        /// 上传文件。传入ClientModel、Limit、FileFullPath、FileStream
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> PutObject(HDFSParam param);
        /// <summary>
        /// 判断是否存在此文件。传入ClientModel、Limit、FileFullPath
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult<bool>> ObjectExist(HDFSParam param);
        /// <summary>
        /// 获取单个私有文件的临时访问地址。传入FileFullPath、ClientModel
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> GetPrivateFileUrl(HDFSParam param);
    }
}

