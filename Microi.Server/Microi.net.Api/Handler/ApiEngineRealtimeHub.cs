using System;
using System.Collections.Generic;
using System.Linq;
using System.IdentityModel.Tokens.Jwt;
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
    /// 接口引擎通用 SignalR Hub。这里只负责可信登录身份、授权接口引擎调用和群组运输；
    /// 业务状态、订阅资格及 Snapshot 均由接口引擎实现。
    /// </summary>
    [EnableCors("any")]
    public sealed class ApiEngineRealtimeHub : Hub
    {
        private const string IdentityItemKey = "Microi.ApiEngineRealtime.Identity";
        private const string GroupsItemKey = "Microi.ApiEngineRealtime.Groups";
        private const int MaximumGroupsPerConnection = 16;

        public override async Task OnConnectedAsync()
        {
            var identity = await ResolveIdentityAsync().ConfigureAwait(false);
            if (identity == null)
            {
                Context.Abort();
                return;
            }

            Context.Items[IdentityItemKey] = identity;
            Context.Items[GroupsItemKey] = new Dictionary<string, HashSet<string>>(
                StringComparer.Ordinal);
            await base.OnConnectedAsync().ConfigureAwait(false);
        }

        /// <summary>
        /// 客户端只传 ChannelKey 和 SubjectId。授权接口由服务端约定解析为
        /// realtime_{channel_key}_authorize，不能通过请求切换到任意 ApiEngineKey。
        /// </summary>
        public async Task<ApiEngineRealtimeSubscriptionResult> SubscribeChannel(
            ApiEngineRealtimeSubscriptionRequest request)
        {
            var identity = await ResolveIdentityAsync().ConfigureAwait(false);
            if (identity == null)
            {
                await RemoveAllSubscriptionGroupsAsync().ConfigureAwait(false);
                Context.Abort();
                throw new HubException("登录身份已失效，请重新登录。");
            }

            if (!ApiEngineRealtimeRuntime.TryNormalizeSubscription(
                    request,
                    out var normalized,
                    out _))
            {
                throw new HubException("实时频道订阅参数无效。");
            }

            var groupName = ApiEngineRealtimeRuntime.BuildGroupName(
                identity.OsClient,
                normalized.ChannelKey,
                normalized.SubjectId);
            var groups = GetConnectionGroups();
            lock (groups)
            {
                if (!groups.ContainsKey(groupName) && groups.Count >= MaximumGroupsPerConnection)
                {
                    throw new HubException("单个连接订阅的实时频道数量已达到上限。");
                }
            }

            bool authorizationSlotAcquired;
            try
            {
                authorizationSlotAcquired = await ApiEngineRealtimeRuntime
                    .TryAcquireSubscriptionAuthorizationSlotAsync(
                        identity.OsClient,
                        identity.UserId)
                    .ConfigureAwait(false);
            }
            catch
            {
                throw new HubException("实时订阅保护服务暂不可用，请稍后重试。");
            }
            if (!authorizationSlotAcquired)
            {
                throw new HubException("实时频道订阅过于频繁，请稍后重试。");
            }

            var authorizationResult = await AuthorizeWithApiEngineAsync(identity, normalized)
                .ConfigureAwait(false);
            if (!ApiEngineRealtimeRuntime.TryValidateAuthorizationResponse(
                    authorizationResult,
                    normalized,
                    out var version))
            {
                await RemoveSubscriptionGroupsAsync(groupName).ConfigureAwait(false);
                throw new HubException("您无权订阅该实时频道，或目标资源已失效。");
            }

            var now = DateTimeOffset.UtcNow;
            var renewedGroups = new HashSet<string>(
                ApiEngineRealtimeRuntime.BuildSubscriptionLeaseGroups(groupName, now),
                StringComparer.Ordinal);
            HashSet<string> previousGroups;
            lock (groups)
            {
                previousGroups = groups.TryGetValue(groupName, out var existing)
                    ? new HashSet<string>(existing, StringComparer.Ordinal)
                    : new HashSet<string>(StringComparer.Ordinal);
            }
            foreach (var renewedGroup in renewedGroups)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, renewedGroup)
                    .ConfigureAwait(false);
            }
            foreach (var expiredGroup in previousGroups.Except(renewedGroups))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, expiredGroup)
                    .ConfigureAwait(false);
            }
            lock (groups)
            {
                groups[groupName] = renewedGroups;
            }

            var latest = await ApiEngineRealtimeRuntime.GetLatestAsync(
                    identity.OsClient,
                    normalized.ChannelKey,
                    normalized.SubjectId)
                .ConfigureAwait(false);
            return new ApiEngineRealtimeSubscriptionResult
            {
                ChannelKey = normalized.ChannelKey,
                SubjectId = normalized.SubjectId,
                Version = Math.Max(version, latest?.Version ?? 0),
                Latest = latest,
                RenewAfterMilliseconds =
                    ApiEngineRealtimeRuntime.SubscriptionRenewAfterMilliseconds,
                LeaseExpiresAt = ApiEngineRealtimeRuntime
                    .GetSubscriptionLeaseExpiry(now)
                    .ToString("O")
            };
        }

        public async Task UnsubscribeChannel(ApiEngineRealtimeSubscriptionRequest request)
        {
            var identity = await ResolveIdentityAsync().ConfigureAwait(false);
            if (identity == null
                || !ApiEngineRealtimeRuntime.TryNormalizeSubscription(
                    request,
                    out var normalized,
                    out _))
            {
                return;
            }

            var groupName = ApiEngineRealtimeRuntime.BuildGroupName(
                identity.OsClient,
                normalized.ChannelKey,
                normalized.SubjectId);
            await RemoveSubscriptionGroupsAsync(groupName).ConfigureAwait(false);
        }

        private async Task<object> AuthorizeWithApiEngineAsync(
            ApiEngineRealtimeIdentity identity,
            ApiEngineRealtimeSubscriptionRequest request)
        {
            if (!(MicroiEngine.ApiEngine is IBackgroundTaskApiEngineRunner trustedRunner))
            {
                throw new HubException("实时订阅服务尚未就绪。");
            }

            var authorizationApiEngineKey =
                ApiEngineRealtimeRuntime.ResolveAuthorizationApiEngineKey(request.ChannelKey);
            // OsClient、CurrentUser 和授权接口 Key 均由服务端生成。客户端请求中的
            // UserId/_CurrentUser/OsClient/GatewayKey/ApiEngineKey 不会进入此调用。
            var param = new JObject
            {
                ["ApiEngineKey"] = authorizationApiEngineKey,
                ["OsClient"] = identity.OsClient,
                ["Command"] = ApiEngineRealtimeRuntime.AuthorizeCommandName,
                ["ChannelKey"] = request.ChannelKey,
                ["SubjectId"] = request.SubjectId,
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
                throw new HubException("实时频道授权校验超时，请稍后重试。");
            }
            catch (HubException)
            {
                throw;
            }
            catch
            {
                throw new HubException("暂时无法校验实时频道权限，请稍后重试。");
            }
        }

        private Dictionary<string, HashSet<string>> GetConnectionGroups()
        {
            if (Context.Items.TryGetValue(GroupsItemKey, out var value)
                && value is Dictionary<string, HashSet<string>> groups)
            {
                return groups;
            }

            groups = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
            Context.Items[GroupsItemKey] = groups;
            return groups;
        }

        private async Task RemoveSubscriptionGroupsAsync(string baseGroupName)
        {
            var groups = GetConnectionGroups();
            HashSet<string> physicalGroups;
            lock (groups)
            {
                if (!groups.TryGetValue(baseGroupName, out var existing)) return;
                physicalGroups = new HashSet<string>(existing, StringComparer.Ordinal);
                groups.Remove(baseGroupName);
            }
            foreach (var physicalGroup in physicalGroups)
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, physicalGroup)
                    .ConfigureAwait(false);
            }
        }

        private async Task RemoveAllSubscriptionGroupsAsync()
        {
            var groups = GetConnectionGroups();
            string[] physicalGroups;
            lock (groups)
            {
                physicalGroups = groups.Values
                    .SelectMany(value => value)
                    .Distinct(StringComparer.Ordinal)
                    .ToArray();
                groups.Clear();
            }
            foreach (var physicalGroup in physicalGroups)
            {
                try
                {
                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, physicalGroup)
                        .ConfigureAwait(false);
                }
                catch
                {
                    // 连接可能已同时断开；SignalR 会清理其剩余群组成员关系。
                }
            }
        }

        private async Task<ApiEngineRealtimeIdentity> ResolveIdentityAsync()
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

            // API AccessKey 的现有权限模型没有 realtime:subscribe scope。直接拒绝，
            // 避免 Hub 绕过 HTTP DiyFilter 的路径与 AllowedApiEngineKeys 精确白名单。
            if (UserAccessKeySecurity.IsSession(currentToken.CurrentUser)) return null;

            JwtSecurityToken jwtToken;
            try
            {
                jwtToken = new JwtSecurityTokenHandler().ReadJwtToken(
                    token.Replace("Bearer ", string.Empty));
            }
            catch
            {
                return null;
            }
            if (jwtToken.ValidTo != DateTime.MinValue && jwtToken.ValidTo < DateTime.UtcNow)
                return null;
            var clientType = jwtToken.Claims
                .FirstOrDefault(claim => claim.Type == "ClientType")?.Value;
            var activeTokenEntry = DiyToken.GetActiveCachedTokenEntry(currentToken, token);
            if (activeTokenEntry == null) return null;
            var clientModel = OsClient.GetClient(currentToken.OsClient);
            var activeTokenUpdateTime = activeTokenEntry.UpdateTime == default
                ? currentToken.UpdateTime
                : activeTokenEntry.UpdateTime;
            if (activeTokenUpdateTime != default
                && DateTime.Now - activeTokenUpdateTime
                > DiyToken.ResolveClientTokenLifetime(clientModel, clientType))
            {
                return null;
            }

            return new ApiEngineRealtimeIdentity
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

        private sealed class ApiEngineRealtimeIdentity
        {
            public string OsClient { get; set; }
            public string UserId { get; set; }
            public JObject CurrentUser { get; set; }
        }
    }
}
