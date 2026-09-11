using System;

namespace Microi.net
{
    /// <summary>
    /// 仅标记具备独立并发上限和强鉴权的应急动作；宿主不能按客户端可伪造的路径前缀放行。
    /// </summary>
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class DatabasePoolRecoveryEndpointAttribute : Attribute { }
}
