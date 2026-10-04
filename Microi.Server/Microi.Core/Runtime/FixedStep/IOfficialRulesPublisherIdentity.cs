namespace Microi.FixedStep
{
/// <summary>
/// 后端受信身份边界。Core只消费契约，具体官方许可证实现由已编译宿主注入；
/// 不暴露为V8原子，不从租户配置、审批行或请求参数读取“官方”布尔值。
/// </summary>
public interface IOfficialRulesPublisherIdentity
{
    /// <summary>每次审批回读重新核验当前节点对该固定租户的官方签发身份。</summary>
    bool IsOfficialPublisher(string tenant);
}
}
