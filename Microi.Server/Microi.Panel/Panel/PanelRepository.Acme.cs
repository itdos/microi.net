using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.Sqlite;

namespace Microi.Panel.Panel;

public sealed partial class PanelRepository
{
    public List<PanelAcmeRegistration> AcmeRegistrations()
    {
        using var db=Open();using var command=db.CreateCommand();command.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id LIKE 'acme:%' ORDER BY id";
        using var rows=command.ExecuteReader();var result=new List<PanelAcmeRegistration>();while(rows.Read())result.Add(Decode<PanelAcmeRegistration>(protector.Unprotect(rows.GetString(0))));return result;
    }
    public PanelOperation EnqueueAcmeRenewal(PanelAcmeRegistration registration)
    {
        var resource=registration.Target=="External"?PanelAcme.ExternalResource(OwnerId,registration):Resource(registration.ResourceId);
        if(resource.State!="Installed")throw new OpsException("自动证书需要运行中的 Nginx 实例。",409);
        // 暂时失败后继续原签发/部署检查点，避免已签发待重载的证书被新的CA订单替代。
        var retry=RetryAcmeRenewal(registration,resource);if(retry!=null)return retry;
        var digest=SHA256.HashData(Encoding.UTF8.GetBytes(registration.Id+"\n"+registration.Revision+"\n"+registration.NextCheck.ToString("O")));
        return Enqueue(registration.Target=="External"?"ExternalAcmeRenew":"AcmeRenew",new Guid(digest.AsSpan(0,16)).ToString(),resource,"scheduler",Encode(new AcmePayload(registration,resource.ConfigRevision)),
            registration.Target=="External"?null:resource.ConfigRevision,acmeClaim:new(registration,registration.Revision,true));
    }
    private PanelOperation? RetryAcmeRenewal(PanelAcmeRegistration registration,PanelResource resource)
    {
        if(registration.LastOperationId.Length==0)return null;
        lock(enqueueGate)
        {
            using var db=Open();using var tx=db.BeginTransaction();using var command=db.CreateCommand();command.Transaction=tx;
            command.CommandText="SELECT body FROM panel_operations WHERE id=$operation";command.Parameters.AddWithValue("$operation",registration.LastOperationId);
            if(command.ExecuteScalar() is not string operationBody)return null;
            var operation=Decode<PanelOperation>(operationBody);
            if(operation.State is not ("Failed" or "Queued" or "Running")||operation.Action is not ("AcmeIssue" or "AcmeRenew" or "ExternalAcmeIssue" or "ExternalAcmeRenew"))return null;
            command.CommandText="SELECT body_cipher FROM panel_payloads WHERE operation_id=$operation";
            if(command.ExecuteScalar() is not string payloadBody)return null;
            var payload=Decode<AcmePayload>(protector.Unprotect(payloadBody));
            if(payload.Registration.Revision!=registration.Revision)return null;
            command.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id=$id";command.Parameters.AddWithValue("$id","acme:"+registration.Id);
            var current=command.ExecuteScalar() is string body?Decode<PanelAcmeRegistration>(protector.Unprotect(body)):null;
            if(current==null||!current.AutoRenew||current.Revision!=registration.Revision||current.LastOperationId!=operation.Id)
                throw new OpsException("自动证书设置已变化、尚未到期或已暂停。",409);
            // 同一失败轮次被并发投递时，后到的调用回读已排队原任务，不新建第二份续期。
            if(operation.State is "Queued" or "Running")return operation;
            if(current.NextCheck!=registration.NextCheck||current.NextCheck>DateTimeOffset.UtcNow)
                throw new OpsException("自动证书尚未到下一次重试时间。",409);
            // 网站已被其它操作修改时，不能自动重放旧发布快照覆盖新配置。
            var execution=BackupState<AcmeExecution>("acme-execution:"+operation.Id);
            if(registration.Target!="External"&&resource.ConfigRevision!=payload.WebsiteRevision&&resource.ConfigRevision!=execution?.Change?.Revision)
                throw new OpsException("失败证书任务的网站版本已变化，请核对并重新申请。",409);
            operation.State="Queued";operation.Error="";operation.Phase="等待继续证书检查点";operation.Updated=DateTimeOffset.UtcNow;
            current.NextCheck=NextAcmeCheck(current.Id);current.Attempt++;
            command.CommandText="UPDATE panel_operations SET state='Queued',body=$operationBody WHERE id=$operation";command.Parameters.AddWithValue("$operationBody",Encode(operation));
            try{command.ExecuteNonQuery();}
            catch(SqliteException error) when(error.SqliteErrorCode==19){throw new OpsException("该实例已有活动任务。",409);}
            command.CommandText="UPDATE panel_backup_state SET body_cipher=$body WHERE id=$id";command.Parameters.AddWithValue("$body",protector.Protect(Encode(current)));command.ExecuteNonQuery();
            tx.Commit();return operation;
        }
    }
    public static DateTimeOffset NextAcmeCheck(string id,PanelCertificate? certificate=null,int failures=0,DateTimeOffset? observedAt=null)
    {
        var now=observedAt??DateTimeOffset.UtcNow;
        var seconds=certificate==null?12*3600:Math.Clamp((certificate.NotAfter-certificate.NotBefore).TotalSeconds/4,30,12*3600);
        if(failures>0)seconds=Math.Min(seconds,Math.Min(6*3600,300*Math.Pow(2,Math.Min(failures-1,7))));
        // 至少每天检查两次ARI；失败采用持久退避，临近过期时缩短间隔保留恢复时间。
        if(certificate!=null)seconds=Math.Min(seconds,Math.Max(30,(certificate.NotAfter-now).TotalSeconds/4));
        var fraction=Convert.ToInt32(UpdateCoordinator.Hash(id)[..2],16)/255d;
        return now.AddSeconds(Math.Min(12*3600,seconds+fraction*Math.Min(seconds/10,1800)));
    }
    public object SaveAcmePolicy(string id,PanelAcmePolicy request)
    {
        if(request.Confirm!=id)throw new OpsException("请确认自动续期证书。");
        using var db=Open();using var tx=db.BeginTransaction();using var command=db.CreateCommand();command.Transaction=tx;
        command.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id=$id";command.Parameters.AddWithValue("$id","acme:"+id);
        var current=command.ExecuteScalar() is string body?Decode<PanelAcmeRegistration>(protector.Unprotect(body)):throw new OpsException("自动证书不存在。",404);
        if(current.Revision!=request.Revision)throw new OpsException("自动证书设置已变化，请刷新。",409);
        current.AutoRenew=request.Enabled;current.Revision=Guid.NewGuid().ToString("N");current.NextCheck=NextAcmeCheck(current.Id,Certificates().GetValueOrDefault(id));
        command.CommandText="UPDATE panel_backup_state SET body_cipher=$body WHERE id=$id";command.Parameters.AddWithValue("$body",protector.Protect(Encode(current)));command.ExecuteNonQuery();tx.Commit();return current.Public();
    }
    public bool RecoverAcmePreflightFailure(PanelAcmeRegistration registration)
    {
        if(registration.LastOperationId.Length==0||registration.CompletedAttempt>=registration.Attempt)return false;
        var operation=Operation(registration.LastOperationId);
        return operation.State=="Failed"&&CompleteAcme(registration.Id,operation.Id,
            operation.Error.Length>0?Redaction.Clean(operation.Error):"证书任务在执行器预检阶段失败。",expectedAttempt:registration.Attempt);
    }
    private void AdvanceAcmeAttempt(SqliteCommand command,PanelOperation operation)
    {
        if(operation.Action is not ("AcmeIssue" or "AcmeRenew" or "ExternalAcmeIssue" or "ExternalAcmeRenew"))return;
        command.CommandText="SELECT body_cipher FROM panel_payloads WHERE operation_id=$id";
        var payload=command.ExecuteScalar() is string body?Decode<AcmePayload>(protector.Unprotect(body)):throw new OpsException("证书任务载荷缺失。",409);
        command.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id=$acme";command.Parameters.AddWithValue("$acme","acme:"+payload.Registration.Id);
        var current=command.ExecuteScalar() is string cipher?Decode<PanelAcmeRegistration>(protector.Unprotect(cipher)):throw new OpsException("自动证书设置缺失。",409);
        if(current.LastOperationId!=operation.Id)throw new OpsException("证书任务已被新配置取代，不能继续旧任务。",409);
        current.Attempt++;
        command.CommandText="UPDATE panel_backup_state SET body_cipher=$acmeBody WHERE id=$acme";command.Parameters.AddWithValue("$acmeBody",protector.Protect(Encode(current)));command.ExecuteNonQuery();
        command.Parameters.RemoveAt("$acme");command.Parameters.RemoveAt("$acmeBody");
    }
    public bool CompleteAcme(string id,string operationId,string error,string outcome="Checked",string thumbprint="",string configurationSha256="",long? expectedAttempt=null)
    {
        using var db=Open();using var tx=db.BeginTransaction();using var command=db.CreateCommand();command.Transaction=tx;
        command.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id=$id";command.Parameters.AddWithValue("$id","acme:"+id);
        if(command.ExecuteScalar() is not string body)return false;var current=Decode<PanelAcmeRegistration>(protector.Unprotect(body));
        if(current.LastOperationId!=operationId||(expectedAttempt.HasValue&&(current.Attempt!=expectedAttempt||current.CompletedAttempt>=expectedAttempt)))return false;
        current.LastError=error;current.LastChecked=DateTimeOffset.UtcNow;
        current.CompletedAttempt=current.Attempt;
        current.ConsecutiveFailures=error.Length==0?0:Math.Min(30,current.ConsecutiveFailures+1);
        current.LastOutcome=error.Length==0?outcome:"Failed";
        if(error.Length==0&&configurationSha256.Length>0)current.ConfigurationSha256=configurationSha256;
        if(error.Length==0&&thumbprint.Length>0)
        {
            if(current.LastCertificateThumbprint!=thumbprint)current.LastRenewed=current.LastChecked;
            current.LastCertificateThumbprint=thumbprint;
        }
        current.NextCheck=NextAcmeCheck(id,Certificates().GetValueOrDefault(id),current.ConsecutiveFailures);
        command.CommandText="UPDATE panel_backup_state SET body_cipher=$body WHERE id=$id";command.Parameters.AddWithValue("$body",protector.Protect(Encode(current)));command.ExecuteNonQuery();tx.Commit();return true;
    }
}
