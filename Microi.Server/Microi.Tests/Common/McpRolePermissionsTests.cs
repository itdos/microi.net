using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class McpRolePermissionsTests
{
    private static McpRoleGrant Grant(string scope="Role",bool write=false,bool delete=false,string role="role") => new()
    {RoleId=role,Policy=new(){Enabled=true,Scope=scope,CanWrite=write,CanDelete=delete}};
    private static McpRoleAuthorization Auth(params McpRoleGrant[] grants)
    {var result=new McpRoleAuthorization();result.Grants.AddRange(grants);return result;}

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"Enabled\":1,\"Scope\":\"Full\",\"CanWrite\":true,\"CanDelete\":true}")]
    [InlineData("{\"Enabled\":true,\"Scope\":\"all\",\"CanWrite\":true,\"CanDelete\":true}")]
    [InlineData("{\"Enabled\":true,\"Scope\":\"Full\",\"CanWrite\":true,\"CanDelete\":true,\"Level\":9999}")]
    public void MalformedPoliciesNeverGrantAuthority(string json)=>Assert.Throws<ArgumentException>(()=>McpRolePermissionPolicy.Parse(JObject.Parse(json)));

    [Fact]
    public void DisabledPolicyClearsDormantGrantsAndDuplicateStorageFailsClosed()
    {
        var policy=McpRolePermissionPolicy.Parse(JObject.Parse("{\"Enabled\":false,\"Scope\":\"Full\",\"CanWrite\":true,\"CanDelete\":true}"));
        Assert.False(policy.Enabled);Assert.False(policy.CanWrite);Assert.False(policy.CanDelete);Assert.Equal("Role",policy.Scope);
        var row=new SysRoleLimit{RoleId="one",Type=McpRolePermissionPolicy.LimitType,FkId=McpRolePermissionPolicy.LimitKey,Permission=Grant("Full",true,true).Policy.Serialize()};
        Assert.True(McpRolePermissionPolicy.Read(new[]{row},"one").Enabled);
        Assert.False(McpRolePermissionPolicy.Read(new[]{row,row},"one").Enabled);
        Assert.False(McpRolePermissionPolicy.Read(new[]{row},"other").Enabled);
        row.FkId="other";Assert.False(McpRolePermissionPolicy.Read(new[]{row},"one").Enabled);
    }

    [Fact]
    public void FullReadAndRestrictedWriteCannotCombineIntoFullMutation()
    {
        var auth=Auth(Grant("Full"),Grant("Role",true,true,"editor"));
        Assert.True(McpRoleRequestAuthorization.CanEnter(auth,"GetApiEngineCode",V8McpScope.Read));
        Assert.False(McpRoleRequestAuthorization.CanEnter(auth,"UpdateApiEngineCode",V8McpScope.Write));
        Assert.False(McpRoleRequestAuthorization.HasFullGrant(auth,"UpdateField",V8McpScope.Write));
        Assert.False(McpRoleRequestAuthorization.CanEnter(auth,"DeleteTable",V8McpScope.Write));
    }

    [Fact]
    public void RolePolicyDoesNotExposeScriptsInfrastructureOrUnknownActions()
    {
        foreach(var auth in new[]{Auth(Grant("Role",true,true)),Auth(Grant("Full",true,true))})
        {
            Assert.False(McpRoleRequestAuthorization.CanEnter(auth,"NewUnreviewedAction",V8McpScope.Read));
            Assert.False(McpRoleRequestAuthorization.CanEnter(auth,"SetRolePermission",V8McpScope.Admin));
            Assert.False(McpRoleRequestAuthorization.CanEnter(auth,"GetPlaywrightContext",V8McpScope.Admin));
            Assert.False(McpRoleRequestAuthorization.CanEnter(auth,"ManageSaasMinio",V8McpScope.Admin));
            Assert.False(McpRoleRequestAuthorization.CanEnter(auth,"GetStatus",V8McpScope.Write));
        }
        Assert.False(McpRoleRequestAuthorization.CanEnter(Auth(Grant("Role",true,true)),"GetApiEngineCode",V8McpScope.Read));
        Assert.False(McpRoleRequestAuthorization.CanEnter(Auth(Grant("Full",true)),"ExecuteApiEngine",V8McpScope.Execute));
        Assert.True(McpRoleRequestAuthorization.CanEnter(Auth(Grant("Full",true,true)),"ExecuteApiEngine",V8McpScope.Execute));
        Assert.False(McpRoleRequestAuthorization.CanEnter(Auth(),"GetStatus",V8McpScope.Read));
    }

    [Fact]
    public void TableMutationRequiresScopeAndOperationFromSameRole()
    {
        var reader=Grant("Full");var editor=Grant("Role",true,false,"editor");
        editor.Limits.Add(new(){RoleId="editor",Type="Menu",FkId="menu-one",Permission="[\"Read\",\"Edit\",\"Del\"]"});
        var auth=Auth(reader,editor);var menus=new[]{new SysMenu{Id="menu-one",DiyTableId="table-one"},new SysMenu{Id="menu-two",DiyTableId="table-two"}};
        Assert.True(ScopedMcpOperations.AllowsTable(auth,"table-one","Edit",menus));
        Assert.False(ScopedMcpOperations.AllowsTable(auth,"table-two","Edit",menus));
        Assert.False(ScopedMcpOperations.AllowsTable(auth,"table-one","Del",menus));
        editor.Policy.CanDelete=true;Assert.True(ScopedMcpOperations.AllowsTable(auth,"table-one","Del",menus));
        editor.Policy.Enabled=false;Assert.False(ScopedMcpOperations.AllowsTable(auth,"table-one","Edit",menus));
    }

    [Fact]
    public void DevelopmentSessionCannotUseLegacyHttpPathsToBypassRoleSwitches()
    {
        var auth=Auth(Grant("Role",true,true),Grant("Full",false,false,"reader"));
        Assert.True(McpDevelopmentSessionBoundary.IsDevelopmentSession("MCP"));
        Assert.True(McpDevelopmentSessionBoundary.IsDevelopmentSession("vscode"));
        Assert.False(McpDevelopmentSessionBoundary.IsDevelopmentSession("PC"));
        Assert.True(McpDevelopmentSessionBoundary.Allows(auth,true,"V8Engine","McpFormData"));
        Assert.False(McpDevelopmentSessionBoundary.Allows(auth,false,"FormEngine","UptFormData"));
        Assert.False(McpDevelopmentSessionBoundary.Allows(auth,false,"ApiEngine","Run"));
        Assert.False(McpDevelopmentSessionBoundary.Allows(auth,false,"Ai","Chat"));
        Assert.False(McpDevelopmentSessionBoundary.Allows(Auth(),true,"V8Engine","GetStatus"));
        Assert.True(McpDevelopmentSessionBoundary.Allows(auth,false,"SysUser","RefreshToken"));
    }

    [Theory]
    [InlineData("ApiV8Code")][InlineData("Sql")][InlineData("DataConfig")][InlineData("_TrustedServerInvocation")]
    public void RestrictedMetadataCannotSmuggleExecutableOrTrustedProperties(string field)
    {
        Assert.Throws<InvalidOperationException>(()=>ScopedMcpOperations.ValidateSafePatch(new JObject{[field]="payload"},new[]{"Label"}));
        Assert.Throws<InvalidOperationException>(()=>ScopedMcpOperations.ValidateSafePatch(new JObject{["Label"]=new JObject{[field]="payload"}},new[]{"Label"}));
    }

    [Fact]
    public void ScopedSchemaKeepsMenuTreeWithoutExpandingUnauthorizedAncestors()
    {
        var tree=ScopedMcpOperations.BuildMenuTree(new[]{new SysMenu{Id="allowed",ParentId="private-parent",Name="Allowed"},new SysMenu{Id="child",ParentId="allowed"}});
        Assert.Equal("allowed",tree.Single()["Id"]?.ToString());Assert.Equal("child",tree.Single()["_Child"]!.Single()["Id"]?.ToString());
        Assert.Equal(2,tree.Descendants().OfType<JObject>().Count());
        Assert.Throws<InvalidOperationException>(()=>ScopedMcpOperations.BuildMenuTree(new[]{new SysMenu{Id="a",ParentId="b"},new SysMenu{Id="b",ParentId="a"}}));
    }
}
