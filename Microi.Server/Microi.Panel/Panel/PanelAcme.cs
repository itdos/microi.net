using System.Net.Mail;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Microi.Panel.Panel;

public sealed record PanelAcmeRequest(string RequestId,string ResourceId,string SiteId,string Email,string Provider,string DirectoryUrl,string RootCertificatePem,bool AutoRenew,bool AcceptTerms,string ExpectedRevision,string ExpectedAcmeRevision,string Confirm);
public sealed record PanelAcmePolicy(string Revision,bool Enabled,string Confirm);
public sealed class PanelAcmeRegistration
{
    public string Id{get;set;}="";
    public string Revision{get;set;}="";
    public string ResourceId{get;set;}="";
    public string SiteId{get;set;}="";
    public string Email{get;set;}="";
    public string Provider{get;set;}="";
    public string DirectoryUrl{get;set;}="";
    public string RootCertificatePem{get;set;}="";
    public string[] Domains{get;set;}=[];
    public bool AutoRenew{get;set;}
    public DateTimeOffset NextCheck{get;set;}
    public string LastOperationId{get;set;}="";
    public string LastError{get;set;}="";
    public object Public()=>new{Id,Revision,ResourceId,SiteId,Email,Provider,DirectoryUrl,RootCertificatePem,Domains,AutoRenew,NextCheck,LastOperationId,LastError};
}
public sealed record AcmeQueueClaim(PanelAcmeRegistration Registration,string ExpectedRevision,bool Automatic);
public sealed record AcmePayload(PanelAcmeRegistration Registration,string WebsiteRevision);
public sealed class AcmeExecution
{
    public string Helper{get;set;}="";
    public string Image{get;set;}="";
    public string ImageId{get;set;}="";
    public string Stage{get;set;}="Issuing";
    public bool AccountReady{get;set;}
    public NginxChange? Change{get;set;}
}

/// <summary>复用网站 HTTP-01 入口。ACME 客户端运行于隔离 Docker 容器，不监听主机端口或访问 Docker socket。</summary>
public sealed class PanelAcme(PanelRepository repository,DockerEngine docker,NginxService nginx)
{
    // 上游 index 内的 OCI 附件不被当前镜像仓库支持；按平台复制原始运行 manifest，摘要逐项保持不变。
    public static string LegoImage(string architecture)=>"registry.cn-hangzhou.aliyuncs.com/microios/lego@"+(architecture switch
    {
        "amd64" or "x86_64"=>"sha256:036fd46389fce4c31d35e112a489f69968596c181172e3d7d0f1597d04c53adb",
        "arm64" or "aarch64"=>"sha256:e5cbc9bb2ec414dfe4d2dae9f589996e59e0c26bc54ebee6ecdbb08669346d96",
        _=>throw new OpsException("ACME 客户端不支持当前主机架构。",409)
    });
    public const string OperationLabel="io.microi.panel.acme-operation";
    public static string CertificateId(string owner,string resource,string site)=>"acme-"+UpdateCoordinator.Hash(owner+"\n"+resource+"\n"+site)[..24].ToLowerInvariant();
    public static string Directory(string provider,string custom)
    {
        if(provider=="LetsEncrypt")return "https://acme-v02.api.letsencrypt.org/directory";
        if(provider=="LetsEncryptStaging")return "https://acme-staging-v02.api.letsencrypt.org/directory";
        if(provider!="Custom" || custom==null || custom.Length>1024 || custom.Any(char.IsWhiteSpace) || !Uri.TryCreate(custom,UriKind.Absolute,out var uri)
            || uri.Scheme!="https" || uri.UserInfo.Length>0 || uri.Fragment.Length>0 || uri.Query.Length>0)throw new OpsException("自定义 ACME 地址必须为不含账号、查询和片段的 HTTPS Directory URL。");
        return uri.AbsoluteUri;
    }
    public static void ValidateRoot(string provider,string pem)
    {
        if(pem.Length==0)return;
        if(provider!="Custom"||pem.Length>65536)throw new OpsException("只有自定义 CA 可以配置 PEM 根证书，最大 64 KiB。");
        var roots=new X509Certificate2Collection();
        try
        {
            roots.ImportFromPem(pem);
            if(roots.Count==0||roots.Cast<X509Certificate2>().Any(x=>!x.Extensions.OfType<X509BasicConstraintsExtension>().Any(e=>e.CertificateAuthority)))throw new OpsException("自定义信任内容必须是 CA 根证书。");
        }
        catch(CryptographicException){throw new OpsException("无法读取自定义 CA 根证书。");}
        finally{foreach(var root in roots)root.Dispose();}
    }
    public PanelOperation Issue(PanelAcmeRequest request,string actor)
    {
        var resource=nginx.Resource(request.ResourceId);
        if(resource.State!="Installed")throw new OpsException("请先安装并启动 Nginx。",409);
        var site=resource.Websites.Sites.SingleOrDefault(x=>x.Id==request.SiteId&&x.Enabled)??throw new OpsException("请先发布并启用目标网站。",409);
        if(request.Confirm!=site.Id||!request.AcceptTerms)throw new OpsException("请确认网站与证书机构的服务条款。");
        if(!Guid.TryParse(request.RequestId,out var id))throw new OpsException("证书申请需要稳定 UUID 请求标识。");
        if(request.Email==null||request.Email.Length>200||!MailAddress.TryCreate(request.Email,out var email)||email.Address!=request.Email)throw new OpsException("请输入有效的证书联系邮箱。");
        var domains=site.Domains.Select(NginxConfig.Domain).Distinct().ToArray();
        if(domains.Length==0||domains.Any(x=>x.StartsWith("*.",StringComparison.Ordinal)))throw new OpsException("HTTP-01 需要明确的网站域名；通配符证书请通过 DNS 验证取得后导入。");
        var directory=Directory(request.Provider,request.DirectoryUrl);ValidateRoot(request.Provider,request.RootCertificatePem??"");
        var registration=new PanelAcmeRegistration{Id=CertificateId(repository.OwnerId,resource.Id,site.Id),Revision=id.ToString("N"),ResourceId=resource.Id,SiteId=site.Id,Domains=domains,
            Email=request.Email,Provider=request.Provider,DirectoryUrl=directory,RootCertificatePem=request.RootCertificatePem??"",AutoRenew=request.AutoRenew};
        return repository.Enqueue("AcmeIssue",request.RequestId,resource,actor,JsonSerializer.Serialize(new AcmePayload(registration,request.ExpectedRevision),JsonDefaults.Options),
            request.ExpectedRevision,JsonSerializer.Serialize(request,JsonDefaults.Options),acmeClaim:new(registration,request.ExpectedAcmeRevision,false));
    }
    public static string StatePath(PanelAcmeRegistration registration)=>NginxConfig.Root+"/acme-state/"+PanelCatalog.SafeName(registration.Id)+"/"+UpdateCoordinator.Hash(registration.DirectoryUrl)[..16];
    public static string AccountPath(PanelAcmeRegistration registration)=>StatePath(registration)+"/accounts/"+new Uri(registration.DirectoryUrl).Authority.Replace(':','_')+"/"+PanelCatalog.SafeName(registration.Id);
    public static string[] RegisterCommand(PanelAcmeRegistration registration)=>["accounts","register","--path",StatePath(registration),"--account-id",registration.Id,
        "--server",registration.DirectoryUrl,"--email",registration.Email,"--accept-tos","--key-type","EC256","--http-timeout","30","--user-agent","Microi.Panel/2.0.0"];
    public static bool CanRecoverUnregisteredAccount(string error,JsonNode account,PanelAcmeRegistration registration)=>
        error.Contains("urn:ietf:params:acme:error:accountDoesNotExist",StringComparison.Ordinal)&&account["registration"]==null
        &&account["id"]?.ToString()==registration.Id&&account["server"]?.ToString()==registration.DirectoryUrl;
    public static string[] Command(PanelAcmeRegistration registration)
    {
        var args=new List<string>{"run","--path",StatePath(registration),"--account-id",registration.Id,"--cert.name",registration.Id,"--server",registration.DirectoryUrl,"--email",registration.Email,
            "--http","--http.webroot",NginxConfig.Root+"/acme","--accept-tos","--key-type","EC256","--http-timeout","30","--cert.timeout","120","--no-random-sleep","--user-agent","Microi.Panel/2.0.0"};
        foreach(var domain in registration.Domains){args.Add("--domains");args.Add(domain);}return args.ToArray();
    }
    private void Progress(PanelOperation operation,string phase){operation.Phase=phase;repository.SaveOperation(operation);}
    public async Task Execute(PanelResource resource,PanelOperation operation,CancellationToken ct)
    {
        var payload=repository.Payload<AcmePayload>(operation.Id);var registration=payload.Registration;
        var state=repository.BackupState<AcmeExecution>("acme-execution:"+operation.Id)??new(){Helper=resource.ContainerName+"-acme-"+operation.Id[..12]};
        void Save()=>repository.SaveBackupState("acme-execution:"+operation.Id,state);
        try
        {
            if(state.Stage=="Complete"){await RemoveHelper(state,resource,operation.Id,ct);return;}
            var site=resource.Websites.Sites.SingleOrDefault(x=>x.Id==registration.SiteId&&x.Enabled)??throw new OpsException("证书对应的网站已停用或移除。",409);
            if(!site.Domains.Select(NginxConfig.Domain).Order().SequenceEqual(registration.Domains.Order()))throw new OpsException("网站域名已经变化，请重新配置自动证书。",409);
            if(resource.ConfigRevision!=payload.WebsiteRevision && resource.ConfigRevision!=state.Change?.Revision)throw new OpsException("网站版本与证书任务不同，请重新核对。",409);
            _=await PanelDockerRuntime.Owned(docker,resource,ct);
            if(state.Stage=="Issuing")
            {
                Progress(operation,"准备 ACME 客户端并验证 HTTP-01 域名所有权");
                if(state.Image.Length==0){state.Image=LegoImage((await docker.Info(ct))?["Architecture"]?.ToString()??"");Save();}
                if(state.ImageId.Length==0){await docker.Pull(state.Image,_=>{},ct);state.ImageId=(await docker.Image(state.Image,ct))!["Id"]!.ToString();Save();}
                if(!state.AccountReady)
                {
                    Progress(operation,"注册或回读 ACME 账号");
                    var accountHelper=state.Helper+"-account";
                    try{await RunClient(accountHelper,RegisterCommand(registration),state,registration,resource,operation,ct);}
                    catch(OpsException error) when(error.Message.Contains("urn:ietf:params:acme:error:accountDoesNotExist",StringComparison.Ordinal))
                    {
                        var account=JsonNode.Parse(await ReadText(accountHelper,AccountPath(registration)+"/account.json",ct));
                        if(account==null||!CanRecoverUnregisteredAccount(error.Message,account,registration))throw;
                        // v5在首次联网前保存账号文件；只有CA明确证明此密钥尚未注册且本地无注册回执时，
                        // 才归档未完成的本地账号。未知网络结果、有效注册账号和私钥原件都不会被删除。
                        var archived=StatePath(registration)+"/unregistered-"+operation.Id;
                        if(await docker.StatPath(resource.ContainerId,archived,ct)!=null)throw new OpsException("未注册账号已归档但注册仍失败，请核对CA状态后继续原任务。",409);
                        var moved=await docker.Execute(resource.ContainerId,["mv","--",AccountPath(registration),archived],ct);
                        if(moved.ExitCode!=0)throw new OpsException("未完成账号归档失败，原文件保持可回读。",409);
                        await RemoveOneHelper(accountHelper,resource,operation.Id,ct);
                        await RunClient(accountHelper,RegisterCommand(registration),state,registration,resource,operation,ct);
                    }
                    state.AccountReady=true;Save();
                }
                Progress(operation,"验证 HTTP-01 并申请或续期证书");
                await RunClient(state.Helper,Command(registration),state,registration,resource,operation,ct);
                var certificate=PanelCertificate.Import(registration.Id,site.Name+" 自动证书",
                    await ReadText(state.Helper,StatePath(registration)+"/certificates/"+registration.Id+".crt",ct),await ReadText(state.Helper,StatePath(registration)+"/certificates/"+registration.Id+".key",ct));
                certificate.Source=registration.Provider;certificate.AssertDomains(registration.Domains);
                var configuration=JsonSerializer.Deserialize<NginxConfiguration>(JsonSerializer.Serialize(resource.Websites,JsonDefaults.Options),JsonDefaults.Options)!;
                configuration.Sites.Single(x=>x.Id==registration.SiteId).CertificateId=certificate.Id;
                var certificates=repository.Certificates();certificates[certificate.Id]=certificate;
                var used=configuration.Sites.Select(x=>x.CertificateId).Where(x=>x.Length>0).ToHashSet();
                state.Change=new(){Revision="r"+operation.Id,PreviousRevision=resource.ConfigRevision,Configuration=configuration,Certificates=certificates.Where(x=>used.Contains(x.Key)).ToDictionary()};
                state.Stage="Deploying";Save();
            }
            Progress(operation,"校验证书 SAN 和私钥并发布到 Nginx");
            await nginx.Deploy(resource,operation,state.Change!,ct);
            repository.SaveCertificate(state.Change!.Certificates[registration.Id]);
            repository.CompleteAcme(registration.Id,operation.Id,"");state.Stage="Complete";Save();await RemoveHelper(state,resource,operation.Id,ct);
        }
        catch(OperationCanceledException) when(ct.IsCancellationRequested){throw;}
        catch(Exception error) when(error is not OutOfMemoryException)
        {repository.CompleteAcme(registration.Id,operation.Id,error is OpsException?Redaction.Clean(error.Message):"证书操作失败，请查看任务记录。");throw;}
    }
    private async Task RunClient(string name,string[] command,AcmeExecution state,PanelAcmeRegistration registration,PanelResource resource,PanelOperation operation,CancellationToken ct)
    {
        var helper=await docker.Inspect(name,ct);
        if(helper==null)
        {
            var labels=PanelDockerConfig.Labels(resource);labels[OperationLabel]=operation.Id;
            var env=new JsonArray();if(registration.RootCertificatePem.Length>0)env.Add("LEGO_CA_CERTIFICATES="+StatePath(registration)+"/roots.pem");
            await docker.Json(HttpMethod.Post,"/containers/create?name="+name,new JsonObject{["Image"]=state.ImageId,["User"]="0:0",["Cmd"]=JsonSerializer.SerializeToNode(command),["Env"]=env,["Labels"]=labels,
                ["HostConfig"]=new JsonObject{["NetworkMode"]=PanelDockerConfig.Network(resource.OwnerId),["Memory"]=256L*1024*1024,["MemorySwap"]=256L*1024*1024,["PidsLimit"]=64,["NanoCpus"]=1_000_000_000L,["Privileged"]=false,
                    ["CapDrop"]=new JsonArray("ALL"),["SecurityOpt"]=new JsonArray("no-new-privileges:true"),["LogConfig"]=new JsonObject{["Type"]="json-file",["Config"]=new JsonObject{["max-size"]="2m",["max-file"]="2"}},
                    ["Mounts"]=new JsonArray(new JsonObject{["Type"]="volume",["Source"]=resource.VolumeName,["Target"]=NginxConfig.Root})}},ct);
            if(registration.RootCertificatePem.Length>0)await docker.PutFiles(name,NginxConfig.Root,[new(StatePath(registration)[(NginxConfig.Root.Length+1)..]+"/roots.pem",Encoding.UTF8.GetBytes(registration.RootCertificatePem))],ct);
            helper=await docker.Inspect(name,ct);
        }
        AssertHelper(helper!,resource,operation.Id);
        if(helper!["State"]?["Running"]?.GetValue<bool>()!=true&&(helper["State"]?["Status"]?.ToString()=="created"||helper["State"]?["ExitCode"]?.GetValue<int>()!=0))
            await docker.Json(HttpMethod.Post,"/containers/"+name+"/start",ct:ct);
        var deadline=DateTimeOffset.UtcNow.AddMinutes(15);
        while(true)
        {
            helper=await docker.Inspect(name,ct)??throw new OpsException("证书任务容器丢失。",409);AssertHelper(helper,resource,operation.Id);
            if(helper["State"]?["Running"]?.GetValue<bool>()!=true)break;
            if(DateTimeOffset.UtcNow>deadline){await docker.Json(HttpMethod.Post,"/containers/"+name+"/stop?t=10",ct:ct);throw new OpsException("证书申请超时，客户端已停止；请核对DNS与HTTP-01路由后继续原任务。",409);}
            await Task.Delay(2000,ct);
        }
        if(helper["State"]?["ExitCode"]?.GetValue<int>()!=0)throw new OpsException("ACME 申请未完成："+Redaction.Clean(await docker.Logs(name,ct,helper["State"]?["StartedAt"]?.ToString()),2000),502);
    }
    private async Task<string> ReadText(string container,string path,CancellationToken ct)=>new UTF8Encoding(false,true).GetString(
        DockerEngine.SingleArchiveFile(await docker.ReadArchive(container,path,ct,128*1024),path.Split('/')[^1],96*1024));
    private static void AssertHelper(JsonNode helper,PanelResource resource,string operationId)
    {PanelDockerConfig.AssertOwned(helper,resource);if(helper["Config"]?["Labels"]?[OperationLabel]?.ToString()!=operationId)throw new OpsException("证书任务容器归属不匹配。",409);}
    private async Task RemoveHelper(AcmeExecution state,PanelResource resource,string operationId,CancellationToken ct)
    {await RemoveOneHelper(state.Helper,resource,operationId,ct);await RemoveOneHelper(state.Helper+"-account",resource,operationId,ct);}
    private async Task RemoveOneHelper(string name,PanelResource resource,string operationId,CancellationToken ct)
    {var helper=await docker.Inspect(name,ct);if(helper==null)return;AssertHelper(helper,resource,operationId);await docker.Json(HttpMethod.Delete,"/containers/"+name+"?v=false&force=false",ct:ct);}
}

public sealed class PanelAcmeScheduler(PanelRepository repository,OpsAudit audit):BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while(!ct.IsCancellationRequested)
        {
            try
            {
                foreach(var registration in repository.AcmeRegistrations().Where(x=>x.AutoRenew&&x.NextCheck<=DateTimeOffset.UtcNow))
                {
                    if(repository.Operations(true).Any(x=>x.ResourceId==registration.ResourceId))continue;
                    try{var operation=repository.EnqueueAcmeRenewal(registration);audit.Write("AcmeRenewalQueued","scheduler",registration.Id,taskId:operation.Id);}
                    catch(OpsException error){repository.CompleteAcme(registration.Id,registration.LastOperationId,Redaction.Clean(error.Message));}
                }
            }
            catch(OperationCanceledException) when(ct.IsCancellationRequested){break;}
            catch(Exception error){audit.Write("AcmeSchedulerError","system",error.GetType().Name,false);}
            await Task.Delay(TimeSpan.FromMinutes(1),ct);
        }
    }
}
