using Dos.ORM;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class LoginSessionRefreshSourceContractTests
{
    [Fact]
    public void RefreshToken_RefreshesProjectionSuccessfullyBeforeRotatingToken()
    {
        var body = ReadMethod(
            Path.Combine("Microi.Server", "Microi.net", "Identity", "SysUserSessionRuntime.cs"),
            "public async Task<object> RefreshToken(SysUserParam param)");

        var refresh = body.IndexOf(
            "_sysUserLogic.RefreshLoginUser(userId, osClient)",
            StringComparison.Ordinal);
        var successGuard = body.IndexOf(
            "if (refreshResult.Code != 1 || refreshResult.Data == null)",
            refresh,
            StringComparison.Ordinal);
        var failedRefreshReturn = body.IndexOf(
            "return Json(refreshResult);",
            successGuard,
            StringComparison.Ordinal);
        var rotation = body.IndexOf(
            "new DiyToken().GetAccessToken",
            failedRefreshReturn,
            StringComparison.Ordinal);

        Assert.True(refresh >= 0, "RefreshToken 必须委托 RefreshLoginUser 重建权限投影。");
        Assert.True(successGuard > refresh, "权限投影刷新后必须先检查成功结果。");
        Assert.True(failedRefreshReturn > successGuard, "权限投影失败必须直接返回原错误。");
        Assert.True(rotation > failedRefreshReturn, "只有权限投影成功后才允许轮换 Token。");
        Assert.Contains("RotateFromToken = previousToken", body, StringComparison.Ordinal);
    }

    [Fact]
    public void RefreshToken_DoesNotReimplementDestructivePermissionFallbacks()
    {
        var body = ReadMethod(
            Path.Combine("Microi.Server", "Microi.net", "Identity", "SysUserSessionRuntime.cs"),
            "public async Task<object> RefreshToken(SysUserParam param)");

        Assert.Contains("_sysUserLogic.RefreshLoginUser(userId, osClient)", body, StringComparison.Ordinal);
        Assert.DoesNotContain("GetTableDataAsync<SysRole>", body, StringComparison.Ordinal);
        Assert.DoesNotContain("GetTableDataAsync<SysRoleLimit>", body, StringComparison.Ordinal);
        Assert.DoesNotContain("_RoleLimitsError", body, StringComparison.Ordinal);
        Assert.DoesNotContain("sysUser[\"_IsAdmin\"] = false", body, StringComparison.Ordinal);
        Assert.DoesNotContain("new List<SysRole>()", body, StringComparison.Ordinal);
        Assert.DoesNotContain("new List<SysRoleLimit>()", body, StringComparison.Ordinal);
        Assert.DoesNotContain("LoginTokenSysUser", body, StringComparison.Ordinal);
    }

    [Fact]
    public void RefreshLoginUser_BuildsFromPrimaryAndMergesProjectionUnderRotationLock()
    {
        var body = ReadMethod(
            Path.Combine("Microi.Server", "Microi.Core", "Logic", "SysUserLogic.cs"),
            "public async Task<DosResult<dynamic>> RefreshLoginUser(string userId, string osClient)");

        Assert.Contains(
            "var identityDbSession = OsClientExtend.GetClient(canonicalTenant).Db;",
            body,
            StringComparison.Ordinal);
        Assert.DoesNotContain(".DbRead", body, StringComparison.Ordinal);
        Assert.Contains("BuildLoginProjectionUserQuery(canonicalTenant, userId)", body, StringComparison.Ordinal);
        Assert.Contains("projectionRead", body, StringComparison.Ordinal);
        Assert.Contains(
            "PlatformAdministratorSecurity.ParseRoleIds(",
            body,
            StringComparison.Ordinal);
        Assert.DoesNotContain("IsDeleted = 0", body, StringComparison.Ordinal);
        Assert.Contains("d.IsDeleted != 1", body, StringComparison.Ordinal);

        var roleRead = body.IndexOf("new SysRoleLogic().GetSysRole(", StringComparison.Ordinal);
        var limitRead = body.IndexOf("new SysRoleLimitLogic().GetSysRoleLimit(", StringComparison.Ordinal);
        var lockStart = body.IndexOf(
            "var lockResult = await MicroiEngine.Lock.ActionLockAsync",
            StringComparison.Ordinal);
        var lockEnd = body.IndexOf("if (lockResult.Code", lockStart, StringComparison.Ordinal);

        Assert.True(roleRead >= 0, "角色必须由受信任的角色逻辑读取。");
        Assert.Contains(
            "identityDbSession",
            body[roleRead..limitRead],
            StringComparison.Ordinal);
        Assert.True(limitRead > roleRead, "角色权限读取必须跟随角色读取。");
        Assert.Contains(
            "identityDbSession",
            body[limitRead..lockStart],
            StringComparison.Ordinal);
        Assert.True(lockStart > limitRead && lockEnd > lockStart, "刷新投影必须使用会话轮换锁提交。");

        var lockScope = body[lockStart..lockEnd];
        Assert.Contains("Key = $\"{cacheKey}:Rotate\"", lockScope, StringComparison.Ordinal);
        Assert.Contains(
            "var latestToken = await DiyCacheBase.GetAsync<CurrentToken>(cacheKey);",
            lockScope,
            StringComparison.Ordinal);
        Assert.Contains("latestToken.CurrentUser = sysUser;", lockScope, StringComparison.Ordinal);
        Assert.Contains("DiyCacheBase.SetAsync(cacheKey, latestToken)", lockScope, StringComparison.Ordinal);
        Assert.DoesNotContain("latestToken.Token =", lockScope, StringComparison.Ordinal);
        Assert.DoesNotContain("latestToken.Tokens =", lockScope, StringComparison.Ordinal);
        Assert.DoesNotContain("latestToken.AuthVersion =", lockScope, StringComparison.Ordinal);
        Assert.DoesNotContain("latestToken.CreateTime =", lockScope, StringComparison.Ordinal);
        Assert.DoesNotContain("latestToken.UpdateTime =", lockScope, StringComparison.Ordinal);
        Assert.DoesNotContain("SetAsync(cacheKey, currentToken)", body, StringComparison.Ordinal);
    }

    [Fact]
    public void DiyToken_RotationCannotRecreateAnInactiveSession()
    {
        var body = ReadMethod(
            Path.Combine("Microi.Server", "Microi.Core", "Token", "DiyToken.cs"),
            "public async Task<DosResult<CurrentToken>> GetAccessToken(DiyTokenParam param)");
        var lockStart = body.IndexOf(
            "var lockResult = await MicroiEngine.Lock.ActionLockAsync",
            StringComparison.Ordinal);
        var lockEnd = body.IndexOf("if (lockResult.Code", lockStart, StringComparison.Ordinal);

        Assert.True(lockStart >= 0 && lockEnd > lockStart, "Token 轮换必须在共享会话锁内完成。");
        var lockScope = body[lockStart..lockEnd];
        var cacheRead = lockScope.IndexOf(
            "DiyCacheBase.GetAsync<CurrentToken>(userTokenCacheKey)",
            StringComparison.Ordinal);
        var activeGuard = lockScope.IndexOf(
            "if (!rotateFromToken.DosIsNullOrWhiteSpace()",
            StringComparison.Ordinal);
        var createSession = lockScope.IndexOf("tokenModel = new CurrentToken", StringComparison.Ordinal);
        var cacheWrite = lockScope.LastIndexOf(
            "DiyCacheBase.SetAsync(userTokenCacheKey, tokenModel)",
            StringComparison.Ordinal);

        Assert.True(cacheRead >= 0, "轮换必须在锁内重读当前共享会话。");
        Assert.True(activeGuard > cacheRead, "必须在锁内重读后校验旧 Token 是否仍然有效。");
        Assert.True(createSession > activeGuard, "失活会话校验必须先于任何新会话构造。");
        Assert.True(cacheWrite > createSession, "只有通过轮换校验的会话才允许写回缓存。");
        Assert.Contains(
            "tokenModel == null || !IsActiveCachedToken(tokenModel, rotateFromToken)",
            lockScope,
            StringComparison.Ordinal);
        Assert.Contains("rotationFailureMessage", lockScope, StringComparison.Ordinal);
        Assert.Contains("return;", lockScope[activeGuard..createSession], StringComparison.Ordinal);
        Assert.Contains("? 1001", body[lockEnd..], StringComparison.Ordinal);
    }

    [Fact]
    public void SysRoleLogic_AllowsAnAuthoritativeDatabaseSession()
    {
        var source = ReadSource(
            Path.Combine("Microi.Server", "Microi.Core", "Logic", "SysRoleLogic.cs"));
        var body = ExtractMethod(source, "public async Task<DosResultList<SysRole>> GetSysRole");

        Assert.Contains("DbSession dbSessionParam = null", source, StringComparison.Ordinal);
        Assert.Contains(
            "dbSessionParam ?? OsClientExtend.GetClient(param.OsClient).DbRead",
            body,
            StringComparison.Ordinal);

        var method = typeof(SysRoleLogic).GetMethod(
            nameof(SysRoleLogic.GetSysRole),
            new[] { typeof(SysRoleParam), typeof(DbSession) });
        Assert.NotNull(method);
        var sessionParameter = method.GetParameters()[1];
        Assert.True(sessionParameter.HasDefaultValue);
        Assert.Null(sessionParameter.DefaultValue);
    }

    [Theory]
    [InlineData("[\"role-a\"]", "role-a")]
    [InlineData("[{\"Id\":\"role-b\",\"Name\":\"Administrator\",\"Level\":9999}]", "role-b")]
    public void RefreshRoleIdParser_AcceptsHistoricalStringAndObjectArrays(
        string serializedRoleIds,
        string expectedRoleId)
    {
        var roleIds = PlatformAdministratorSecurity.ParseRoleIds(serializedRoleIds);

        Assert.Equal(new[] { expectedRoleId }, roleIds);
    }

    private static string ReadMethod(string relativePath, string methodSignature)
    {
        return ExtractMethod(ReadSource(relativePath), methodSignature);
    }

    private static string ReadSource(string relativePath)
    {
        return File.ReadAllText(Path.Combine(FindRepositoryRoot(), relativePath));
    }

    private static string ExtractMethod(string source, string methodSignature)
    {
        var nameIndex = source.IndexOf(methodSignature, StringComparison.Ordinal);
        Assert.True(nameIndex >= 0, $"未找到方法 {methodSignature}");
        var start = source.IndexOf('{', nameIndex);
        Assert.True(start >= 0, $"未找到方法 {methodSignature} 的方法体");
        var depth = 0;
        for (var index = start; index < source.Length; index++)
        {
            if (source[index] == '{')
            {
                depth++;
            }
            else if (source[index] == '}' && --depth == 0)
            {
                return source[start..(index + 1)];
            }
        }
        throw new InvalidOperationException($"方法 {methodSignature} 的方法体不完整");
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.Server"))
                && Directory.Exists(Path.Combine(current.FullName, "Microi.Client")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("Unable to locate the Microi repository root.");
    }
}
