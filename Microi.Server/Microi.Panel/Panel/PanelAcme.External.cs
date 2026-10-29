using System.Net.Mail;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Microi.Panel.Panel;

public sealed record PanelExternalAcmeRequest(string RequestId,string InstanceId,string SiteId,string ExpectedFingerprint,string ExpectedSha256,
    string[] Domains,string Email,string Provider,string DirectoryUrl,string RootCertificatePem,bool AutoRenew,bool AcceptTerms,string ExpectedAcmeRevision,string Confirm);

public sealed partial class PanelAcme
{
    public PanelOperation ExternalIssue(PanelExternalAcmeRequest request,string actor)
    {
        if(!Guid.TryParse(request.RequestId,out var requestId)||request.Confirm!=request.SiteId||!request.AcceptTerms)
            throw new OpsException("请确认外部网站、ACME条款及稳定的请求标识。");
        if(request.InstanceId is not {Length: >0 and <=128}||request.SiteId is not {Length: >0 and <=128})throw new OpsException("外部网站标识无效。");
        if(request.Email is not {Length: >0 and <=200}||!MailAddress.TryCreate(request.Email,out var email)||email.Address!=request.Email)throw new OpsException("请输入有效的证书联系邮箱。");
        RequireSha256(request.ExpectedSha256);RequireSha256(request.ExpectedFingerprint);
        var domains=(request.Domains??[]).Select(NginxConfig.Domain).Distinct().Order().ToArray();
        if(domains.Length is <1 or >100||domains.Any(x=>x.StartsWith("*.",StringComparison.Ordinal)))throw new OpsException("HTTP-01需要1至100个明确域名；通配符证书请通过DNS验证取得后导入。");
        var resourceId="host-nginx-"+UpdateCoordinator.Hash(request.InstanceId)[..24].ToLowerInvariant();
        var registration=new PanelAcmeRegistration{Id=CertificateId(repository.OwnerId,resourceId,request.SiteId),Revision=requestId.ToString("N"),
            Target="External",ResourceId=resourceId,InstanceId=request.InstanceId,SiteId=request.SiteId,InstanceFingerprint=request.ExpectedFingerprint,
            ConfigurationSha256=request.ExpectedSha256,Domains=domains,Email=request.Email,Provider=request.Provider,
            DirectoryUrl=Directory(request.Provider,request.DirectoryUrl),RootCertificatePem=request.RootCertificatePem??"",AutoRenew=request.AutoRenew};
        ValidateRoot(registration.Provider,registration.RootCertificatePem);
        return repository.Enqueue("ExternalAcmeIssue",request.RequestId,ExternalResource(repository.OwnerId,registration),actor,
            JsonSerializer.Serialize(new AcmePayload(registration,request.ExpectedSha256),JsonDefaults.Options),
            fingerprintMaterial:JsonSerializer.Serialize(request,JsonDefaults.Options),acmeClaim:new(registration,request.ExpectedAcmeRevision,false));
    }

    public static PanelResource ExternalResource(string owner,PanelAcmeRegistration registration)=>new()
    {
        Id=registration.ResourceId,OwnerId=owner,PluginId="nginx",State="Installed",ConfigRevision=registration.ConfigurationSha256,
        ContainerName="mci-panel-"+PanelCatalog.SafeName(owner)+"-"+PanelCatalog.SafeName(registration.Id),
        VolumeName="mci-panel-"+PanelCatalog.SafeName(owner)+"-"+PanelCatalog.SafeName(registration.Id)
    };

    public static void ValidateChallengePath(string path)
    {
        // 路径只来自root socket已核验的宿主挂载映射；helper只取得新建挑战目录，不取得整个站点根目录。
        if(path is not {Length: >1 and <=4096}||!path.StartsWith('/')||path.Contains('\\')||path.Any(char.IsControl)
            ||path.Split('/').Any(x=>x is "." or "..")||!Regex.IsMatch(path.Split('/')[^1],@"^\.microi-acme-[a-f0-9]{64}$",RegexOptions.CultureInvariant))
            throw new OpsException("宿主未返回隔离的HTTP-01挑战目录，已停止挂载。",502);
    }
    private static void RequireSha256(string value)
    {if(value==null||!Regex.IsMatch(value,@"^[a-fA-F0-9]{64}$",RegexOptions.CultureInvariant))throw new OpsException("外部Nginx状态摘要无效，请刷新网站配置。");}
    public static string CertificateSha256(PanelCertificate certificate)
    {using var leaf=X509Certificate2.CreateFromPem(certificate.CertificatePem);return leaf.GetCertHashString(HashAlgorithmName.SHA256).ToLowerInvariant();}
    public static void ValidateExternalDeployment(JsonObject receipt,PanelAcmeRegistration registration,PanelCertificate certificate)
    {
        try
        {
            if(receipt["verified"]?.GetValue<bool>()!=true||receipt["fingerprint"]?.GetValue<string>()!=registration.InstanceFingerprint
                ||!string.Equals(receipt["certificateSha256"]?.GetValue<string>(),CertificateSha256(certificate),StringComparison.OrdinalIgnoreCase))
                throw new OpsException("外部Nginx未回读到新证书的实际TLS指纹，不能登记为续期成功。",502);
            RequireSha256(receipt["configSha256"]?.GetValue<string>()??"");
        }
        catch(Exception error) when(error is InvalidOperationException or FormatException)
        {throw new OpsException("外部Nginx证书部署回执格式无效。",502);}
    }
    public async Task ExecuteExternal(PanelOperation operation,CancellationToken ct)
    {
        var payload=repository.Payload<AcmePayload>(operation.Id);var registration=payload.Registration;
        if(registration.Target!="External")throw new OpsException("外部证书任务类型不匹配。",409);
        var resource=ExternalResource(repository.OwnerId,registration);
        var state=repository.BackupState<AcmeExecution>("acme-execution:"+operation.Id)??new(){Helper=resource.ContainerName+"-acme-"+operation.Id[..12]};
        void Save()=>repository.SaveBackupState("acme-execution:"+operation.Id,state);
        using var host=new HostNginxService();
        try
        {
            if(state.Stage=="Complete"){await RemoveHelper(state,resource,operation.Id,ct);return;}
            var current=repository.AcmeRegistrations().SingleOrDefault(x=>x.Id==registration.Id);
            if(current==null||current.Revision!=registration.Revision||(operation.Action=="ExternalAcmeRenew"&&!current.AutoRenew))
                throw new OpsException("外部自动证书已暂停或设置已变化，停止旧任务。",409);
            if(state.Stage=="Issuing")
            {
                Progress(operation,"核对外部站点版本并准备隔离HTTP-01入口");
                var prepared=await host.PrepareHttp01(new(registration.InstanceId,registration.SiteId,registration.InstanceFingerprint,
                    registration.ConfigurationSha256,operation.Id,registration.SiteId,registration.Domains),ct);
                if(prepared["prepared"]?.GetValue<bool>()!=true||prepared["validated"]?.GetValue<bool>()!=true||prepared["reloaded"]?.GetValue<bool>()!=true)
                    throw new OpsException("外部HTTP-01入口未通过配置校验与重载回读。",502);
                var domains=prepared["domains"]?.AsArray().Select(x=>NginxConfig.Domain(x?.GetValue<string>()??"")).Distinct().Order().ToArray()??[];
                if(!domains.SequenceEqual(registration.Domains.Order())||prepared["fingerprint"]?.GetValue<string>()!=registration.InstanceFingerprint)
                    throw new OpsException("外部站点域名或实例身份已经变化，停止证书申请。",409);
                state.ChallengeHostPath=prepared["challengeHostPath"]?.GetValue<string>()??"";ValidateChallengePath(state.ChallengeHostPath);
                if(state.ChallengeHostPath.Split('/')[^1]!=".microi-acme-"+prepared["isolationId"]?.GetValue<string>())
                    throw new OpsException("外部挑战目录与隔离标识不一致。",502);
                state.ExternalConfigurationSha256=prepared["configSha256"]?.GetValue<string>()??"";RequireSha256(state.ExternalConfigurationSha256);
                state.HttpPrepared=true;Save();registration.ChallengeHostPath=state.ChallengeHostPath;
                await PrepareExternalStorage(resource,ct);
                if(state.Image.Length==0){state.Image=LegoImage((await docker.Info(ct))?["Architecture"]?.ToString()??"");Save();}
                if(state.ImageId.Length==0){await docker.Pull(state.Image,_=>{},ct);state.ImageId=(await docker.Image(state.Image,ct))!["Id"]!.ToString();Save();}
                await EnsureAccount(state,registration,resource,operation,Save,ct);
                Progress(operation,"使用外部站点HTTP-01路由申请或检查续期");
                await RunClient(state.Helper,Command(registration),state,registration,resource,operation,ct);
                state.Certificate=PanelCertificate.Import(registration.Id,"外部网站自动证书",await ReadText(state.Helper,StatePath(registration)+"/certificates/"+registration.Id+".crt",ct),
                    await ReadText(state.Helper,StatePath(registration)+"/certificates/"+registration.Id+".key",ct));
                state.Certificate.Source=registration.Provider;state.Certificate.AssertDomains(registration.Domains);
                state.Outcome=repository.Certificates().GetValueOrDefault(registration.Id)?.Thumbprint==state.Certificate.Thumbprint?"Unchanged":"Deployed";
                state.Stage="Deploying";Save();
            }
            Progress(operation,"部署外部站点证书并回读实际TLS指纹");
            var certificate=state.Certificate??throw new OpsException("持久证书检查点缺失，停止部署。",409);
            var deployed=await host.DeployCertificate(new(registration.InstanceId,registration.SiteId,registration.InstanceFingerprint,state.ExternalConfigurationSha256,
                operation.Id,certificate.CertificatePem,certificate.PrivateKeyPem,registration.SiteId),ct);
            ValidateExternalDeployment(deployed,registration,certificate);
            repository.SaveCertificate(certificate);
            repository.CompleteAcme(registration.Id,operation.Id,"",state.Outcome,certificate.Thumbprint,deployed["configSha256"]!.GetValue<string>());
            state.Stage="Complete";Save();await RemoveHelper(state,resource,operation.Id,ct);
        }
        catch(OperationCanceledException) when(ct.IsCancellationRequested){throw;}
        catch(Exception error) when(error is not OutOfMemoryException)
        {if(state.Stage!="Complete")repository.CompleteAcme(registration.Id,operation.Id,error is OpsException?Redaction.Clean(error.Message):"外部证书任务失败，请查看操作记录。");throw;}
    }
    private async Task PrepareExternalStorage(PanelResource resource,CancellationToken ct)
    {
        var networkName=PanelDockerConfig.Network(resource.OwnerId);
        var network=await docker.Json(HttpMethod.Get,"/networks/"+networkName,ct:ct,allowMissing:true);
        if(network==null)
        {
            await docker.Json(HttpMethod.Post,"/networks/create",new JsonObject{["Name"]=networkName,["Driver"]="bridge",["Labels"]=new JsonObject{[PanelDockerConfig.OwnerLabel]=resource.OwnerId}},ct);
            network=await docker.Json(HttpMethod.Get,"/networks/"+networkName,ct:ct);
        }
        if(network?["Labels"]?[PanelDockerConfig.OwnerLabel]?.ToString()!=resource.OwnerId)throw new OpsException("ACME网络不属于当前面板。",409);
        var volume=await docker.Json(HttpMethod.Get,"/volumes/"+resource.VolumeName,ct:ct,allowMissing:true)
            ??await docker.Json(HttpMethod.Post,"/volumes/create",new JsonObject{["Name"]=resource.VolumeName,["Labels"]=PanelDockerConfig.Labels(resource)},ct);
        PanelDockerConfig.AssertOwned(volume!,resource);
    }
}
