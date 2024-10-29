namespace Microi.net;

public partial interface ISuppertToClientInvoke
{
    /// <summary>
    /// 私聊
    /// </summary>
    /// <param name="msg"></param>
    /// <returns></returns>
    Task SendToUser(MessageBodyParam msg); //, string userId
}
