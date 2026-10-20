using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{

/// <summary>仅提供传输契约；配对、业务命令和权限由选定接口引擎负责。</summary>
public static class ApiEngineSocketRuntime
{
    public const string HubPath = "/api-engine-socket";
    public const string ResponseType = "SignalR";
    public const string EventName = "EngineMessage";
    private static readonly AsyncLocal<Binding> Current = new AsyncLocal<Binding>();
    private static readonly Regex Coordinate = new Regex("^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$", RegexOptions.CultureInvariant);
    private static readonly Regex Identifier = new Regex("^[A-Za-z0-9_-]{1,128}$", RegexOptions.CultureInvariant);

    public static bool IsCoordinate(string value) => value != null && Coordinate.IsMatch(value);
    public static bool IsIdentifier(string value) => value != null && Identifier.IsMatch(value);
    public static string Hash(string value)
    {
        using var sha = SHA256.Create();
        return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-", "").ToLowerInvariant();
    }
    public static string Group(string tenant, string engine, string connection) =>
        "Microi:Socket:" + Hash(tenant.ToLowerInvariant() + "\n" + engine.ToLowerInvariant()) + ":" + connection;

    public static IDisposable Enter(string tenant, string engine)
    {
        if (!IsCoordinate(tenant) || !IsCoordinate(engine)) throw new ArgumentException("Invalid socket binding.");
        var previous = Current.Value;
        Current.Value = new Binding(tenant, engine);
        return new Scope(() => Current.Value = previous);
    }

    public static bool IsTransportAllowed(string tenant, string engine, string responseType)
    {
        var binding = Current.Value;
        var socket = string.Equals(responseType, ResponseType, StringComparison.OrdinalIgnoreCase);
        if (!socket) return binding == null || !binding.Matches(tenant, engine);
        return binding != null && binding.Matches(tenant, engine);
    }

    public static void ValidateMessage(string requestId, JObject message)
    {
        if (!IsIdentifier(requestId) || message == null
            || Encoding.UTF8.GetByteCount(message.ToString(Formatting.None)) > 12 * 1024)
            throw new ArgumentException("Invalid socket message.");
        ValidateDepth(message, 0);
    }

    private static void ValidateDepth(JToken token, int depth)
    {
        if (depth > 16) throw new ArgumentException("Socket message is too deeply nested.");
        if (token is JContainer container)
            foreach (var child in container.Children()) ValidateDepth(child, depth + 1);
    }

    /// <summary>只在接口事务成功提交后提取投递路由，路由信息不得暴露给调用方。</summary>
    public static IReadOnlyList<SocketDelivery> ExtractDeliveries(JObject result)
    {
        var append = result["DataAppend"] as JObject;
        var outgoing = append?["SocketMessages"];
        append?.Remove("SocketMessages");
        if ((int?)result["Code"] != 1 || outgoing == null) return Array.Empty<SocketDelivery>();
        var messages = outgoing as JArray;
        if (messages == null || messages.Count > 16
            || Encoding.UTF8.GetByteCount(outgoing.ToString(Formatting.None)) > 32 * 1024)
            throw new ArgumentException("Invalid socket delivery envelope.");
        var deliveries = new List<SocketDelivery>();
        foreach (var item in messages)
        {
            var connection = (string)item["ConnectionId"];
            var data = item["Data"] as JObject;
            if (!IsIdentifier(connection) || data == null)
                throw new ArgumentException("Invalid socket recipient.");
            ValidateDepth(data, 0);
            deliveries.Add(new SocketDelivery(connection, (JObject)data.DeepClone()));
        }
        return deliveries;
    }

    public static JObject ProjectResponse(JObject result)
    {
        // 脚本诊断可能包含堆栈和基础设施信息，不得进入公开实时消息。
        var diagnosticFailure = (int?)result["Code"] != 1 && result["DataAppend"]?["DetailMsg"] != null;
        var response = new JObject
        {
            ["Code"] = result["Code"]?.DeepClone() ?? new JValue(0),
            ["Msg"] = diagnosticFailure ? "实时接口执行失败，请联系管理员检查服务日志。" : result["Msg"]?.DeepClone(),
            ["Data"] = diagnosticFailure ? null : result["Data"]?.DeepClone()
        };
        if (Encoding.UTF8.GetByteCount(response.ToString(Formatting.None)) > 32 * 1024)
            throw new ArgumentException("Socket response exceeds the transport budget.");
        return response;
    }

    public static async Task<bool> TryAcquireRateAsync(string tenant, string engine, string client, string bucket, int maximum, int seconds)
    {
        var key = "Microi:" + tenant + ":ApiEngineSocket:Rate:" + Hash(engine + "\n" + client + "\n" + bucket);
        var database = MicroiEngine.CacheTenant.Cache(tenant).Db(tenant);
        var count = await database.ScriptEvaluateAsync(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n;",
            new RedisKey[] { key }, new RedisValue[] { seconds }).ConfigureAwait(false);
        return (long)count <= maximum;
    }

    public static async Task<bool> RenewConnectionAsync(string tenant, string engine, string client, string connection)
    {
        var key = "Microi:" + tenant + ":ApiEngineSocket:Connections:" + Hash(engine + "\n" + client);
        var database = MicroiEngine.CacheTenant.Cache(tenant).Db(tenant);
        var accepted = await database.ScriptEvaluateAsync(
            "local t=redis.call('TIME'); local now=tonumber(t[1]); redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now); " +
            "if not redis.call('ZSCORE',KEYS[1],ARGV[1]) and redis.call('ZCARD',KEYS[1])>=64 then return 0 end; " +
            "redis.call('ZADD',KEYS[1],now+90,ARGV[1]); redis.call('EXPIRE',KEYS[1],120); return 1;",
            new RedisKey[] { key }, new RedisValue[] { connection }).ConfigureAwait(false);
        return (long)accepted == 1;
    }

    public static Task<bool> ReleaseConnectionAsync(string tenant, string engine, string client, string connection)
    {
        var key = "Microi:" + tenant + ":ApiEngineSocket:Connections:" + Hash(engine + "\n" + client);
        return MicroiEngine.CacheTenant.Cache(tenant).Db(tenant).SortedSetRemoveAsync(key, connection);
    }

    public sealed class SocketDelivery
    {
        public SocketDelivery(string connectionId, JObject data) { ConnectionId = connectionId; Data = data; }
        public string ConnectionId { get; }
        public JObject Data { get; }
    }
    private sealed class Binding
    {
        public Binding(string tenant, string engine) { Tenant = tenant; Engine = engine; }
        public string Tenant { get; }
        public string Engine { get; }
        public bool Matches(string tenant, string engine) => string.Equals(Tenant, tenant, StringComparison.OrdinalIgnoreCase)
            && string.Equals(Engine, engine, StringComparison.OrdinalIgnoreCase);
    }
    private sealed class Scope : IDisposable
    {
        public Scope(Action restore) { _restore = restore; }
        private Action _restore;
        public void Dispose() => Interlocked.Exchange(ref _restore, null)?.Invoke();
    }
}

public interface IApiEngineSocketRunner
{
    Task<object> RunSocketAsync(string tenant, string engine, string connectionId, string eventName,
        string clientKey, string requestId, JObject message, JObject trustedUser, CancellationToken cancellationToken);
}
}
