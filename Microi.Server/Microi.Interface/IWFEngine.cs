using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// 工作流引擎接口
    /// </summary>
    public interface IWFEngine
    {
        /// <summary>
        /// 获取V8条件线值
        /// </summary>
        Task<string> GetV8LineValue(GetV8LineValueParam param);

        /// <summary>
        /// 启动工作流
        /// </summary>
        Task<DosResult> StartWork(WFParam param, DbTrans _trans = null);

        /// <summary>
        /// 发送工作（审批流程）
        /// </summary>
        Task<DosResult> SendWork(WFParam param, DbTrans _trans = null);

        /// <summary>
        /// 移交工作
        /// </summary>
        Task<DosResult> HandOverWork(WFParam param);

        /// <summary>
        /// 撤回工作
        /// </summary>
        Task<DosResult> RecallWork(WFParam param);

        /// <summary>
        /// 作废流程实例
        /// </summary>
        Task<DosResult> CancelFlow(WFParam param);

        /// <summary>
        /// 获取下个节点的确认用户
        /// </summary>
        Task<DosResult> GetNextNodeConfirmUsers(WFParam param);

        /// <summary>
        /// 获取开始节点
        /// </summary>
        Task<DosResult<WFNode>> GetStartWFNode(WFParam param);
    }
}