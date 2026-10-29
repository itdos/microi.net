using System.Text.Json;
using System.Text.Json.Nodes;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microi.Panel;
using Microi.Panel.Panel;

internal static class GuardBridgeChecks
{
    [DllImport("libc",EntryPoint="geteuid")]
    private static extern uint EffectiveUserId();
    /// <summary>真实隔离 Linux 宿主上的 .NET→Unix HTTP→Python→防火墙闭环，任何离线 fallback 均算失败。</summary>
    public static async Task Run(string expectedHostId)
    {
        const string marker="/var/lib/panel-acceptance-id";
        if(!OperatingSystem.IsLinux()||EffectiveUserId()!=0||expectedHostId.Length<8||!File.Exists(marker)||File.ReadAllText(marker).Trim()!=expectedHostId)
            throw new Exception("Guard bridge requires the explicitly identified isolated Linux acceptance host.");
        var checks=new List<string>();
        void Check(bool value,string title){if(!value)throw new Exception(title);checks.Add(title);}
        using var client=new PanelAuthGuardClient();
        var status=await client.Status(default)??throw new Exception("Real host guard is unavailable; local fallback is forbidden.");
        Check(status["firewall"]?["verified"]?.GetValue<bool>()==true,"GET status confirms the actual host firewall");
        var policy=status["policy"]!.AsObject();
        Check(policy["enabled"]?.GetValue<bool>()==true&&policy["maxFailures"]?.GetValue<int>()==3&&policy["windowSeconds"]?.GetValue<int>()==0,
            "isolated host uses the expected cumulative three-failure policy");
        string ip="";
        for(var attempt=0;attempt<8;attempt++)
        {
            var candidate="198.51.100."+RandomNumberGenerator.GetInt32(1,255);
            var initial=await client.Check(candidate,default)??throw new Exception("Real POST check returned no receipt.");
            if(initial["ip"]?.ToString()==candidate&&initial["banned"]?.GetValue<bool>()==false&&initial["failedAttempts"]?.GetValue<int>()==0
                &&initial["resetEpoch"]==null&&initial["lastFailure"]==null){ip=candidate;break;}
        }
        Check(ip.Length>0,"POST check selects an unused documentation IP without existing counters or reset state");
        var touched=false;
        try
        {
            var revision=policy["revision"]!.GetValue<string>();
            // 仅以 CAS 回写相同基础值验证 PUT 协议，不改变管理员配置或全局开关。
            var updated=await client.SavePolicy(new(){["expectedRevision"]=revision,["enabled"]=true},default);
            Check(updated["policy"]?["revision"]?.ToString()!=revision&&updated["policy"]?["generation"]?.GetValue<long>()>policy["generation"]!.GetValue<long>(),
                "PUT policy returns a new durable revision and generation");
            var staleRejected=false;
            try{await client.SavePolicy(new(){["expectedRevision"]=revision,["enabled"]=true},default);}
            catch(OpsException error) when(error.Status==409){staleRejected=true;}
            Check(staleRejected,"stale policy CAS is rejected by the real daemon");
            var eventId="认证协议验收-"+Guid.NewGuid().ToString("N");var occurred=DateTimeOffset.UtcNow;touched=true;
            var one=await client.Failure(ip,eventId,default,occurred)??throw new Exception("Real POST failures returned no receipt.");
            Check(one["ip"]?.ToString()==ip&&one["accepted"]?.GetValue<bool>()==true&&one["failedAttempts"]?.GetValue<int>()==1,
                "Chinese event ID crosses the UTF-8 HTTP body and is persisted once");
            var replay=await client.Failure(ip,eventId,default,occurred)??throw new Exception("Real replay returned no receipt.");
            Check(replay["failedAttempts"]?.GetValue<int>()==1,"event replay does not duplicate the host counter");
            for(var i=2;i<=3;i++)
            {
                var receipt=await client.Failure(ip,"bridge-"+Guid.NewGuid().ToString("N"),default)??throw new Exception("Real failure returned no receipt.");
                Check(receipt["failedAttempts"]?.GetValue<int>()==i,"host failure count reaches "+i);
            }
            var banned=await client.Check(ip,default)??throw new Exception("Real banned check returned no receipt.");
            Check(banned["banned"]?.GetValue<bool>()==true&&banned["ban"]?["applied"]?.GetValue<bool>()==true,
                "POST check confirms the persisted ban is applied to the firewall");
            var unban=await client.Unban(ip,default);
            Check(unban["ip"]?.ToString()==ip&&unban["removed"]?.GetValue<bool>()==true&&unban["banned"]?.GetValue<bool>()==false&&unban["firewallVerified"]?.GetValue<bool>()==true,
                "POST unban confirms kernel removal before reporting success");
            var cleared=await client.Check(ip,default)??throw new Exception("Real cleared check returned no receipt.");
            Check(cleared["banned"]?.GetValue<bool>()==false&&cleared["failedAttempts"]?.GetValue<int>()==0,
                "independent POST check confirms the host reset");
            touched=false;
            Console.WriteLine(JsonSerializer.Serialize(new{completed=true,kind="real-dotnet-unix-guard-protocol",hostId=expectedHostId,ip,checks,failed=0,skipped=0,
                policyValuesChanged=false,boundary="Direct failure injection verifies HTTP/Unix framing and host state; it is not SSH or database authentication evidence.",
                observedAt=DateTimeOffset.UtcNow},JsonDefaults.Options));
        }
        finally
        {
            // 仅清理本轮预先确认空白的测试 IP，失败时也不能遗留本轮防火墙封禁。
            if(touched)await client.Unban(ip,default);
        }
    }
}
