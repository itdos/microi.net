namespace Microi.net
{
    /// <summary>
    /// SaaS 租户开通全链路进度契约。后端任务和官方应用包生成器共用此单一事实源，
    /// 避免数据库导入期间把前端的总步数从新版回写为历史值。
    /// </summary>
    public static class TenantProvisioningProgressContract
    {
        public const int TotalSteps = 13;
        public const int HostProvisioningCompletedStep = TotalSteps - 2;
    }
}
