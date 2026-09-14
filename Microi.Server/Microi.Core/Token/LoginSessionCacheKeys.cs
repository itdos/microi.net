namespace Microi.net
{
    /// <summary>
    /// 多终端会话使用独立协议命名空间。旧 API 会整条覆盖 LoginTokenSysUser，
    /// 所以新节点不得读写、迁入或回退该键；否则旧登录会再次覆盖会话，或复活已吊销的 Token。
    /// 首次切换需要在新版重新登录，旧版会话保持原样，JWT 签名密钥无需轮换。
    /// </summary>
    public static class LoginSessionCacheKeys
    {
        public static string UserPrefix(string osClient) => $"Microi:{osClient}:LoginSessions:V2:SysUser:";
        public static string User(string osClient, string userId) => $"{UserPrefix(osClient)}{userId}";
    }
}
