using System;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    //public static class MicroiHDFSExtensions
    //{
    //    public static IServiceCollection AddMicroiHDFS(this IServiceCollection services)
    //    {
    //        try
    //        {
    //            //services.AddSingleton<IMicroiHDFS, MicroiHDFSAliyun>();
    //            //services.AddSingleton<IMicroiHDFS, MicroiHDFSAliyun>();
    //            Console.WriteLine("Microi：注入分布式存储插件成功！");
    //            return services;
    //        }
    //        catch (Exception ex)
    //        {
    //            Console.WriteLine("Microi：注入分布式存储插件失败：" + ex.Message);
    //            return services;
    //        }
    //    }
    //}

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

