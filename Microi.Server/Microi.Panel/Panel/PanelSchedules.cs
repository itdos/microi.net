using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace Microi.Panel.Panel;

public sealed record PanelScheduleRequest(string Id,string ResourceId,string Action,bool Enabled,int IntervalHours,DateTimeOffset FirstRun,int MaximumGiB,string ExpectedRevision,string Confirm,bool AllowInterruption);
public sealed class PanelSchedule
{
    public string Id{get;set;}="";
    public string Revision{get;set;}="";
    public string ResourceId{get;set;}="";
    public string Action{get;set;}="Backup";
    public bool Enabled{get;set;}
    public int IntervalHours{get;set;}=24;
    public int MaximumGiB{get;set;}=10;
    public DateTimeOffset NextRun{get;set;}
    public string LastOperationId{get;set;}="";
    public string LastError{get;set;}="";
}
public sealed partial class PanelRepository
{
    public List<PanelSchedule> Schedules()
    {
        using var db=Open();using var command=db.CreateCommand();command.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id LIKE 'schedule:%' ORDER BY id";
        using var rows=command.ExecuteReader();var result=new List<PanelSchedule>();while(rows.Read())result.Add(Decode<PanelSchedule>(protector.Unprotect(rows.GetString(0))));return result;
    }
    public PanelSchedule SaveSchedule(PanelScheduleRequest request)
    {
        PanelCatalog.SafeName(request.Id);var resource=Resource(request.ResourceId);
        if(resource.State is "Pending" or "Removed")throw new OpsException("计划任务需要已经安装的插件实例。",409);
        if(request.Confirm!=request.Id || (request.Enabled && !request.AllowInterruption))throw new OpsException("请确认计划任务及其服务中断影响。");
        if(request.Action is not ("Backup" or "Restart") || request.IntervalHours is <1 or >168 || request.MaximumGiB is <1 or >100)throw new OpsException("计划只支持冷备份或重启，间隔 1–168 小时、备份上限 1–100 GiB。");
        if(request.Enabled && (request.FirstRun<DateTimeOffset.UtcNow.AddMinutes(-1)||request.FirstRun>DateTimeOffset.UtcNow.AddYears(1)))throw new OpsException("首次执行时间应在当前时间至未来一年内。");
        using var db=Open();using var tx=db.BeginTransaction();using var command=db.CreateCommand();command.Transaction=tx;
        command.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id=$id";command.Parameters.AddWithValue("$id","schedule:"+request.Id);
        var previous=command.ExecuteScalar() is string body?Decode<PanelSchedule>(protector.Unprotect(body)):null;
        if((previous?.Revision??"")!=request.ExpectedRevision)throw new OpsException("计划已经由其它页面修改，请刷新后核对。",409);
        var value=new PanelSchedule{Id=request.Id,ResourceId=request.ResourceId,Action=request.Action,Enabled=request.Enabled,IntervalHours=request.IntervalHours,MaximumGiB=request.MaximumGiB,
            Revision=Guid.NewGuid().ToString("N"),NextRun=request.FirstRun,LastOperationId=previous?.LastOperationId??""};
        command.CommandText="INSERT INTO panel_backup_state VALUES($id,$body) ON CONFLICT(id) DO UPDATE SET body_cipher=excluded.body_cipher";
        command.Parameters.AddWithValue("$body",protector.Protect(Encode(value)));command.ExecuteNonQuery();tx.Commit();return value;
    }
    public PanelOperation EnqueueSchedule(PanelSchedule schedule)
    {
        // 槽位确定去重 Id，排队与推进 NextRun 在 Enqueue 的同一事务完成；崩溃不会漏跑或重复排队。
        var digest=SHA256.HashData(Encoding.UTF8.GetBytes(schedule.Id+"\n"+schedule.Revision+"\n"+schedule.NextRun.ToString("O")));
        var requestId=new Guid(digest.AsSpan(0,16)).ToString();var resource=Resource(schedule.ResourceId);
        var payload=schedule.Action=="Backup"?Encode(new PanelBackupRequest(requestId,resource.Id,true,schedule.MaximumGiB)):null;
        if(resource.State is "Pending" or "Removed")throw new OpsException("计划目标当前无法执行。",409);
        return Enqueue(schedule.Action,requestId,resource,"scheduler",payload,scheduleClaim:schedule);
    }
    public bool RecordScheduleError(PanelSchedule schedule,string error)
    {
        using var db=Open();using var tx=db.BeginTransaction();using var command=db.CreateCommand();command.Transaction=tx;
        command.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id=$id";command.Parameters.AddWithValue("$id","schedule:"+schedule.Id);
        if(command.ExecuteScalar() is not string body)return false;var current=Decode<PanelSchedule>(protector.Unprotect(body));
        if(current.Revision!=schedule.Revision||current.NextRun!=schedule.NextRun||current.LastError==error)return false;
        current.LastError=error;command.CommandText="UPDATE panel_backup_state SET body_cipher=$body WHERE id=$id";command.Parameters.AddWithValue("$body",protector.Protect(Encode(current)));command.ExecuteNonQuery();tx.Commit();return true;
    }
}

public sealed class PanelScheduler(PanelRepository repository,OpsAudit audit):BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while(!stoppingToken.IsCancellationRequested)
        {
            try
            {
                foreach(var schedule in repository.Schedules().Where(x=>x.Enabled&&x.NextRun<=DateTimeOffset.UtcNow))
                {
                    if(repository.Operations(true).Any(x=>x.ResourceId==schedule.ResourceId))continue;
                    try{var operation=repository.EnqueueSchedule(schedule);audit.Write("ScheduledPanelOperation","scheduler",schedule.Id+"：任务已持久化",taskId:operation.Id);}
                    catch(OpsException error){var message=Redaction.Clean(error.Message);if(repository.RecordScheduleError(schedule,message))audit.Write("ScheduledPanelOperationRejected","scheduler",schedule.Id+"："+message,false);}
                }
            }
            catch(OperationCanceledException)when(stoppingToken.IsCancellationRequested){break;}
            catch(Exception error){audit.Write("PanelSchedulerError","system","计划扫描失败："+error.GetType().Name,false);}
            await Task.Delay(TimeSpan.FromSeconds(10),stoppingToken);
        }
    }
}
