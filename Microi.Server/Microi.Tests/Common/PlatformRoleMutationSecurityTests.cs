using System.Reflection;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class PlatformRoleMutationSecurityTests
{
    [Fact]
    public void SysRoleMutationEndpoints_AreProtectedByPlatformAdministratorFilter()
    {
        Assert.Null(typeof(SysRoleController).GetCustomAttribute<PlatformAdminOnlyAttribute>(true));
        foreach (var actionName in new[]
                 {
                     nameof(SysRoleController.AddSysRole),
                     nameof(SysRoleController.AddSysRoleFromBody),
                     nameof(SysRoleController.UptSysRole),
                     nameof(SysRoleController.UptSysRoleFromBody),
                     nameof(SysRoleController.DelSysRole)
                 })
        {
            var action = typeof(SysRoleController).GetMethod(actionName);
            Assert.NotNull(action);
            Assert.NotNull(action!.GetCustomAttribute<PlatformAdminOnlyAttribute>(true));
        }

        var catalogAction = typeof(SysRoleController).GetMethod(nameof(SysRoleController.GetSysRole));
        Assert.NotNull(catalogAction);
        Assert.Null(catalogAction!.GetCustomAttribute<PlatformAdminOnlyAttribute>(true));
    }

    [Fact]
    public void DelegatedRoleCatalog_ContainsOnlyLowerRolesAndOwnedPeerRole()
    {
        var result = SysUserManagementSecurity.SelectAssignableRoles(
            100,
            new[] { "manager-role" },
            new[]
            {
                new SysRole { Id = "administrator", Name = "Administrator", Level = DiyCommon.MaxRoleLevel },
                new SysRole { Id = "foreign-peer", Name = "Foreign peer", Level = 100 },
                new SysRole { Id = "manager-role", Name = "Manager", Level = 100 },
                new SysRole { Id = "subordinate-role", Name = "Subordinate", Level = 10 },
                new SysRole { Id = "deleted-role", Name = "Deleted", Level = 1, IsDeleted = 1 }
            });

        Assert.Equal(new[] { "manager-role", "subordinate-role" }, result.Select(role => role.Id));
        Assert.All(result, role =>
        {
            Assert.Null(role.BaseLimit);
            Assert.Null(role.DeptIds);
        });
    }

    [Theory]
    [InlineData(nameof(SysUserController.GetSysUser))]
    [InlineData(nameof(SysUserController.AddSysUser))]
    [InlineData(nameof(SysUserController.DelSysUser))]
    public void SysUserCrudEndpoints_UseGranularTableAuthorization(string actionName)
    {
        var action = typeof(SysUserController).GetMethod(actionName);
        Assert.NotNull(action);
        Assert.Null(action!.GetCustomAttribute<PlatformAdminOnlyAttribute>(true));
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
        Assert.True(PlatformResourceSecurity.CanGrantDirectTablePermission(
            "sys_user",
            "Edit",
            ordinaryRoleLevel));
    }

    [Fact]
    public void DelegatedUserManager_CannotChangeOwnRoleMembership()
    {
        var result = EvaluateUserMutation(
            SysUserManagementOperation.Edit,
            targetUserId: "manager",
            targetLevel: 100,
            currentTargetRoleIds: new[] { "manager-role" },
            requestedRoleIds: new[] { "manager-role", "other-role" },
            requestedRoleLevels: new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                ["manager-role"] = 100,
                ["other-role"] = 10
            });

        Assert.False(result.Allowed);
        Assert.Equal("self_role_change_denied", result.Reason);
    }

    [Fact]
    public void DelegatedUserManager_CanEchoOwnUnchangedRoleWithoutMutatingAuthority()
    {
        var result = EvaluateUserMutation(
            SysUserManagementOperation.Edit,
            targetUserId: "manager",
            targetLevel: 100,
            currentTargetRoleIds: new[] { "manager-role" },
            requestedRoleIds: new[] { "manager-role" },
            requestedRoleLevels: new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                ["manager-role"] = 100
            });

        Assert.True(result.Allowed);
        Assert.False(result.RoleIdsChanged);
        Assert.Equal(100, result.AssignedLevel);
    }

    [Fact]
    public void DelegatedLevelZeroManager_CanAssignOnlyItsOwnLevelZeroRole()
    {
        var ownRole = EvaluateUserMutation(
            SysUserManagementOperation.Add,
            targetUserId: null,
            targetLevel: 0,
            currentTargetRoleIds: Array.Empty<string>(),
            requestedRoleIds: new[] { "level-zero-role" },
            requestedRoleLevels: new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                ["level-zero-role"] = 0
            },
            actorLevel: 0,
            actorRoleIds: new[] { "level-zero-role" });
        var foreignRole = EvaluateUserMutation(
            SysUserManagementOperation.Add,
            targetUserId: null,
            targetLevel: 0,
            currentTargetRoleIds: Array.Empty<string>(),
            requestedRoleIds: new[] { "foreign-level-zero-role" },
            requestedRoleLevels: new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                ["foreign-level-zero-role"] = 0
            },
            actorLevel: 0,
            actorRoleIds: new[] { "level-zero-role" });

        Assert.True(ownRole.Allowed);
        Assert.Equal(0, ownRole.AssignedLevel);
        Assert.False(foreignRole.Allowed);
        Assert.Equal("assigned_role_level_not_lower", foreignRole.Reason);
    }

    [Fact]
    public void DelegatedUserManager_CannotAssignForeignPeerOrHigherRole()
    {
        var foreignPeer = EvaluateUserMutation(
            SysUserManagementOperation.Add,
            targetUserId: null,
            targetLevel: 0,
            currentTargetRoleIds: Array.Empty<string>(),
            requestedRoleIds: new[] { "foreign-peer" },
            requestedRoleLevels: new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                ["foreign-peer"] = 100
            });
        var higher = EvaluateUserMutation(
            SysUserManagementOperation.Add,
            targetUserId: null,
            targetLevel: 0,
            currentTargetRoleIds: Array.Empty<string>(),
            requestedRoleIds: new[] { "administrator" },
            requestedRoleLevels: new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                ["administrator"] = DiyCommon.MaxRoleLevel
            });

        Assert.False(foreignPeer.Allowed);
        Assert.False(higher.Allowed);
        Assert.Equal("assigned_role_level_not_lower", foreignPeer.Reason);
        Assert.Equal("assigned_role_level_not_lower", higher.Reason);
    }

    [Fact]
    public void DelegatedUserManager_CanAssignOwnedPeerRoleOrLowerRole()
    {
        var ownedPeer = EvaluateUserMutation(
            SysUserManagementOperation.Add,
            targetUserId: null,
            targetLevel: 0,
            currentTargetRoleIds: Array.Empty<string>(),
            requestedRoleIds: new[] { "manager-role" },
            requestedRoleLevels: new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                ["manager-role"] = 100
            });
        var lower = EvaluateUserMutation(
            SysUserManagementOperation.Edit,
            targetUserId: "subordinate",
            targetLevel: 10,
            currentTargetRoleIds: new[] { "subordinate-role" },
            requestedRoleIds: new[] { "subordinate-role" },
            requestedRoleLevels: new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                ["subordinate-role"] = 10
            });

        Assert.True(ownedPeer.Allowed);
        Assert.True(lower.Allowed);
    }

    [Fact]
    public void DelegatedUserManager_CannotDeleteSelfOrManageSuperior()
    {
        var selfDelete = EvaluateUserMutation(
            SysUserManagementOperation.Delete,
            targetUserId: "manager",
            targetLevel: 100,
            currentTargetRoleIds: new[] { "manager-role" },
            requestedRoleIds: Array.Empty<string>(),
            requestedRoleLevels: new Dictionary<string, int>());
        var superiorEdit = EvaluateUserMutation(
            SysUserManagementOperation.Edit,
            targetUserId: "administrator",
            targetLevel: DiyCommon.MaxRoleLevel,
            currentTargetRoleIds: new[] { "administrator-role" },
            requestedRoleIds: Array.Empty<string>(),
            requestedRoleLevels: new Dictionary<string, int>(),
            roleIdsSupplied: false);

        Assert.False(selfDelete.Allowed);
        Assert.False(superiorEdit.Allowed);
        Assert.Equal("self_delete_denied", selfDelete.Reason);
        Assert.Equal("target_level_not_lower", superiorEdit.Reason);
    }

    private static SysUserManagementDecision EvaluateUserMutation(
        SysUserManagementOperation operation,
        string targetUserId,
        int targetLevel,
        IEnumerable<string> currentTargetRoleIds,
        IEnumerable<string> requestedRoleIds,
        IReadOnlyDictionary<string, int> requestedRoleLevels,
        bool roleIdsSupplied = true,
        int actorLevel = 100,
        IEnumerable<string> actorRoleIds = null)
    {
        return SysUserManagementSecurity.Evaluate(
            "manager",
            actorLevel,
            actorRoleIds ?? new[] { "manager-role" },
            operation,
            targetUserId,
            targetLevel,
            currentTargetRoleIds,
            requestedRoleIds,
            requestedRoleLevels,
            roleIdsSupplied);
    }
}
