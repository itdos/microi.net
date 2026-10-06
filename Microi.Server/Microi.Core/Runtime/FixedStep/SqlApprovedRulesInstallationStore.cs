using System;
using System.Collections.Generic;
using System.Linq;
using System.Globalization;
using System.Text;
using Microi.FixedStep;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
/// <summary>只读主库安装事实。租户来自编译期部署绑定，不接受请求的连接/表名/SQL。</summary>
public interface IPrimaryRulesInstallationReader
{
    JObject Read(string tenant,string registrationId);
}

public sealed class PrimaryRulesInstallationReader : IPrimaryRulesInstallationReader
{
    // 一条主库查询同时核验审批、实际安装版本和V3完成版本；缺表/断库/重复记录均失败关闭。
    internal const string Sql = @"SELECT a.*,i.InstallStatus AS LiveInstallStatus,
i.AppVersionInstall AS LiveInstalledVersion,i.InstallOsClient AS LiveInstallTenant,
i.StoreId AS LiveStoreId,i.IsDeleted AS LiveInstallDeleted,
v.AppId AS LivePublishedAppId,v.VersionNo AS LivePublishedVersion,
v.PublishState AS LivePublishState,v.PublishProtocolVersion AS LivePublishProtocol,
v.SourceManifestHash AS LiveSourceHash,v.CompletedAt AS LiveCompletedAt,v.IsDeleted AS LiveVersionDeleted,
v.SourceSnapshotPath AS LiveSourceSnapshotPath,v.RuntimeManifestHash AS LiveRuntimeHash,
h.Id AS LiveSnapshotId,h.TableName AS LiveSnapshotTable,h.TableRowId AS LiveSnapshotRowId,h.IsDeleted AS LiveSnapshotDeleted,
CASE WHEN OCTET_LENGTH(h.Data)<=524288 THEN h.Data ELSE NULL END AS LiveSnapshotData,
s.Id AS LiveCurrentId,s.AppKey AS LiveCurrentKey,s.AppVersion AS LiveCurrentVersion,
s.Status AS LiveCurrentStatus,s.IsApprove AS LiveCurrentApproved,s.IsDeleted AS LiveCurrentDeleted,
s.BuildStatus AS LiveCurrentBuildStatus,s.PublishState AS LiveCurrentPublishState,
s.PublishProtocolVersion AS LiveCurrentProtocol,s.CommittedPublishVersionId AS LiveCurrentCommittedVersion,
s.CommittedRuntimeManifestHash AS LiveCurrentRuntimeHash,s.PackageId AS LiveCurrentPackageId,
s.PackageSha256 AS LiveCurrentPackageHash,s.PackageSize AS LiveCurrentPackageSize,
s.PackageHdfsPath AS LiveCurrentPackagePath,s.PackageStorageMode AS LiveCurrentPackageMode,
k.Id AS LivePackageId,k.StoreId AS LivePackageStoreId,k.AppVersion AS LivePackageVersion,
k.Status AS LivePackageStatus,k.IsDeleted AS LivePackageDeleted,k.Sha256 AS LivePackageHash,
k.Size AS LivePackageSize,k.HdfsPath AS LivePackagePath,k.StorageMode AS LivePackageMode
FROM mci_runtime_installation a
LEFT JOIN sys_microistoreversion i ON i.Id=a.InstallRecordId
INNER JOIN mci_ai_app_version v ON v.Id=a.PublishedVersionId
LEFT JOIN mic_data_version h ON h.Id=a.InstallRecordId
LEFT JOIN sys_microistore s ON s.Id=a.PublishedAppId
LEFT JOIN sys_microistore_package k ON k.Id=s.PackageId
WHERE a.TenantKey=@tenant AND a.RegistrationId=@registration LIMIT 2";
    public JObject Read(string tenant,string registrationId)
    {
        var db=OsClientExtend.GetClient(tenant)?.Db;
        if(db==null)throw new InvalidOperationException("InstallationPrimaryUnavailable");
        if(db.Db.DbProvider.DatabaseType!=Dos.ORM.DatabaseType.MySql)throw new InvalidOperationException("InstallationDialectUnsupported");
        // 首批实装限定MySQL；LIMIT 2拒绝异常重复，不加载无界结果集或在C#内择一。
        var rows=db.FromSql(Sql).AddInParameter("@tenant",tenant).AddInParameter("@registration",registrationId).ToList<dynamic>();
        if(rows==null||rows.Count!=1)throw new InvalidOperationException("InstallationMissingOrAmbiguous");
        return JObject.FromObject((object)rows[0]);
    }
}

/// <summary>有实际主库实现的审批提供者；登记时和每次运行均回读，数据库故障/撤销不使用旧授权缓存。</summary>
public sealed class SqlApprovedRulesInstallationStore : IApprovedRulesInstallationStore
{
    private readonly CompiledRulesDeployments deployments;
    private readonly IPrimaryRulesInstallationReader primary;
    private readonly IOfficialRulesPublisherIdentity officialIdentity;
    // 旧二参构造保留安装分支；没有受信宿主身份提供者时，官方来源分支始终拒绝。
    public SqlApprovedRulesInstallationStore(CompiledRulesDeployments deployments,IPrimaryRulesInstallationReader primary,IOfficialRulesPublisherIdentity officialIdentity=null)
    {this.deployments=deployments;this.primary=primary;this.officialIdentity=officialIdentity;}
    public ApprovedInstallation ReadVerified(string tenant,string registrationId)
    {
        var binding=deployments.Require(tenant,registrationId);
        var row=primary.Read(binding.Tenant,binding.RegistrationId);
        // 官方身份只从受信许可证/宿主判定；审批行、Param 或自报来源不能选择此证明。
        var official=binding.ProofKind==RulesInstallationProofKind.OfficialPublishedSnapshot
            && officialIdentity!=null && officialIdentity.IsOfficialPublisher(binding.Tenant);
        return RulesInstallationRecord.Verify(row,binding,official);
    }
}

/// <summary>审批摘要与私有部署组合中固定的摘要比较；单纯改数据库行不能授予新代码执行权限。</summary>
public static class RulesInstallationRecord
{
    private static readonly string[] DigestFields={"Id","TenantKey","RegistrationId","PackageKey","InstallRecordId","PublisherTenant","PublishedAppId","PublishedVersionId","PublishedVersion","SourceManifestHash","AssemblySha256","EntryType","TickEngineKey","ProjectionEngineKey","RulesVersion","LayoutId","ApprovedBy","PublisherIdentity"};
    private static string Text(JObject row,string key)=>row.GetValue(key,StringComparison.OrdinalIgnoreCase)?.ToString()??"";
    private static bool LiveFlag(JObject row,string key){var value=Text(row,key);return value==""||value=="0"||string.Equals(value,"false",StringComparison.OrdinalIgnoreCase);}
    private static bool Hash(string value)=>value.Length==64&&value.All(c=>(c>='0'&&c<='9')||(c>='a'&&c<='f'));
    private static Dictionary<string,string> Dependencies(JObject row)
    {
        var raw=Text(row,"DependencyJson");if(raw.Length>256*1024)throw new InvalidOperationException("DependencyManifestTooLarge");
        var json=JObject.Parse(raw,new JsonLoadSettings{DuplicatePropertyNameHandling=DuplicatePropertyNameHandling.Error});
        if(json.Count==0||json.Count>512)throw new InvalidOperationException("DependencyManifestInvalid");
        var result=new Dictionary<string,string>(StringComparer.Ordinal);
        foreach(var p in json.Properties()){if(p.Name.Length>512||p.Value.Type!=JTokenType.String||!Hash(p.Value.ToString()))throw new InvalidOperationException("DependencyManifestInvalid");result.Add(p.Name,p.Value.ToString());}
        return result;
    }
    public static string Digest(JObject row,RulesInstallationProofKind kind=RulesInstallationProofKind.TenantInstallation,string publicationSnapshotSha256="")
    {
        if(!Enum.IsDefined(typeof(RulesInstallationProofKind),kind))throw new InvalidOperationException("InvalidProofKind");
        if(kind==RulesInstallationProofKind.OfficialPublishedSnapshot&&!Hash(publicationSnapshotSha256))throw new InvalidOperationException("InvalidPublicationSnapshotHash");
        // 旧安装摘要字节完全保持；官方发布证明用独立domain，绑定快照的真实UTF-8字节hash。
        var b=new StringBuilder(kind==RulesInstallationProofKind.TenantInstallation
            ? "microi-native-installation-v1\n" : "microi-native-publication-v1\n"+publicationSnapshotSha256+"\n");
        foreach(var key in DigestFields){var value=Text(row,key);if(value.Length==0||value.Length>1024)throw new InvalidOperationException("ApprovalFieldMissing");b.Append(value.Length).Append(':').Append(value).Append('\n');}
        foreach(var p in Dependencies(row).OrderBy(p=>p.Key,StringComparer.Ordinal))b.Append(p.Key.Length).Append(':').Append(p.Key).Append(':').Append(p.Value).Append('\n');
        return TrustedRulesCatalog.Hash(b.ToString());
    }
    public static ApprovedInstallation Verify(JObject row,CompiledRulesBinding binding,bool isOfficialPublisher=false)
    {
        if(row==null||Text(row,"TenantKey")!=binding.Tenant||Text(row,"RegistrationId")!=binding.RegistrationId||Text(row,"EntryType")!=binding.EntryType.FullName||Digest(row,binding.ProofKind,binding.PublicationSnapshotSha256)!=binding.ApprovalDigest)throw new InvalidOperationException("ApprovalReceiptMismatch");
        // 两种证明都限定同租户；跨租户仍需要独立来源协议，不能拿其它租户版本行授权。
        if(Text(row,"PublisherTenant")!=binding.Tenant||Text(row,"Status")!="Approved"||!LiveFlag(row,"IsDeleted")||!string.IsNullOrEmpty(Text(row,"RevokedAt")))throw new InvalidOperationException("InstallationRevoked");
        if(binding.ProofKind==RulesInstallationProofKind.TenantInstallation && (Text(row,"LiveInstallStatus")!="Installed"||Text(row,"LiveInstallTenant")!=binding.Tenant||Text(row,"LiveInstalledVersion")!=Text(row,"PublishedVersion")||Text(row,"LiveStoreId")!=Text(row,"PublishedAppId")||!LiveFlag(row,"LiveInstallDeleted")))throw new InvalidOperationException("InstallationVersionMismatch");
        if(!LiveFlag(row,"LiveVersionDeleted")||Text(row,"LivePublishState")!="Completed"||Text(row,"LivePublishProtocol")!="3"||Text(row,"LivePublishedAppId")!=Text(row,"PublishedAppId")||Text(row,"LivePublishedVersion")!=Text(row,"PublishedVersion")||Text(row,"LiveSourceHash")!=Text(row,"SourceManifestHash")||!Hash(Text(row,"SourceManifestHash"))||string.IsNullOrEmpty(Text(row,"LiveCompletedAt")))throw new InvalidOperationException("PublishedSourceMismatch");
        if(binding.ProofKind==RulesInstallationProofKind.OfficialPublishedSnapshot)
            VerifyOfficialPublication(row,binding,isOfficialPublisher);
        return new ApprovedInstallation{ApprovalId=Text(row,"Id"),AdministratorId=Text(row,"ApprovedBy"),PublisherIdentity=Text(row,"PublisherIdentity"),ImmutableSourceManifestSha256=Text(row,"SourceManifestHash"),DependencyClosureSha256=Dependencies(row),Package=new PackageApproval{Tenant=binding.Tenant,RegistrationId=binding.RegistrationId,PackageKey=Text(row,"PackageKey"),SourceReceipt=Text(row,"Id"),AssemblySha256=Text(row,"AssemblySha256"),EntryType=Text(row,"EntryType"),TickEngineKey=Text(row,"TickEngineKey"),ProjectionEngineKey=Text(row,"ProjectionEngineKey"),RulesVersion=Text(row,"RulesVersion"),LayoutId=Text(row,"LayoutId")}};
    }
    private static bool StrictLive(JObject row,string key)=>Text(row,key)=="0"||Text(row,key)=="false";
    private static bool PositiveSize(string text)=>long.TryParse(text,NumberStyles.None,CultureInfo.InvariantCulture,out var n)&&n>0;
    private static void VerifyOfficialPublication(JObject row,CompiledRulesBinding binding,bool official)
    {
        if(!official)throw new InvalidOperationException("OfficialPublisherRequired");
        var raw=Text(row,"LiveSnapshotData");
        if(!StrictLive(row,"LiveSnapshotDeleted")||Text(row,"LiveSnapshotId")!=Text(row,"InstallRecordId")||Text(row,"LiveSnapshotTable")!="sys_microistore"
            ||Text(row,"LiveSnapshotRowId")!=Text(row,"PublishedAppId")||raw.Length==0||Encoding.UTF8.GetByteCount(raw)>524288
            ||TrustedRulesCatalog.Hash(raw)!=binding.PublicationSnapshotSha256)throw new InvalidOperationException("PublicationSnapshotMismatch");
        JObject snapshot;
        try{snapshot=JObject.Parse(raw,new JsonLoadSettings{DuplicatePropertyNameHandling=DuplicatePropertyNameHandling.Error});}
        catch(Exception e) when(e is Newtonsoft.Json.JsonException||e is ArgumentException)
        {throw new InvalidOperationException("PublicationSnapshotInvalid",e);}
        // 不可变历史证明 + 当前有效指针双重核验。仅Completed或仅保留旧历史都不能继续授权。
        if(Text(row,"LiveCurrentId")!=Text(row,"PublishedAppId")||Text(row,"LiveCurrentKey")!=Text(row,"PackageKey")
            ||Text(row,"LiveCurrentVersion")!=Text(row,"PublishedVersion")||Text(row,"LiveCurrentStatus")!="Published"
            ||Text(row,"LiveCurrentApproved")!="1"||!StrictLive(row,"LiveCurrentDeleted")||Text(row,"LiveCurrentBuildStatus")!="Success"
            ||Text(row,"LiveCurrentProtocol")!="3"||Text(row,"LiveCurrentPublishState")!="Completed"
            ||Text(row,"LiveCurrentCommittedVersion")!=Text(row,"PublishedVersionId")
            ||!Hash(Text(row,"LiveRuntimeHash"))||Text(row,"LiveCurrentRuntimeHash")!=Text(row,"LiveRuntimeHash")
            ||string.IsNullOrWhiteSpace(Text(row,"LiveSourceSnapshotPath")))throw new InvalidOperationException("PublicationPointerMismatch");
        var fields=new[]{"Id","AppKey","AppVersion","Status","IsApprove","IsDeleted","BuildStatus","PublishProtocolVersion","PublishState","CommittedPublishVersionId","CommittedRuntimeManifestHash","PackageId","PackageSha256","PackageSize","PackageHdfsPath","PackageStorageMode"};
        var live=new[]{"LiveCurrentId","LiveCurrentKey","LiveCurrentVersion","LiveCurrentStatus","LiveCurrentApproved","LiveCurrentDeleted","LiveCurrentBuildStatus","LiveCurrentProtocol","LiveCurrentPublishState","LiveCurrentCommittedVersion","LiveCurrentRuntimeHash","LiveCurrentPackageId","LiveCurrentPackageHash","LiveCurrentPackageSize","LiveCurrentPackagePath","LiveCurrentPackageMode"};
        for(var i=0;i<fields.Length;i++)if(Text(snapshot,fields[i])!=Text(row,live[i]))throw new InvalidOperationException("PublicationSnapshotPointerMismatch");
        if(Text(row,"LiveCurrentPackageId")==""||!Hash(Text(row,"LiveCurrentPackageHash"))||!PositiveSize(Text(row,"LiveCurrentPackageSize"))
            ||!Text(row,"LiveCurrentPackagePath").StartsWith("/",StringComparison.Ordinal)
            ||(Text(row,"LiveCurrentPackageMode")!="HdfsPublic"&&Text(row,"LiveCurrentPackageMode")!="HdfsPrivate")
            ||Text(row,"LivePackageId")!=Text(row,"LiveCurrentPackageId")||Text(row,"LivePackageStoreId")!=Text(row,"PublishedAppId")
            ||Text(row,"LivePackageVersion")!=Text(row,"PublishedVersion")||Text(row,"LivePackageStatus")!="Verified"||!StrictLive(row,"LivePackageDeleted")
            ||Text(row,"LivePackageHash")!=Text(row,"LiveCurrentPackageHash")||Text(row,"LivePackageSize")!=Text(row,"LiveCurrentPackageSize")
            ||Text(row,"LivePackagePath")!=Text(row,"LiveCurrentPackagePath")||Text(row,"LivePackageMode")!=Text(row,"LiveCurrentPackageMode"))throw new InvalidOperationException("PublicationPackageMismatch");
    }

}
}
