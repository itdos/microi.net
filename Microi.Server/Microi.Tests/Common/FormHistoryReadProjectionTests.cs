using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class FormHistoryReadProjectionTests
{
    private static DiyTableRowParam Parent() => new() { OsClient="tenant", TableId="table", Id="row", _SysMenuId="menu", _InvokeType="Client", _CurrentUser=new JObject { ["Id"]="admin" } };
    private static JObject Raw() => JObject.Parse("""{"Id":"row","Name":"current","Phone":"private","Removed":"current","Pwd":"current-secret","Settings":{"Display":"current","Token":"current-token"},"ApiV8Code":"return 2;"}""");
    private static List<JObject> Metadata() => new[]{"Name","Phone","Removed","Pwd","Settings","ApiV8Code"}.Select(name=>new JObject { ["Name"]=name,["Label"]="字段"+name,["Component"]="Text" }).ToList();
    private static FormHistoryReadProjection Ready(DiyTableRowParam parent, JObject? current=null)
    {
        var observer=new FormHistoryReadProjection(parent);observer.Begin(parent,Raw(),Metadata());
        observer.Complete(parent,current??Raw(),Array.Empty<string>());return observer;
    }

    [Fact]
    public void UnchangedFieldsRemainReadableButArbitraryMasksAndRemovedFieldsNeverReturn()
    {
        var parent=Parent();var current=Raw();current["Phone"]="***";current.Remove("Removed");
        var observer=Ready(parent,current);
        var result=observer.ProjectSnapshot("orders",JObject.Parse("""{"Id":"row","Name":"previous","Phone":"OLD-PRIVATE","Removed":"OLD-DELETED","Unknown":"OLD-UNKNOWN"}"""));
        Assert.Equal("previous",(string?)result["Name"]);Assert.Null(result["Phone"]);Assert.Null(result["Removed"]);Assert.Null(result["Unknown"]);
    }

    [Fact]
    public void NestedCredentialObjectsAndJsonStringsAreRedactedWithoutLosingOrdinaryValues()
    {
        var observer=Ready(Parent());
        foreach(JToken value in new JToken[]{JObject.Parse("""{"Display":"previous","Token":"OLD-TOKEN","nested":[{"ClientSecret":"OLD-SECRET","Value":4}]}"""),new JValue("{\"Display\":\"previous\",\"Authorization\":\"OLD-AUTH\"}")})
        {
            var result=observer.ProjectSnapshot("orders",new JObject{["Id"]="row",["Settings"]=value,["Pwd"]="OLD-PWD"});
            Assert.Contains("previous",result.ToString());Assert.DoesNotContain("OLD-",result.ToString());Assert.Null(result["Pwd"]);
            Assert.Equal(value.Type,result["Settings"]!.Type);
        }
    }

    [Fact]
    public void AnArbitraryNestedDataFilterRewriteDeniesTheWholeHistoricalField()
    {
        var current=Raw();current["Settings"]!["Display"]="MASKED-BY-BUSINESS-EVENT";
        var result=Ready(Parent(),current).ProjectSnapshot("orders",new JObject{["Name"]="old",["Settings"]=new JObject{["Display"]="PRIVATE"}});
        Assert.Equal("old",(string?)result["Name"]);Assert.Null(result["Settings"]);
    }

    [Theory]
    [InlineData("tenant")][InlineData("table")][InlineData("row")][InlineData("menu")][InlineData("user")]
    public void ObserverCannotBeReusedForAnotherParentContext(string part)
    {
        var parent=Parent();var observer=new FormHistoryReadProjection(parent);observer.Begin(parent,Raw(),Metadata());
        if(part=="tenant")parent.OsClient="foreign";if(part=="table")parent.TableId="foreign";if(part=="row")parent.Id="foreign";
        if(part=="menu")parent._SysMenuId="foreign";if(part=="user")parent._CurrentUser["Id"]="foreign";
        observer.Complete(parent,Raw(),Array.Empty<string>());Assert.False(observer.IsComplete);Assert.Null(observer.ProjectSnapshot("orders",Raw()));
    }

    [Fact]
    public void SerializationCannotProvideOrLeakTheServerObserver()
    {
        var parent=Parent();parent._HistoryProjection=Ready(parent);
        Assert.DoesNotContain("HistoryProjection",JsonConvert.SerializeObject(parent));
        var forged=JObject.Parse("""{"_HistoryProjection":{"IsComplete":true},"Id":"row"}""").ToObject<DiyTableRowParam>();
        Assert.Null(forged!._HistoryProjection);
    }

    [Fact]
    public void IncompleteRepeatedOrMismatchedStoredSnapshotsFailClosed()
    {
        var parent=Parent();var observer=new FormHistoryReadProjection(parent);
        Assert.Null(observer.ProjectSnapshot("orders",Raw()));observer.Begin(parent,Raw(),Metadata());observer.Complete(parent,Raw(),Array.Empty<string>());
        Assert.Null(observer.ProjectSnapshot("orders",JObject.Parse("""{"Id":"foreign","Name":"private"}""")));
        observer.Begin(parent,Raw(),Metadata());Assert.False(observer.IsComplete);Assert.Null(observer.ProjectSnapshot("orders",Raw()));
    }

    [Fact]
    public void HistoricalLogsUseCurrentLabelsAndDropSensitiveUnknownOrMaskedFields()
    {
        var current=Raw();current["Phone"]="masked";var observer=Ready(Parent(),current);
        var result=observer.ProjectLog("orders",new JValue("""[{"Name":"Name","Label":"OLD-UNTRUSTED","OVal":"before","NVal":"after"},{"Name":"Phone","OVal":"PRIVATE"},{"Name":"Pwd","NVal":"SECRET"},{"Name":"Unknown","NVal":"UNKNOWN"}]"""));
        Assert.Single(result);Assert.Equal("字段Name",(string?)result[0]!["Label"]);Assert.Equal("before",(string?)result[0]!["OVal"]);
        Assert.DoesNotContain("PRIVATE",result.ToString());Assert.DoesNotContain("SECRET",result.ToString());
    }

    [Fact]
    public void ServerNotSaveFieldsAndOversizedPayloadCannotRecoverHistory()
    {
        var parent=Parent();var observer=new FormHistoryReadProjection(parent);observer.Begin(parent,Raw(),Metadata());observer.Complete(parent,Raw(),new[]{"Name"});
        Assert.Null(observer.ProjectSnapshot("orders",new JObject{["Name"]="PRIVATE"}));
        Assert.Null(observer.ProjectSnapshot("orders",new JValue(new string('x',2*1024*1024+1))));
    }

    [Fact]
    public void CodeSnapshotsStillUseTheirNarrowCodeWhitelistAndCurrentProjection()
    {
        var observer=Ready(Parent());var result=observer.ProjectCode("sys_apiengine",JObject.Parse("""{"Id":"row","ApiV8Code":"return 1;","Name":"not-code","Pwd":"SECRET"}"""));
        Assert.Equal("return 1;",(string?)result["ApiV8Code"]);Assert.Null(result["Name"]);Assert.Null(result["Pwd"]);
    }

    [Fact]
    public void PasswordComponentsMaskedTextControlsAndEncryptedColumnsDenyHistoryEvenWithOrdinaryNames()
    {
        var parent=Parent();var raw=JObject.Parse("""{"Id":"row","Name":"current","A":"current","B":"current","C":"current"}""");
        var metadata=new List<JObject>{new(){["Name"]="Name"},new(){["Name"]="A",["Component"]="Password"},new(){["Name"]="B",["Config"]="{\"TextShowPassword\":true}"},new(){["Name"]="C",["Encrypt"]=1}};
        var observer=new FormHistoryReadProjection(parent);observer.Begin(parent,raw,metadata);observer.Complete(parent,raw,Array.Empty<string>());
        var result=observer.ProjectSnapshot("orders",JObject.Parse("""{"Name":"previous","A":"OLD-A","B":"OLD-B","C":"OLD-C"}"""));
        Assert.Equal("previous",(string?)result["Name"]);Assert.DoesNotContain("OLD-",result.ToString());
    }

    [Fact]
    public void SaasHistoryAllowsOnlyExplicitSafeMetadataAndCurrentUnchangedFields()
    {
        var parent=Parent();
        var names=new[]{"ClientName","OsClient","IsEnable","UnknownConfiguration","RedisHost","MQUserName","TranslateKey","AlidnsKeyId","ChanjetAppKey","DbConn"};
        var raw=new JObject{["Id"]="row"};foreach(var name in names)raw[name]="current";
        var observer=new FormHistoryReadProjection(parent);observer.Begin(parent,raw,names.Select(name=>new JObject{["Name"]=name}));
        var current=(JObject)raw.DeepClone();current["IsEnable"]="masked";observer.Complete(parent,current,Array.Empty<string>());
        var old=new JObject{["Id"]="row"};foreach(var name in names)old[name]="OLD-"+name;
        var result=observer.ProjectSnapshot("sys_osclients",old)!;
        Assert.Equal("OLD-ClientName",(string?)result["ClientName"]);Assert.Equal("OLD-OsClient",(string?)result["OsClient"]);
        Assert.Equal(3,result.Count);Assert.Null(result["IsEnable"]);
    }

    [Fact]
    public void RichConfigurationValuesCannotHideCredentialsBehindSemanticKeysOrJsonEncoding()
    {
        var payload=JArray.Parse("""[{"Key":"Authorization","Value":"OLD-AUTH"},{"Name":"TranslateKey","Value":"OLD-TRANSLATE"},{"FieldName":"MQUserName","Text":"OLD-MQ"},{"Component":"Password","Value":"OLD-CONTROL"},{"PasswordNameEncrypt":1,"Value":"OLD-ENCRYPTED"},{"Name":"Display","Value":"ordinary"}]""");
        foreach(var value in new JToken[]{payload,new JValue(payload.ToString(Formatting.None)),new JValue(JsonConvert.SerializeObject(payload.ToString(Formatting.None)))})
        {
            var result=Ready(Parent()).ProjectSnapshot("orders",new JObject{["Settings"]=value})!;
            Assert.Contains("ordinary",result.ToString());Assert.DoesNotContain("OLD-",result.ToString());
            Assert.Equal(value.Type,result["Settings"]!.Type);
        }
    }

    [Fact]
    public void PasswordNameEncryptMetadataAndConfigurationFlagsDenyHistoricalValues()
    {
        var parent=Parent();var raw=JObject.Parse("""{"Id":"row","Name":"current","A":"current","B":"current"}""");
        var fields=new[]{new JObject{["Name"]="Name"},new JObject{["Name"]="A",["PasswordNameEncrypt"]=1},new JObject{["Name"]="B",["Config"]="{\"PasswordNameEncrypt\":true}"}};
        var observer=new FormHistoryReadProjection(parent);observer.Begin(parent,raw,fields);observer.Complete(parent,raw,Array.Empty<string>());
        var result=observer.ProjectSnapshot("orders",JObject.Parse("""{"Name":"previous","A":"OLD-A","B":"OLD-B"}"""))!;
        Assert.Equal("previous",(string?)result["Name"]);Assert.DoesNotContain("OLD-",result.ToString());
    }

    [Fact]
    public void CodeTableLogsPreserveCurrentCodeFieldButRedactCredentialsInOtherChanges()
    {
        var changes=JArray.Parse("""[{"Name":"ApiV8Code","OVal":"return 1;","NVal":"return 2;"},{"Name":"Pwd","OVal":"OLD-PWD"},{"Name":"Settings","NVal":{"Key":"RedisHost","Value":"OLD-ENDPOINT","Token":"OLD-TOKEN"}}]""");
        var result=Ready(Parent()).ProjectLog("sys_apiengine",changes)!;
        Assert.Equal(2,result.Count);Assert.Equal("return 1;",(string?)result[0]!["OVal"]);Assert.DoesNotContain("OLD-",result.ToString());
    }

    [Theory]
    [InlineData("x-api-key")][InlineData("client-secret")][InlineData("access_token")]
    public void CredentialIdentifiersWithSeparatorsAreHiddenWithoutChangingOrdinaryNamesOrValues(string identifier)
    {
        var settings=new JObject{[identifier]="OLD-DIRECT",["Entries"]=new JArray(new JObject{["Key"]=identifier,["Value"]="OLD-SEMANTIC"},new JObject{["Key"]="Hyphenated-Name",["Value"]="ordinary-with_ spaces"}),["Hyphenated-Name"]="literal client-secret value is ordinary business text"};
        var result=Ready(Parent()).ProjectSnapshot("orders",new JObject{["Settings"]=settings})!;
        Assert.DoesNotContain("OLD-",result.ToString());Assert.Equal("literal client-secret value is ordinary business text",(string?)result["Settings"]!["Hyphenated-Name"]);
        var ordinary=result["Settings"]!["Entries"]![1]!;Assert.Equal("Hyphenated-Name",(string?)ordinary["Key"]);Assert.Equal("ordinary-with_ spaces",(string?)ordinary["Value"]);
    }
}
