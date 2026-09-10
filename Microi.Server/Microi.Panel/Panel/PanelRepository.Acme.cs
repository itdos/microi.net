using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;

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
        var resource=Resource(registration.ResourceId);if(resource.State!="Installed")throw new OpsException("自动证书需要运行中的 Nginx 实例。",409);
        var digest=SHA256.HashData(Encoding.UTF8.GetBytes(registration.Id+"\n"+registration.Revision+"\n"+registration.NextCheck.ToString("O")));
        return Enqueue("AcmeRenew",new Guid(digest.AsSpan(0,16)).ToString(),resource,"scheduler",Encode(new AcmePayload(registration,resource.ConfigRevision)),
            resource.ConfigRevision,acmeClaim:new(registration,registration.Revision,true));
    }
    public static DateTimeOffset NextAcmeCheck(string id,PanelCertificate? certificate=null)
    {
        var seconds=certificate==null?12*3600:Math.Clamp((certificate.NotAfter-certificate.NotBefore).TotalSeconds/4,30,12*3600);
        // 短周期私有 CA 也按有效期检查；错峰范围最多为检查间隔的十分之一。
        var fraction=Convert.ToInt32(UpdateCoordinator.Hash(id)[..2],16)/255d;
        return DateTimeOffset.UtcNow.AddSeconds(seconds+fraction*Math.Min(seconds/10,1800));
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
    public void CompleteAcme(string id,string operationId,string error)
    {
        using var db=Open();using var tx=db.BeginTransaction();using var command=db.CreateCommand();command.Transaction=tx;
        command.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id=$id";command.Parameters.AddWithValue("$id","acme:"+id);
        if(command.ExecuteScalar() is not string body)return;var current=Decode<PanelAcmeRegistration>(protector.Unprotect(body));
        if(current.LastOperationId!=operationId)return;current.LastError=error;current.NextCheck=NextAcmeCheck(id,Certificates().GetValueOrDefault(id));
        command.CommandText="UPDATE panel_backup_state SET body_cipher=$body WHERE id=$id";command.Parameters.AddWithValue("$body",protector.Protect(Encode(current)));command.ExecuteNonQuery();tx.Commit();
    }
}
