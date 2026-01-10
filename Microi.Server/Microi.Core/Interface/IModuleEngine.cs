using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 模块引擎接口
    /// </summary>
    public interface IModuleEngine
    {
        /// <summary>
        /// 获取数据列表（异步）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>数据结果列表</returns>
        Task<DosResultList<dynamic>> GetTableDataAsync(dynamic dynamicParam);

        /// <summary>
        /// 获取数据列表（同步）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>数据结果列表</returns>
        DosResultList<dynamic> GetTableData(dynamic dynamicParam);

        /// <summary>
        /// 获取指定类型的数据列表（异步）
        /// </summary>
        /// <typeparam name="T">返回数据类型</typeparam>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>数据结果列表</returns>
        Task<DosResultList<T>> GetTableDataAsync<T>(dynamic dynamicParam);

        /// <summary>
        /// 获取数据数量（异步）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>数据结果列表（仅包含数量）</returns>
        Task<DosResultList<dynamic>> GetTableDataCountAsync(dynamic dynamicParam);

        /// <summary>
        /// 获取数据数量（同步）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>数据结果列表（仅包含数量）</returns>
        DosResultList<dynamic> GetTableDataCount(dynamic dynamicParam);

        /// <summary>
        /// 获取树形数据（异步）- 已废弃，请使用 GetTableDataTreeAsync
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>树形数据结果列表</returns>
        [Obsolete("同GetTableDataTreeAsync")]
        Task<DosResultList<dynamic>> GetTableTreeAsync(dynamic dynamicParam);

        /// <summary>
        /// 获取树形数据（同步）- 已废弃，请使用 GetTableDataTree
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>树形数据结果列表</returns>
        [Obsolete("同GetTableDataTree")]
        DosResultList<dynamic> GetTableTree(dynamic dynamicParam);

        /// <summary>
        /// 获取树形数据（异步）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>树形数据结果列表</returns>
        Task<DosResultList<dynamic>> GetTableDataTreeAsync(dynamic dynamicParam);

        /// <summary>
        /// 获取树形数据（同步）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>树形数据结果列表</returns>
        DosResultList<dynamic> GetTableDataTree(dynamic dynamicParam);

        /// <summary>
        /// 获取模块模型
        /// </summary>
        /// <param name="dynamicParam">动态参数，可传入Id或ModuleEngineKey</param>
        /// <returns>模块模型结果</returns>
        Task<DosResult<dynamic>> GetModuleModel(dynamic dynamicParam);
    }
}