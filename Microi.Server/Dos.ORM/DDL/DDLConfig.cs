namespace Dos.ORM
{
    /// <summary>
    /// DDL（数据库结构操作）全局配置
    /// 由上层框架（Microi.Core）在启动时设置回调
    /// </summary>
    public static class DDLConfig
    {
        /// <summary>
        /// 多语言消息回调：GetLang(osClient, key, lang) → 本地化字符串
        /// 上层框架注入 DiyMessage.GetLang
        /// </summary>
        public static System.Func<string, string, string, string> GetLang { get; set; }
            = (osClient, key, lang) => key; // 默认返回key本身

        /// <summary>
        /// 默认语言标识
        /// </summary>
        public static string DefaultLang { get; set; } = "cn";
    }
}
