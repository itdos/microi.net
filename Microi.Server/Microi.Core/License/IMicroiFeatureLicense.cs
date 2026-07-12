namespace Microi.net
{
    /// <summary>
    /// 平台付费功能统一授权状态。
    /// 由宿主 Microi.net 实现，AI、Controller 和其它插件只能读取此入口，禁止各自缓存或重复验签。
    /// </summary>
    public interface IMicroiFeatureLicense
    {
        OnlineAiLicenseState GetOnlineAiLicenseState();
    }

    public sealed class OnlineAiLicenseState
    {
        public bool IsLicensed { get; set; }
        public string ProductType { get; set; }
        public string ProviderAssemblyVersion { get; set; }
    }
}
