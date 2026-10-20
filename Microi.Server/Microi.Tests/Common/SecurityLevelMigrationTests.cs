using Microi.net;

namespace Microi.Tests.Common;

public sealed class SecurityLevelMigrationTests
{
    [Theory]
    [InlineData("7.6.14.0", false, true)]
    [InlineData("", false, true)]
    [InlineData("7.6.14.0", true, false)]
    [InlineData("", true, false)]
    [InlineData("7.6.15.0", false, false)]
    [InlineData("7.6.16.0", false, false)]
    [InlineData("7.6.17.0", true, false)]
    [InlineData("invalid", false, false)]
    public void HistoricalConversionRequiresOldVersionAndNoModernAdministrator(string version, bool modern, bool expected)
        => Assert.Equal(expected, SecurityLevelMigrationPolicy.IsLegacyDatabase(version, modern));

    [Theory]
    [InlineData(998, false, 998)]
    [InlineData(999, false, 999)]
    [InlineData(9998, false, 9998)]
    [InlineData(998, true, 9998)]
    [InlineData(999, true, 9999)]
    [InlineData(905, true, 905)]
    public void CustomUsersAndRolesKeepTheirLevelUnlessConfirmedLegacy(int level, bool legacy, int expected)
    {
        Assert.Equal(expected, SecurityLevelMigrationPolicy.UserLevel("ordinary", level, legacy));
        Assert.Equal(expected, SecurityLevelMigrationPolicy.RoleLevel("普通角色", level, legacy));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(998)]
    [InlineData(999)]
    [InlineData(9998)]
    [InlineData(9999)]
    public void BuiltInAdministratorAccountAndRoleAlwaysResolveTo9999(int level)
    {
        Assert.Equal(9999, SecurityLevelMigrationPolicy.UserLevel("ADMIN", level, false));
        Assert.Equal(9999, SecurityLevelMigrationPolicy.RoleLevel("超级管理员", level, false));
        Assert.Equal(level, SecurityLevelMigrationPolicy.RoleLevel("超级管理员助理", level, false));
        Assert.Equal(level, SecurityLevelMigrationPolicy.UserLevel("admin2", level, false));
    }

    [Fact]
    public void BeilunStaleRoleSnapshotUsesAuthoritativeRoleAndPreservesBindings()
    {
        const string before = """[{"Id":"r1","Name":"超级管理员","Level":998},{"Id":"business","Level":999}]""";
        var levels = new Dictionary<string, int> { ["r1"] = 9999, ["business"] = 999 };
        var after = SecurityLevelMigrationPolicy.RefreshRoleSnapshot(before, levels);
        Assert.Equal("""[{"Id":"r1","Name":"超级管理员","Level":9999},{"Id":"business","Level":999}]""", after);
        Assert.Equal(after, SecurityLevelMigrationPolicy.RefreshRoleSnapshot(after, levels));
        Assert.Equal("""["r1"]""", SecurityLevelMigrationPolicy.RefreshRoleSnapshot("""["r1"]""", levels));
        Assert.ThrowsAny<Exception>(() => SecurityLevelMigrationPolicy.RefreshRoleSnapshot("broken", levels));
    }
}
