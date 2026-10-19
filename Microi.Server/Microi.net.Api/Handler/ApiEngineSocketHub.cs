using System.IdentityModel.Tokens.Jwt;
using Dos.Common;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json.Linq;

namespace Microi.net;

/// <summary>通用双向传输；应用房间、业务指令和权限仍由接口引擎负责。</summary>
[EnableCors("any")]
public sealed class ApiEngineSocketHub : Hub
{
    private const string BindingKey = "Microi.Socket.Binding";

    public override async Task OnConnectedAsync()
    {
        var http = Context.GetHttpContext();
        var tenant = http?.Request.Query["OsClient"].ToString();
        var engine = http?.Request.Query["ApiEngineKey"].ToString();
        if (!ApiEngineSocketRuntime.IsCoordinate(tenant) || !ApiEngineSocketRuntime.IsCoordinate(engine))
            throw new HubException("必须指定有效的 OsClient 和 ApiEngineKey。");
        var binding = new Binding(tenant, engine,
            ApiEngineSocketRuntime.Hash(http?.Connection.RemoteIpAddress?.ToString() ?? "unknown"));
        Context.Items[BindingKey] = binding;
        if (!await AcquireAsync(binding, "connect", 30, 60)) throw new HubException("连接过于频繁，请稍后重试。");
        await Groups.AddToGroupAsync(Context.ConnectionId,
            ApiEngineSocketRuntime.Group(tenant, engine, Context.ConnectionId));
        var response = await ExecuteAsync(binding, "Connected", "connected", new JObject(), Context.ConnectionAborted);
        if ((int?)response["Code"] != 1)
        {
            Context.Abort();
            throw new HubException("此接口尚未允许当前实时连接。");
        }
        // Hub 是短生命周期对象；空闲监视只保留连接上下文，不能依赖已释放的 Hub 实例。
        _ = MonitorIdleAsync(Context, binding);
        await base.OnConnectedAsync();
    }

    public async Task<JObject> Invoke(string requestId, JObject message)
    {
        if (!Context.Items.TryGetValue(BindingKey, out var value) || value is not Binding binding)
            throw new HubException("实时连接尚未就绪。");
        try { ApiEngineSocketRuntime.ValidateMessage(requestId, message); }
        catch (ArgumentException) { throw new HubException("实时消息格式或大小无效。"); }
        if (!await AcquireAsync(binding, "message", 240, 10))
            throw new HubException("实时操作过于频繁，请稍后重试。");
        return await ExecuteAsync(binding, "Message", requestId, message, Context.ConnectionAborted);
    }

    public override async Task OnDisconnectedAsync(Exception exception)
    {
        if (Context.Items.TryGetValue(BindingKey, out var value) && value is Binding binding)
        {
            try
            {
                // 断开事件使用独立超时，不能复用已经取消的连接令牌。
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                await ExecuteAsync(binding, "Disconnected", "disconnected", new JObject(), timeout.Token);
            }
            catch { /* 节点或 Redis 不可用时，接口引擎租约仍须独立过期。 */ }
            try { await ApiEngineSocketRuntime.ReleaseConnectionAsync(binding.Tenant, binding.Engine, binding.ClientKey, Context.ConnectionId); }
            catch { /* 即使此次清理失败，共享连接名额也会自行过期。 */ }
        }
        await base.OnDisconnectedAsync(exception);
    }

    private async Task<JObject> ExecuteAsync(Binding binding, string eventName, string requestId,
        JObject message, CancellationToken cancellationToken)
    {
        if (MicroiEngine.ApiEngine is not IApiEngineSocketRunner runner)
            throw new HubException("实时接口引擎服务尚未就绪。");
        var user = await ResolveUserAsync(binding.Tenant);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(8));
        try
        {
            var raw = await runner.RunSocketAsync(binding.Tenant, binding.Engine, Context.ConnectionId,
                eventName, binding.ClientKey, requestId, (JObject)message.DeepClone(), user, timeout.Token);
            var result = JsonHelper.ToJObject(raw) ?? new JObject { ["Code"] = 0, ["Msg"] = "实时接口返回格式无效。" };
            var deliveries = ApiEngineSocketRuntime.ExtractDeliveries(result);
            var response = ApiEngineSocketRuntime.ProjectResponse(result);
            foreach (var delivery in deliveries)
                await Clients.Group(ApiEngineSocketRuntime.Group(binding.Tenant, binding.Engine, delivery.ConnectionId))
                    .SendAsync(ApiEngineSocketRuntime.EventName, delivery.Data, timeout.Token);
            return response;
        }
        catch (OperationCanceledException) { throw new HubException("实时操作超时，执行结果待确认。"); }
        catch (HubException) { throw; }
        catch { throw new HubException("实时服务暂不可用，请稍后重试。"); }
    }

    private async Task<bool> AcquireAsync(Binding binding, string bucket, int maximum, int seconds)
    {
        try
        {
            if (!await ApiEngineSocketRuntime.TryAcquireRateAsync(binding.Tenant, binding.Engine, binding.ClientKey, bucket, maximum, seconds)) return false;
            if (!await ApiEngineSocketRuntime.RenewConnectionAsync(binding.Tenant, binding.Engine, binding.ClientKey, Context.ConnectionId)) return false;
            Interlocked.Exchange(ref binding.LastMessageTicks, DateTime.UtcNow.Ticks);
            return true;
        }
        catch { throw new HubException("实时保护服务暂不可用。"); }
    }

    private static async Task MonitorIdleAsync(HubCallerContext connection, Binding binding)
    {
        try
        {
            while (!connection.ConnectionAborted.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromSeconds(15), connection.ConnectionAborted);
                if (DateTime.UtcNow.Ticks - Interlocked.Read(ref binding.LastMessageTicks) > TimeSpan.FromSeconds(75).Ticks)
                {
                    connection.Abort();
                    return;
                }
            }
        }
        catch (OperationCanceledException) { }
    }

    private async Task<JObject> ResolveUserAsync(string tenant)
    {
        var http = Context.GetHttpContext();
        var token = http?.Request.Query["access_token"].ToString();
        if (string.IsNullOrWhiteSpace(token)) token = http?.Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(token)) return null; // 接口引擎每次调用仍检查 AllowAnonymous、StopHttp 与角色权限。
        token = token.Trim();
        if (token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) token = token[7..].Trim();
        if (token.Length > 8192) throw new HubException("登录身份已失效。");
        var identity = await DiyToken.GetCurrentToken(token);
        if (identity?.CurrentUser == null || string.IsNullOrWhiteSpace((string)identity.CurrentUser["Id"])
            || !string.Equals(identity.OsClient, tenant, StringComparison.OrdinalIgnoreCase)
            || UserAccessKeySecurity.IsSession(identity.CurrentUser))
            throw new HubException("登录身份无效或与租户不匹配。");
        JwtSecurityToken jwt;
        try { jwt = new JwtSecurityTokenHandler().ReadJwtToken(token); }
        catch { throw new HubException("登录身份已失效。"); }
        var active = DiyToken.GetActiveCachedTokenEntry(identity, token);
        var updated = active?.UpdateTime == default ? identity.UpdateTime : active?.UpdateTime;
        if (active == null || jwt.ValidTo != DateTime.MinValue && jwt.ValidTo < DateTime.UtcNow
            || updated != null && updated != default(DateTime)
            && DateTime.Now - updated.Value > DiyToken.ResolveClientTokenLifetime(OsClient.GetClient(tenant),
                jwt.Claims.FirstOrDefault(c => c.Type == "ClientType")?.Value))
            throw new HubException("登录身份已失效。");
        return (JObject)identity.CurrentUser.DeepClone();
    }

    private sealed record Binding(string Tenant, string Engine, string ClientKey)
    {
        public long LastMessageTicks = DateTime.UtcNow.Ticks;
    }
}
