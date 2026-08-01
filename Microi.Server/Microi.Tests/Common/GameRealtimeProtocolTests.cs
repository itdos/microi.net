using System.Reflection;
using System.Diagnostics;
using System.Text.RegularExpressions;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class GameRealtimeProtocolTests
{
    [Fact]
    public void Successful_data_append_is_reduced_to_the_six_public_fields()
    {
        var result = JObject.Parse("""
        {
          "Code": 1,
          "Data": { "Hand": ["private-card"] },
          "DataAppend": {
            "RealtimeInvalidation": {
              "EventId": "01KYGAMEEVENT00000000000001",
              "AppKey": "landlord-arena",
              "RoomId": "01KYGAMEROOM00000000000001",
              "Version": 12,
              "Command": "Play",
              "OccurredAt": "1900-01-01T00:00:00Z",
              "PrivateHand": ["S3", "H4"],
              "UserId": "must-not-leak"
            }
          }
        }
        """);

        var accepted = GameRealtimeRuntime.TryReadInvalidation(
            result,
            "iTdos",
            out var invalidation,
            out var error);

        Assert.True(accepted, error);
        Assert.Equal("01KYGAMEEVENT00000000000001", invalidation.EventId);
        Assert.Equal("landlord-arena", invalidation.AppKey);
        Assert.Equal("01KYGAMEROOM00000000000001", invalidation.RoomId);
        Assert.Equal(12, invalidation.Version);
        Assert.Equal("Play", invalidation.Command);
        Assert.NotEqual("1900-01-01T00:00:00Z", invalidation.OccurredAt);

        var json = JsonConvert.SerializeObject(invalidation);
        Assert.DoesNotContain("PrivateHand", json, StringComparison.Ordinal);
        Assert.DoesNotContain("UserId", json, StringComparison.Ordinal);
        Assert.Equal(
            new[] { "EventId", "AppKey", "RoomId", "Version", "Command", "OccurredAt" },
            typeof(GameRealtimeInvalidation).GetProperties()
                .Select(property => property.Name)
                .ToArray());
    }

    [Fact]
    public void Failed_business_result_never_produces_an_invalidation()
    {
        var result = JObject.Parse("""
        {
          "Code": 0,
          "DataAppend": {
            "RealtimeInvalidation": {
              "EventId": "01KYGAMEEVENT00000000000002",
              "AppKey": "landlord-arena",
              "RoomId": "room-1",
              "Version": 2,
              "Command": "Play"
            }
          }
        }
        """);

        Assert.False(GameRealtimeRuntime.TryReadInvalidation(
            result,
            "iTdos",
            out _,
            out var error));
        Assert.Null(error);
    }

    [Theory]
    [InlineData("", "landlord-arena", "room-1", "Play")]
    [InlineData("bad event id", "landlord-arena", "room-1", "Play")]
    [InlineData("event-1", "bad/app", "room-1", "Play")]
    [InlineData("event-1", "landlord-arena", "room-1", "bad command")]
    public void Invalid_contract_is_rejected(
        string eventId,
        string appKey,
        string roomId,
        string command)
    {
        var result = JObject.FromObject(new
        {
            Code = 1,
            DataAppend = new
            {
                RealtimeInvalidation = new
                {
                    EventId = eventId,
                    AppKey = appKey,
                    RoomId = roomId,
                    Version = 1,
                    Command = command
                }
            }
        });

        Assert.False(GameRealtimeRuntime.TryReadInvalidation(
            result,
            "iTdos",
            out _,
            out var error));
        Assert.False(string.IsNullOrWhiteSpace(error));
    }

    [Fact]
    public void Group_name_is_tenant_app_and_room_scoped()
    {
        var baseline = GameRealtimeRuntime.BuildGroupName("iTdos", "landlord-arena", "room-1");

        Assert.StartsWith("Microi:GameRoom:v1:", baseline, StringComparison.Ordinal);
        Assert.NotEqual(
            baseline,
            GameRealtimeRuntime.BuildGroupName("other", "landlord-arena", "room-1"));
        Assert.NotEqual(
            baseline,
            GameRealtimeRuntime.BuildGroupName("iTdos", "mahjong-club", "room-1"));
        Assert.NotEqual(
            baseline,
            GameRealtimeRuntime.BuildGroupName("iTdos", "landlord-arena", "room-2"));
    }

    [Fact]
    public void Event_replay_fingerprint_is_stable_but_changed_content_conflicts()
    {
        var first = new GameRealtimeInvalidation
        {
            EventId = "event-1",
            AppKey = "landlord-arena",
            RoomId = "room-1",
            Version = 8,
            Command = "Play",
            OccurredAt = "2026-08-01T01:00:00Z"
        };
        var replay = new GameRealtimeInvalidation
        {
            EventId = first.EventId,
            AppKey = first.AppKey,
            RoomId = first.RoomId,
            Version = first.Version,
            Command = first.Command,
            OccurredAt = "2026-08-01T01:00:02Z"
        };
        var conflict = new GameRealtimeInvalidation
        {
            EventId = first.EventId,
            AppKey = first.AppKey,
            RoomId = first.RoomId,
            Version = first.Version + 1,
            Command = first.Command,
            OccurredAt = first.OccurredAt
        };

        Assert.Equal(
            GameRealtimeRuntime.BuildEventFingerprint(first),
            GameRealtimeRuntime.BuildEventFingerprint(replay));
        Assert.NotEqual(
            GameRealtimeRuntime.BuildEventFingerprint(first),
            GameRealtimeRuntime.BuildEventFingerprint(conflict));
    }

    [Fact]
    public async Task Post_commit_budget_times_out_without_waiting_for_a_stuck_sidecar()
    {
        var stopwatch = Stopwatch.StartNew();
        var result = await GameRealtimeRuntime.ExecuteWithinBudgetAsync(
            async () =>
            {
                await Task.Delay(500);
                return new GameRealtimePublishResult { BroadcastSucceeded = true };
            },
            TimeSpan.FromMilliseconds(40),
            "event-timeout",
            "group-timeout");
        stopwatch.Stop();

        Assert.True(result.TimedOut);
        Assert.False(result.BroadcastSucceeded);
        Assert.Equal("event-timeout", result.EventId);
        Assert.Contains("POST_COMMIT_TIMEOUT_40MS", result.BroadcastError);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromMilliseconds(350), stopwatch.Elapsed.ToString());
    }

    [Fact]
    public async Task Post_commit_budget_preserves_a_completed_publish_result()
    {
        var expected = new GameRealtimePublishResult
        {
            EventId = "event-ok",
            GroupName = "group-ok",
            BroadcastAttempted = true,
            BroadcastSucceeded = true
        };

        var actual = await GameRealtimeRuntime.ExecuteWithinBudgetAsync(
            () => Task.FromResult(expected),
            TimeSpan.FromMilliseconds(100),
            expected.EventId,
            expected.GroupName);

        Assert.Same(expected, actual);
        Assert.False(actual.TimedOut);
    }

    [Fact]
    public void Subscription_only_accepts_gateway_contract_and_exact_room_echo()
    {
        var request = new GameRealtimeSubscriptionRequest
        {
            AppKey = "landlord-arena",
            GatewayKey = "app_ddz_gateway",
            RoomId = "room-1"
        };
        var allowed = JObject.FromObject(new
        {
            Code = 1,
            Data = new
            {
                Authorized = true,
                AppKey = "landlord-arena",
                RoomId = "room-1",
                Version = 19
            }
        });
        var wrongRoom = (JObject)allowed.DeepClone();
        wrongRoom["Data"]!["RoomId"] = "room-2";

        Assert.True(GameRealtimeRuntime.TryNormalizeSubscription(
            request,
            out var normalized,
            out var error), error);
        Assert.True(GameRealtimeRuntime.TryValidateAuthorizationResponse(
            allowed,
            normalized,
            out var version));
        Assert.Equal(19, version);
        Assert.False(GameRealtimeRuntime.TryValidateAuthorizationResponse(
            wrongRoom,
            normalized,
            out _));
        Assert.False(GameRealtimeRuntime.TryNormalizeSubscription(
            new GameRealtimeSubscriptionRequest
            {
                AppKey = request.AppKey,
                GatewayKey = "sys_user_export",
                RoomId = request.RoomId
            },
            out _,
            out _));
    }

    [Fact]
    public void Hub_and_controller_keep_the_fixed_public_contract()
    {
        Assert.NotNull(typeof(GameRealtimeHub).GetMethod(
            GameRealtimeRuntime.SubscribeMethodName,
            BindingFlags.Instance | BindingFlags.Public));
        Assert.NotNull(typeof(GameRealtimeHub).GetMethod(
            GameRealtimeRuntime.UnsubscribeMethodName,
            BindingFlags.Instance | BindingFlags.Public));
        Assert.Equal("/game-realtime", GameRealtimeRuntime.HubPath);
        Assert.Equal("GameRoomChanged", GameRealtimeRuntime.ClientEventName);
        Assert.Equal("AuthorizeRealtime", GameRealtimeRuntime.AuthorizeCommandName);
        Assert.Equal("RealtimeInvalidation", GameRealtimeRuntime.DataAppendPropertyName);
        Assert.InRange(GameRealtimeRuntime.PostCommitBudgetMilliseconds, 1500, 2000);

        var serverRoot = FindServerRoot();
        var controller = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net.Api",
            "Controllers",
            "ApiEngineController.cs"));
        var matches = Regex.Matches(
            controller,
            @"await\s+MicroiEngine\.ApiEngine\.RunAsync\(param\);\s*await\s+PublishRealtimeInvalidationAfterCommitAsync\(result,\s*param\);");
        Assert.Equal(5, matches.Count);
        Assert.Contains("GameRealtimeRuntime.PublishAfterCommitWithinBudgetAsync(", controller);
        Assert.DoesNotContain("GameRealtimeRuntime.PublishAfterCommitAsync(", controller);
        Assert.DoesNotMatch(
            @"result\s*=\s*await\s+GameRealtimeRuntime\.PublishAfterCommit",
            controller);

        var hubSource = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net.Api",
            "Handler",
            "GameRealtimeHub.cs"));
        Assert.Contains("[\"Command\"] = GameRealtimeRuntime.AuthorizeCommandName", hubSource);
        Assert.DoesNotContain("[\"Action\"] = \"AuthorizeRealtime\"", hubSource);
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
