using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class UserAccessKeySecurityTests
{
    private static JObject NewScopedUser()
    {
        return new JObject
        {
            ["Id"] = "user-1",
            ["_IsAdmin"] = false,
            ["_AccessKeySession"] = true,
            ["_AccessKeyScopes"] = new JArray("page:open", "form:read", "api-engine:run"),
            ["_AccessKeyAllowedRoutes"] = new JArray("/mic/data-dashboard/preview/dashboard-1"),
            ["_AccessKeyAllowedTableNames"] = new JArray("mic_data_dashboard"),
            ["_AccessKeyAllowedTableIds"] = new JArray("table-dashboard-id"),
            ["_AccessKeyAllowedMenuReferences"] = new JArray(
                "menu-dashboard-id",
                "module-dashboard-key"),
            ["_AccessKeyAllowedFieldIds"] = new JArray("field-dashboard-id"),
            ["_AccessKeyAllowedApiEngineKeys"] = new JArray("dashboard_summary"),
            ["_AccessKeyAllowedDataSourceKeys"] = new JArray()
        };
    }

    [Fact]
    public void GeneratedCredential_UsesPublicPrefixAndStrongSecret()
    {
        var generated = UserAccessKeySecurity.GenerateCredential();

        Assert.StartsWith("microi_ak_", generated.Prefix, StringComparison.Ordinal);
        Assert.StartsWith(generated.Prefix + ".", generated.Credential, StringComparison.Ordinal);
        Assert.True(UserAccessKeySecurity.TryGetPrefix(generated.Credential, out var parsedPrefix));
        Assert.Equal(generated.Prefix, parsedPrefix);
        Assert.Equal(41, generated.Credential.Length);
    }

    [Fact]
    public void CredentialHash_UsesFixedTimeComparableDigest()
    {
        var hash = UserAccessKeySecurity.HashCredential("microi_ak_public.secret");
        var same = UserAccessKeySecurity.HashCredential("microi_ak_public.secret");
        var other = UserAccessKeySecurity.HashCredential("microi_ak_public.other");

        Assert.True(UserAccessKeySecurity.FixedTimeHashEquals(hash, same));
        Assert.False(UserAccessKeySecurity.FixedTimeHashEquals(hash, other));
        Assert.DoesNotContain("secret", hash, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void RouteScope_IsExactAndIgnoresQueryString()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.IsRouteAllowed(
            user,
            "/mic/data-dashboard/preview/dashboard-1?ShowClassicTop=0"));
        Assert.False(UserAccessKeySecurity.IsRouteAllowed(
            user,
            "/mic/data-dashboard/preview/dashboard-2"));
        Assert.False(UserAccessKeySecurity.IsRouteAllowed(user, "/system/sysuser"));
    }

    [Fact]
    public void RouteWildcard_AllowsAnyRouteAndUsesSafeRedirect()
    {
        var user = NewScopedUser();
        user["_AccessKeyAllowedRoutes"] = new JArray("*");

        Assert.True(UserAccessKeySecurity.IsRouteAllowed(user, "/mic/any-authorized-page"));
        Assert.Equal(
            "/mic/any-authorized-page",
            UserAccessKeySecurity.ResolveRedirectPath(
                new[] { "*" },
                "/mic/any-authorized-page?ShowClassicTop=0"));
        Assert.Equal("/", UserAccessKeySecurity.ResolveRedirectPath(new[] { "*" }, null));
        Assert.Equal("*", UserAccessKeySecurity.NormalizeRoute("/*"));
    }

    [Fact]
    public void TableScope_NarrowsReadAndDeniesWriteByDefault()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.IsTableOperationAllowed(
            user,
            "MIC_DATA_DASHBOARD",
            true));
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(
            user,
            "sys_user",
            true));
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(
            user,
            "mic_data_dashboard",
            false));
    }

    [Fact]
    public void TableWildcard_AllowsAccountAuthorizedReadsButStillRequiresScope()
    {
        var user = NewScopedUser();
        user["_AccessKeyAllowedTableNames"] = new JArray("*");

        Assert.True(UserAccessKeySecurity.IsTableOperationAllowed(user, "business_table", true));
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(user, "business_table", false));
        user["_AccessKeyScopes"] = new JArray("page:open");
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(user, "business_table", true));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void RuntimeScope_PreservesLiveAccountAdministratorState(bool isAdmin)
    {
        var user = new JObject
        {
            ["Id"] = "user-1",
            ["Account"] = "tester",
            ["_IsAdmin"] = isAdmin,
            ["_AccessKeySession"] = true,
            ["_AccessKeyId"] = "old-key"
        };
        var runtime = new UserAccessKeyRuntime
        {
            Id = "key-1",
            TargetUserId = "user-1",
            Name = "screen",
            State = 1,
            Scopes = "[\"page:open\",\"form:read\"]",
            AllowedRoutes = "[\"*\"]",
            AllowedTableNames = "[\"*\"]",
            AllowedTableIds = "[\"*\"]",
            AllowedMenuReferences = "[\"*\"]",
            AllowedFieldIds = "[\"*\"]",
            AllowedApiEngineKeys = "[]",
            AllowedDataSourceKeys = "[]"
        };

        var result = UserAccessKeyService.ApplyRuntimeScope(user, runtime);

        Assert.Equal(1, result.Code);
        Assert.Equal(isAdmin, result.Data["_IsAdmin"]?.Value<bool>());
        Assert.Equal("key-1", result.Data["_AccessKeyId"]?.ToString());
        Assert.Equal("old-key", user["_AccessKeyId"]?.ToString());
    }

    [Fact]
    public void RuntimeScope_FailsClosedForRevokedRuntime()
    {
        var result = UserAccessKeyService.ApplyRuntimeScope(
            new JObject { ["Id"] = "user-1", ["_IsAdmin"] = true },
            new UserAccessKeyRuntime
            {
                Id = "key-1",
                TargetUserId = "user-1",
                State = 2
            });

        Assert.Equal(1001, result.Code);
        Assert.Null(result.Data);
    }

    [Fact]
    public void TableScope_AcceptsDerivedTableIdForMetadataRequests()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.IsTableOperationAllowed(
            user,
            "table-dashboard-id",
            true));
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(
            user,
            "table-other-id",
            true));
    }

    [Fact]
    public void TableScope_FailsClosedForMissingOrMixedBatchReferences()
    {
        var user = NewScopedUser();

        Assert.False(UserAccessKeySecurity.AreTableReferencesAllowed(
            user,
            Array.Empty<string>(),
            true));
        Assert.True(UserAccessKeySecurity.AreTableReferencesAllowed(
            user,
            new[] { "mic_data_dashboard", "table-dashboard-id" },
            true));
        Assert.False(UserAccessKeySecurity.AreTableReferencesAllowed(
            user,
            new[] { "mic_data_dashboard", "table-other-id" },
            true));
    }

    [Fact]
    public void FieldScope_AllowsSqlDataForFieldsOwnedByAllowedTablesOnly()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.AreFieldReferencesAllowed(
            user,
            new[] { "field-dashboard-id" }));
        Assert.False(UserAccessKeySecurity.AreFieldReferencesAllowed(
            user,
            Array.Empty<string>()));
        Assert.False(UserAccessKeySecurity.AreFieldReferencesAllowed(
            user,
            new[] { "field-other-id" }));
        Assert.True(UserAccessKeySecurity.IsFieldDataLookupPath(
            "/api/FormEngine/GetDiyFieldSqlData"));
        Assert.True(UserAccessKeySecurity.IsFieldDataLookupPath(
            "/api/DiyTable/GetFieldsData"));
    }

    [Fact]
    public void EngineScopes_RequireExactKey()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.IsApiEngineAllowed(user, "dashboard_summary"));
        Assert.False(UserAccessKeySecurity.IsApiEngineAllowed(user, "admin_reset_password"));
        Assert.False(UserAccessKeySecurity.IsDataSourceAllowed(user, "any-data-source"));
    }

    [Fact]
    public void ApiPathScope_DeniesAccountManagementAndAllowsReadFacade()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/FormEngine/GetFormData"));
        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/ApiEngine/Run"));
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/SysUser/UptSysUser"));
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/SysUserAccessKey/Create"));
    }

    [Theory]
    [InlineData("/api/FormEngine/GetTableData-mic-data-dashboard")]
    [InlineData("/api/FormEngine/Get-TableData-mic-data-dashboard")]
    [InlineData("/api/FormEngine/GetFormData-mic-data-dashboard")]
    [InlineData("/api/FormEngine/Get-FormData-mic-data-dashboard")]
    public void DynamicFormEngineReadRoutes_AreAuthorizedBeforeRouteTransformation(string path)
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(user, path));
        Assert.True(UserAccessKeySecurity.TryGetTableOperation(
            path,
            out var isRead,
            out var isExport));
        Assert.True(UserAccessKeySecurity.TryGetDynamicFormEngineAction(
            path,
            out var dynamicAction));
        Assert.True(UserAccessKeySecurity.TryGetDynamicFormEngineRoute(
            path,
            out var parsedAction,
            out var routeReference));
        Assert.Equal(dynamicAction, parsedAction);
        Assert.False(string.IsNullOrWhiteSpace(routeReference));
        Assert.Contains(dynamicAction, new[] { "GetTableData", "GetFormData" });
        Assert.True(isRead);
        Assert.False(isExport);
    }

    [Fact]
    public void DynamicFormEngineRoute_ModuleEngineKeyUsesDerivedMenuScope()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.AreFormEngineRequestReferencesAllowed(
            user,
            "/api/FormEngine/GetTableData-menu-dashboard-id",
            Array.Empty<string>(),
            new[] { "menu-dashboard-id" },
            Array.Empty<string>()));
        Assert.False(UserAccessKeySecurity.AreFormEngineRequestReferencesAllowed(
            user,
            "/api/FormEngine/GetTableData-menu-other-id",
            Array.Empty<string>(),
            new[] { "menu-other-id" },
            Array.Empty<string>()));
    }

    [Fact]
    public void DynamicFormEngineRoute_FullDataScopeAllowsMenuIdRequestBody()
    {
        var user = NewScopedUser();
        user["_AccessKeyAllowedTableNames"] = new JArray("*");
        user["_AccessKeyAllowedTableIds"] = new JArray("*");
        user["_AccessKeyAllowedMenuReferences"] = new JArray("*");
        const string menuId = "01kk9865pn34c97fg0w8af33pb";

        Assert.True(UserAccessKeySecurity.AreFormEngineRequestReferencesAllowed(
            user,
            "/api/FormEngine/GetTableData-" + menuId,
            Array.Empty<string>(),
            new[] { menuId },
            Array.Empty<string>()));
    }

    [Fact]
    public void DynamicFormEngineRoute_RequiresBodyReferenceAndMatchingSuffix()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.AreFormEngineRequestReferencesAllowed(
            user,
            "/api/FormEngine/GetTableData-mic-data-dashboard",
            new[] { "mic_data_dashboard" },
            Array.Empty<string>(),
            Array.Empty<string>()));
        Assert.False(UserAccessKeySecurity.AreFormEngineRequestReferencesAllowed(
            user,
            "/api/FormEngine/GetTableData-mic-data-dashboard",
            new[] { "other_table" },
            Array.Empty<string>(),
            Array.Empty<string>()));
        Assert.False(UserAccessKeySecurity.AreFormEngineRequestReferencesAllowed(
            user,
            "/api/FormEngine/GetTableData-mic-data-dashboard",
            Array.Empty<string>(),
            Array.Empty<string>(),
            Array.Empty<string>()));
    }

    [Theory]
    [InlineData("/api/FormEngine/AddFormData-mic-data-dashboard")]
    [InlineData("/api/FormEngine/Add-FormData-mic-data-dashboard")]
    [InlineData("/api/FormEngine/UptFormData-mic-data-dashboard")]
    [InlineData("/api/FormEngine/Upt-FormData-mic-data-dashboard")]
    [InlineData("/api/FormEngine/DelFormData-mic-data-dashboard")]
    [InlineData("/api/FormEngine/Del-FormData-mic-data-dashboard")]
    public void DynamicFormEngineWriteRoutes_RequireWriteScope(string path)
    {
        var user = NewScopedUser();
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(user, path));

        user["_AccessKeyScopes"] = new JArray("page:open", "form:read", "form:write");
        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(user, path));
        Assert.True(UserAccessKeySecurity.TryGetTableOperation(
            path,
            out var isRead,
            out var isExport));
        Assert.True(UserAccessKeySecurity.TryGetDynamicFormEngineAction(path, out _));
        Assert.False(isRead);
        Assert.False(isExport);
    }

    [Theory]
    [InlineData("/api/FormEngine/GetTableDataX-mic-data-dashboard")]
    [InlineData("/api/FormEngine/GetTableData-")]
    [InlineData("/api/FormEngine/Get-TableData-")]
    [InlineData("/api/FormEngine/GetTableData-mic-data-dashboard/extra")]
    [InlineData("/api/ApiEngine/GetTableData-mic-data-dashboard")]
    public void DynamicFormEngineRouteLookalikes_RemainDenied(string path)
    {
        var user = NewScopedUser();

        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(user, path));
        Assert.False(UserAccessKeySecurity.TryGetTableOperation(
            path,
            out _,
            out _));
        Assert.False(UserAccessKeySecurity.TryGetDynamicFormEngineAction(path, out _));
        Assert.False(UserAccessKeySecurity.TryGetDynamicFormEngineRoute(
            path,
            out _,
            out _));
    }

    [Fact]
    public void WildcardPageScope_AllowsDynamicMenuBootstrapOnlyForWildcardRoutes()
    {
        var exactRouteUser = NewScopedUser();
        var wildcardRouteUser = NewScopedUser();
        wildcardRouteUser["_AccessKeyAllowedRoutes"] = new JArray("*");

        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            exactRouteUser,
            "/api/SysMenu/GetSysMenuStep"));
        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            wildcardRouteUser,
            "/api/SysMenu/GetSysMenuStep"));
        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            wildcardRouteUser,
            "/api/SysUser/RefreshToken"));
        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            wildcardRouteUser,
            "/api/SysUser/Logout"));
    }

    [Fact]
    public void FullAccessKeyFacade_CoversRuntimeCapabilitiesButBlocksControlPlane()
    {
        var user = NewScopedUser();
        user["_AccessKeyScopes"] = new JArray(
            "page:open",
            "form:read",
            "form:write",
            "form:export",
            "api-engine:run",
            "data-source:run",
            "file:read");
        user["_AccessKeyAllowedRoutes"] = new JArray("*");
        user["_AccessKeyAllowedTableNames"] = new JArray("*");
        user["_AccessKeyAllowedTableIds"] = new JArray("*");
        user["_AccessKeyAllowedMenuReferences"] = new JArray("*");
        user["_AccessKeyAllowedFieldIds"] = new JArray("*");
        user["_AccessKeyAllowedDataSourceKeys"] = new JArray("dashboard_source");

        var allowedPaths = new[]
        {
            "/api/SysUser/GetCurrentUser",
            "/api/SysMenu/GetSysMenuStep",
            "/api/FormEngine/GetSysConfig",
            "/api/FormEngine/GetLangBundle",
            "/api/FormEngine/GetSysMenuModel",
            "/api/FormEngine/GetDiyTableModel",
            "/api/FormEngine/GetDiyFieldByDiyTables",
            "/api/FormEngine/GetTableDataCount",
            "/api/FormEngine/GetTableData-mic-data-dashboard",
            "/api/FormEngine/GetFormData-mic-data-dashboard",
            "/api/FormEngine/AddFormData",
            "/api/FormEngine/AddFormData-mic-data-dashboard",
            "/api/FormEngine/UptFormData-mic-data-dashboard",
            "/api/FormEngine/DelFormData-mic-data-dashboard",
            "/api/FormEngine/ExportDiyTableRow",
            "/api/SysDept/GetSysDeptStep",
            "/api/SysBaseData/GetSysBaseDataStep",
            "/api/SysUserFk/GetSysUserFk",
            "/api/ApiEngine/Run",
            "/api/DataSourceEngine/Run",
            "/api/BackgroundTask/List",
            "/api/BackgroundTask/RunApiEngine",
            "/api/OnlineTerminal/Mine",
            "/api/Os/GetDateTimeNow",
            "/api/UserBehavior/Signal",
            "/api/ModuleEngine/GetTableData",
            "/api/WorkFlow/GetWFHistory",
            "/api/WorkFlow/StartWork",
            "/api/HDFS/GetPrivateFileUrl"
        };
        foreach (var path in allowedPaths)
        {
            Assert.True(
                UserAccessKeySecurity.IsApiPathAllowed(user, path),
                $"Expected runtime path to be allowed: {path}");
        }

        var deniedPaths = new[]
        {
            "/api/SysUser/GetSysUserPassword",
            "/api/SysUser/GetOwnedTenantAdminPassword",
            "/api/SysUser/ResetOwnedTenantAdminPassword",
            "/api/SysUserAccessKey/Create",
            "/api/SysMenu/UptSysMenu",
            "/api/WorkFlow/SaveWFFlowDesign",
            "/api/FormEngine/GetTableIndexes",
            "/api/FormEngine/AddDiyField",
            "/api/OnlineTerminal/List",
            "/api/OnlineTerminal/Kick",
            "/api/HDFS/Upload"
        };
        foreach (var path in deniedPaths)
        {
            Assert.False(
                UserAccessKeySecurity.IsApiPathAllowed(user, path),
                $"Expected control-plane path to be denied: {path}");
        }
    }

    [Fact]
    public void IndirectRuntimeEngines_RequireAllAuthorizedDataMode()
    {
        var selectedTableUser = NewScopedUser();

        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            selectedTableUser,
            "/api/ModuleEngine/GetTableData"));
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            selectedTableUser,
            "/api/WorkFlow/GetWFHistory"));

        selectedTableUser["_AccessKeyAllowedTableNames"] = new JArray("*");
        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            selectedTableUser,
            "/api/ModuleEngine/GetTableData"));
        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            selectedTableUser,
            "/api/WorkFlow/GetWFHistory"));
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            selectedTableUser,
            "/api/WorkFlow/StartWork"));
    }

    [Fact]
    public void FileReadScope_AllowsOnlyExactHdfsReadFacade()
    {
        var user = NewScopedUser();
        user["_AccessKeyScopes"] = new JArray("page:open", "file:read");

        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/HDFS/GetPrivateFileUrl"));
        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/HDFS/OpenPrivateFile/"));
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/HDFS/Upload"));
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/HDFS/SaveOfficeDocument"));
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/HDFS/DeleteObject"));
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/HDFS/SyncMinioObject"));
    }

    [Fact]
    public void StripSessionFields_DoesNotMutateSharedIdentity()
    {
        var original = NewScopedUser();

        var clean = UserAccessKeySecurity.StripSessionFields(original);

        Assert.True(original["_AccessKeySession"]!.Value<bool>());
        Assert.Null(clean["_AccessKeySession"]);
        Assert.Equal("user-1", clean["Id"]!.ToString());
    }

    [Fact]
    public void AccessKeyTable_IsProtectedPlatformResource()
    {
        Assert.True(PlatformResourceSecurity.IsProtectedTable(
            UserAccessKeySecurity.TableName));
    }

    [Fact]
    public void Expiry_AllowsPermanentAndRejectsPastDate()
    {
        var now = new DateTime(2026, 7, 28, 12, 0, 0);

        Assert.True(UserAccessKeySecurity.IsExpiryActive(null, now));
        Assert.True(UserAccessKeySecurity.IsExpiryActive("", now));
        Assert.True(UserAccessKeySecurity.IsExpiryActive("2026-07-29 12:00:00", now));
        Assert.False(UserAccessKeySecurity.IsExpiryActive("2026-07-27 12:00:00", now));
        Assert.False(UserAccessKeySecurity.IsExpiryActive("invalid", now));
    }

    [Fact]
    public void StoredPassword_DESCanBeDecodedAndValidated()
    {
        var encrypted = EncryptHelper.DESEncode("Microi-test-password");

        var result = SysUserLogic.DecodeStoredPassword(encrypted, "DES");

        Assert.Equal(1, result.Code);
        Assert.Equal("Microi-test-password", result.Data);
        Assert.Equal(0, SysUserLogic.DecodeStoredPassword(encrypted, "V8").Code);
        Assert.Equal(0, SysUserLogic.DecodeStoredPassword("not-des", "DES").Code);
    }
}
