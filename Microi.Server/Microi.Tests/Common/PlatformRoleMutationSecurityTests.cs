using System.Reflection;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class PlatformRoleMutationSecurityTests
{
    [Fact]
    public void SysRoleController_IsProtectedByPlatformAdministratorFilter()
    {
        Assert.NotNull(typeof(SysRoleController).GetCustomAttribute<PlatformAdminOnlyAttribute>(true));
    }

    [Fact]
    public void DatabaseRoleDemotion_InvalidatesOtherwiseStaleAdministratorPrincipal()
    {
        var currentUser = new JObject
        {
            ["Id"] = "executive-user",
            ["Account"] = "executive",
            ["Level"] = DiyCommon.MaxRoleLevel,
            ["_IsAdmin"] = true
        };
        var databaseUser = new SysUser
        {
            Id = "executive-user",
            Account = "executive",
            Level = DiyCommon.MaxRoleLevel,
            State = 1,
            IsDeleted = 0,
            RoleIds = "[\"executive-role\"]"
        };
        var demotedRole = new SysRole
        {
            Id = "executive-role",
            Level = DiyCommon.MaxRoleLevel - 1,
            IsDeleted = 0
        };

        Assert.False(PlatformAdministratorSecurity.HasEffectivePlatformAdministratorLevel(
            currentUser,
            databaseUser,
            new[] { demotedRole }));
    }

    [Fact]
    public void ForgedPostmanAdministratorFlag_CannotRaiseOrdinaryDatabaseUser()
    {
        var currentUser = new JObject
        {
            ["Id"] = "ordinary-user",
            ["Account"] = "executive",
            ["Level"] = DiyCommon.MaxRoleLevel,
            ["_IsAdmin"] = true
        };
        var databaseUser = new SysUser
        {
            Id = "ordinary-user",
            Account = "executive",
            Level = 100,
            State = 1,
            IsDeleted = 0,
            RoleIds = "[\"ordinary-role\"]"
        };
        var ordinaryRole = new SysRole
        {
            Id = "ordinary-role",
            Level = 100,
            IsDeleted = 0
        };

        Assert.False(PlatformAdministratorSecurity.HasEffectivePlatformAdministratorLevel(
            currentUser,
            databaseUser,
            new[] { ordinaryRole }));
    }

    [Fact]
    public void ActiveDatabaseAdministratorRole_AllowsRoleMutationBoundary()
    {
        var currentUser = new JObject
        {
            ["Id"] = "platform-admin",
            ["Account"] = "admin-a",
            ["Level"] = DiyCommon.MaxRoleLevel
        };
        var databaseUser = new SysUser
        {
            Id = "platform-admin",
            Account = "admin-a",
            Level = DiyCommon.MaxRoleLevel,
            State = 1,
            IsDeleted = 0,
            RoleIds = "[{\"Id\":\"platform-role\",\"Name\":\"平台管理员\"}]"
        };
        var administratorRole = new SysRole
        {
            Id = "platform-role",
            Level = DiyCommon.MaxRoleLevel,
            IsDeleted = 0
        };

        Assert.True(PlatformAdministratorSecurity.HasEffectivePlatformAdministratorLevel(
            currentUser,
            databaseUser,
            new[] { administratorRole }));
    }

    [Fact]
    public void DirectGrantPolicy_RejectsSensitiveAndReadOnlyWritePayloads()
    {
        var ordinaryRoleLevel = DiyCommon.MaxRoleLevel - 1;

        Assert.False(PlatformResourceSecurity.CanGrantDirectTablePermission(
            "sys_role",
            "Read",
            ordinaryRoleLevel));
        Assert.True(PlatformResourceSecurity.CanGrantDirectTablePermission(
            "sys_microiservice",
            "Read",
            ordinaryRoleLevel));
        Assert.False(PlatformResourceSecurity.CanGrantDirectTablePermission(
            "sys_microiservice",
            "Edit",
            ordinaryRoleLevel));
        Assert.True(PlatformResourceSecurity.CanGrantDirectTablePermission(
            "mic_print",
            "Edit",
            ordinaryRoleLevel));
    }
}
