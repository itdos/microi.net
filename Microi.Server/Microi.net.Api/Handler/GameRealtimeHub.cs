using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 游戏房间低延迟失效通知 Hub。这里不处理发牌、出牌、结算，也不向客户端发送
    /// 私密牌面；所有业务授权和权威状态仍由对应 app_*_gateway 接口引擎决定。
    /// </summary>
    [EnableCors("any")]
    public sealed class GameRealtimeHub : Hub
    {
        private const string IdentityItemKey = "Microi.GameRealtime.Identity";
        private const string GroupsItemKey = "Microi.GameRealtime.Groups";
        private const int MaximumGroupsPerConnection = 8;

        public override async Task OnConnectedAsync()
        {
            var identity = await ResolveIdentityAsync().ConfigureAwait(false);
            if (identity == null)
            {
                Context.Abort();
                return;
            }

            Context.Items[IdentityItemKey] = identity;
            Context.Items[GroupsItemKey] = new HashSet<string>(StringComparer.Ordinal);
            await base.OnConnectedAsync().ConfigureAwait(false);
        }

        /// <summary>
        /// 订阅房间。客户端只能提供房间定位信息，OsClient 和 CurrentUser 始终来自
        /// 当前有效登录 Token；成员资格由 gateway 的 AuthorizeRealtime 动作验证。
        /// </summary>
        public async Task<GameRealtimeSubscriptionResult> SubscribeGameRoom(
            GameRealtimeSubscriptionRequest request)
        {
            var identity = await ResolveIdentityAsync().ConfigureAwait(false);
            if (identity == null)
            {
                throw new HubException("登录身份已失效，请重新登录。");
            }

            if (!GameRealtimeRuntime.TryNormalizeSubscription(request, out var normalized, out _))
            {
                throw new HubException("房间实时订阅参数无效。");
            }

            var groupName = GameRealtimeRuntime.BuildGroupName(
                identity.OsClient,
                normalized.AppKey,
                normalized.RoomId);
            var groups = GetConnectionGroups();
            lock (groups)
            {
                if (!groups.Contains(groupName) && groups.Count >= MaximumGroupsPerConnection)
                {
                    throw new HubException("单个连接订阅的房间数量已达到上限。");
                }
            }

            var authorizationResult = await AuthorizeWithGatewayAsync(identity, normalized)
                .ConfigureAwait(false);
            if (!GameRealtimeRuntime.TryValidateAuthorizationResponse(
                    authorizationResult,
                    normalized,
                    out var version))
            {
                throw new HubException("您不是该房间成员，或房间已失效。");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, groupName)
                .ConfigureAwait(false);
            lock (groups)
            {
                groups.Add(groupName);
            }

            var latest = await GameRealtimeRuntime.GetLatestAsync(
                    identity.OsClient,
                    normalized.AppKey,
                    normalized.RoomId)
                .ConfigureAwait(false);
            return new GameRealtimeSubscriptionResult
            {
                AppKey = normalized.AppKey,
                RoomId = normalized.RoomId,
                Version = Math.Max(version, latest?.Version ?? 0),
                Latest = latest
            };
        }

        public async Task UnsubscribeGameRoom(GameRealtimeSubscriptionRequest request)
        {
            var identity = await ResolveIdentityAsync().ConfigureAwait(false);
            if (identity == null
                || !GameRealtimeRuntime.TryNormalizeSubscription(request, out var normalized, out _))
            {
                return;
            }

            var groupName = GameRealtimeRuntime.BuildGroupName(
                identity.OsClient,
                normalized.AppKey,
                normalized.RoomId);
            var groups = GetConnectionGroups();
            var subscribed = false;
            lock (groups)
            {
                subscribed = groups.Remove(groupName);
            }
            if (subscribed)
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName)
                    .ConfigureAwait(false);
            }
        }

        private async Task<object> AuthorizeWithGatewayAsync(
            GameRealtimeIdentity identity,
            GameRealtimeSubscriptionRequest request)
        {
            if (!(MicroiEngine.ApiEngine is IBackgroundTaskApiEngineRunner trustedRunner))
            {
                throw new HubException("实时订阅服务尚未就绪。");
            }

            // 该 CurrentUser 是 Hub 根据当前有效 Token 从共享 Redis 会话中恢复的，
            // 客户端请求体中的任何 UserId/_CurrentUser/OsClient 都不会进入此调用。
            var param = new JObject
            {
                ["ApiEngineKey"] = request.GatewayKey,
                ["OsClient"] = identity.OsClient,
                ["Command"] = GameRealtimeRuntime.AuthorizeCommandName,
                ["AppKey"] = request.AppKey,
                ["RoomId"] = request.RoomId,
                ["_InvokeType"] = InvokeType.Client.ToString()
            };
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(
                Context.ConnectionAborted);
            timeout.CancelAfter(TimeSpan.FromSeconds(8));
            try
            {
                return await trustedRunner.RunBackgroundAsync(
                        param,
                        (JObject)identity.CurrentUser.DeepClone(),
                        timeout.Token)
                    .ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                throw new HubException("房间成员校验超时，请稍后重试。");
            }
            catch (HubException)
            {
                throw;
            }
            catch
            {
                throw new HubException("暂时无法校验房间成员身份，请稍后重试。");
            }
        }

        private HashSet<string> GetConnectionGroups()
        {
            if (Context.Items.TryGetValue(GroupsItemKey, out var value)
                && value is HashSet<string> groups)
            {
                return groups;
            }

            groups = new HashSet<string>(StringComparer.Ordinal);
            Context.Items[GroupsItemKey] = groups;
            return groups;
        }

        private async Task<GameRealtimeIdentity> ResolveIdentityAsync()
        {
            var httpContext = Context.GetHttpContext();
            var token = ReadAccessToken(httpContext);
            if (token.DosIsNullOrWhiteSpace()) return null;

            var currentToken = await DiyToken.GetCurrentToken(token).ConfigureAwait(false);
            var userId = currentToken?.CurrentUser?["Id"]?.ToString();
            if (currentToken?.CurrentUser == null
                || currentToken.OsClient.DosIsNullOrWhiteSpace()
                || userId.DosIsNullOrWhiteSpace())
            {
                return null;
            }

            return new GameRealtimeIdentity
            {
                OsClient = currentToken.OsClient,
                UserId = userId,
                CurrentUser = currentToken.CurrentUser
            };
        }

        private static string ReadAccessToken(HttpContext httpContext)
        {
            var token = httpContext?.Request.Query["access_token"].ToString();
            if (token.DosIsNullOrWhiteSpace())
            {
                token = httpContext?.Request.Headers["Authorization"].FirstOrDefault();
            }
            if (token.DosIsNullOrWhiteSpace()) return string.Empty;
            token = token.Trim();
            if (token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                token = token.Substring("Bearer ".Length).Trim();
            }
            return token.Length <= 8192 ? token : string.Empty;
        }

        private sealed class GameRealtimeIdentity
        {
            public string OsClient { get; set; }
            public string UserId { get; set; }
            public JObject CurrentUser { get; set; }
        }
    }
}
