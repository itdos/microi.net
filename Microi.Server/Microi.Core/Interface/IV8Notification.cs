using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 后端 V8 的平台内部通知入口。业务事实由接口引擎先持久化，
    /// 此接口只负责在事务提交后通过 SignalR 发出低延迟提示。
    /// </summary>
    public interface IV8Notification
    {
        /// <summary>
        /// 向当前租户的指定用户推送平台内部通知。
        /// </summary>
        DosResult Send(dynamic dynamicParam);
    }
}
