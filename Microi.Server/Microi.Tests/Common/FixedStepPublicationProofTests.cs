using System.Security.Cryptography;
using System.Text;
using Microi.FixedStep;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>通用官方发行证明门禁；纯数据/ORM外围夹具，不写真实审批、不假称部署。</summary>
public sealed class FixedStepPublicationProofTests
{
    [Fact]
    public void Official_snapshot_with_no_installed_row_is_valid_only_for_fixed_official_kind()
    {
        var (row,binding)=Fixture();
        Assert.Equal("fixture-app",RulesInstallationRecord.Verify(row,binding,true).Package.PackageKey);
        var oldBinding=new CompiledRulesBinding("tenant","reg",RulesInstallationRecord.Digest(row),typeof(Counter),()=>new Counter());
        Assert.Equal("InstallationVersionMismatch",Assert.Throws<InvalidOperationException>(()=>RulesInstallationRecord.Verify(row,oldBinding,true)).Message);
        Assert.Equal("OfficialPublisherRequired",Assert.Throws<InvalidOperationException>(()=>RulesInstallationRecord.Verify(row,binding,false)).Message);
    }

    [Fact]
    public void Existing_installation_kind_and_digest_remain_byte_compatible()
    {
        var (row,_)=Fixture();Install(row);
        var canonical="microi-native-installation-v1\n";
        foreach(var key in DigestFields){var text=row[key]!.ToString();canonical+=text.Length+":"+text+"\n";}
        var name=typeof(Counter).Assembly.FullName!;canonical+=name.Length+":"+name+":"+new string('d',64)+"\n";
        Assert.Equal(Hash(canonical),RulesInstallationRecord.Digest(row));
        var binding=new CompiledRulesBinding("tenant","reg",Hash(canonical),typeof(Counter),()=>new Counter());
        Assert.Equal(RulesInstallationProofKind.TenantInstallation,binding.ProofKind);
        Assert.Equal("fixture-app",RulesInstallationRecord.Verify(row,binding).Package.PackageKey);
    }

    [Theory]
    [InlineData("LiveCurrentStatus","Draft")]
    [InlineData("LiveCurrentApproved","0")]
    [InlineData("LiveCurrentDeleted","1")]
    [InlineData("LiveCurrentBuildStatus","Publishing")]
    [InlineData("LiveCurrentVersion","v1.0.1")]
    [InlineData("LiveCurrentCommittedVersion","another-version")]
    [InlineData("LiveCurrentRuntimeHash","bad")]
    [InlineData("LiveCurrentProtocol","2")]
    [InlineData("LiveCurrentPublishState","RepairRequired")]
    [InlineData("LiveSourceSnapshotPath","")]
    [InlineData("LiveSourceHash","bad")]
    [InlineData("LiveCompletedAt","")]
    [InlineData("LiveVersionDeleted","1")]
    [InlineData("LiveSnapshotId","other-snapshot")]
    [InlineData("LiveSnapshotTable","sys_user")]
    [InlineData("LiveSnapshotRowId","another-app")]
    [InlineData("LiveSnapshotDeleted","1")]
    [InlineData("LiveSnapshotData", "{}")]
    [InlineData("LiveCurrentPackageHash","bad")]
    [InlineData("LivePackageStatus","Pending")]
    [InlineData("LivePackageDeleted","1")]
    [InlineData("LivePackageId","other-package")]
    [InlineData("LivePackageStoreId","other-app")]
    [InlineData("LivePackageVersion","v0.0.1")]
    [InlineData("LivePackageHash","bad")]
    [InlineData("LivePackageSize","0")]
    [InlineData("LivePackagePath","/different")]
    [InlineData("LivePackageMode","Inline")]
    [InlineData("Status","Revoked")]
    [InlineData("RevokedAt","2026-10-04")]
    [InlineData("IsDeleted","1")]
    public void Live_change_rejects_previously_valid_deployment(string field,string value)
    {
        var (row,binding)=Fixture();RulesInstallationRecord.Verify(row,binding,true);
        row[field]=value;Assert.Throws<InvalidOperationException>(()=>RulesInstallationRecord.Verify(row,binding,true));
    }

    [Fact]
    public void Changing_snapshot_and_current_pointer_together_cannot_change_compiled_proof()
    {
        var (row,binding)=Fixture();var snapshot=JObject.Parse(row["LiveSnapshotData"]!.ToString());
        snapshot["PackageHdfsPath"]="/other";row["LiveCurrentPackagePath"]=row["LivePackagePath"]="/other";
        row["LiveSnapshotData"]=snapshot.ToString(Formatting.None);
        Assert.Equal("PublicationSnapshotMismatch",Assert.Throws<InvalidOperationException>(()=>RulesInstallationRecord.Verify(row,binding,true)).Message);
    }

    [Fact]
    public void Cross_tenant_and_missing_or_invalid_static_proof_cannot_use_official_kind()
    {
        var (row,binding)=Fixture();row["PublisherTenant"]="other";
        binding=Binding(row,binding.PublicationSnapshotSha256);
        Assert.Equal("InstallationRevoked",Assert.Throws<InvalidOperationException>(()=>RulesInstallationRecord.Verify(row,binding,true)).Message);
        Assert.Throws<InvalidOperationException>(()=>new CompiledRulesBinding("tenant","reg",new string('a',64),typeof(Counter),()=>new Counter(),RulesInstallationProofKind.OfficialPublishedSnapshot));
        Assert.Throws<InvalidOperationException>(()=>new CompiledRulesBinding("tenant","reg",new string('a',64),typeof(Counter),()=>new Counter(),(RulesInstallationProofKind)22));
    }

    [Fact]
    public void Proof_kind_is_digest_separated_and_snapshot_json_is_bounded_and_unambiguous()
    {
        var (row,binding)=Fixture();Assert.NotEqual(RulesInstallationRecord.Digest(row),binding.ApprovalDigest);
        foreach(var raw in new[]{"{\"Id\":\"a\",\"Id\":\"b\"}",new string('x',524289)})
        {row["LiveSnapshotData"]=raw;var changed=Binding(row,Hash(raw));Assert.Throws<InvalidOperationException>(()=>RulesInstallationRecord.Verify(row,changed,true));}
    }

    [Fact]
    public void Provider_reads_primary_again_on_each_call_and_fails_closed_after_change()
    {
        var (row,_)=Fixture();Install(row);var binding=new CompiledRulesBinding("tenant","reg",RulesInstallationRecord.Digest(row),typeof(Counter),()=>new Counter());
        var reader=new Reader(row);var store=new SqlApprovedRulesInstallationStore(new CompiledRulesDeployments(new[]{new Registrar(binding)}),reader);
        store.ReadVerified("tenant","reg");row["LiveInstallDeleted"]=1;
        Assert.Throws<InvalidOperationException>(()=>store.ReadVerified("tenant","reg"));Assert.Equal(2,reader.Reads);
    }

    internal static (JObject row,CompiledRulesBinding binding) Fixture()
    {
        var r=new JObject();foreach(var key in DigestFields)r[key]="fixture";
        r["TenantKey"]=r["PublisherTenant"]="tenant";r["RegistrationId"]="reg";r["PackageKey"]="fixture-app";
        r["EntryType"]=typeof(Counter).FullName;r["SourceManifestHash"]=r["LiveSourceHash"]=new string('a',64);
        r["AssemblySha256"]=new string('d',64);r["DependencyJson"]=new JObject{[typeof(Counter).Assembly.FullName!]=new string('d',64)}.ToString(Formatting.None);
        r["Status"]="Approved";r["IsDeleted"]=r["LiveVersionDeleted"]=r["LiveCurrentDeleted"]=r["LivePackageDeleted"]=r["LiveSnapshotDeleted"]=0;
        r["LivePublishState"]=r["LiveCurrentPublishState"]="Completed";r["LivePublishProtocol"]=r["LiveCurrentProtocol"]=3;r["LiveCompletedAt"]="2026-10-04";
        r["LivePublishedAppId"]=r["LiveCurrentId"]=r["LivePackageStoreId"]=r["LiveSnapshotRowId"]=r["PublishedAppId"];
        r["LivePublishedVersion"]=r["LiveCurrentVersion"]=r["LivePackageVersion"]=r["PublishedVersion"];
        r["LiveCurrentCommittedVersion"]=r["PublishedVersionId"];r["LiveCurrentKey"]=r["PackageKey"];
        r["LiveSourceSnapshotPath"]="/private/source";r["LiveCurrentStatus"]="Published";r["LiveCurrentApproved"]=1;r["LiveCurrentBuildStatus"]="Success";
        r["LiveCurrentRuntimeHash"]=r["LiveRuntimeHash"]=new string('b',64);r["LiveCurrentPackageId"]=r["LivePackageId"]="package";
        r["LiveCurrentPackageHash"]=r["LivePackageHash"]=new string('c',64);r["LiveCurrentPackageSize"]=r["LivePackageSize"]=100;
        r["LiveCurrentPackagePath"]=r["LivePackagePath"]="/immutable/package.json";r["LiveCurrentPackageMode"]=r["LivePackageMode"]="HdfsPublic";r["LivePackageStatus"]="Verified";
        r["LiveSnapshotId"]=r["InstallRecordId"];r["LiveSnapshotTable"]="sys_microistore";
        var names=new[]{"Id","AppKey","AppVersion","Status","IsApprove","IsDeleted","BuildStatus","PublishProtocolVersion","PublishState","CommittedPublishVersionId","CommittedRuntimeManifestHash","PackageId","PackageSha256","PackageSize","PackageHdfsPath","PackageStorageMode"};
        var keys=new[]{"LiveCurrentId","LiveCurrentKey","LiveCurrentVersion","LiveCurrentStatus","LiveCurrentApproved","LiveCurrentDeleted","LiveCurrentBuildStatus","LiveCurrentProtocol","LiveCurrentPublishState","LiveCurrentCommittedVersion","LiveCurrentRuntimeHash","LiveCurrentPackageId","LiveCurrentPackageHash","LiveCurrentPackageSize","LiveCurrentPackagePath","LiveCurrentPackageMode"};
        var snapshot=new JObject();for(var i=0;i<names.Length;i++)snapshot[names[i]]=r[keys[i]]!.DeepClone();
        r["LiveSnapshotData"]=snapshot.ToString(Formatting.None);return(r,Binding(r,Hash(r["LiveSnapshotData"]!.ToString())));
    }
    private static readonly string[] DigestFields={"Id","TenantKey","RegistrationId","PackageKey","InstallRecordId","PublisherTenant","PublishedAppId","PublishedVersionId","PublishedVersion","SourceManifestHash","AssemblySha256","EntryType","TickEngineKey","ProjectionEngineKey","RulesVersion","LayoutId","ApprovedBy","PublisherIdentity"};
    private static void Install(JObject r){r["LiveInstallStatus"]="Installed";r["LiveInstallTenant"]="tenant";r["LiveInstalledVersion"]=r["PublishedVersion"];r["LiveStoreId"]=r["PublishedAppId"];r["LiveInstallDeleted"]=0;}
    private static string Hash(string s)=>Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(s)));
    private static CompiledRulesBinding Binding(JObject r,string hash)=>new("tenant","reg",RulesInstallationRecord.Digest(r,RulesInstallationProofKind.OfficialPublishedSnapshot,hash),typeof(Counter),()=>new Counter(),RulesInstallationProofKind.OfficialPublishedSnapshot,hash);
    private sealed class Reader(JObject row):IPrimaryRulesInstallationReader{public int Reads;public JObject Read(string tenant,string registration){Reads++;return(JObject)row.DeepClone();}}
    private sealed class Registrar(CompiledRulesBinding binding):ITrustedRulesRegistrar{public IEnumerable<CompiledRulesBinding> Registrations=>new[]{binding};}
    private sealed class Counter:IDeterministicRules
    {
        public long CompletedTick=>0;public bool IsTerminal=>false;public SimulationBinding Binding=>new(){Tenant="tenant",RoomId="room",RoomEpoch="epoch"};
        public void Initialize(string s){}public void Restore(string s){}public string Apply(InboxCommand c)=>"Accepted";public void AdvanceOneTick(){}public string Capture()=>"{}";public string Project(int seat,long cursor)=>"{}";
    }
}
