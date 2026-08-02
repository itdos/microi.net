using System.Diagnostics;
using System.Reflection;
using System.Text.RegularExpressions;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class ApiEngineRealtimeProtocolTests
{
    [Fact]
    public void Channel_subscription_uses_a_server_owned_authorization_engine_convention()
    {
        var request = new ApiEngineRealtimeSubscriptionRequest
        {
            ChannelKey = "order_updates",
            SubjectId = "order-1001"
        };

        Assert.True(ApiEngineRealtimeRuntime.TryNormalizeSubscription(
            request,
            out var normalized,
            out var error), error);
        Assert.Equal("order_updates", normalized.ChannelKey);
        Assert.Equal("order-1001", normalized.SubjectId);
        Assert.Equal(
            "realtime_order_updates_authorize",
            ApiEngineRealtimeRuntime.ResolveAuthorizationApiEngineKey(normalized.ChannelKey));
        Assert.Equal(
            new[] { "ChannelKey", "SubjectId" },
            typeof(ApiEngineRealtimeSubscriptionRequest)
                .GetProperties()
                .Select(property => property.Name)
                .ToArray());

        Assert.False(ApiEngineRealtimeRuntime.TryNormalizeSubscription(
            new ApiEngineRealtimeSubscriptionRequest
            {
                ChannelKey = "../../sys_user_export",
                SubjectId = request.SubjectId
            },
            out _,
            out _));
    }

    [Fact]
    public void Successful_data_append_is_reduced_to_the_generic_public_contract()
    {
        var result = JObject.Parse("""
        {
          "Code": 1,
          "Data": { "PrivateValue": "must-not-leak" },
          "DataAppend": {
            "RealtimeEvent": {
              "EventId": "01KYREALTIME000000000000001",
              "ChannelKey": "order_updates",
              "SubjectId": "order-1001",
              "Version": 12,
              "EventType": "StatusChanged",
              "OccurredAt": "1900-01-01T00:00:00Z",
              "Data": { "Status": "Paid" },
              "CurrentUser": { "Token": "must-not-leak" }
            }
          }
        }
        """);

        var accepted = ApiEngineRealtimeRuntime.TryReadEvent(
            result,
            "iTdos",
            out var realtimeEvent,
            out var error);

        Assert.True(accepted, error);
        Assert.Equal("01KYREALTIME000000000000001", realtimeEvent.EventId);
        Assert.Equal("order_updates", realtimeEvent.ChannelKey);
        Assert.Equal("order-1001", realtimeEvent.SubjectId);
        Assert.Equal(12, realtimeEvent.Version);
        Assert.Equal("StatusChanged", realtimeEvent.EventType);
        Assert.Equal("Paid", realtimeEvent.Data!["Status"]!.ToString());
        Assert.NotEqual("1900-01-01T00:00:00Z", realtimeEvent.OccurredAt);

        var json = JsonConvert.SerializeObject(realtimeEvent);
        Assert.DoesNotContain("PrivateValue", json, StringComparison.Ordinal);
        Assert.DoesNotContain("CurrentUser", json, StringComparison.Ordinal);
        Assert.DoesNotContain("Token", json, StringComparison.Ordinal);
        Assert.Equal(
            new[]
            {
                "EventId", "ChannelKey", "SubjectId", "Version", "EventType", "Data", "OccurredAt"
            },
            typeof(ApiEngineRealtimeEvent).GetProperties()
                .Select(property => property.Name)
                .ToArray());
    }

    [Fact]
    public void Failed_or_oversized_event_is_never_broadcastable()
    {
        var failed = JObject.FromObject(new
        {
            Code = 0,
            DataAppend = new
            {
                RealtimeEvent = ValidEventContract()
            }
        });
        Assert.False(ApiEngineRealtimeRuntime.TryReadEvent(
            failed,
            "iTdos",
            out _,
            out var failedError));
        Assert.Null(failedError);

        var oversized = JObject.FromObject(new
        {
            Code = 1,
            DataAppend = new
            {
                RealtimeEvent = new
                {
                    EventId = "event-oversized",
                    ChannelKey = "order_updates",
                    SubjectId = "order-1001",
                    Version = 13,
                    EventType = "StatusChanged",
                    Data = new { Text = new string('x', ApiEngineRealtimeRuntime.MaximumDataBytes + 1) }
                }
            }
        });
        Assert.False(ApiEngineRealtimeRuntime.TryReadEvent(
            oversized,
            "iTdos",
            out _,
            out var oversizedError));
        Assert.Contains("不能超过", oversizedError, StringComparison.Ordinal);
    }

    [Fact]
    public void Authorization_requires_exact_channel_subject_and_nonnegative_version_echo()
    {
        var request = new ApiEngineRealtimeSubscriptionRequest
        {
            ChannelKey = "order_updates",
            SubjectId = "order-1001"
        };
        var allowed = JObject.FromObject(new
        {
            Code = 1,
            Data = new
            {
                Authorized = true,
                ChannelKey = request.ChannelKey,
                SubjectId = request.SubjectId,
                Version = 7
            }
        });

        Assert.True(ApiEngineRealtimeRuntime.TryValidateAuthorizationResponse(
            allowed,
            request,
            out var version));
        Assert.Equal(7, version);

        var wrongSubject = (JObject)allowed.DeepClone();
        wrongSubject["Data"]!["SubjectId"] = "order-1002";
        Assert.False(ApiEngineRealtimeRuntime.TryValidateAuthorizationResponse(
            wrongSubject,
            request,
            out _));
    }

    [Fact]
    public void Groups_and_fingerprints_are_tenant_channel_subject_and_content_scoped()
    {
        var baseline = ApiEngineRealtimeRuntime.BuildGroupName(
            "iTdos",
            "order_updates",
            "order-1001");
        Assert.StartsWith("Microi:ApiEngineRealtime:v2:", baseline, StringComparison.Ordinal);
        Assert.NotEqual(
            baseline,
            ApiEngineRealtimeRuntime.BuildGroupName("other", "order_updates", "order-1001"));
        Assert.NotEqual(
            baseline,
            ApiEngineRealtimeRuntime.BuildGroupName("iTdos", "inventory_updates", "order-1001"));
        Assert.NotEqual(
            baseline,
            ApiEngineRealtimeRuntime.BuildGroupName("iTdos", "order_updates", "order-1002"));

        var first = new ApiEngineRealtimeEvent
        {
            EventId = "event-1",
            ChannelKey = "order_updates",
            SubjectId = "order-1001",
            Version = 8,
            EventType = "StatusChanged",
            Data = JObject.FromObject(new { Status = "Paid" }),
            OccurredAt = "2026-08-02T01:00:00Z"
        };
        var replay = JObject.FromObject(first).ToObject<ApiEngineRealtimeEvent>()!;
        replay.OccurredAt = "2026-08-02T01:00:02Z";
        var conflict = JObject.FromObject(first).ToObject<ApiEngineRealtimeEvent>()!;
        conflict.Data!["Status"] = "Cancelled";

        Assert.Equal(
            ApiEngineRealtimeRuntime.BuildEventFingerprint(first),
            ApiEngineRealtimeRuntime.BuildEventFingerprint(replay));
        Assert.NotEqual(
            ApiEngineRealtimeRuntime.BuildEventFingerprint(first),
            ApiEngineRealtimeRuntime.BuildEventFingerprint(conflict));
    }

    [Fact]
    public void Subscription_groups_use_short_reauthorized_time_bucket_leases()
    {
        var baseGroup = ApiEngineRealtimeRuntime.BuildGroupName(
            "iTdos",
            "order_updates",
            "order-1001");
        var now = DateTimeOffset.FromUnixTimeSeconds(90);
        var leaseGroups = ApiEngineRealtimeRuntime.BuildSubscriptionLeaseGroups(baseGroup, now);

        Assert.Equal(2, leaseGroups.Count);
        Assert.Equal(baseGroup + ":lease:3", leaseGroups[0]);
        Assert.Equal(baseGroup + ":lease:4", leaseGroups[1]);
        Assert.Equal(
            leaseGroups[0],
            ApiEngineRealtimeRuntime.BuildBroadcastGroupName(baseGroup, now));
        Assert.Equal(
            DateTimeOffset.FromUnixTimeSeconds(150),
            ApiEngineRealtimeRuntime.GetSubscriptionLeaseExpiry(now));
        Assert.Equal(2, ApiEngineRealtimeRuntime.ProtocolVersion);
        Assert.InRange(
            ApiEngineRealtimeRuntime.SubscriptionRenewAfterMilliseconds,
            5_000,
            20_000);
    }

    [Fact]
    public async Task Post_commit_budget_does_not_replace_the_business_response_path()
    {
        var stopwatch = Stopwatch.StartNew();
        var result = await ApiEngineRealtimeRuntime.ExecuteWithinBudgetAsync(
            async () =>
            {
                await Task.Delay(500);
                return new ApiEngineRealtimePublishResult { BroadcastSucceeded = true };
            },
            TimeSpan.FromMilliseconds(40),
            "event-timeout",
            "group-timeout");
        stopwatch.Stop();

        Assert.True(result.TimedOut);
        Assert.False(result.BroadcastSucceeded);
        Assert.Contains("POST_COMMIT_TIMEOUT_40MS", result.BroadcastError);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromMilliseconds(350), stopwatch.Elapsed.ToString());
    }

    [Fact]
    public void Generic_hub_is_added_without_removing_the_legacy_game_contract()
    {
        Assert.NotNull(typeof(ApiEngineRealtimeHub).GetMethod(
            ApiEngineRealtimeRuntime.SubscribeMethodName,
            BindingFlags.Instance | BindingFlags.Public));
        Assert.NotNull(typeof(ApiEngineRealtimeHub).GetMethod(
            ApiEngineRealtimeRuntime.UnsubscribeMethodName,
            BindingFlags.Instance | BindingFlags.Public));
        Assert.Equal("/api-engine-realtime", ApiEngineRealtimeRuntime.HubPath);
        Assert.Equal("RealtimeEvent", ApiEngineRealtimeRuntime.ClientEventName);
        Assert.Equal("AuthorizeRealtime", ApiEngineRealtimeRuntime.AuthorizeCommandName);
        Assert.Equal("RealtimeEvent", ApiEngineRealtimeRuntime.DataAppendPropertyName);
        Assert.Equal("/game-realtime", GameRealtimeRuntime.HubPath);
        Assert.NotNull(typeof(GameRealtimeHub).GetMethod(
            GameRealtimeRuntime.SubscribeMethodName,
            BindingFlags.Instance | BindingFlags.Public));

        var serverRoot = FindServerRoot();
        var program = File.ReadAllText(Path.Combine(serverRoot, "Microi.net.Api", "Program.cs"));
        Assert.Contains(
            "app.MapHub<ApiEngineRealtimeHub>(ApiEngineRealtimeRuntime.HubPath)",
            program,
            StringComparison.Ordinal);
        Assert.Contains(
            "app.MapHub<GameRealtimeHub>(GameRealtimeRuntime.HubPath)",
            program,
            StringComparison.Ordinal);

        var controller = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net.Api",
            "Controllers",
            "ApiEngineController.cs"));
        Assert.Equal(5, Regex.Matches(
            controller,
            @"await\s+PublishApiEngineRealtimeAfterCommitAsync\(result,\s*param\);").Count);
        Assert.Contains(
            ".PublishAfterCommitWithinBudgetAsync(osClient, realtimeEvent)",
            controller,
            StringComparison.Ordinal);

        var hub = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net.Api",
            "Handler",
            "ApiEngineRealtimeHub.cs"));
        Assert.Contains(
            "ResolveAuthorizationApiEngineKey(request.ChannelKey)",
            hub,
            StringComparison.Ordinal);
        Assert.Contains(
            "UserAccessKeySecurity.IsSession(currentToken.CurrentUser)",
            hub,
            StringComparison.Ordinal);
        Assert.Contains(
            "DiyToken.ResolveClientTokenLifetime(clientModel, clientType)",
            hub,
            StringComparison.Ordinal);
        Assert.Contains(
            "BuildSubscriptionLeaseGroups(groupName, now)",
            hub,
            StringComparison.Ordinal);
        Assert.Contains(
            "TryAcquireSubscriptionAuthorizationSlotAsync(",
            hub,
            StringComparison.Ordinal);
        Assert.Contains(
            "RemoveSubscriptionGroupsAsync(groupName)",
            hub,
            StringComparison.Ordinal);
        Assert.DoesNotMatch("\\[\"GatewayKey\"\\]\\s*=", hub);

        var runtime = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Core",
            "Runtime",
            "ApiEngineRealtimeRuntime.cs"));
        var publishStart = runtime.IndexOf(
            "PublishAfterCommitAsync(",
            StringComparison.Ordinal);
        var publishEnd = runtime.IndexOf(
            "PublishAfterCommitWithinBudgetAsync(",
            publishStart,
            StringComparison.Ordinal);
        var publishMethod = runtime.Substring(publishStart, publishEnd - publishStart);
        Assert.Contains("LockTakeAsync", publishMethod, StringComparison.Ordinal);
        Assert.Contains("LockReleaseAsync", publishMethod, StringComparison.Ordinal);
        Assert.Contains("VersionConflict", publishMethod, StringComparison.Ordinal);
        Assert.Contains(
            "SubscriptionAuthorizationRateLimitMaximum",
            runtime,
            StringComparison.Ordinal);
        Assert.Contains("redis.call('INCR', KEYS[1])", runtime, StringComparison.Ordinal);
        Assert.True(
            publishMethod.IndexOf("SendGroupAsync", StringComparison.Ordinal)
            < publishMethod.LastIndexOf("EventDeduplicationTtl", StringComparison.Ordinal),
            "EventId 完成标记必须在广播成功后写入，避免先 NX 后强杀永久吞通知。");

        Assert.Equal(
            new[]
            {
                "ProtocolVersion", "ChannelKey", "SubjectId", "Version", "Latest",
                "RenewAfterMilliseconds", "LeaseExpiresAt"
            },
            typeof(ApiEngineRealtimeSubscriptionResult)
                .GetProperties()
                .Select(property => property.Name)
                .ToArray());
    }

    private static object ValidEventContract()
    {
        return new
        {
            EventId = "event-1",
            ChannelKey = "order_updates",
            SubjectId = "order-1001",
            Version = 1,
            EventType = "StatusChanged"
        };
    }

    private static string FindServerRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.net.Api"))
                && Directory.Exists(Path.Combine(current.FullName, "Microi.Core")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("未找到 Microi.Server 根目录。");
    }
}
