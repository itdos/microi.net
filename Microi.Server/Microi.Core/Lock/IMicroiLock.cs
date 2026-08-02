#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using Dos.Common;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    /// <summary>
    /// 已获取的分布式租约上下文。长任务可在每个外部副作用前后主动确认所有权，
    /// 并携带单调递增 fencing token 供业务状态机审计或条件写入。
    /// </summary>
    public interface IMicroiLockLease
    {
        bool IsLost { get; }
        string LossReason { get; }
        long FencingToken { get; }
        void ThrowIfLost();
        Task EnsureHeldAsync();
    }

    /// <summary>
    /// 微信模板消息接口
    /// </summary>
    public interface IMicroiLock
    {
        Task<DosResult> ActionLockAsync(MicroiLockParam param, Func<Task> action);
        Task<DosResult> ActionLockAsync(MicroiLockParam param, Func<IMicroiLockLease, Task> action);
    }
}
