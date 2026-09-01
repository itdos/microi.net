using Microi.net;

namespace Microi.Tests.Common;

public sealed class WorkflowRoleBindingResolverTests
{
    [Fact]
    public void HistoricalObjectArray_ResolvesExplicitRoleId()
    {
        var result = Resolve(
            "[{\"Id\":\"role-admin\",\"Name\":\"超级管理员\"}]",
            Role("role-admin", "超级管理员"));

        Assert.True(result.Success, result.ErrorMessage);
        Assert.Equal(new[] { "role-admin" }, result.RoleIds);
    }

    [Fact]
    public void StableIdStringArray_ResolvesRoleIdBeforeSameTextName()
    {
        var result = Resolve(
            "[\"role-admin\"]",
            Role("role-admin", "超级管理员"),
            Role("other-role", "role-admin"));

        Assert.True(result.Success, result.ErrorMessage);
        Assert.Equal(new[] { "role-admin" }, result.RoleIds);
    }

    [Fact]
    public void LegacyUniqueNameString_ResolvesToStableRoleId()
    {
        var result = Resolve(
            "[\"超级管理员\"]",
            Role("role-admin", "超级管理员"));

        Assert.True(result.Success, result.ErrorMessage);
        Assert.Equal(new[] { "role-admin" }, result.RoleIds);
    }

    [Fact]
    public void MixedHistoricalShapes_AreResolvedAndDeduplicated()
    {
        var result = Resolve(
            "[{\"Id\":\"role-admin\",\"Name\":\"旧名称\"},\"role-admin\",{\"Name\":\"审批员\"}]",
            Role("role-admin", "超级管理员"),
            Role("role-approver", "审批员"));

        Assert.True(result.Success, result.ErrorMessage);
        Assert.Equal(new[] { "role-admin", "role-approver" }, result.RoleIds);
    }

    [Fact]
    public void InvalidJson_FailsClosed()
    {
        var selection = WorkflowRoleBindingResolver.Parse("[\"role-admin\"");

        Assert.False(selection.Success);
        Assert.Contains("有效的 JSON", selection.ErrorMessage);
    }

    [Fact]
    public void UnknownStringRole_FailsClosed()
    {
        var result = Resolve("[\"不存在的角色\"]");

        Assert.False(result.Success);
        Assert.Contains("不存在或已删除", result.ErrorMessage);
    }

    [Fact]
    public void DuplicateExactRoleName_FailsClosed()
    {
        var result = Resolve(
            "[\"审批员\"]",
            Role("role-a", "审批员"),
            Role("role-b", "审批员"));

        Assert.False(result.Success);
        Assert.Contains("名称不唯一", result.ErrorMessage);
    }

    [Fact]
    public void ExplicitObjectId_DoesNotFallBackToLegacyName()
    {
        var result = Resolve(
            "[{\"Id\":\"deleted-role\",\"Name\":\"超级管理员\"}]",
            Role("role-admin", "超级管理员"));

        Assert.False(result.Success);
        Assert.Contains("角色 Id 不存在或已删除", result.ErrorMessage);
    }

    [Fact]
    public void InvalidExplicitObjectId_DoesNotFallBackToLegacyName()
    {
        var selection = WorkflowRoleBindingResolver.Parse(
            "[{\"Id\":null,\"Name\":\"超级管理员\"}]");

        Assert.False(selection.Success);
        Assert.Contains("Id 必须是非空字符串", selection.ErrorMessage);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("null")]
    [InlineData("[]")]
    public void EmptyRoleBinding_IsValidAndResolvesNoRole(string? json)
    {
        var result = Resolve(json);

        Assert.True(result.Success, result.ErrorMessage);
        Assert.Empty(result.RoleIds);
    }

    private static WorkflowRoleBindingResolution Resolve(
        string? json,
        params WorkflowRoleBindingRole[] roles)
    {
        var selection = WorkflowRoleBindingResolver.Parse(json);
        return WorkflowRoleBindingResolver.Resolve(selection, roles);
    }

    private static WorkflowRoleBindingRole Role(string id, string name)
    {
        return new WorkflowRoleBindingRole { Id = id, Name = name };
    }
}
