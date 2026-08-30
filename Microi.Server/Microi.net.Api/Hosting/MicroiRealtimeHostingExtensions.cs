using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json.Serialization;
using StackExchange.Redis;

// ASP.NET Core 实时传输宿主组合。
namespace Microi.net.Api;

/// <summary>
/// API 宿主的 SignalR 传输装配。Hub 只承载认证连接、群组和消息运输，
/// 权威业务状态与订阅规则仍由接口引擎及共享存储维护。
/// </summary>
public static class MicroiRealtimeHostingExtensions
{
    // The browser client sends a keep-alive every 15 seconds and treats 45 seconds
    // without a server frame as disconnected. Keep both sides aligned so the
    // general DiyWebSocket hub does not enter a permanent reconnect loop.
    private static readonly TimeSpan RealtimeClientTimeoutInterval = TimeSpan.FromSeconds(45);
    private static readonly TimeSpan RealtimeKeepAliveInterval = TimeSpan.FromSeconds(15);

    public static IServiceCollection AddMicroiRealtimeTransport(
        this IServiceCollection services,
        string redisConnection,
        bool enableDetailedErrors)
    {
        var signalR = services.AddSignalR(options =>
            {
                options.EnableDetailedErrors = enableDetailedErrors;
                options.ClientTimeoutInterval = RealtimeClientTimeoutInterval;
                options.KeepAliveInterval = RealtimeKeepAliveInterval;
                options.MaximumReceiveMessageSize = 10 * 1024 * 1024;
            })
            .AddNewtonsoftJsonProtocol(options =>
            {
                options.PayloadSerializerSettings.ContractResolver = new DefaultContractResolver();
            })
            .AddMessagePackProtocol()
            .AddStackExchangeRedis(redisConnection, options =>
            {
                options.Configuration.ChannelPrefix = RedisChannel.Literal("MicroiSignalR");
            });

        ConfigureSmallCommandHub<GameRealtimeHub>(signalR, enableDetailedErrors);
        ConfigureSmallCommandHub<ApiEngineRealtimeHub>(signalR, enableDetailedErrors);

        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = redisConnection;
            options.InstanceName = "Microi:";
        });
        return services;
    }

    public static WebApplication MapMicroiRealtimeTransport(this WebApplication app)
    {
        app.MapHub<DiyWebSocket>("/diy-websocket").RequireCors("any");
        app.MapHub<GameRealtimeHub>(GameRealtimeRuntime.HubPath).RequireCors("any");
        app.MapHub<ApiEngineRealtimeHub>(ApiEngineRealtimeRuntime.HubPath).RequireCors("any");

        var chatHub = app.Services.GetRequiredService<IHubContext<DiyWebSocket>>();
        RealtimePushRuntime.Configure((connectionIds, eventName, payload) =>
            chatHub.Clients.Clients(connectionIds.ToList()).SendAsync(eventName, payload));

        var gameHub = app.Services.GetRequiredService<IHubContext<GameRealtimeHub>>();
        RealtimePushRuntime.ConfigureGroups((groupName, eventName, payload) =>
            gameHub.Clients.Group(groupName).SendAsync(eventName, payload));

        var apiEngineHub = app.Services.GetRequiredService<IHubContext<ApiEngineRealtimeHub>>();
        RealtimePushRuntime.ConfigureGroups(
            ApiEngineRealtimeRuntime.TransportName,
            (groupName, eventName, payload) =>
                apiEngineHub.Clients.Group(groupName).SendAsync(eventName, payload));
        return app;
    }

    private static void ConfigureSmallCommandHub<THub>(
        ISignalRServerBuilder signalR,
        bool enableDetailedErrors)
        where THub : Hub
    {
        signalR.AddHubOptions<THub>(options =>
        {
            options.ClientTimeoutInterval = RealtimeClientTimeoutInterval;
            options.KeepAliveInterval = RealtimeKeepAliveInterval;
            options.MaximumReceiveMessageSize = 16 * 1024;
            options.EnableDetailedErrors = enableDetailedErrors;
        });
    }
}
