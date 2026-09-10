using Microsoft.AspNetCore.DataProtection;

namespace Microi.Panel.Panel;

public sealed partial class PanelRepository
{
    public T Payload<T>(string operationId)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT body_cipher FROM panel_payloads WHERE operation_id=$id"; cmd.Parameters.AddWithValue("$id", operationId);
        return cmd.ExecuteScalar() is string body ? Decode<T>(protector.Unprotect(body)) : throw new OpsException("任务的恢复数据缺失。", 409);
    }
    public Dictionary<string, PanelCertificate> Certificates()
    {
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT body_cipher FROM panel_certificates ORDER BY id";
        using var rows = cmd.ExecuteReader(); var certificates = new Dictionary<string, PanelCertificate>();
        while (rows.Read()) { var certificate = Decode<PanelCertificate>(protector.Unprotect(rows.GetString(0))); certificates.Add(certificate.Id, certificate); }
        return certificates;
    }
    public void SaveCertificate(PanelCertificate certificate)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "INSERT INTO panel_certificates VALUES($id,$body) ON CONFLICT(id) DO UPDATE SET body_cipher=excluded.body_cipher";
        cmd.Parameters.AddWithValue("$id", certificate.Id); cmd.Parameters.AddWithValue("$body", protector.Protect(Encode(certificate))); cmd.ExecuteNonQuery();
    }
}
