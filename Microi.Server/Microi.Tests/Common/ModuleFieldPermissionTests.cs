using Microi.net;
using Newtonsoft.Json.Linq;
namespace Microi.Tests.Common;
public sealed class ModuleFieldPermissionTests
{
    private static FormEngineAuthorizationSnapshot Principal() => new() { UserId="user", EffectiveRoleIds=new(){"role"},DepartmentIds=new(){"dept"},JobIds=new(){"job"} };
    private static string Config(string key,string identity,bool visible,bool editable) => new JObject {
        ["Version"]=1,["Enabled"]=true,["Rules"]=new JArray(new JObject{[key]=new JArray(identity),["Fields"]=new JArray(new JObject{["Name"]="Secret",["Visible"]=visible,["Editable"]=editable})}) }.ToString();
    [Theory][InlineData("Users","user")][InlineData("Roles","role")][InlineData("Departments","dept")][InlineData("Jobs","job")]
    public void AuthoritativeIdentityEnforcesHiddenAndReadonly(string key,string identity) {
        var hidden=ModuleFieldPermission.Resolve(Config(key,identity,false,true),Principal()); Assert.False(hidden.Visible("SECRET")); Assert.False(hidden.Editable("Secret"));
        var read=ModuleFieldPermission.Resolve(Config(key,identity,true,false),Principal());Assert.True(read.Visible("Secret"));Assert.False(read.Editable("Secret"));
        var unrelated=ModuleFieldPermission.Resolve(Config(key,"unrelated",false,false),Principal());Assert.True(unrelated.Visible("Secret"));
    }
    [Fact] public void RoleAndJobAssignmentsAreIndependentIdentities() {
        var roleOnly = new FormEngineAuthorizationSnapshot { UserId="user", EffectiveRoleIds=new(){"shared-id"}, JobIds=new() };
        Assert.True(ModuleFieldPermission.Resolve(Config("Jobs","shared-id",false,false),roleOnly).Visible("Secret"));
        Assert.False(ModuleFieldPermission.Resolve(Config("Roles","shared-id",false,false),roleOnly).Visible("Secret"));
        var jobOnly = new FormEngineAuthorizationSnapshot { UserId="user", EffectiveRoleIds=new(), JobIds=ModuleFieldPermission.Ids("[{\"Id\":\"shared-id\",\"JobName\":\"销售岗位\"}]") };
        Assert.False(ModuleFieldPermission.Resolve(Config("Jobs","shared-id",false,false),jobOnly).Visible("Secret"));
        Assert.True(ModuleFieldPermission.Resolve(Config("Roles","shared-id",false,false),jobOnly).Visible("Secret"));
    }
    [Fact]public void DenyWinsAcrossGroupsAndMenuContextsAndDerivedValues() {
        var read=ModuleFieldPermission.Resolve(Config("Roles","role",true,true),Principal());
        read.Intersect(ModuleFieldPermission.Resolve(Config("Users","user",false,false),Principal()));read.RestrictAlias("Alias","Secret");
        var row=read.Project(JObject.Parse("{\"Id\":\"1\",\"Secret\":\"hidden\",\"Alias\":\"hidden\",\"Secret_RealPath\":\"hidden\",\"Name\":\"public\",\"_Child\":[{\"Secret\":\"hidden\"}]}"));
        Assert.Null(row["Secret"]);Assert.Null(row["Alias"]);Assert.Null(row["Secret_RealPath"]);Assert.Null(row["_Child"]![0]!["Secret"]);Assert.Equal("public",(string?)row["Name"]);
    }
    [Fact] public void AllowListCanGrantExplicitFieldsWhileOtherFieldsRemainHidden() {
        var config=JObject.Parse(Config("Roles","role",true,true));config["DefaultVisible"]=false;config["DefaultEditable"]=false;
        var permission=ModuleFieldPermission.Resolve(config.ToString(),Principal());Assert.True(permission.Visible("Id"));Assert.True(permission.Editable("Secret"));Assert.False(permission.Visible("Name"));
    }
    [Fact] public void OrmLoadsFieldPoliciesIntoTypedSnapshotModel() {
        var table=new System.Data.DataTable();table.Columns.Add("Id",typeof(string));table.Columns.Add("DiyTableId",typeof(string));table.Columns.Add("FieldPermissions",typeof(string));
        table.Rows.Add("menu","table",Config("Users","user",false,false));
        using var reader=table.CreateDataReader();var menu=Dos.ORM.EntityUtils.ReaderToEnumerable<FormEngineAuthorizationMenuSnapshot>(reader).Single();
        Assert.Equal("menu",menu.Id);Assert.Equal("table",menu.DiyTableId);
        Assert.False(ModuleFieldPermission.Resolve(menu.FieldPermissions,Principal()).Visible("Secret"));
    }
    [Fact] public void ClientAccessContainsOnlyResolvedCapabilities() {
        var access=ModuleFieldPermission.Resolve(Config("Users","user",true,false),Principal()).ToClientAccess();
        Assert.False(access["Fields"]!["Secret"]!["Editable"]!.Value<bool>());Assert.Null(access["Rules"]);Assert.Null(access["Users"]);
    }
    [Theory][InlineData("not-json")][InlineData("{\"Version\":2,\"Enabled\":true,\"Rules\":[]}")][InlineData("{\"Version\":1,\"Enabled\":true,\"Rules\":[{\"Fields\":[{\"Name\":\"X\",\"Visible\":1}]}]}")]
    public void MalformedPoliciesNeverBecomeAnImplicitGrant(string json) => Assert.ThrowsAny<Exception>(()=>ModuleFieldPermission.Resolve(json,Principal()));
}
