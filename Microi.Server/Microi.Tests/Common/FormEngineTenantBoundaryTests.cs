using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Reflection;

namespace Dos.Common.Tests;

public class FormEngineTenantBoundaryTests
{
    [Fact]
    public void V8TenantContext_ReplacesForeignTenantForNonMasterScript()
    {
        var currentTenant = string.Equals(
            OsClientDefault.OsClient,
            "tenant_boundary_a",
            StringComparison.OrdinalIgnoreCase)
            ? "tenant_boundary_b"
            : "tenant_boundary_a";

        using (V8TenantContext.Enter(currentTenant, "tenant-boundary-test"))
        {
            Assert.Equal(currentTenant, V8TenantContext.EnforceOsClient("foreign_tenant"));
        }
    }

    [Fact]
    public void NonMasterV8SysConfigReturn_IsSanitizedDeepCopyWithoutMutatingRawModel()
    {
        var engine = new ExposedFormEngine();
        var source = new JObject
        {
            ["SysTitle"] = "Tenant title",
            ["ClientSecrets"] = "raw-secret",
            ["GlobalServerV8Code"] = "raw-server-code"
        };
        var currentTenant = GetNonMasterTenant();

        JObject projection;
        using (V8TenantContext.Enter(currentTenant, "sysconfig-projection-test"))
        {
            projection = (JObject)engine.ProjectSysConfigForCaller(source);
        }

        Assert.NotSame(source, projection);
        Assert.Equal("Tenant title", projection["SysTitle"]?.ToString());
        Assert.Null(projection["ClientSecrets"]);
        Assert.Null(projection["GlobalServerV8Code"]);
        Assert.Equal("raw-secret", source["ClientSecrets"]?.ToString());
        Assert.Equal("raw-server-code", source["GlobalServerV8Code"]?.ToString());

        projection["SysTitle"] = "changed";
        Assert.Equal("Tenant title", source["SysTitle"]?.ToString());
    }

    [Fact]
    public void InternalSysConfigReturn_KeepsRawModel()
    {
        var engine = new ExposedFormEngine();
        var source = new JObject { ["ClientSecrets"] = "raw-secret" };

        Assert.Same(source, engine.ProjectSysConfigForCaller(source));
    }

    [Fact]
    public void LimitDiyTable_RequiresExactRoleIdMatch()
    {
        var engine = new FormEngine();
        var table = new JObject
        {
            ["BindRole"] = "[\"role-1\"]"
        };

        Assert.False(engine.LimitDiyTable(table, new JObject
        {
            ["RoleIds"] = "[\"role-10\"]"
        }));
        Assert.True(engine.LimitDiyTable(table, new JObject
        {
            ["RoleIds"] = "[\"role-1\"]"
        }));
    }

    [Fact]
    public void LimitDiyTable_SupportsObjectRoleListWithoutSubstringMatching()
    {
        var engine = new FormEngine();
        var table = new JObject
        {
            ["BindRole"] = "[\"role-2\"]"
        };

        Assert.True(engine.LimitDiyTable(table, new JObject
        {
            ["RoleIds"] = "[{\"Id\":\"role-2\",\"Name\":\"业务角色\"}]"
        }));
        Assert.False(engine.LimitDiyTable(table, new JObject
        {
            ["RoleIds"] = "[{\"Id\":\"role-20\",\"Name\":\"其它角色\"}]"
        }));
    }

    [Theory]
    [InlineData("sys_osclients")]
    [InlineData("sys_config")]
    [InlineData("sys_apiengine")]
    [InlineData("diy_table")]
    [InlineData("diy_field")]
    [InlineData("sys_menu")]
    [InlineData("sys_role")]
    [InlineData("sys_rolelimit")]
    [InlineData("sys_user")]
    [InlineData("sys_userfk")]
    [InlineData("sys_onlineuser")]
    [InlineData("sys_datasource")]
    [InlineData("diy_schedule_job")]
    [InlineData("diy_schedule_job_log")]
    [InlineData("sys_mq")]
    [InlineData("sys_mqtt")]
    [InlineData("microi_database")]
    [InlineData("sys_log")]
    [InlineData("sys_servernode")]
    [InlineData("mic_ai")]
    [InlineData("mic_email_server")]
    [InlineData("wx_mp")]
    [InlineData("mci_database_backup")]
    [InlineData("mci_background_task")]
    [InlineData("mci_file_remote_connection")]
    [InlineData("mci_redis_connection")]
    [InlineData("mci_license_server")]
    [InlineData("mci_user_access_key")]
    [InlineData("mci_security_access_log")]
    [InlineData("mci_security_attack_event")]
    [InlineData("mci_security_ip_block")]
    [InlineData("mci_spider_account")]
    [InlineData("mci_spider_profile")]
    [InlineData("mci_spider_rule")]
    [InlineData("mci_ai_app")]
    [InlineData("mci_ai_app_file")]
    [InlineData("mci_ai_app_version")]
    [InlineData("mci_ai_data_domain")]
    [InlineData("mci_ai_role_policy")]
    public void ClientFormEngine_ProtectsHighRiskPlatformTables(string tableName)
    {
        Assert.True(PlatformResourceSecurity.IsProtectedTable(tableName));
        Assert.Contains(
            tableName,
            PlatformResourceSecurity.ProtectedTableNames,
            StringComparer.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("mic_page")]
    [InlineData("mic_print")]
    public void ClientFormEngine_RoleManagedRuntimeTablesUseExplicitRolePermissions(string tableName)
    {
        Assert.True(PlatformResourceSecurity.IsPlatformTable(tableName));
        Assert.True(PlatformResourceSecurity.IsRoleManagedTable(tableName));
        Assert.False(PlatformResourceSecurity.IsProtectedTable(tableName));
        Assert.True(PlatformResourceSecurity.DeniesAnonymousAccess(tableName));
        Assert.False(PlatformResourceSecurity.RequiresPlatformAdministrator(tableName, "Read"));
        Assert.False(PlatformResourceSecurity.RequiresPlatformAdministrator(tableName, "Edit"));
        Assert.All(
            new[] { "Read", "Add", "Edit", "Del" },
            permission => Assert.True(
                PlatformResourceSecurity.CanGrantDirectTablePermission(
                    tableName,
                    permission,
                    DiyCommon.MaxRoleLevel - 1)));
    }

    [Theory]
    [InlineData("wf_flowdesign")]
    [InlineData("wf_node")]
    [InlineData("wf_line")]
    [InlineData("sys_microiservice")]
    [InlineData("sys_microiservice_page")]
    [InlineData("sys_microistore")]
    [InlineData("sys_microistoreversion")]
    [InlineData("sys_appinstalled")]
    [InlineData("sys_business_blueprint")]
    [InlineData("sys_blueprint_relation")]
    [InlineData("sys_blueprint_history")]
    [InlineData("mic_micro_app")]
    [InlineData("mic_micro_app_asset")]
    [InlineData("mic_micro_app_version")]
    public void ClientFormEngine_RuntimeMetadataCanOnlyBeDelegatedForRead(string tableName)
    {
        Assert.True(PlatformResourceSecurity.IsPlatformTable(tableName));
        Assert.True(PlatformResourceSecurity.IsReadOnlyTable(tableName));
        Assert.False(PlatformResourceSecurity.IsProtectedTable(tableName));
        Assert.True(PlatformResourceSecurity.DeniesAnonymousAccess(tableName));
        Assert.False(PlatformResourceSecurity.RequiresPlatformAdministrator(tableName, "Read"));
        Assert.False(PlatformResourceSecurity.RequiresPlatformAdministrator(tableName, "List"));
        Assert.True(PlatformResourceSecurity.RequiresPlatformAdministrator(tableName, "Add"));
        Assert.True(PlatformResourceSecurity.RequiresPlatformAdministrator(tableName, "Edit"));
        Assert.True(PlatformResourceSecurity.RequiresPlatformAdministrator(tableName, "Delete"));
        Assert.True(PlatformResourceSecurity.CanGrantDirectTablePermission(
            tableName,
            "Read",
            DiyCommon.MaxRoleLevel - 1));
        Assert.False(PlatformResourceSecurity.CanGrantDirectTablePermission(
            tableName,
            "Edit",
            DiyCommon.MaxRoleLevel - 1));
    }

    [Fact]
    public void ClientFormEngine_PlatformPolicyContainsExactDistinctTableSet()
    {
        Assert.Equal(55, PlatformResourceSecurity.PlatformTableNames.Count);
        Assert.Equal(
            PlatformResourceSecurity.PlatformTableNames.Count,
            PlatformResourceSecurity.PlatformTableNames
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count());
    }

    [Fact]
    public void ClientFormEngine_DoesNotProtectEveryMciPrefixedBusinessTable()
    {
        Assert.False(PlatformResourceSecurity.IsProtectedTable("mci_drafts"));
        Assert.False(PlatformResourceSecurity.IsProtectedTable("diy_area"));
    }

    [Fact]
    public void TableChildDelegation_RejectsCyclesAndChainsDeeperThanEight()
    {
        var cycle = NewTableChildContext("menu-a", "table-a", "field-a");
        cycle.Parent = cycle;
        Assert.False(InvokeTableChildContextValidation(cycle));

        TableChildAuthorizationContext chain = null;
        for (var index = 0; index < 9; index++)
        {
            chain = NewTableChildContext(
                $"menu-{index}",
                $"table-{index}",
                $"field-{index}",
                chain);
        }
        Assert.False(InvokeTableChildContextValidation(chain));
    }

    [Fact]
    public void TableChildDelegation_AcceptsAcyclicChainUpToEightLevels()
    {
        TableChildAuthorizationContext chain = null;
        for (var index = 0; index < 8; index++)
        {
            chain = NewTableChildContext(
                $"menu-{index}",
                $"table-{index}",
                $"field-{index}",
                chain);
        }
        Assert.True(InvokeTableChildContextValidation(chain));
    }

    [Fact]
    public async Task AnonymousClient_CannotReadProtectedTable_ButKeepsOrdinaryAnonymousPolicy()
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _IsAnonymous = true
        };

        Assert.False(await InvokeClientAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "protected-id", ["Name"] = "sys_osclients" },
            "Read"));
        Assert.False(await InvokeClientAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "print-id", ["Name"] = "mic_print" },
            "Read"));
        Assert.True(await InvokeClientAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "ordinary-id", ["Name"] = "diy_customer" },
            "Read"));
    }

    [Fact]
    public async Task PlatformAdmin_BypassesProtectedTableBlock()
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _CurrentUser = new JObject
            {
                ["Id"] = "platform-admin",
                ["Level"] = DiyCommon.MaxRoleLevel
            },
            _AuthorizationSnapshot = new FormEngineAuthorizationSnapshot
            {
                UserId = "platform-admin",
                UserLevel = DiyCommon.MaxRoleLevel,
                IsActiveUser = true
            }
        };

        Assert.True(await InvokeClientAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "protected-id", ["Name"] = "sys_apiengine" },
            "Read"));
    }

    [Fact]
    public async Task PrintRuntime_UsesExplicitDirectTableGrantForOrdinaryUser()
    {
        var engine = new FormEngine();
        var tableId = "print-table-id";
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _CurrentUser = new JObject
            {
                ["Id"] = "print-user",
                ["Level"] = 100
            },
            _AuthorizationSnapshot = new FormEngineAuthorizationSnapshot
            {
                UserId = "print-user",
                UserLevel = 100,
                IsActiveUser = true,
                EffectiveRoleIds = new List<string> { "print-role" },
                RoleLimits = new List<SysRoleLimit>
                {
                    new()
                    {
                        Type = "Table",
                        FkId = tableId,
                        Permission = "[\"Read\",\"Edit\"]"
                    }
                }
            }
        };

        Assert.True(await InvokeClientAuthorization(
            engine,
            param,
            new JObject { ["Id"] = tableId, ["Name"] = "mic_print" },
            "Read"));
        Assert.True(await InvokeClientAuthorization(
            engine,
            param,
            new JObject { ["Id"] = tableId, ["Name"] = "mic_print" },
            "Edit"));
    }

    [Fact]
    public async Task ReadOnlyPlatformMetadata_RejectsWriteEvenWhenPayloadContainsEditGrant()
    {
        var engine = new FormEngine();
        var tableId = "service-table-id";
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _CurrentUser = new JObject
            {
                ["Id"] = "service-user",
                ["Level"] = 100
            },
            _AuthorizationSnapshot = new FormEngineAuthorizationSnapshot
            {
                UserId = "service-user",
                UserLevel = 100,
                IsActiveUser = true,
                EffectiveRoleIds = new List<string> { "service-role" },
                RoleLimits = new List<SysRoleLimit>
                {
                    new()
                    {
                        Type = "Table",
                        FkId = tableId,
                        Permission = "[\"Read\",\"Edit\"]"
                    }
                }
            }
        };

        Assert.True(await InvokeClientAuthorization(
            engine,
            param,
            new JObject { ["Id"] = tableId, ["Name"] = "sys_microiservice" },
            "Read"));
        Assert.False(await InvokeClientAuthorization(
            engine,
            param,
            new JObject { ["Id"] = tableId, ["Name"] = "sys_microiservice" },
            "Edit"));
    }

    [Fact]
    public async Task TrustedServerV8_DoesNotRequireMenuEvenWhenInvokeTypeRunsClientEvents()
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _TrustedServerInvocation = true
        };

        Assert.True(await InvokeClientAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "table-id", ["Name"] = "diy_customer" },
            "Read"));
    }

    [Fact]
    public void BrowserJson_CannotBindTrustedInvocationOrAuthorizationPolicy()
    {
        var param = JsonConvert.DeserializeObject<DiyTableRowParam>(
            """
            {
              "_InvokeType": "Client",
              "_TrustedServerInvocation": true,
              "_PreserveAuthorizationPolicyForRead": true,
              "_AuthorizationPolicy": {
                "SqlWhere": "1=1"
              }
            }
            """);

        Assert.NotNull(param);
        Assert.False(param!._TrustedServerInvocation);
        Assert.False(param._PreserveAuthorizationPolicyForRead);
        Assert.Null(param._AuthorizationPolicy);
    }

    [Fact]
    public async Task TrustedReadProbe_PreservesOnlyServerConstructedAuthorizationPolicy()
    {
        var param = new DiyTableRowParam
        {
            _TrustedServerInvocation = true,
            _PreserveAuthorizationPolicyForRead = true,
            _AuthorizationPolicy = new FormEngineAuthorizationPolicy
            {
                SqlWhere = "A.OwnerId = '$CurrentUser.Id$'"
            }
        };

        Assert.True(await InvokeClientAuthorization(
            new FormEngine(),
            param,
            new JObject { ["Id"] = "table-a", ["Name"] = "diy_customer" },
            "Read"));
        Assert.NotNull(param._AuthorizationPolicy);
        Assert.False(param._PreserveAuthorizationPolicyForRead);
    }

    [Fact]
    public void LegacyMenuFallback_UnscopedReadKeepsOriginalQueryShape()
    {
        var snapshot = NewAuthorizationSnapshot(
            permission: null,
            new FormEngineAuthorizationMenuSnapshot
            {
                Id = "menu-a",
                DiyTableId = "table-a",
                SqlWhere = null,
                JoinTables = "[{\"Id\":\"presentation-only\"}]"
            });

        var policy = InvokeLegacyAuthorizationPolicy(snapshot, "table-a", "Read");

        Assert.NotNull(policy);
        Assert.False(policy!.HasRowScope);
        Assert.Null(policy.JoinTables);
    }

    [Fact]
    public void LegacyMenuFallback_WriteRequiresExactPermission()
    {
        var menu = new FormEngineAuthorizationMenuSnapshot
        {
            Id = "menu-a",
            DiyTableId = "table-a"
        };
        var readOnly = NewAuthorizationSnapshot(null, menu);
        var editable = NewAuthorizationSnapshot("[\"Edit\"]", menu);

        Assert.Null(InvokeLegacyAuthorizationPolicy(readOnly, "table-a", "Edit"));
        Assert.NotNull(InvokeLegacyAuthorizationPolicy(editable, "table-a", "Edit"));
    }

    [Fact]
    public void LegacyMenuFallback_UnionsCompatibleRowScopes()
    {
        var snapshot = new FormEngineAuthorizationSnapshot
        {
            RoleLimits = new List<SysRoleLimit>
            {
                new() { Type = "Menu", FkId = "menu-a" },
                new() { Type = "Menu", FkId = "menu-b" }
            },
            Menus = new List<FormEngineAuthorizationMenuSnapshot>
            {
                new()
                {
                    Id = "menu-a",
                    DiyTableId = "table-a",
                    SqlWhere = "OwnerId = '$CurrentUser.Id$'",
                    SqlJoin = "LEFT JOIN team T ON T.Id = A.TeamId",
                    JoinTables = "[]"
                },
                new()
                {
                    Id = "menu-b",
                    DiyTableId = "table-a",
                    SqlWhere = "T.ManagerId = '$CurrentUser.Id$'",
                    SqlJoin = "LEFT JOIN team T ON T.Id = A.TeamId",
                    JoinTables = "[]"
                }
            }
        };

        var policy = InvokeLegacyAuthorizationPolicy(snapshot, "table-a", "List");

        Assert.NotNull(policy);
        Assert.True(policy!.HasRowScope);
        Assert.Contains(" OR ", policy.SqlWhere);
        Assert.Equal(2, policy.MenuIds.Count);
    }

    [Fact]
    public void LegacyMenuFallback_RejectsAmbiguousJoinContexts()
    {
        var snapshot = new FormEngineAuthorizationSnapshot
        {
            RoleLimits = new List<SysRoleLimit>
            {
                new() { Type = "Menu", FkId = "menu-a" },
                new() { Type = "Menu", FkId = "menu-b" }
            },
            Menus = new List<FormEngineAuthorizationMenuSnapshot>
            {
                new()
                {
                    Id = "menu-a",
                    DiyTableId = "table-a",
                    SqlWhere = "X.OwnerId = 1",
                    SqlJoin = "LEFT JOIN x X ON X.Id = A.XId"
                },
                new()
                {
                    Id = "menu-b",
                    DiyTableId = "table-a",
                    SqlWhere = "Y.OwnerId = 1",
                    SqlJoin = "LEFT JOIN y Y ON Y.Id = A.YId"
                }
            }
        };

        Assert.Null(InvokeLegacyAuthorizationPolicy(snapshot, "table-a", "List"));
    }

    [Fact]
    public void LegacyMenuFallback_WriteAllowsAnyGrantedMenuWithExactCapabilityDespiteDifferentQueryJoins()
    {
        var snapshot = new FormEngineAuthorizationSnapshot
        {
            RoleLimits = new List<SysRoleLimit>
            {
                new()
                {
                    Type = "Menu",
                    FkId = "menu-a",
                    Permission = "[\"Edit\"]"
                },
                new()
                {
                    Type = "Menu",
                    FkId = "menu-b",
                    Permission = "[\"Del\"]"
                }
            },
            Menus = new List<FormEngineAuthorizationMenuSnapshot>
            {
                new()
                {
                    Id = "menu-a",
                    DiyTableId = "table-a",
                    SqlWhere = "X.OwnerId = 1",
                    SqlJoin = "LEFT JOIN x X ON X.Id = A.XId"
                },
                new()
                {
                    Id = "menu-b",
                    DiyTableId = "table-a",
                    SqlWhere = "Y.OwnerId = 1",
                    SqlJoin = "LEFT JOIN y Y ON Y.Id = A.YId"
                }
            }
        };

        var editPolicy = InvokeLegacyAuthorizationPolicy(snapshot, "table-a", "Edit");
        var deletePolicy = InvokeLegacyAuthorizationPolicy(snapshot, "table-a", "Delete");

        Assert.NotNull(editPolicy);
        Assert.False(editPolicy!.HasRowScope);
        Assert.Equal(new[] { "menu-a" }, editPolicy.MenuIds);
        Assert.NotNull(deletePolicy);
        Assert.False(deletePolicy!.HasRowScope);
        Assert.Equal(new[] { "menu-b" }, deletePolicy.MenuIds);
    }

    [Fact]
    public async Task LegacySingleRowRead_RecoversStaleMenuThroughGrantedSameTableMenu()
    {
        var snapshot = NewActiveAuthorizationSnapshot(
            new FormEngineAuthorizationMenuSnapshot
            {
                Id = "menu-customer",
                DiyTableId = "table-customer"
            });
        var param = new DiyTableRowParam
        {
            Id = "customer-a",
            _InvokeType = InvokeType.Client.ToString(),
            _SysMenuId = "removed-menu",
            _CurrentUser = new JObject { ["Id"] = "user-a" },
            _AuthorizationSnapshot = snapshot
        };

        var allowed = await InvokeClientAuthorization(
            new FormEngine(),
            param,
            new JObject
            {
                ["Id"] = "table-customer",
                ["Name"] = "diy_customer"
            },
            "Read");

        Assert.True(allowed);
        Assert.Equal("menu-customer", param._SysMenuId);
        Assert.Null(param._AuthorizationPolicy);
    }

    [Fact]
    public async Task LegacySingleRowCompatibility_DoesNotRelaxListsOrOtherTables()
    {
        var snapshot = NewActiveAuthorizationSnapshot(
            new FormEngineAuthorizationMenuSnapshot
            {
                Id = "menu-order",
                DiyTableId = "table-order"
            });
        DiyTableRowParam NewParam() => new()
        {
            Id = "customer-a",
            _InvokeType = InvokeType.Client.ToString(),
            _SysMenuId = "removed-menu",
            _CurrentUser = new JObject { ["Id"] = "user-a" },
            _AuthorizationSnapshot = snapshot
        };
        var table = new JObject
        {
            ["Id"] = "table-customer",
            ["Name"] = "diy_customer"
        };

        Assert.False(await InvokeClientAuthorization(
            new FormEngine(),
            NewParam(),
            table,
            "Read"));
        Assert.False(await InvokeClientAuthorization(
            new FormEngine(),
            NewParam(),
            table,
            "List"));
    }

    [Fact]
    public void AuthorizationMenuResolver_UsesGrantedSnapshotAndCanonicalModuleKey()
    {
        var snapshot = new FormEngineAuthorizationSnapshot
        {
            Menus = new List<FormEngineAuthorizationMenuSnapshot>
            {
                new()
                {
                    Id = "menu-a",
                    ModuleEngineKey = "customer-manage",
                    DiyTableId = "table-a"
                }
            }
        };

        var byId = InvokeFindAuthorizationMenu(snapshot, "menu-a", "table-a");
        var byKey = InvokeFindAuthorizationMenu(snapshot, "customer-manage", "table-a");
        var wrongTable = InvokeFindAuthorizationMenu(snapshot, "customer-manage", "table-b");

        Assert.NotNull(byId);
        Assert.Same(byId, byKey);
        Assert.Null(wrongTable);
    }

    [Fact]
    public async Task DynamicFormEngineArguments_TrustClrServerObjectsButNotHttpJson()
    {
        var engine = new FormEngine();

        var serverParam = await engine.DynamicToDiyTableRowParam(new
        {
            FormEngineKey = "diy_customer",
            _InvokeType = InvokeType.Server.ToString()
        });
        var httpParam = await engine.DynamicToDiyTableRowParam(JObject.Parse(
            """
            {
              "FormEngineKey": "diy_customer",
              "_InvokeType": "Server",
              "_TrustedServerInvocation": true
            }
            """));

        Assert.True(serverParam._TrustedServerInvocation);
        Assert.False(httpParam._TrustedServerInvocation);
    }

    [Fact]
    public async Task TypedClientFormEngineArguments_DoNotBecomeTrustedByClrType()
    {
        var engine = new FormEngine();
        var clientParam = await engine.DynamicToDiyTableRowParam(
            new DiyTableRowParam
            {
                FormEngineKey = "diy_customer",
                _InvokeType = InvokeType.Client.ToString()
            });
        var clientBatch = await engine.DynamicToDiyTableRowParamList(
            new List<DiyTableRowParam>
            {
                new()
                {
                    FormEngineKey = "diy_customer",
                    _InvokeType = InvokeType.Client.ToString()
                }
            });

        Assert.False(clientParam._TrustedServerInvocation);
        Assert.Single(clientBatch);
        Assert.False(clientBatch[0]._TrustedServerInvocation);
    }

    [Fact]
    public async Task McpTrustedWrite_UsesServerOnlyMarker_ThatJsonCannotForge()
    {
        var helper = typeof(V8McpLogic).GetMethod(
            "BuildTrustedMcpFormWriteParam",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(helper);

        var trustedArgument = Assert.IsType<DiyTableRowParam>(helper!.Invoke(
            null,
            new object[]
            {
                "tenant-a",
                new JObject
                {
                    ["Id"] = "table-a",
                    ["Tabs"] = "[{\"Name\":\"AI配置\"}]"
                }
            }));
        var trustedParam = await new FormEngine()
            .DynamicToDiyTableRowParam(trustedArgument);
        var forgedParam = await new FormEngine()
            .DynamicToDiyTableRowParam(JObject.Parse(
                """
                {
                  "OsClient": "tenant-a",
                  "Id": "table-a",
                  "_InvokeType": "Server",
                  "_TrustedServerInvocation": true,
                  "Tabs": "forged"
                }
                """));

        Assert.True(trustedParam._TrustedServerInvocation);
        Assert.Equal(
            "[{\"Name\":\"AI配置\"}]",
            trustedParam._RowModel?["Tabs"]?.ToString());
        Assert.False(forgedParam._TrustedServerInvocation);
    }

    [Fact]
    public async Task UpgradeTrustedWrite_UsesServerOnlyMarker_ThatJsonCannotForge()
    {
        var helperType = typeof(UpgradeAppStore).Assembly.GetType(
            "Microi.net.UpgradeTrustedFormEngine");
        Assert.NotNull(helperType);
        var helper = helperType!.GetMethod(
            "BuildWriteParam",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(helper);

        var trustedArgument = Assert.IsType<DiyTableRowParam>(helper!.Invoke(
            null,
            new object[]
            {
                "sys_apiengine",
                "tenant-a",
                new
                {
                    Id = "engine-a",
                    ApiEngineKey = "upgrade-test"
                }
            }));
        var formEngine = new FormEngine();
        var normalized = await formEngine.DynamicToDiyTableRowParam(trustedArgument);
        var sparseWrite = await formEngine.DynamicParamToDiyParam(trustedArgument);

        Assert.True(normalized._TrustedServerInvocation);
        Assert.Equal("tenant-a", normalized.OsClient);
        Assert.Equal("engine-a", normalized.Id);
        Assert.Equal(
            "upgrade-test",
            normalized._RowModel?["ApiEngineKey"]?.ToString());
        Assert.Equal(
            "upgrade-test",
            sparseWrite._RowModel?["ApiEngineKey"]?.ToString());
        Assert.False(sparseWrite._RowModel?.ContainsKey("Name"));
        Assert.False(sparseWrite._RowModel?.ContainsKey("ModuleEngineKey"));
        normalized._AuthorizationPolicy = new FormEngineAuthorizationPolicy
        {
            SqlWhere = "A.OwnerId = '$CurrentUser.Id$'",
            SqlJoin = "LEFT JOIN stale_scope S ON S.Id = A.Id"
        };
        Assert.True(await InvokeClientAuthorization(
            new FormEngine(),
            normalized,
            new JObject
            {
                ["Id"] = "sys-apiengine-table",
                ["Name"] = "sys_apiengine"
            },
            "Edit"));
        Assert.Null(normalized._AuthorizationPolicy);
    }

    [Fact]
    public void AuthorizedNestedOldRowRead_PreservesTrustedProvenanceAndUserContext()
    {
        var helper = typeof(FormEngine).GetMethod(
            "BuildAuthorizedNestedOldRowReadParam",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(helper);

        var currentUser = new JObject
        {
            ["Id"] = "admin-user",
            ["Level"] = 9999
        };
        var source = new DiyTableRowParam
        {
            FormEngineKey = "sys_apiengine",
            Id = "engine-a",
            OsClient = "tenant-a",
            _CurrentUser = currentUser,
            _InvokeType = InvokeType.Client.ToString(),
            _SysMenuId = "menu-a",
            _TrustedServerInvocation = true,
            _AuthorizationSnapshot = new FormEngineAuthorizationSnapshot
            {
                UserLevel = 9999,
                IsActiveUser = true
            }
        };

        var nested = Assert.IsType<DiyTableRowParam>(
            helper!.Invoke(null, new object[] { source, false }));

        Assert.True(nested._TrustedServerInvocation);
        Assert.Same(currentUser, nested._CurrentUser);
        Assert.Same(source._AuthorizationSnapshot, nested._AuthorizationSnapshot);
        Assert.Equal(source._InvokeType, nested._InvokeType);
        Assert.Equal(source._SysMenuId, nested._SysMenuId);
        Assert.Equal(source.FormEngineKey, nested.FormEngineKey);
        Assert.Equal(source.Id, nested.Id);
        Assert.Equal(source.OsClient, nested.OsClient);
    }

    [Fact]
    public async Task GrantedMenu_RemainsAuthoritative_WhenLegacyTableBindRoleIsStale()
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _SysMenuId = "menu-customer",
            _CurrentUser = new JObject
            {
                ["Id"] = "user-a",
                ["RoleIds"] = "[\"role-current\"]"
            },
            _AuthorizationSnapshot = new FormEngineAuthorizationSnapshot
            {
                UserId = "user-a",
                UserLevel = 0,
                IsActiveUser = true,
                EffectiveRoleIds = new List<string> { "role-current" },
                RoleLimits = new List<SysRoleLimit>
                {
                    new() { Type = "Menu", FkId = "menu-customer" }
                },
                Menus = new List<FormEngineAuthorizationMenuSnapshot>
                {
                    new()
                    {
                        Id = "menu-customer",
                        DiyTableId = "table-customer"
                    }
                }
            }
        };

        var allowed = await InvokeClientAuthorization(
            engine,
            param,
            new JObject
            {
                ["Id"] = "table-customer",
                ["Name"] = "diy_customer",
                ["BindRole"] = "[\"retired-role\"]"
            },
            "Read");

        Assert.True(allowed);
    }

    [Fact]
    public async Task StaleBindRole_DoesNotCreateAccessWithoutMenuOrTableGrant()
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _CurrentUser = new JObject
            {
                ["Id"] = "user-a",
                ["RoleIds"] = "[\"role-current\"]"
            },
            _AuthorizationSnapshot = new FormEngineAuthorizationSnapshot
            {
                UserId = "user-a",
                UserLevel = 0,
                IsActiveUser = true,
                EffectiveRoleIds = new List<string> { "role-current" },
                RoleLimits = new List<SysRoleLimit>(),
                Menus = new List<FormEngineAuthorizationMenuSnapshot>()
            }
        };

        var allowed = await InvokeClientAuthorization(
            engine,
            param,
            new JObject
            {
                ["Id"] = "table-customer",
                ["Name"] = "diy_customer",
                ["BindRole"] = "[\"role-current\"]"
            },
            "Read");

        Assert.False(allowed);
    }

    [Fact]
    public async Task ActiveUser_MicAiRead_IsForcedToEnabledSecretFreeProjection()
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _PageSize = 10000,
            _Top = 10000,
            _SelectFields = new List<string>
            {
                "Id",
                "Name",
                "ApiKey",
                "Endpoint",
                "QdrantApiKey",
                "SystemChatMsg"
            },
            _SelectNotFields = new List<string> { "Name" },
            _AppendSelect = new List<string> { "A.ApiKey AS LeakedApiKey" },
            _AppendHavingSelect = new List<string> { "A.QdrantApiKey AS LeakedQdrantKey" },
            _AppendHaving = new List<string> { "1=1" },
            _Where = new JArray(new JArray("ApiKey", "Like", "sk-secret%")),
            _Keyword = "sk-secret",
            _Search = new Dictionary<string, string> { ["Endpoint"] = "internal" },
            _SearchEqual = new Dictionary<string, string> { ["QdrantApiKey"] = "secret" },
            _SearchCheckbox = new Dictionary<string, List<string>>
            {
                ["ApiKey"] = new List<string> { "secret" }
            },
            _SearchDateTime = new Dictionary<string, List<string>>
            {
                ["UpdateTime"] = new List<string> { "2026-01-01", "2026-12-31" }
            },
            _OrderBy = "ApiKey",
            _OrderByType = "DESC",
            _OrderBys = new Dictionary<string, string>
            {
                ["Endpoint"] = "ASC",
                ["Name"] = "DESC"
            },
            _CurrentUser = new JObject { ["Id"] = "user-a" },
            _AuthorizationSnapshot = new FormEngineAuthorizationSnapshot
            {
                UserId = "user-a",
                UserLevel = 0,
                IsActiveUser = true
            }
        };

        var allowed = await InvokeClientAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "mic-ai-id", ["Name"] = "mic_ai" },
            "List");

        Assert.True(allowed);
        Assert.Contains("Id", param._SelectFields);
        Assert.Contains("Name", param._SelectFields);
        Assert.Contains("AiModel", param._SelectFields);
        Assert.Contains("Sort", param._SelectFields);
        Assert.Contains("EnableVectorDatabase", param._SelectFields);
        Assert.DoesNotContain("ApiKey", param._SelectFields);
        Assert.DoesNotContain("Endpoint", param._SelectFields);
        Assert.DoesNotContain("QdrantApiKey", param._SelectFields);
        Assert.DoesNotContain("SystemChatMsg", param._SelectFields);
        Assert.Null(param._SelectNotFields);
        Assert.Null(param._AppendSelect);
        Assert.Null(param._AppendHavingSelect);
        Assert.Null(param._AppendHaving);
        Assert.Null(param._Where);
        Assert.Null(param._Keyword);
        Assert.Empty(param._Search);
        Assert.Null(param._SearchCheckbox);
        Assert.Null(param._SearchDateTime);
        Assert.Equal("1", param._SearchEqual["IsEnable"]);
        Assert.Equal("Sort", param._OrderBy);
        Assert.Equal("ASC", param._OrderByType);
        Assert.Single(param._OrderBys);
        Assert.Equal("DESC", param._OrderBys["Name"]);
        Assert.Equal(500, param._PageSize);
        Assert.Equal(500, param._Top);
    }

    [Fact]
    public async Task ActiveUser_MicAiMetadata_RemainsDenied()
    {
        var allowed = await InvokeClientMetadataAuthorization(
            new FormEngine(),
            new DiyTableRowParam
            {
                _InvokeType = InvokeType.Client.ToString(),
                _CurrentUser = new JObject { ["Id"] = "user-a" },
                _AuthorizationSnapshot = new FormEngineAuthorizationSnapshot
                {
                    UserId = "user-a",
                    UserLevel = 0,
                    IsActiveUser = true
                }
            },
            new JObject { ["Id"] = "mic-ai-id", ["Name"] = "mic_ai" });

        Assert.False(allowed);
    }

    [Fact]
    public async Task PlatformAdmin_MicAiMetadata_IsAllowed()
    {
        var allowed = await InvokeClientMetadataAuthorization(
            new FormEngine(),
            new DiyTableRowParam
            {
                _InvokeType = InvokeType.Client.ToString(),
                _CurrentUser = new JObject { ["Id"] = "platform-admin" },
                _AuthorizationSnapshot = new FormEngineAuthorizationSnapshot
                {
                    UserId = "platform-admin",
                    UserLevel = DiyCommon.MaxRoleLevel,
                    IsActiveUser = true
                }
            },
            new JObject { ["Id"] = "mic-ai-id", ["Name"] = "mic_ai" });

        Assert.True(allowed);
    }

    [Fact]
    public async Task GrantedMenu_MetadataAllowsPrimaryAndOrdinaryJoinButKeepsProtectedJoinDenied()
    {
        var engine = new FormEngine();
        var snapshot = new FormEngineAuthorizationSnapshot
        {
            UserId = "ordinary-user",
            UserLevel = 0,
            IsActiveUser = true,
            EffectiveRoleIds = new List<string> { "role-a" },
            RoleLimits = new List<SysRoleLimit>
            {
                new()
                {
                    Type = "Menu",
                    FkId = "menu-a",
                    Permission = "[\"Read\",\"Add\"]"
                }
            },
            Menus = new List<FormEngineAuthorizationMenuSnapshot>
            {
                new()
                {
                    Id = "menu-a",
                    DiyTableId = "table-primary",
                    JoinTables =
                        "[{\"Id\":\"table-join\",\"Name\":\"diy_customer\"},"
                        + "{\"Id\":\"table-user\",\"Name\":\"Sys_User\"}]"
                }
            }
        };
        DiyTableRowParam NewParam() => new()
        {
            _InvokeType = InvokeType.Client.ToString(),
            _SysMenuId = "menu-a",
            _CurrentUser = new JObject { ["Id"] = "ordinary-user" },
            _AuthorizationSnapshot = snapshot
        };

        var primaryAllowed = await InvokeClientMetadataAuthorization(
            engine,
            NewParam(),
            new JObject
            {
                ["Id"] = "table-primary",
                ["Name"] = "diy_order"
            });
        var ordinaryJoinAllowed = await InvokeClientMetadataAuthorization(
            engine,
            NewParam(),
            new JObject
            {
                ["Id"] = "table-join",
                ["Name"] = "diy_customer"
            });
        var protectedJoinAllowed = await InvokeClientMetadataAuthorization(
            engine,
            NewParam(),
            new JObject
            {
                ["Id"] = "table-user",
                ["Name"] = "Sys_User"
            });

        Assert.True(primaryAllowed);
        Assert.True(ordinaryJoinAllowed);
        Assert.False(protectedJoinAllowed);
    }

    [Fact]
    public async Task TableMetadata_RecoversStaleMenuThroughGrantedSameTableMenu()
    {
        var snapshot = NewActiveAuthorizationSnapshot(
            new FormEngineAuthorizationMenuSnapshot
            {
                Id = "menu-customer",
                DiyTableId = "table-customer"
            });
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _SysMenuId = "removed-menu",
            _CurrentUser = new JObject { ["Id"] = "user-a" },
            _AuthorizationSnapshot = snapshot
        };

        var allowed = await InvokeClientMetadataAuthorization(
            new FormEngine(),
            param,
            new JObject
            {
                ["Id"] = "table-customer",
                ["Name"] = "diy_customer"
            });

        Assert.True(allowed);
        Assert.Equal("menu-customer", param._SysMenuId);
    }

    [Fact]
    public void BuiltInSecurityMessages_LocalizeLegacyDatabaseFallbacks()
    {
        const string tenantWithoutLanguageRows = "legacy-lang-test";

        Assert.Equal(
            "您没有权限做此操作！",
            DiyMessage.GetLang(tenantWithoutLanguageRows, "NoAuth", "zh-CN"));
        Assert.Equal(
            "You do not have permission to perform this operation.",
            DiyMessage.GetLang(tenantWithoutLanguageRows, "NoAuth", "en"));
        Assert.Equal(
            "参数错误！",
            DiyMessage.GetLang(tenantWithoutLanguageRows, "ParamError", "cn"));
    }

    [Fact]
    public void BatchUnscopedListAuthorization_AllowsExactReadOrUnscopedMenuOnly()
    {
        var snapshot = new FormEngineAuthorizationSnapshot
        {
            UserId = "user-a",
            UserLevel = 0,
            IsActiveUser = true,
            EffectiveRoleIds = new List<string> { "role-a" },
            RoleLimits = new List<SysRoleLimit>
            {
                new()
                {
                    Type = "Table",
                    FkId = "table-direct",
                    Permission = "[\"Read\"]"
                },
                new()
                {
                    Type = "Table",
                    FkId = "table-add-only",
                    Permission = "[\"Add\"]"
                },
                new() { Type = "Menu", FkId = "menu-unscoped" },
                new() { Type = "Menu", FkId = "menu-scoped" }
            },
            Menus = new List<FormEngineAuthorizationMenuSnapshot>
            {
                new()
                {
                    Id = "menu-unscoped",
                    DiyTableId = "table-menu-unscoped"
                },
                new()
                {
                    Id = "menu-scoped",
                    DiyTableId = "table-menu-scoped",
                    SqlWhere = "OwnerId = '$CurrentUser.Id$'"
                }
            }
        };
        var tables = new List<DiyTable>
        {
            new() { Id = "table-direct", Name = "diy_direct" },
            new() { Id = "table-add-only", Name = "diy_add_only" },
            new() { Id = "table-menu-unscoped", Name = "diy_unscoped" },
            new() { Id = "table-menu-scoped", Name = "diy_scoped" },
            new() { Id = "table-protected", Name = "mic_ai" }
        };

        var allowed = InvokeBatchUnscopedListAuthorization(
            snapshot,
            tables,
            tables.Select(d => d.Name));

        Assert.Equal(
            new[] { "diy_direct", "diy_unscoped" },
            allowed);
    }

    [Fact]
    public void BatchUnscopedListAuthorization_AdminStillExcludesProtectedAndNonCandidates()
    {
        var allowed = InvokeBatchUnscopedListAuthorization(
            new FormEngineAuthorizationSnapshot
            {
                UserId = "platform-admin",
                UserLevel = DiyCommon.MaxRoleLevel,
                IsActiveUser = true
            },
            new List<DiyTable>
            {
                new() { Id = "ordinary-a", Name = "diy_a" },
                new() { Id = "ordinary-b", Name = "diy_b" },
                new() { Id = "protected", Name = "mic_ai" }
            },
            new[] { "diy_b", "mic_ai" });

        Assert.Equal(new[] { "diy_b" }, allowed);
    }

    [Theory]
    [InlineData("Add")]
    [InlineData("Edit")]
    [InlineData("Delete")]
    public async Task OrdinaryUser_MicAiWrites_RemainDenied(string operation)
    {
        var allowed = await InvokeClientAuthorization(
            new FormEngine(),
            new DiyTableRowParam
            {
                _InvokeType = InvokeType.Client.ToString(),
                _CurrentUser = new JObject { ["Id"] = "user-a" },
                _AuthorizationSnapshot = new FormEngineAuthorizationSnapshot
                {
                    UserId = "user-a",
                    UserLevel = 0,
                    IsActiveUser = true
                }
            },
            new JObject { ["Id"] = "mic-ai-id", ["Name"] = "mic_ai" },
            operation);

        Assert.False(allowed);
    }

    [Fact]
    public void AuthorizationSnapshotKey_IsRoleOrderStableAndTenantScoped()
    {
        var a = FormEngineAuthorizationCache.BuildSnapshotKey(
            "tenant-a",
            "7",
            new[] { "role-b", "role-a" });
        var b = FormEngineAuthorizationCache.BuildSnapshotKey(
            "tenant-a",
            "7",
            new[] { "ROLE-A", "ROLE-B" });
        var otherTenant = FormEngineAuthorizationCache.BuildSnapshotKey(
            "tenant-b",
            "7",
            new[] { "role-a", "role-b" });

        Assert.Equal(a, b);
        Assert.NotEqual(a, otherTenant);
        Assert.Contains(":Snapshot:v2:", a);
    }

    [Theory]
    [InlineData("Edit")]
    [InlineData("Delete")]
    [InlineData("EditByWhere")]
    [InlineData("DeleteByWhere")]
    public async Task ScopedMenu_SingleTableWritesUseMenuCapabilityNotQueryScope(string operation)
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _CurrentUser = new JObject { ["Id"] = "ordinary-user" }
        };
        var allowed = await InvokeMenuRowScopeAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "table-id", ["Name"] = "diy_order" },
            new JObject
            {
                ["Id"] = "menu-id",
                ["SqlWhere"] = "A.OwnerId = '$CurrentUser.Id$'"
            },
            operation);

        Assert.True(allowed);
        Assert.Null(param._AuthorizationPolicy);
    }

    [Theory]
    [InlineData("Edit")]
    [InlineData("Delete")]
    [InlineData("EditByWhere")]
    [InlineData("DeleteByWhere")]
    [InlineData("Import")]
    public async Task ScopedMenu_JoinWritesAndImportUseMenuCapabilityNotQueryScope(string operation)
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _CurrentUser = new JObject { ["Id"] = "ordinary-user", ["Level"] = 0 }
        };
        var allowed = await InvokeMenuRowScopeAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "table-id", ["Name"] = "diy_order" },
            new JObject
            {
                ["Id"] = "menu-id",
                ["SqlWhere"] = "B.OwnerId = '$CurrentUser.Id$'",
                ["SqlJoin"] = "LEFT JOIN diy_customer B ON B.Id=A.CustomerId",
                ["JoinTables"] = "[{\"Name\":\"diy_customer\",\"AsName\":\"B\"}]"
            },
            operation);

        Assert.True(allowed);
        Assert.Null(param._AuthorizationPolicy);
    }

    [Theory]
    [InlineData("Edit", "[\"Edit\"]", true)]
    [InlineData("Delete", "[\"Del\"]", true)]
    [InlineData("Edit", "[\"Del\"]", false)]
    [InlineData("Delete", "[\"Edit\"]", false)]
    public async Task ExplicitScopedMenu_WriteDependsOnlyOnExactMenuCapability(
        string operation,
        string permission,
        bool expected)
    {
        var menu = new FormEngineAuthorizationMenuSnapshot
        {
            Id = "menu-customer",
            DiyTableId = "table-customer",
            SqlWhere = "B.OwnerId = '$CurrentUser.Id$'",
            SqlJoin = "LEFT JOIN Sys_User B ON A.UserId=B.Id",
            JoinTables = "[{\"Name\":\"Sys_User\",\"AsName\":\"B\"}]"
        };
        var param = new DiyTableRowParam
        {
            Id = "customer-a",
            _InvokeType = InvokeType.Client.ToString(),
            _SysMenuId = menu.Id,
            _CurrentUser = new JObject
            {
                ["Id"] = "ordinary-user",
                ["Level"] = 0
            },
            _AuthorizationSnapshot = NewActiveAuthorizationSnapshot(menu, permission)
        };

        var allowed = await InvokeClientAuthorization(
            new FormEngine(),
            param,
            new JObject
            {
                ["Id"] = "table-customer",
                ["Name"] = "diy_customer"
            },
            operation);

        Assert.Equal(expected, allowed);
        Assert.Null(param._AuthorizationPolicy);
    }

    [Fact]
    public async Task ScopedMenu_AddUsesExplicitAddPermissionInsteadOfExistingRowScope()
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _CurrentUser = new JObject { ["Id"] = "ordinary-user" }
        };
        var allowed = await InvokeMenuRowScopeAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "table-id", ["Name"] = "diy_order" },
            new JObject
            {
                ["Id"] = "menu-id",
                ["SqlWhere"] = "B.OwnerId = '$CurrentUser.Id$'",
                ["SqlJoin"] = "LEFT JOIN diy_customer B ON B.Id=A.CustomerId",
                ["JoinTables"] = "[{\"Name\":\"diy_customer\",\"AsName\":\"B\"}]"
            },
            "Add");

        Assert.True(allowed);
        Assert.Null(param._AuthorizationPolicy);
    }

    [Theory]
    [InlineData("List")]
    [InlineData("Export")]
    public async Task ScopedMenu_ListAndExportKeepUsingQueryScope(string operation)
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            _InvokeType = InvokeType.Client.ToString(),
            _CurrentUser = new JObject { ["Id"] = "ordinary-user" }
        };
        var allowed = await InvokeMenuRowScopeAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "table-id", ["Name"] = "diy_order" },
            new JObject
            {
                ["Id"] = "menu-id",
                ["SqlWhere"] = "OwnerId = $CurrentUserId$"
            },
            operation);

        Assert.True(allowed);
        Assert.NotNull(param._AuthorizationPolicy);
    }

    [Fact]
    public async Task ScopedMenu_DetailReadUsesTableMenuAccessWithoutListQueryScope()
    {
        var engine = new FormEngine();
        var param = new DiyTableRowParam
        {
            Id = "row-outside-list-filter",
            _InvokeType = InvokeType.Client.ToString(),
            _CurrentUser = new JObject { ["Id"] = "ordinary-user" }
        };
        var allowed = await InvokeMenuRowScopeAuthorization(
            engine,
            param,
            new JObject { ["Id"] = "table-id", ["Name"] = "diy_order" },
            new JObject
            {
                ["Id"] = "menu-id",
                ["SqlWhere"] = "B.OwnerId = '$CurrentUser.Id$'",
                ["SqlJoin"] = "LEFT JOIN diy_customer B ON B.Id=A.CustomerId",
                ["JoinTables"] = "[{\"Name\":\"diy_customer\",\"AsName\":\"B\"}]"
            },
            "Read");

        Assert.True(allowed);
        Assert.Null(param._AuthorizationPolicy);
    }

    [Fact]
    public async Task ControllerOwnedOperation_RejectsServerOrUnknownOperationBeforeDatabaseAccess()
    {
        var engine = new FormEngine();
        var serverResult = await engine.AuthorizeClientTableOperationAsync(
            new DiyTableRowParam { _InvokeType = InvokeType.Server.ToString() },
            "Export");
        var unknownResult = await engine.AuthorizeClientTableOperationAsync(
            new DiyTableRowParam { _InvokeType = InvokeType.Client.ToString() },
            "PayloadSelectedOperation");

        Assert.Equal(0, serverResult.Code);
        Assert.Equal(0, unknownResult.Code);
    }

    [Theory]
    [InlineData("SysConfig")]
    [InlineData("SysMenu")]
    [InlineData("SysMenuModel")]
    [InlineData("DiyTable")]
    [InlineData("DiyTableModel")]
    public async Task ConfigurationCacheEntry_EnforcesTenantBeforeCacheAccess(string entry)
    {
        var engine = new RejectingFormEngine();

        var result = entry switch
        {
            "SysConfig" => await engine.GetSysConfig("foreign_tenant"),
            "SysMenu" => await engine.GetSysMenu("menu", "foreign_tenant"),
            "SysMenuModel" => await engine.GetSysMenuModel("menu", "foreign_tenant"),
            "DiyTable" => await engine.GetDiyTable("table", "foreign_tenant"),
            "DiyTableModel" => await engine.GetDiyTableModel("table", "foreign_tenant"),
            _ => throw new ArgumentOutOfRangeException(nameof(entry), entry, null)
        };

        Assert.Equal(0, result.Code);
        Assert.Equal("foreign_tenant", engine.LastRequestedOsClient);
        Assert.Equal(1, engine.EnforcementCount);
    }

    [Theory]
    [InlineData("Queue")]
    [InlineData("Reset")]
    [InlineData("Reload")]
    [InlineData("Sync")]
    [InlineData("Repair")]
    public async Task LanguageConfigurationEntry_EnforcesTenantBeforeSharedStateOrDatabaseAccess(string entry)
    {
        var engine = new RejectingFormEngine();

        var result = entry switch
        {
            "Queue" => engine.QueueDiyLangFullSync("foreign_tenant"),
            "Reset" => engine.ResetDiyLangFullSync("foreign_tenant"),
            "Reload" => engine.ReloadDiyLangRuntimeConfig("foreign_tenant"),
            "Sync" => await engine.SyncDiyLangFullAsync("foreign_tenant"),
            "Repair" => await engine.RepairMissingDiyLangTranslationsAsync("foreign_tenant"),
            _ => throw new ArgumentOutOfRangeException(nameof(entry), entry, null)
        };

        Assert.Equal(0, result.Code);
        Assert.Equal("foreign_tenant", engine.LastRequestedOsClient);
        Assert.Equal(1, engine.EnforcementCount);
    }

    private sealed class RejectingFormEngine : FormEngine
    {
        public int EnforcementCount { get; private set; }
        public string LastRequestedOsClient { get; private set; }

        protected override string EnforceConfigurationOsClient(string osClient)
        {
            EnforcementCount++;
            LastRequestedOsClient = osClient;
            return string.Empty;
        }
    }

    private sealed class ExposedFormEngine : FormEngine
    {
        public dynamic ProjectSysConfigForCaller(dynamic source)
        {
            return ProtectSysConfigForV8Return(source);
        }
    }

    private static string GetNonMasterTenant()
    {
        return string.Equals(
            OsClientDefault.OsClient,
            "tenant_boundary_a",
            StringComparison.OrdinalIgnoreCase)
            ? "tenant_boundary_b"
            : "tenant_boundary_a";
    }

    private static async Task<bool> InvokeClientAuthorization(
        FormEngine engine,
        DiyTableRowParam param,
        JObject table,
        string operation)
    {
        var operationType = typeof(FormEngine).GetNestedType(
            "ClientTableOperation",
            BindingFlags.NonPublic);
        var method = typeof(FormEngine).GetMethod(
            "AuthorizeClientTableAsync",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(operationType);
        Assert.NotNull(method);

        var operationValue = Enum.Parse(operationType!, operation, ignoreCase: true);
        var task = Assert.IsType<Task<bool>>(method!.Invoke(
            engine,
            new object[] { param, table, operationValue }));
        return await task;
    }

    private static async Task<bool> InvokeClientMetadataAuthorization(
        FormEngine engine,
        DiyTableRowParam param,
        JObject table)
    {
        var method = typeof(FormEngine).GetMethod(
            "AuthorizeClientTableMetadataAsync",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method);

        var task = Assert.IsType<Task<bool>>(method!.Invoke(
            engine,
            new object[] { param, table }));
        return await task;
    }

    private static List<string> InvokeBatchUnscopedListAuthorization(
        FormEngineAuthorizationSnapshot snapshot,
        IEnumerable<DiyTable> tables,
        IEnumerable<string> candidates)
    {
        var method = typeof(FormEngine).GetMethod(
            "FilterAuthorizedUnscopedClientTableNames",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);

        return Assert.IsType<List<string>>(method!.Invoke(
            null,
            new object[]
            {
                snapshot,
                tables,
                candidates.ToHashSet(StringComparer.OrdinalIgnoreCase)
            }));
    }

    private static async Task<bool> InvokeMenuRowScopeAuthorization(
        FormEngine engine,
        DiyTableRowParam param,
        JObject table,
        JObject menu,
        string operation)
    {
        var operationType = typeof(FormEngine).GetNestedType(
            "ClientTableOperation",
            BindingFlags.NonPublic);
        var method = typeof(FormEngine).GetMethod(
            "IsWithinMenuRowScopeAsync",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(operationType);
        Assert.NotNull(method);

        var operationValue = Enum.Parse(operationType!, operation, ignoreCase: true);
        var task = Assert.IsType<Task<bool>>(method!.Invoke(
            engine,
            new object[] { param, table, menu, operationValue }));
        return await task;
    }

    private static FormEngineAuthorizationSnapshot NewAuthorizationSnapshot(
        string permission,
        FormEngineAuthorizationMenuSnapshot menu)
    {
        return new FormEngineAuthorizationSnapshot
        {
            RoleLimits = new List<SysRoleLimit>
            {
                new()
                {
                    Type = "Menu",
                    FkId = menu.Id,
                    Permission = permission
                }
            },
            Menus = new List<FormEngineAuthorizationMenuSnapshot> { menu }
        };
    }

    private static FormEngineAuthorizationSnapshot NewActiveAuthorizationSnapshot(
        FormEngineAuthorizationMenuSnapshot menu,
        string permission = null)
    {
        var snapshot = NewAuthorizationSnapshot(permission, menu);
        snapshot.UserId = "user-a";
        snapshot.UserLevel = 0;
        snapshot.IsActiveUser = true;
        snapshot.EffectiveRoleIds = new List<string> { "role-a" };
        return snapshot;
    }

    private static FormEngineAuthorizationPolicy InvokeLegacyAuthorizationPolicy(
        FormEngineAuthorizationSnapshot snapshot,
        string tableId,
        string operation)
    {
        var operationType = typeof(FormEngine).GetNestedType(
            "ClientTableOperation",
            BindingFlags.NonPublic);
        var method = typeof(FormEngine).GetMethod(
            "BuildLegacyAuthorizationPolicy",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(operationType);
        Assert.NotNull(method);

        var operationValue = Enum.Parse(operationType!, operation, ignoreCase: true);
        return method!.Invoke(
            null,
            new object[] { snapshot, tableId, operationValue })
            as FormEngineAuthorizationPolicy;
    }

    private static FormEngineAuthorizationMenuSnapshot InvokeFindAuthorizationMenu(
        FormEngineAuthorizationSnapshot snapshot,
        string menuIdOrKey,
        string tableId)
    {
        var method = typeof(FormEngine).GetMethod(
            "FindAuthorizationMenu",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return method!.Invoke(
            null,
            new object[] { snapshot, menuIdOrKey, tableId })
            as FormEngineAuthorizationMenuSnapshot;
    }

    private static TableChildAuthorizationContext NewTableChildContext(
        string menuId,
        string tableId,
        string fieldId,
        TableChildAuthorizationContext parent = null)
    {
        return new TableChildAuthorizationContext
        {
            ParentSysMenuId = menuId,
            ParentTableId = tableId,
            ParentFieldId = fieldId,
            ParentRowId = $"row-{fieldId}",
            ParentValue = $"value-{fieldId}",
            ParentFormMode = "View",
            Parent = parent
        };
    }

    private static bool InvokeTableChildContextValidation(
        TableChildAuthorizationContext context)
    {
        var method = typeof(FormEngine).GetMethod(
            "IsValidTableChildContextChain",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return Assert.IsType<bool>(method!.Invoke(null, new object[] { context }));
    }
}
