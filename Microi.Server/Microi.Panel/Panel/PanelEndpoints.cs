namespace Microi.Panel.Panel;

public static class PanelEndpoints
{
    public static void MapPanel(this RouteGroupBuilder authenticatedOps)
    {
        // 复用独立面板登录、CSRF、no-store 与来源校验，业务平台 DiyToken 不授予主机权限。
        var api = authenticatedOps.MapGroup("/panel");
        api.MapGet("/catalog", () => Results.Ok(PanelCatalog.All));
        api.MapGet("/acme",(PanelRepository repository)=>Results.Ok(repository.AcmeRegistrations().Select(x=>x.Public())));
        api.MapPost("/acme",(PanelAcmeRequest request,PanelAcme acme,HttpContext ctx)=>Results.Accepted(value:acme.Issue(request,ctx.User.Identity!.Name!)));
        api.MapPost("/acme/{id}/policy",(string id,PanelAcmePolicy request,PanelRepository repository,HttpContext ctx,OpsAudit audit)=>
        {var result=repository.SaveAcmePolicy(id,request);audit.Write("AcmePolicySaved",ctx.User.Identity!.Name!,id+"："+(request.Enabled?"自动续期":"已暂停"));return Results.Ok(result);});
        api.MapGet("/schedules",(PanelRepository repository)=>Results.Ok(repository.Schedules().Select(x=>new {schedule=x,operation=x.LastOperationId.Length==0?null:repository.Operation(x.LastOperationId)})));
        api.MapPost("/schedules",(PanelScheduleRequest request,PanelRepository repository,HttpContext ctx,OpsAudit audit)=>
        {
            var result=repository.SaveSchedule(request);audit.Write("PanelScheduleSaved",ctx.User.Identity!.Name!,result.Id+"："+(result.Enabled?"已启用":"已暂停"));return Results.Ok(result);
        });
        api.MapGet("/backups", (PanelRepository repo) => Results.Ok(repo.Backups().Select(x => x.Public())));
        api.MapPost("/backups/{id}/delete", (string id,PanelDeleteBackupRequest request,PanelBackups backups,HttpContext ctx)=>Results.Accepted(value:backups.Delete(id,request,ctx.User.Identity!.Name!)));
        api.MapPost("/resources/{id}/backups", (string id, PanelBackupRequest request, PanelBackups backups, HttpContext ctx) => Results.Accepted(value:backups.Create(id,request,ctx.User.Identity!.Name!)));
        api.MapPost("/resources/{id}/restore", (string id, PanelRestoreRequest request, PanelBackups backups, HttpContext ctx) => Results.Accepted(value:backups.Restore(id,request,ctx.User.Identity!.Name!)));
        api.MapGet("/backups/{id}/download", async (string id, PanelBackups backups, CancellationToken ct) =>
        {
            var backup=backups.Get(id);await backups.Verify(backup,ct);
            return Results.File(backups.FilePath(id),"application/x-tar",backup.Resource.Id+"-"+backup.Created.ToString("yyyyMMdd-HHmmss")+".tar",enableRangeProcessing:true);
        });
        api.MapGet("/certificates", (PanelRepository repo) => Results.Ok(repo.Certificates().Values.Select(x => x.Public())));
        api.MapPost("/certificates", (CertificateImport request, PanelRepository repo, HttpContext ctx, OpsAudit audit) =>
        {
            if (request.Confirm != request.Id) throw new OpsException("请确认本次导入的证书标识。");
            if(request.Id.StartsWith("acme-",StringComparison.Ordinal))throw new OpsException("acme- 前缀由自动证书管理，请为手动导入使用其它标识。");
            var certificate = PanelCertificate.Import(request.Id, request.Name, request.CertificatePem, request.PrivateKeyPem);
            repo.SaveCertificate(certificate); audit.Write("CertificateImported", ctx.User.Identity!.Name!, "证书：" + certificate.Id);
            return Results.Ok(certificate.Public());
        });
        api.MapGet("/nginx/{id}", (string id, NginxService nginx) => Results.Ok(nginx.Snapshot(id)));
        api.MapPost("/nginx/{id}/preview", (string id, NginxConfiguration config, NginxService nginx) => Results.Ok(nginx.Preview(id, config)));
        api.MapPost("/nginx/{id}/publish", (string id, NginxPublishRequest request, NginxService nginx, HttpContext ctx) =>
            Results.Accepted(value: nginx.Publish(id, request, ctx.User.Identity!.Name!)));
        api.MapGet("/nginx/{id}/sites/{site}/files", async (string id, string site, string? path, PanelFiles files, CancellationToken ct) => Results.Ok(await files.List(id, site, path ?? "", ct)));
        api.MapGet("/nginx/{id}/sites/{site}/history", async (string id, string site, PanelFiles files, CancellationToken ct) => Results.Ok(await files.History(id, site, ct)));
        api.MapGet("/nginx/{id}/sites/{site}/file", async (string id, string site, string path, PanelFiles files, CancellationToken ct) =>
        {
            var bytes = await files.Read(id, site, path, ct); string? text = null;
            if (bytes.Length <= 512 * 1024 && !bytes.Contains((byte)0)) { try { text = new System.Text.UTF8Encoding(false,true).GetString(bytes); } catch (System.Text.DecoderFallbackException) { } }
            return Results.Ok(new { path, size = bytes.Length, hash = PanelFiles.Hash(bytes), text, editable = text != null });
        });
        api.MapGet("/nginx/{id}/sites/{site}/download", async (string id, string site, string path, PanelFiles files, CancellationToken ct) =>
            Results.File(await files.Read(id, site, path, ct), "application/octet-stream", path.Split('/').Last()));
        api.MapPost("/nginx/{id}/files", async (string id, PanelFiles files, HttpContext ctx) =>
        {
            // 仅认证后的专用上传入口允许 28 MiB JSON；其它管理接口继续保留默认小请求上限。
            var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly:false }) limit.MaxRequestBodySize = 28L * 1024 * 1024;
            var request = await ctx.Request.ReadFromJsonAsync<PanelFileRequest>(ctx.RequestAborted) ?? throw new OpsException("文件请求不能为空。");
            return Results.Accepted(value: files.Enqueue(id, request, ctx.User.Identity!.Name!));
        });
        api.MapGet("/snapshot", async (PanelService panel, CancellationToken ct) => Results.Ok(await panel.Snapshot(ct)));
        api.MapPost("/install", async (PluginInstallRequest request, HttpContext ctx, PanelService panel, CancellationToken ct) =>
            Results.Accepted(value: await panel.Install(request, ctx.User.Identity!.Name!, ct)));
        api.MapPost("/resources/{id}/actions", (string id, PanelAction request, HttpContext ctx, PanelService panel) =>
            Results.Accepted(value: panel.Operate(id, request, ctx.User.Identity!.Name!)));
        api.MapGet("/resources/{id}/logs", async (string id, PanelService panel, CancellationToken ct) => Results.Ok(new { content = await panel.Logs(id, ct) }));
        api.MapGet("/operations/{id}", (string id, PanelRepository repo) => Results.Ok(repo.Operation(id)));
        api.MapPost("/operations/{id}/retry", (string id, PanelRetry request, PanelRepository repo) =>
        {
            if (request.Confirm != id) throw new OpsException("请确认需要继续的操作编号。");
            return Results.Accepted(value: repo.Retry(id));
        });
    }
}
public sealed record PanelRetry(string Confirm);
public sealed record CertificateImport(string Id, string Name, string CertificatePem, string PrivateKeyPem, string Confirm);
