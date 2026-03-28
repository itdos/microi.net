using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    public interface IMongoDB
    {
        /// <summary>
        /// 生成新的MongoDB ObjectId
        /// </summary>
        /// <returns>ObjectId字符串</returns>
        string NewId();

        /// <summary>
        /// 添加表单数据（需要传入osClient）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>操作结果</returns>
        DosResult AddFormData(dynamic dynamicParam);

        /// <summary>
        /// 更新表单数据（需要传入osClient）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>操作结果</returns>
        DosResult UptFormData(dynamic dynamicParam);

        /// <summary>
        /// 删除表单数据（需要传入osClient）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>操作结果</returns>
        DosResult DelFormData(dynamic dynamicParam);

        /// <summary>
        /// 获取表单数据（需要传入osClient）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>表单数据结果</returns>
        DosResult<dynamic> GetFormData(dynamic dynamicParam);

        /// <summary>
        /// 获取表数据（需要传入osClient）
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>表数据列表结果</returns>
        DosResultList<dynamic> GetTableData(dynamic dynamicParam);
        Task<DosResult> AddSysLog(SysLogParam param);
        Task<DosResultList<SysLog>> GetSysLog(SysLogParam param);
        Task<DosResult> GetSysLogTypes(SysLogParam param);
        /// <summary>
        /// 一次性返回当前月 5 类日志的并行数量统计（Error/Warn/SlowSQL/SlowExec/Exception）
        /// </summary>
        Task<DosResult> GetSysLogStats(SysLogParam param);
        /// <summary>
        /// 异步写接口调用次数（首次插入，之后累加 CallCount）
        /// </summary>
        Task<DosResult> AddApiCallCount(ApiCallCountParam param);
        /// <summary>
        /// 获取接口调用次数排行
        /// </summary>
        Task<DosResultList<ApiCallCount>> GetApiCallCountRank(ApiCallCountParam param);
    }
}
