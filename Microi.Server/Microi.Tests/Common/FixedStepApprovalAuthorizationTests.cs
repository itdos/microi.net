using Microi.net;

namespace Microi.Tests.Common;

/// <summary>通用原生规则审批表不能因误授菜单/直接表权限成为普通用户的授权恢复入口。</summary>
public sealed class FixedStepApprovalAuthorizationTests
{
    [Theory]
    [InlineData("Read")][InlineData("List")][InlineData("Add")][InlineData("Edit")]
    [InlineData("Delete")][InlineData("EditByWhere")][InlineData("DeleteByWhere")]
    [InlineData("Import")][InlineData("Export")]
    public void Every_generic_operation_requires_platform_administrator(string operation)
    {
        Assert.True(PlatformResourceSecurity.RequiresPlatformAdministrator("mci_runtime_installation",operation));
    }
    [Theory]
    [InlineData("Read")][InlineData("Add")][InlineData("Edit")][InlineData("Del")]
    public void Ordinary_role_cannot_receive_direct_grant_but_admin_maintenance_remains(string permission)
    {
        Assert.False(PlatformResourceSecurity.CanGrantDirectTablePermission("mci_runtime_installation",permission,1));
        Assert.True(PlatformResourceSecurity.CanGrantDirectTablePermission("mci_runtime_installation",permission,9999));
    }
    [Fact]
    public void Anonymous_and_case_variants_are_closed_without_blocking_ordinary_business_tables()
    {
        Assert.True(PlatformResourceSecurity.DeniesAnonymousAccess(" MCI_RUNTIME_INSTALLATION "));
        Assert.True(PlatformResourceSecurity.IsProtectedTable("mci_runtime_installation"));
        Assert.False(PlatformResourceSecurity.IsProtectedTable("app_example_order"));
        Assert.True(PlatformResourceSecurity.CanGrantDirectTablePermission("app_example_order","Edit",1));
    }
}
