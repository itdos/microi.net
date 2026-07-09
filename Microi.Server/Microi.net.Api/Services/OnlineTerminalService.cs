using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    public static class OnlineTerminalService
    {
        private const string TokenConnectionPrefix = "token:";
        private static IHubContext<DiyWebSocket> _hubContext;

        public static void ConfigureHubContext(IHubContext<DiyWebSocket> hubContext)
        {
            _hubContext = hubContext;
        }

        public static async Task TrackConnectedAsync(
            string osClient,
            JObject currentUser,
            string connectionId,
            HttpContext httpContext,
            IEnumerable<Claim> claims,
            string groupName,
            string otherInfo,
            string deviceClientId,
            string token)
        {
            if (osClient.DosIsNullOrWhiteSpace() || currentUser == null || connectionId.DosIsNullOrWhiteSpace())
            {
                return;
            }

            var userId = currentUser["Id"]?.Val<string>() ?? "";
            if (userId.DosIsNullOrWhiteSpace())
            {
                return;
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var onlineKey = GetOnlineHashKey(osClient);
            var chatKey = GetChatOnlineKey(osClient, userId);
            var clientInfo = await cache.GetAsync<ClientInfo>(chatKey).ConfigureAwait(false)
                             ?? cache.HashGet<ClientInfo>(onlineKey, userId)
                             ?? new ClientInfo
                             {
                                 UserId = userId,
                                 ConnectedTime = DateTime.Now,
                             };

            var name = currentUser["Name"]?.Val<string>() ?? "";
            var account = currentUser["Account"]?.Val<string>() ?? "";
            var avatar = currentUser["Avatar"]?.Val<string>() ?? "";
            var level = currentUser["Level"]?.Val<int>() ?? 0;
            var clientType = claims?.FirstOrDefault(d => d.Type == "ClientType")?.Value;
            var did = claims?.FirstOrDefault(d => d.Type == "Did")?.Value;
            var claimIp = claims?.FirstOrDefault(d => d.Type == "IP")?.Value;
            var ip = httpContext?.Connection?.RemoteIpAddress?.ToString();
            if (ip.DosIsNullOrWhiteSpace())
            {
                ip = claimIp;
            }

            clientInfo.UserId = userId;
            clientInfo.UserName = name.DosIsNullOrWhiteSpace() ? account : name;
            clientInfo.Account = account;
            clientInfo.Level = level;
            clientInfo.UserAvatar = avatar;
            clientInfo.GroupName = groupName;
            clientInfo.OtherInfo = otherInfo;
            clientInfo.Ip = ip;
            clientInfo.DeviceClientId = deviceClientId;
            clientInfo.LastConnectionId = connectionId;
            clientInfo.ConnectionIds ??= new List<string>();
            clientInfo.ConnectionIds.Remove(connectionId);
            clientInfo.ConnectionIds.Insert(0, connectionId);
            clientInfo.ConnectionIds = clientInfo.ConnectionIds.Take(20).ToList();
            clientInfo.Terminals ??= new List<ClientTerminalInfo>();
            var tokenHash = HashToken(token);
            if (!tokenHash.DosIsNullOrWhiteSpace())
            {
                clientInfo.Terminals.RemoveAll(d =>
                    string.Equals(d.TokenHash, tokenHash, StringComparison.OrdinalIgnoreCase)
                    && IsTokenConnectionId(d.ConnectionId));
            }
            clientInfo.Terminals.RemoveAll(d => d.ConnectionId == connectionId);
            clientInfo.Terminals.Insert(0, new ClientTerminalInfo
            {
                ConnectionId = connectionId,
                DeviceClientId = deviceClientId,
                ClientType = clientType.DosIsNullOrWhiteSpace("PC"),
                Did = did.DosIsNullOrWhiteSpace(deviceClientId.DosIsNullOrWhiteSpace("Empty")),
                Ip = ip,
                UserAgent = httpContext?.Request?.Headers["User-Agent"].ToString() ?? "",
                OtherInfo = otherInfo,
                TokenHash = tokenHash,
                ConnectedTime = DateTime.Now,
                LastActiveTime = DateTime.Now,
            });
            clientInfo.Terminals = clientInfo.Terminals.Take(20).ToList();

            await SaveClientInfoAsync(cache, osClient, clientInfo).ConfigureAwait(false);
            await NotifyOnlineChangedAsync(osClient, clientInfo.UserId).ConfigureAwait(false);
        }

        public static async Task TrackDisconnectedAsync(string osClient, string userId, string connectionId)
        {
            if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace() || connectionId.DosIsNullOrWhiteSpace())
            {
                return;
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var clientInfo = await cache.GetAsync<ClientInfo>(GetChatOnlineKey(osClient, userId)).ConfigureAwait(false)
                             ?? cache.HashGet<ClientInfo>(GetOnlineHashKey(osClient), userId);
            if (clientInfo == null)
            {
                return;
            }

            clientInfo.ConnectionIds ??= new List<string>();
            clientInfo.Terminals ??= new List<ClientTerminalInfo>();
            clientInfo.ConnectionIds.Remove(connectionId);
            clientInfo.Terminals.RemoveAll(d => d.ConnectionId == connectionId);
            if (clientInfo.LastConnectionId == connectionId)
            {
                clientInfo.LastConnectionId = clientInfo.ConnectionIds.FirstOrDefault();
            }

            if (clientInfo.ConnectionIds.Count == 0 && clientInfo.Terminals.Count == 0)
            {
                await cache.RemoveAsync(GetChatOnlineKey(osClient, userId)).ConfigureAwait(false);
                cache.HashDelete(GetOnlineHashKey(osClient), userId);
            }
            else
            {
                await SaveClientInfoAsync(cache, osClient, clientInfo).ConfigureAwait(false);
            }

            await NotifyOnlineChangedAsync(osClient, userId).ConfigureAwait(false);
        }

        public static async Task TrackTokenActiveAsync(
            string osClient,
            CurrentToken tokenModel,
            TokensModel activeTokenEntry,
            HttpContext httpContext,
            IEnumerable<Claim> claims,
            string requestToken)
        {
            if (osClient.DosIsNullOrWhiteSpace() || tokenModel?.CurrentUser == null)
            {
                return;
            }

            var currentUser = tokenModel.CurrentUser;
            var userId = currentUser["Id"]?.Val<string>() ?? "";
            if (userId.DosIsNullOrWhiteSpace())
            {
                return;
            }

            var tokenEntries = tokenModel.Tokens?
                .Where(d => d != null
                            && string.Equals(d.AuthVersion, DiyToken.CurrentAuthVersion, StringComparison.Ordinal)
                            && !d.Token.DosIsNullOrWhiteSpace())
                .ToList() ?? new List<TokensModel>();
            if (activeTokenEntry != null
                && !activeTokenEntry.Token.DosIsNullOrWhiteSpace()
                && !tokenEntries.Any(d => string.Equals(d.Token, activeTokenEntry.Token, StringComparison.Ordinal)))
            {
                tokenEntries.Add(activeTokenEntry);
            }
            if (tokenEntries.Count == 0)
            {
                return;
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var onlineKey = GetOnlineHashKey(osClient);
            var chatKey = GetChatOnlineKey(osClient, userId);
            var clientInfo = await cache.GetAsync<ClientInfo>(chatKey).ConfigureAwait(false)
                             ?? cache.HashGet<ClientInfo>(onlineKey, userId)
                             ?? new ClientInfo
                             {
                                 UserId = userId,
                                 ConnectedTime = DateTime.Now,
                             };

            var name = currentUser["Name"]?.Val<string>() ?? "";
            var account = currentUser["Account"]?.Val<string>() ?? "";
            var avatar = currentUser["Avatar"]?.Val<string>() ?? "";
            var level = currentUser["Level"]?.Val<int>() ?? 0;
            var requestTokenHash = HashToken(requestToken.DosTrim().DosReplace("Bearer ", ""));
            var requestIp = httpContext?.Connection?.RemoteIpAddress?.ToString();
            var requestUserAgent = httpContext?.Request?.Headers["User-Agent"].ToString() ?? "";
            var requestDid = httpContext?.Request?.Headers["did"].ToString();
            var claimDid = claims?.FirstOrDefault(d => d.Type == "Did")?.Value;
            var claimIp = claims?.FirstOrDefault(d => d.Type == "IP")?.Value;
            var claimClientType = claims?.FirstOrDefault(d => d.Type == "ClientType")?.Value;

            clientInfo.UserId = userId;
            clientInfo.UserName = name.DosIsNullOrWhiteSpace() ? account : name;
            clientInfo.Account = account;
            clientInfo.Level = level;
            clientInfo.UserAvatar = avatar;
            clientInfo.Ip = requestIp.DosIsNullOrWhiteSpace(claimIp);
            clientInfo.Terminals ??= new List<ClientTerminalInfo>();

            var activeHashes = tokenEntries
                .Select(d => HashToken(d.Token))
                .Where(d => !d.DosIsNullOrWhiteSpace())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            clientInfo.Terminals.RemoveAll(d =>
                IsTokenConnectionId(d.ConnectionId)
                && !d.TokenHash.DosIsNullOrWhiteSpace()
                && !activeHashes.Contains(d.TokenHash));

            foreach (var tokenEntry in tokenEntries)
            {
                var tokenHash = HashToken(tokenEntry.Token);
                if (tokenHash.DosIsNullOrWhiteSpace())
                {
                    continue;
                }

                var liveTerminal = clientInfo.Terminals.FirstOrDefault(d =>
                    !IsTokenConnectionId(d.ConnectionId)
                    && string.Equals(d.TokenHash, tokenHash, StringComparison.OrdinalIgnoreCase));
                var isCurrentRequest = string.Equals(tokenHash, requestTokenHash, StringComparison.OrdinalIgnoreCase);
                var clientType = tokenEntry.ClientType.DosIsNullOrWhiteSpace(claimClientType.DosIsNullOrWhiteSpace("PC"));
                var did = tokenEntry.Did.DosIsNullOrWhiteSpace(
                    (isCurrentRequest ? requestDid : "").DosIsNullOrWhiteSpace(claimDid.DosIsNullOrWhiteSpace("Empty")));
                var ip = tokenEntry.IP.DosIsNullOrWhiteSpace(isCurrentRequest ? requestIp.DosIsNullOrWhiteSpace(claimIp) : "");
                var lastActiveTime = isCurrentRequest ? DateTime.Now : (tokenEntry.UpdateTime == default ? tokenEntry.CreateTime : tokenEntry.UpdateTime);

                if (liveTerminal != null)
                {
                    liveTerminal.DeviceClientId = liveTerminal.DeviceClientId.DosIsNullOrWhiteSpace(did);
                    liveTerminal.ClientType = clientType;
                    liveTerminal.Did = did;
                    liveTerminal.Ip = ip.DosIsNullOrWhiteSpace(liveTerminal.Ip);
                    if (isCurrentRequest && !requestUserAgent.DosIsNullOrWhiteSpace())
                    {
                        liveTerminal.UserAgent = requestUserAgent;
                    }
                    liveTerminal.LastActiveTime = lastActiveTime;
                    continue;
                }

                var tokenConnectionId = GetTokenConnectionId(tokenHash);
                var tokenTerminal = clientInfo.Terminals.FirstOrDefault(d => d.ConnectionId == tokenConnectionId);
                if (tokenTerminal == null)
                {
                    tokenTerminal = new ClientTerminalInfo
                    {
                        ConnectionId = tokenConnectionId,
                        ConnectedTime = tokenEntry.CreateTime == default ? DateTime.Now : tokenEntry.CreateTime,
                    };
                    clientInfo.Terminals.Insert(0, tokenTerminal);
                }

                tokenTerminal.DeviceClientId = did;
                tokenTerminal.ClientType = clientType;
                tokenTerminal.Did = did;
                tokenTerminal.Ip = ip;
                tokenTerminal.UserAgent = isCurrentRequest ? requestUserAgent : tokenTerminal.UserAgent;
                tokenTerminal.TokenHash = tokenHash;
                tokenTerminal.LastActiveTime = lastActiveTime;
            }

            clientInfo.Terminals = clientInfo.Terminals
                .OrderByDescending(d => d.LastActiveTime)
                .Take(20)
                .ToList();

            await SaveClientInfoAsync(cache, osClient, clientInfo).ConfigureAwait(false);
        }

        public static List<object> ListOnlineUsers(string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new List<object>();
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var list = cache.HashGetAllValues<ClientInfo>(GetOnlineHashKey(osClient)) ?? new List<ClientInfo>();
            return list
                .Where(d => d != null && !d.UserId.DosIsNullOrWhiteSpace() && (d.ConnectionIds?.Count > 0 || d.Terminals?.Count > 0))
                .OrderByDescending(d => d.Terminals?.Max(t => t.LastActiveTime) ?? d.ConnectedTime)
                .Select(ToUserView)
                .ToList();
        }

        public static object GetUserTerminals(string osClient, string userId)
        {
            if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace())
            {
                return new { Terminals = new List<object>() };
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var clientInfo = cache.Get<ClientInfo>(GetChatOnlineKey(osClient, userId))
                             ?? cache.HashGet<ClientInfo>(GetOnlineHashKey(osClient), userId);
            return clientInfo == null
                ? new { Terminals = new List<object>() }
                : ToUserView(clientInfo);
        }

        public static async Task<DosResult> KickTerminalAsync(string osClient, JObject operatorUser, string targetUserId, string connectionId)
        {
            var operatorUserId = operatorUser?["Id"]?.Val<string>() ?? "";
            var operatorLevel = operatorUser?["Level"]?.Val<int>() ?? 0;
            if (operatorUserId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(1001, null, "登录身份已过期");
            }
            if (targetUserId.DosIsNullOrWhiteSpace())
            {
                targetUserId = operatorUserId;
            }
            if (operatorUserId != targetUserId && operatorLevel < 9999)
            {
                return new DosResult(0, null, "无权踢掉其它用户终端");
            }
            if (connectionId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "连接Id不能为空");
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var clientInfo = await cache.GetAsync<ClientInfo>(GetChatOnlineKey(osClient, targetUserId)).ConfigureAwait(false)
                             ?? cache.HashGet<ClientInfo>(GetOnlineHashKey(osClient), targetUserId);
            if (clientInfo == null)
            {
                return new DosResult(0, null, "该终端已离线");
            }

            clientInfo.ConnectionIds ??= new List<string>();
            clientInfo.Terminals ??= new List<ClientTerminalInfo>();
            var targetTerminal = clientInfo.Terminals.FirstOrDefault(d => d.ConnectionId == connectionId);
            if (targetTerminal == null && !clientInfo.ConnectionIds.Contains(connectionId))
            {
                return new DosResult(0, null, "未找到该终端连接");
            }

            await RemoveLoginTokenAsync(cache, osClient, targetUserId, targetTerminal).ConfigureAwait(false);
            if (!IsTokenConnectionId(connectionId))
            {
                await SendForceLogoutAsync(connectionId, "该终端已被管理员下线，请重新登录。").ConfigureAwait(false);
            }

            clientInfo.ConnectionIds.Remove(connectionId);
            clientInfo.Terminals.RemoveAll(d => d.ConnectionId == connectionId);
            if (clientInfo.LastConnectionId == connectionId)
            {
                clientInfo.LastConnectionId = clientInfo.ConnectionIds.FirstOrDefault();
            }

            if (clientInfo.ConnectionIds.Count == 0 && clientInfo.Terminals.Count == 0)
            {
                await cache.RemoveAsync(GetChatOnlineKey(osClient, targetUserId)).ConfigureAwait(false);
                cache.HashDelete(GetOnlineHashKey(osClient), targetUserId);
            }
            else
            {
                await SaveClientInfoAsync(cache, osClient, clientInfo).ConfigureAwait(false);
            }

            await NotifyOnlineChangedAsync(osClient, targetUserId).ConfigureAwait(false);
            return new DosResult(1, null, "已踢掉该终端");
        }

        private static async Task SaveClientInfoAsync(IMicroiCache cache, string osClient, ClientInfo clientInfo)
        {
            if (clientInfo?.UserId.DosIsNullOrWhiteSpace() != false)
            {
                return;
            }
            await cache.SetAsync(GetChatOnlineKey(osClient, clientInfo.UserId), clientInfo).ConfigureAwait(false);
            cache.HashSet(GetOnlineHashKey(osClient), clientInfo.UserId, clientInfo);
        }

        private static async Task RemoveLoginTokenAsync(IMicroiCache cache, string osClient, string userId, ClientTerminalInfo terminal)
        {
            var tokenModel = await cache.GetAsync<CurrentToken>($"Microi:{osClient}:LoginTokenSysUser:{userId}").ConfigureAwait(false);
            if (tokenModel?.Tokens == null || tokenModel.Tokens.Count == 0)
            {
                return;
            }

            var before = tokenModel.Tokens.Count;
            tokenModel.Tokens.RemoveAll(d =>
            {
                if (terminal == null)
                {
                    return false;
                }
                var sameToken = !terminal.TokenHash.DosIsNullOrWhiteSpace()
                                && string.Equals(HashToken(d.Token), terminal.TokenHash, StringComparison.OrdinalIgnoreCase);
                var sameDevice = !terminal.Did.DosIsNullOrWhiteSpace()
                                 && string.Equals(d.Did, terminal.Did, StringComparison.OrdinalIgnoreCase)
                                 && string.Equals(d.ClientType.DosIsNullOrWhiteSpace("PC"), terminal.ClientType.DosIsNullOrWhiteSpace("PC"), StringComparison.OrdinalIgnoreCase);
                return sameToken || sameDevice;
            });

            if (tokenModel.Tokens.Count != before)
            {
                tokenModel.UpdateTime = DateTime.Now;
                if (tokenModel.Tokens.Count > 0)
                {
                    tokenModel.Token = tokenModel.Tokens[0].Token;
                    await cache.SetAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}", tokenModel).ConfigureAwait(false);
                }
                else
                {
                    await cache.RemoveAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}").ConfigureAwait(false);
                }
            }
        }

        private static async Task NotifyOnlineChangedAsync(string osClient, string changedUserId)
        {
            if (_hubContext == null || osClient.DosIsNullOrWhiteSpace())
            {
                return;
            }

            var users = ListRawOnlineUsers(osClient);
            var adminConnections = users
                .Where(d => d.Level >= 9999)
                .SelectMany(d => d.ConnectionIds ?? new List<string>())
                .Distinct()
                .ToList();
            var changedConnections = users
                .Where(d => d.UserId == changedUserId)
                .SelectMany(d => d.ConnectionIds ?? new List<string>())
                .Distinct()
                .ToList();
            var targetConnections = adminConnections.Concat(changedConnections).Distinct().ToList();
            if (targetConnections.Count == 0)
            {
                return;
            }

            await _hubContext.Clients.Clients(targetConnections).SendAsync("ReceiveOnlineTerminalChanged", new
            {
                OnlineUserCount = users.Count,
                ChangedUserId = changedUserId,
                UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
            }).ConfigureAwait(false);
        }

        private static async Task SendForceLogoutAsync(string connectionId, string reason)
        {
            if (_hubContext == null || connectionId.DosIsNullOrWhiteSpace())
            {
                return;
            }
            await _hubContext.Clients.Client(connectionId).SendAsync("ReceiveForceLogout", new
            {
                Reason = reason,
                Time = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
            }).ConfigureAwait(false);
        }

        private static List<ClientInfo> ListRawOnlineUsers(string osClient)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            return (cache.HashGetAllValues<ClientInfo>(GetOnlineHashKey(osClient)) ?? new List<ClientInfo>())
                .Where(d => d != null && !d.UserId.DosIsNullOrWhiteSpace() && (d.ConnectionIds?.Count > 0 || d.Terminals?.Count > 0))
                .ToList();
        }

        private static object ToUserView(ClientInfo clientInfo)
        {
            return new
            {
                clientInfo.UserId,
                clientInfo.UserName,
                clientInfo.Account,
                clientInfo.Level,
                clientInfo.UserAvatar,
                clientInfo.Ip,
                OnlineCount = clientInfo.Terminals?.Count ?? clientInfo.ConnectionIds?.Count ?? 0,
                LastActiveTime = clientInfo.Terminals?.OrderByDescending(d => d.LastActiveTime).FirstOrDefault()?.LastActiveTime,
                Terminals = (clientInfo.Terminals ?? new List<ClientTerminalInfo>())
                    .OrderByDescending(d => d.LastActiveTime)
                    .Select(ToTerminalView)
                    .ToList()
            };
        }

        private static object ToTerminalView(ClientTerminalInfo item)
        {
            return new
            {
                item.ConnectionId,
                item.DeviceClientId,
                item.ClientType,
                item.Did,
                item.Ip,
                item.UserAgent,
                item.OtherInfo,
                item.ConnectedTime,
                item.LastActiveTime
            };
        }

        private static string GetOnlineHashKey(string osClient) => $"Microi:{osClient}:OnlineUsers";

        private static string GetChatOnlineKey(string osClient, string userId) => $"Microi:{osClient}:ChatOnline:{userId}";

        private static string GetTokenConnectionId(string tokenHash) => $"{TokenConnectionPrefix}{tokenHash}";

        private static bool IsTokenConnectionId(string connectionId)
        {
            return !connectionId.DosIsNullOrWhiteSpace()
                   && connectionId.StartsWith(TokenConnectionPrefix, StringComparison.OrdinalIgnoreCase);
        }

        private static string HashToken(string token)
        {
            if (token.DosIsNullOrWhiteSpace())
            {
                return "";
            }
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(token)));
        }
    }
}
