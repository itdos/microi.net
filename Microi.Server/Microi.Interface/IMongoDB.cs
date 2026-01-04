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
    }
}
