using System.Net.Http.Json;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.FullStack;

/// <summary>只在登记的隔离 Full 租户创建短期角色、账号和业务表，两个 API 节点共同验证权限事实。</summary>
[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
[Trait("Suite", "McpRolePermissions")]
public sealed class McpRolePermissionsHttpTests
{
    [Fact]
    public async Task RoleScopeMutationRevocationAndLegacyRoutesAreEnforcedAcrossNodes()
    {
        Assert.Equal("YES", Required("MICROI_TEST_ALLOW_WRITES"));
        var os = Required("MICROI_TEST_OSCLIENT");
        Assert.StartsWith("StandardSuite", os, StringComparison.Ordinal);
        Assert.False(os.Equals("iTdos", StringComparison.OrdinalIgnoreCase));
        var apis = new[] { Required("MICROI_TEST_API_BASE"), Required("MICROI_TEST_PEER_API_BASE") };
        var suffix = Guid.NewGuid().ToString("N")[..12];
        var role = "mcp-role-" + suffix; var readerRole = "mcp-read-" + suffix;
        var tableNames = new[] { "mcp_gate_a_" + suffix, "mcp_gate_b_" + suffix };
        var tables = new List<string>(); var modules = new List<string>();
        // 遵守平台默认 6–20 位密码策略，避免角色权限验收在创建账号阶段提前终止。
        var account = "mcp_" + suffix; var password = "McP!9" + Guid.NewGuid().ToString("N")[..15];
        var userId = ""; var token = ""; var did = "McpRoleHttp-" + suffix;
        var adminToken = Required("MICROI_TEST_TOKEN"); var adminDid = Required("MICROI_TEST_DID");

        async Task<JObject> Send(int node, string route, JObject body, bool admin = true, bool anonymous = false)
        {
            using var client = new HttpClient(new HttpClientHandler { UseCookies = false,
                ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator })
                { BaseAddress = new Uri(apis[node].TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(90) };
            client.DefaultRequestHeaders.Add("osclient", os);
            client.DefaultRequestHeaders.Add("did", admin ? adminDid : did);
            if (!anonymous) client.DefaultRequestHeaders.Add("authorization", admin ? adminToken : token);
            body["OsClient"] ??= os;
            using var content = new StringContent(body.ToString(Formatting.None), System.Text.Encoding.UTF8, "application/json");
            using var response = await client.PostAsync(route, content, TestContext.Current.CancellationToken);
            Assert.True(response.IsSuccessStatusCode || (int)response.StatusCode == 403, route + " HTTP " + (int)response.StatusCode);
            var result = JObject.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            if (response.Headers.TryGetValues("authorization", out var rotations))
            { if (admin) adminToken = rotations.First(); else token = rotations.First(); }
            return result;
        }
        async Task<JToken> Script(string code, JObject? args = null)
        {
            var envelope = Ok(await Send(0, "api/V8Engine/ExecuteApiEngine", new JObject {
                ["ApiEngineKey"] = "platform-sys-role", ["V8Code"] = code, ["Param"] = args ?? new JObject() }));
            return Ok((JObject)envelope["Result"]!);
        }
        async Task<JObject> ReadPolicy(string id, int node = 0)
        {
            var rows = (JArray)Ok(await Send(node, "apiengine/platform-sys-role", new JObject {
                ["Action"] = "GetMcpRolePermissions", ["RoleId"] = id }));
            return (JObject)Assert.Single(rows);
        }
        async Task SetPolicy(string id, bool enabled, string scope = "Role", bool write = false, bool delete = false)
        {
            var old = await ReadPolicy(id);
            var policy = new JObject { ["Enabled"] = enabled, ["Scope"] = scope, ["CanWrite"] = write, ["CanDelete"] = delete };
            var request = new JObject { ["Action"] = "SaveMcpRolePermissions", ["Roles"] = new JArray(new JObject {
                ["Id"] = id, ["Version"] = old["Version"], ["Policy"] = policy }) };
            Ok(await Send(0, "apiengine/platform-sys-role", request));
            var observed = await ReadPolicy(id, 1);
            Assert.Equal(enabled, observed["Policy"]!["Enabled"]!.Value<bool>());
            // 第二窗口拿着旧版本不能覆盖；本次确实改变了内容时才测试版本冲突。
            if (old["Version"]?.ToString() != observed["Version"]?.ToString())
                Denied(await Send(1, "apiengine/platform-sys-role", request));
        }
        try
        {
            await Script("""
                for(var id of [V8.Param.Role,V8.Param.Reader]) {
                  V8.DbTrans.FromSql('INSERT INTO sys_role (Id,Name,Level,IsDeleted,CreateTime,UpdateTime) VALUES (@id,@name,100,0,@now,@now)')
                    .AddInParameter('@id',id).AddInParameter('@name',id).AddInParameter('@now',DateNow('yyyy-MM-dd HH:mm:ss')).ExecuteNonQuery();
                }
                return {Code:1,Data:{Created:true}};
                """, new JObject { ["Role"] = role, ["Reader"] = readerRole });
            for (var i = 0; i < tableNames.Length; i++)
            {
                var table = Ok(await Send(0, "api/V8Engine/CreateTable", new JObject { ["Name"] = tableNames[i], ["Description"] = "MCP 隔离验收 " + suffix }));
                tables.Add(table["TableId"]!.ToString());
                Ok(await Send(0, "api/V8Engine/AddField", new JObject { ["TableId"] = tables[i], ["Name"] = "Name", ["Label"] = "名称", ["Type"] = "varchar(100)", ["Component"] = "Text" }));
                var menu = Ok(await Send(0, "api/V8Engine/CreateModule", new JObject { ["Name"] = "MCP验收" + i + suffix, ["DiyTableId"] = tables[i], ["Url"] = "/mcp-gate-" + i + suffix, ["Display"] = 0, ["AppDisplay"] = 0 }));
                modules.Add((menu["ModuleId"] ?? menu["Id"])!.ToString());
            }
            await Script("""
                V8.DbTrans.FromSql('INSERT INTO sys_rolelimit (Id,RoleId,FkId,Type,Permission,CreateTime) VALUES (@id,@role,@menu,@type,@permission,@now)')
                  .AddInParameter('@id',V8.Param.Role+'-menu').AddInParameter('@role',V8.Param.Role).AddInParameter('@menu',V8.Param.Menu)
                  .AddInParameter('@type','Menu').AddInParameter('@permission','["Read","Add","Edit","Del"]')
                  .AddInParameter('@now',DateNow('yyyy-MM-dd HH:mm:ss')).ExecuteNonQuery();
                return {Code:1,Data:{Created:true}};
                """, new JObject { ["Role"] = role, ["Menu"] = modules[0] });
            var user = Ok(await Send(0, "apiengine/platform-sys-user-admin", new JObject {
                ["Action"] = "AddSysUser", ["Account"] = account, ["Pwd"] = password,
                ["Name"] = "MCP隔离角色验收", ["RoleIds"] = new JArray(role, readerRole), ["State"] = 1, ["Level"] = 100 }));
            userId = user["Id"]!.ToString();
            var login = await Send(0, "api/SysUser/Login", new JObject { ["Account"] = account, ["Pwd"] = password,
                ["_ClientType"] = "MCP", ["_AutomationTestLogin"] = true }, false, true);
            Ok(login); if (string.IsNullOrEmpty(token)) token = (login["Data"]?["Token"] ?? login["Token"])!.ToString();
            for (var node = 0; node < 2; node++) Denied(await Send(node, "api/V8Engine/GetStatus", new JObject(), false));
            await SetPolicy(role, true);
            await SetPolicy(role, true); // 未改变授权的角色表单保存必须幂等。
            for (var node = 0; node < 2; node++)
            {
                Ok(await Send(node, "api/V8Engine/GetStatus", new JObject(), false));
                var schema = Ok(await Send(node, "api/V8Engine/GetDbSchema", new JObject(), false));
                var names = schema["Tables"]!.Select(t => t["Name"]!.ToString()).ToArray();
                Assert.Contains(tableNames[0], names); Assert.DoesNotContain(tableNames[1], names); Assert.DoesNotContain("sys_osclients", names);
                Ok(await Send(node, "api/V8Engine/GetFieldList", new JObject { ["TableId"] = tables[0] }, false));
                Denied(await Send(node, "api/V8Engine/GetFieldList", new JObject { ["TableId"] = tables[1] }, false));
                Denied(await Send(node, "api/V8Engine/UpdateTable", new JObject { ["Id"] = tables[0], ["Description"] = "must-not-write" }, false));
                Denied(await Send(node, "api/V8Engine/GetApiEngineCode", new JObject { ["ApiEngineKey"] = "platform-sys-role" }, false));
                Denied(await Send(node, "apiengine/platform-sys-role", new JObject { ["Action"] = "GetMcpRolePermissions" }, false));
                Denied(await Send(node, "api/FormEngine/GetTableData", new JObject { ["FormEngineKey"] = tableNames[0], ["_CurrentUser"] = new JObject { ["Level"] = 9999 }, ["_TrustedServerInvocation"] = true }, false));
                Denied(await Send(node, "api/V8Engine/McpFormData", new JObject { ["Operation"] = "query", ["TableName"] = "sys_osclients" }, false));
                Denied(await Send(node, "api/V8Engine/GetDbSchema", new JObject { ["OsClient"] = Required("MICROI_TEST_CHILD_OSCLIENT") }, false));
            }
            await SetPolicy(role, true, write: true);
            await SetPolicy(readerRole, true, "Full");
            for (var node = 0; node < 2; node++)
            {
                Ok(await Send(node, "api/V8Engine/UpdateTable", new JObject { ["Id"] = tables[0], ["Description"] = "owned-edit-" + node }, false));
                Denied(await Send(node, "api/V8Engine/UpdateTable", new JObject { ["Id"] = tables[1], ["Description"] = "outside-edit" }, false));
                Denied(await Send(node, "api/V8Engine/UpdateTable", new JObject { ["Id"] = tables[0], ["SubmitBeforeServerV8"] = "return {Code:1};" }, false));
                var id = "mcp-row-" + suffix + node;
                Ok(await Send(node, "api/V8Engine/McpFormData", new JObject { ["Operation"] = "add", ["TableName"] = tableNames[0], ["ConfirmExecution"] = tableNames[0], ["Row"] = new JObject { ["Id"] = id, ["Name"] = "owned" } }, false));
                Ok(await Send(node, "api/V8Engine/McpFormData", new JObject { ["Operation"] = "query", ["TableName"] = tableNames[0] }, false));
                Denied(await Send(node, "api/V8Engine/AdministerTableData", new JObject { ["Operation"] = "delete", ["TableName"] = tableNames[0], ["Id"] = id, ["ConfirmExecution"] = "DELETE:" + tableNames[0] + ":" + id }, false));
                Ok(await Send(node, "api/V8Engine/GetApiEngineCode", new JObject { ["ApiEngineKey"] = "platform-sys-role" }, false));
                Denied(await Send(node, "api/V8Engine/ExecuteApiEngine", new JObject { ["ApiEngineKey"] = "platform-sys-role", ["V8Code"] = "return {Code:1,Data:'forbidden'};" }, false));
            }
            await SetPolicy(role, true, write: true, delete: true);
            var deletedId = "mcp-row-" + suffix + "0";
            Ok(await Send(1, "api/V8Engine/AdministerTableData", new JObject { ["Operation"] = "delete", ["TableName"] = tableNames[0], ["Id"] = deletedId, ["ConfirmExecution"] = "DELETE:" + tableNames[0] + ":" + deletedId }, false));
            var rowsAfterDelete = (JArray)Ok(await Send(0, "api/V8Engine/McpFormData", new JObject { ["Operation"] = "query", ["TableName"] = tableNames[0] }, false));
            Assert.DoesNotContain(rowsAfterDelete, row => row["Id"]?.ToString() == deletedId);
            await SetPolicy(readerRole, true, "Full", true, true);
            var execution = Ok(await Send(1, "api/V8Engine/ExecuteApiEngine", new JObject { ["ApiEngineKey"] = "platform-sys-role", ["V8Code"] = "return {Code:1,Data:{Marker:'trusted-mcp-role',Level:V8.CurrentUser.Level}};" }, false));
            var result = Ok((JObject)execution["Result"]!);
            Assert.Equal("trusted-mcp-role", result["Marker"]?.ToString()); Assert.True(result["Level"]!.Value<int>() < 9999);
            await SetPolicy(role, false); await SetPolicy(readerRole, false);
            for (var node = 0; node < 2; node++) Denied(await Send(node, "api/V8Engine/GetStatus", new JObject(), false));
            // 管理员权限不由普通角色的开关决定。
            Ok(await Send(1, "api/V8Engine/GetStatus", new JObject()));
        }
        finally
        {
            // 精确清理已登记对象；随机物理表名在执行 DDL 前再次白名单校验，绝不清库或动其它任务。
            await Script("""
                var names=V8.Param.Names, tables=V8.Param.Tables, menus=V8.Param.Menus;
                for(var i=0;i<names.length;i++) {
                  if(!/^mcp_gate_[ab]_[a-f0-9]{12}$/.test(names[i])) return {Code:0,Msg:'cleanup identifier rejected'};
                  var existing=V8.DbTrans.FromSql('SELECT Id FROM diy_table WHERE Name=@name').AddInParameter('@name',names[i]).First();
                  if(existing){
                    V8.DbTrans.FromSql('DELETE FROM sys_menu WHERE DiyTableId=@id').AddInParameter('@id',existing.Id).ExecuteNonQuery();
                    V8.DbTrans.FromSql('DELETE FROM diy_field WHERE TableId=@id').AddInParameter('@id',existing.Id).ExecuteNonQuery();
                    V8.DbTrans.FromSql('DELETE FROM diy_table WHERE Id=@id AND Name=@name').AddInParameter('@id',existing.Id).AddInParameter('@name',names[i]).ExecuteNonQuery();
                  }
                  V8.Db.FromSql('DROP TABLE IF EXISTS `'+names[i]+'`').ExecuteNonQuery();
                }
                for(var j=0;j<menus.length;j++)V8.DbTrans.FromSql('DELETE FROM sys_menu WHERE Id=@id').AddInParameter('@id',menus[j]).ExecuteNonQuery();
                var cleanupUser=V8.DbTrans.FromSql('SELECT Id FROM sys_user WHERE Account=@account').AddInParameter('@account',V8.Param.Account).First();
                if(cleanupUser){V8.Method.ClearUserLoginInfo(cleanupUser.Id,V8.OsClient);V8.DbTrans.FromSql('DELETE FROM sys_user WHERE Id=@id AND Account=@account').AddInParameter('@id',cleanupUser.Id).AddInParameter('@account',V8.Param.Account).ExecuteNonQuery();}
                for(var id of [V8.Param.Role,V8.Param.Reader]){
                  V8.DbTrans.FromSql('DELETE FROM sys_rolelimit WHERE RoleId=@id').AddInParameter('@id',id).ExecuteNonQuery();
                  V8.DbTrans.FromSql('DELETE FROM sys_role WHERE Id=@id').AddInParameter('@id',id).ExecuteNonQuery();
                }
                return {Code:1,Data:{Cleaned:true}};
                """, new JObject { ["Names"] = new JArray(tableNames), ["Tables"] = new JArray(tables), ["Menus"] = new JArray(modules),
                    ["UserId"] = userId, ["Account"] = account, ["Role"] = role, ["Reader"] = readerRole });
        }
    }

    private static JToken Ok(JObject result)
    {
        Assert.True(result["Code"]?.Value<int>() == 1, "Expected success: " + result["Msg"]?.ToString());
        return result["Data"] ?? JValue.CreateNull();
    }
    private static void Denied(JObject result) => Assert.NotEqual(1, result["Code"]?.Value<int>());
    private static string Required(string key) => Environment.GetEnvironmentVariable(key) is { Length: > 0 } value
        ? value : throw new InvalidOperationException("Isolated Full requires " + key);
}
