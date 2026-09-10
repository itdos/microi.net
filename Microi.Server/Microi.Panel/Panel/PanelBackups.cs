using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Microi.Panel.Panel;

public sealed record PanelBackupRequest(string RequestId, string Confirm, bool AllowInterruption, int MaximumGiB = 10);
public sealed record PanelRestoreRequest(string RequestId, string BackupId, string Confirm, bool AllowInterruption);
public sealed record PanelDeleteBackupRequest(string RequestId, string Confirm);

/// <summary>冷备份和新卷恢复。所有检查点先落盘；恢复失败重新启用原容器，任何分支都不删除业务数据卷。</summary>
public sealed class PanelBackups(PanelRepository repository, DockerEngine docker, OpsOptions options)
{
    private const string RestoreLabel = "io.microi.panel.restore";
    private string DirectoryPath => Path.Combine(options.DataDir, "backups");
    private static string ValidId(string id) => Guid.TryParseExact(id, "N", out _) ? id : throw new OpsException("备份编号无效。");
    public string FilePath(string id) => Path.Combine(DirectoryPath, ValidId(id) + ".tar");
    private static PanelResource Clone(PanelResource resource) => JsonSerializer.Deserialize<PanelResource>(JsonSerializer.Serialize(resource, JsonDefaults.Options),JsonDefaults.Options)!;
    private static bool Running(JsonNode container) => container["State"]?["Running"]?.GetValue<bool>() == true;
    private void Progress(PanelOperation operation, string phase) { operation.Phase = phase; repository.SaveOperation(operation); }
    public PanelBackup Get(string id) => repository.BackupState<PanelBackup>("backup:" + ValidId(id)) ?? throw new OpsException("备份不存在。",404);
    public PanelOperation Create(string resourceId, PanelBackupRequest request, string actor)
    {
        var resource = repository.Resource(resourceId);
        if (resource.State is "Pending" or "Removed" || resource.ContainerId.Length == 0) throw new OpsException("请先完成插件安装，再创建备份。",409);
        if (request.Confirm != resourceId || !request.AllowInterruption) throw new OpsException("请确认冷备份会暂时停止此服务。");
        if (request.MaximumGiB is < 1 or > 100) throw new OpsException("本次备份容量上限须在 1–100 GiB 之间。");
        return repository.Enqueue("Backup",request.RequestId,resource,actor,JsonSerializer.Serialize(request,JsonDefaults.Options));
    }
    public PanelOperation Restore(string resourceId, PanelRestoreRequest request, string actor)
    {
        var resource = repository.Resource(resourceId); var backup = Get(request.BackupId);
        if (request.Confirm != resourceId || !request.AllowInterruption) throw new OpsException("请确认恢复会中断此服务并切换到备份内容。");
        if (backup.State != "Ready" || backup.Resource.Id != resourceId || backup.Resource.PluginId != resource.PluginId || backup.Resource.OwnerId != resource.OwnerId) throw new OpsException("备份未完成或不属于此插件实例。",409);
        if (resource.State is "Pending" or "Removed") throw new OpsException("请先完成插件安装，再恢复备份。",409);
        return repository.Enqueue("RestoreBackup",request.RequestId,resource,actor,JsonSerializer.Serialize(request,JsonDefaults.Options));
    }
    public async Task Verify(PanelBackup backup, CancellationToken ct)
    {
        var path = FilePath(backup.Id);
        if (backup.State != "Ready" || !File.Exists(path) || new FileInfo(path).Length != backup.Size) throw new OpsException("备份文件缺失或长度已变化。",409);
        await using var file = File.OpenRead(path);
        if (Convert.ToHexStringLower(await SHA256.HashDataAsync(file,ct)) != backup.Sha256) throw new OpsException("备份文件哈希不匹配，已停止恢复。",409);
        file.Position = 0;
        if (await PanelArchive.ContentHash(file,ct) != backup.ContentHash) throw new OpsException("备份内容校验失败。",409);
    }
    public PanelOperation Delete(string id,PanelDeleteBackupRequest request,string actor)
    {
        var backup=Get(id);if(request.Confirm!=id)throw new OpsException("请确认需要永久删除的备份编号。");
        return repository.Enqueue("DeleteBackup",request.RequestId,repository.Resource(backup.Resource.Id),actor,JsonSerializer.Serialize(request,JsonDefaults.Options));
    }
    public Task ExecuteDelete(PanelOperation operation)
    {
        var request=repository.Payload<PanelDeleteBackupRequest>(operation.Id);var backup=Get(request.Confirm);
        if(backup.Resource.Id!=operation.ResourceId)throw new OpsException("备份不属于任务登记的资源。",409);
        var path=FilePath(backup.Id);if(File.Exists(path))File.Delete(path); // 仅删除由有效备份 Id 解析的单个归档，不递归清理目录。
        var partial=path+".partial";if(File.Exists(partial))File.Delete(partial);
        backup.State="Deleted";repository.SaveBackupState("backup:"+backup.Id,backup);return Task.CompletedTask;
    }
    public async Task ExecuteBackup(PanelResource resource, PanelOperation operation, CancellationToken ct)
    {
        var request = repository.Payload<PanelBackupRequest>(operation.Id); var maximum = request.MaximumGiB * 1024L * 1024 * 1024;
        Directory.CreateDirectory(DirectoryPath);
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(DirectoryPath,UnixFileMode.UserRead|UnixFileMode.UserWrite|UnixFileMode.UserExecute);
        var backup = repository.BackupState<PanelBackup>("backup:" + operation.Id);
        if (backup == null)
        {
            var actual = await PanelDockerRuntime.Owned(docker,resource,ct);
            backup = new() { Id = operation.Id, Resource = Clone(resource), WasRunning = Running(actual) };
            repository.SaveBackupState("backup:" + operation.Id,backup);
        }
        var saved = backup;
        try
        {
            if (backup.State != "Ready")
            {
                var final = FilePath(operation.Id); var partial = final + ".partial";
                // 原子发布后崩溃的任务只需校验已有归档；重新写入时可回收本任务旧 partial 的空间。
                if (!File.Exists(final)) CheckDiskSpace(Math.Max(0, maximum - (File.Exists(partial) ? new FileInfo(partial).Length : 0)) + 512L * 1024 * 1024);
                Progress(operation,"暂时停止目标服务，生成一致冷备份");
                var container = await PanelDockerRuntime.Owned(docker,resource,ct);
                if (Running(container)) await PanelDockerRuntime.Stop(docker,resource,ct);
                container = await PanelDockerRuntime.Owned(docker,resource,ct);
                if (Running(container) || container["State"]?["OOMKilled"]?.GetValue<bool>() == true || (backup.WasRunning && container["State"]?["ExitCode"]?.GetValue<int>() == 137)) throw new OpsException("服务未正常停止，不能把强制终止后的文件宣告为一致冷备份。");
                if (!File.Exists(final))
                {
                    await using (var file = new FileStream(partial,FileMode.Create,FileAccess.ReadWrite,FileShare.None,128*1024,FileOptions.Asynchronous))
                    {
                        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(partial,UnixFileMode.UserRead|UnixFileMode.UserWrite);
                        await docker.WithArchive(resource.ContainerId,PanelCatalog.Get(resource.PluginId).DataPath + "/.",async(stream,token)=>backup.ExcludedRuntimeEntries=await PanelArchive.CopyForBackup(stream,file,resource.PluginId,token),maximum,ct);
                        repository.SaveBackupState("backup:"+operation.Id,backup);
                        file.Flush(flushToDisk:true); file.Position = 0; backup.ContentHash = await PanelArchive.ContentHash(file,ct);
                        file.Position = 0; backup.Sha256 = Convert.ToHexStringLower(await SHA256.HashDataAsync(file,ct)); backup.Size = file.Length;
                    }
                    File.Move(partial,final); // 同目录原子发布；原数据卷从未写入备份文件。
                }
                else
                {
                    await using var file = File.OpenRead(final); backup.ContentHash = await PanelArchive.ContentHash(file,ct); file.Position=0;
                    backup.Sha256=Convert.ToHexStringLower(await SHA256.HashDataAsync(file,ct)); backup.Size=file.Length;
                }
                backup.State="Ready";repository.SaveBackupState("backup:"+operation.Id,backup);
            }
            await Verify(backup,ct); Progress(operation,"备份已校验，恢复原运行状态");
        }
        finally
        {
            // 普通错误和关闭取消仍尽力恢复原服务；硬终止则由持久 WasRunning 检查点在下一次启动补偿。
            if (saved.WasRunning)
            {
                using var recovery = new CancellationTokenSource(TimeSpan.FromMinutes(2));
                var original = await PanelDockerRuntime.Owned(docker,saved.Resource,recovery.Token);
                if (!Running(original)) await docker.Json(HttpMethod.Post,"/containers/"+saved.Resource.ContainerId+"/start",ct:recovery.Token);
            }
        }
        if (backup.WasRunning) await PanelDockerRuntime.Ready(docker,resource,ct);
    }
    private void CheckDiskSpace(long required)
    {
        var path=Path.GetFullPath(options.DataDir);
        var drive=DriveInfo.GetDrives().Where(x=>path==x.Name.TrimEnd(Path.DirectorySeparatorChar)||path.StartsWith(x.Name.TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar,StringComparison.Ordinal)).OrderByDescending(x=>x.Name.Length).FirstOrDefault();
        if (drive is not {IsReady:true} || drive.AvailableFreeSpace < required) throw new OpsException("备份所在磁盘的可用空间不足以覆盖本次容量上限和 512 MiB 余量；请降低上限或扩容。",409);
    }
    public async Task ExecuteRestore(PanelResource resource, PanelOperation operation, CancellationToken ct)
    {
        var request=repository.Payload<PanelRestoreRequest>(operation.Id); var backup=Get(request.BackupId);
        var state=repository.BackupState<PanelRestoreState>("restore:"+operation.Id);
        if (state?.Stage=="Complete") { await RemoveHelper(state,ct);return; }
        if (state?.Stage=="RollingBack") { await Rollback(state,ct);throw new OpsException("已完成中断后的原服务恢复；请核对现场后继续原任务。",409); }
        Progress(operation,"校验原始备份内容与目标实例");
        try { await Verify(backup,ct); }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException)
        {
            // 已进入切换阶段的中断任务，即使归档随后损坏，也必须先恢复原服务。
            if (state?.Stage == "Activating") { state.Stage="RollingBack";Save(state);await Rollback(state,ct); }
            throw;
        }
        if (state==null || state.Stage=="RolledBack")
        {
            var attempt=(state?.Attempt??0)+1;var actual=await PanelDockerRuntime.Owned(docker,resource,ct);var target=Clone(backup.Resource);
            target.VolumeName=resource.VolumeName+"-r"+operation.Id[..10]+"-"+attempt; target.ContainerName=resource.ContainerName;target.ContainerId="";
            target.BindAddress=resource.BindAddress;target.Ports=new(resource.Ports);target.Created=resource.Created;
            state=new(){Id=operation.Id,BackupId=backup.Id,Original=Clone(resource),Target=target,WasRunning=Running(actual),Attempt=attempt,
                Helper=resource.ContainerName+"-restore-"+operation.Id[..10]+"-"+attempt,PreservedName=resource.ContainerName+"-before-"+operation.Id[..10]+"-"+attempt};
            Save(state);
        }
        try
        {
            if (state.Stage=="Preparing")
            {
                Progress(operation,"在全新数据卷恢复并逐项验证内容");CheckDiskSpace(backup.Size+512L*1024*1024);
                if(await docker.Image(state.Target.ImageId,ct)==null) throw new OpsException("备份对应的原版本镜像不存在，请先导入该镜像后继续。",409);
                var volume=await docker.Json(HttpMethod.Get,"/volumes/"+state.Target.VolumeName,ct:ct,allowMissing:true);
                if(volume==null) volume=await docker.Json(HttpMethod.Post,"/volumes/create",new JsonObject{["Name"]=state.Target.VolumeName,["Labels"]=PanelDockerConfig.Labels(state.Target)},ct);
                PanelDockerConfig.AssertOwned(volume!,state.Target);
                (int Uid,int Gid,string Mode) root;
                await using(var source=File.OpenRead(FilePath(backup.Id)))root=PanelArchive.RootMetadata(source);
                // Docker 解包会保留子项权限，但略过目标目录自身的所有者。固定帮助进程只修正受管卷根目录，仍逐项校验完整权限。
                string[] rootCommand=["/bin/sh","-c","chown \"$1:$2\" \"$4\" && chmod \"$3\" \"$4\"","panel-volume-root",root.Uid.ToString(),root.Gid.ToString(),root.Mode,PanelCatalog.Get(resource.PluginId).DataPath];
                var helper=await docker.Inspect(state.Helper,ct);
                if(helper!=null && helper["Config"]?["Entrypoint"]?.ToJsonString()!=JsonSerializer.SerializeToNode(rootCommand)!.ToJsonString())
                {
                    AssertRestoreContainer(helper,state);if(Running(helper))throw new OpsException("旧帮助容器仍在运行，请等待其结束再继续。",409);
                    await docker.Json(HttpMethod.Delete,"/containers/"+helper["Id"]+"?v=false&force=false",ct:ct);helper=null;
                }
                if(helper==null)
                {
                    var labels=PanelDockerConfig.Labels(state.Target);labels[RestoreLabel]=state.Id;
                    var config=new JsonObject{["Image"]=state.Target.ImageId,["User"]="0:0",["Entrypoint"]=JsonSerializer.SerializeToNode(rootCommand),["Cmd"]=new JsonArray(),["Labels"]=labels,["Healthcheck"]=new JsonObject{["Test"]=new JsonArray("NONE")},
                        ["HostConfig"]=new JsonObject{["NetworkMode"]="none",["Memory"]=64L*1024*1024,["PidsLimit"]=32,["Privileged"]=false,
                            ["Mounts"]=new JsonArray(new JsonObject{["Type"]="volume",["Source"]=state.Target.VolumeName,["Target"]=PanelCatalog.Get(resource.PluginId).DataPath,["VolumeOptions"]=new JsonObject{["NoCopy"]=true}})}};
                    await docker.Json(HttpMethod.Post,"/containers/create?name="+state.Helper,config,ct);helper=await docker.Inspect(state.Helper,ct);
                }
                AssertRestoreContainer(helper!,state);
                await using(var source=File.OpenRead(FilePath(backup.Id))) await docker.PutArchive(state.Helper,PanelCatalog.Get(resource.PluginId).DataPath,source,ct);
                await docker.Json(HttpMethod.Post,"/containers/"+state.Helper+"/start",ct:ct);
                var metadataDeadline=DateTimeOffset.UtcNow.AddSeconds(30);
                do{helper=await docker.Inspect(state.Helper,ct);if(helper!=null&&!Running(helper))break;await Task.Delay(200,ct);}while(DateTimeOffset.UtcNow<metadataDeadline);
                if(helper==null||Running(helper)||helper["State"]?["ExitCode"]?.GetValue<int>()!=0)throw new OpsException("数据卷根目录权限未恢复，原服务保持不变。",409);
                string content="";await docker.WithArchive(state.Helper,PanelCatalog.Get(resource.PluginId).DataPath+"/.",async(stream,token)=>content=await PanelArchive.ContentHash(stream,token),backup.Size+16L*1024*1024,ct);
                if(content!=backup.ContentHash) throw new OpsException("新数据卷内容校验不匹配，原服务保持不变。",409);
                state.Stage="DataReady";Save(state);
            }
            Progress(operation,"保留原容器并切换到已校验的新数据卷");state.Stage="Activating";Save(state);
            var original=await docker.Inspect(state.Original.ContainerId,ct)??throw new OpsException("原容器丢失，已停止恢复。",409);PanelDockerConfig.AssertOwned(original,state.Original);
            if(Running(original)) await PanelDockerRuntime.Stop(docker,state.Original,ct);
            if(original["Name"]?.ToString().TrimStart('/')!=state.PreservedName) await docker.Json(HttpMethod.Post,"/containers/"+state.Original.ContainerId+"/rename?name="+state.PreservedName,ct:ct);
            var current=await docker.Inspect(state.Target.ContainerName,ct);
            if(current==null)
            {
                var config=PanelDockerConfig.Create(state.Target,state.Target.ImageId);config["Labels"]![RestoreLabel]=state.Id;
                var created=await docker.Json(HttpMethod.Post,"/containers/create?name="+state.Target.ContainerName,config,ct);state.Target.ContainerId=created!["Id"]!.ToString();Save(state);
                current=await docker.Inspect(state.Target.ContainerName,ct);
            }
            AssertRestoreContainer(current!,state);state.Target.ContainerId=current!["Id"]!.ToString();Save(state);
            if(state.WasRunning)
            {
                if(!Running(current)) await docker.Json(HttpMethod.Post,"/containers/"+state.Target.ContainerId+"/start",ct:ct);
                Progress(operation,"等待恢复后的服务健康检查");await PanelDockerRuntime.Ready(docker,state.Target,ct);
            }
            state.Target.State=state.WasRunning?"Installed":"Stopped";repository.SaveResource(state.Target);state.Stage="Complete";Save(state);await RemoveHelper(state,ct);
        }
        catch(OperationCanceledException) when(ct.IsCancellationRequested){throw;}
        catch(Exception error) when(error is not OutOfMemoryException)
        {
            if(state.Stage is "Activating" or "RollingBack") { state.Stage="RollingBack";Save(state);await Rollback(state,ct); }
            throw;
        }
    }
    private static void AssertRestoreContainer(JsonNode container,PanelRestoreState state)
    {
        PanelDockerConfig.AssertOwned(container,state.Target);
        if(container["Config"]?["Labels"]?[RestoreLabel]?.ToString()!=state.Id) throw new OpsException("恢复容器归属与当前任务不匹配。",409);
    }
    private void Save(PanelRestoreState state)=>repository.SaveBackupState("restore:"+state.Id,state);
    private async Task RemoveHelper(PanelRestoreState state,CancellationToken ct)
    {
        var helper=await docker.Inspect(state.Helper,ct);if(helper==null)return;AssertRestoreContainer(helper,state);
        await docker.Json(HttpMethod.Delete,"/containers/"+helper["Id"]+"?v=false&force=false",ct:ct);
    }
    private async Task Rollback(PanelRestoreState state,CancellationToken ct)
    {
        var current=await docker.Inspect(state.Target.ContainerName,ct);
        if(current!=null && current["Id"]?.ToString()!=state.Original.ContainerId)
        {
            AssertRestoreContainer(current,state);
            if(Running(current)) { state.Target.ContainerId=current["Id"]!.ToString();await PanelDockerRuntime.Stop(docker,state.Target,ct); }
            await docker.Json(HttpMethod.Delete,"/containers/"+current["Id"]+"?v=false&force=false",ct:ct);
        }
        var original=await docker.Inspect(state.Original.ContainerId,ct)??throw new OpsException("原容器已丢失，恢复需人工处理；全部数据卷仍保留。",409);PanelDockerConfig.AssertOwned(original,state.Original);
        if(original["Name"]?.ToString().TrimStart('/')!=state.Original.ContainerName) await docker.Json(HttpMethod.Post,"/containers/"+state.Original.ContainerId+"/rename?name="+state.Original.ContainerName,ct:ct);
        if(state.WasRunning && !Running(original)) await docker.Json(HttpMethod.Post,"/containers/"+state.Original.ContainerId+"/start",ct:ct);
        if(state.WasRunning) await PanelDockerRuntime.Ready(docker,state.Original,ct);
        repository.SaveResource(state.Original);state.Stage="RolledBack";Save(state);await RemoveHelper(state,ct);
    }
}
