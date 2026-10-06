namespace Microi.net
{
    /// <summary>复用宿主现有共享验证码提供方，避免并行维护第二套验证状态。</summary>
    public interface ISaasTrialCaptcha
    {
        bool Validate(string osClient, string id, string value);
    }
}
