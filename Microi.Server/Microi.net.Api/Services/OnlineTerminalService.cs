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
            var clientModel = OsClient.GetClient(osClient);
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
            var clientTypeValue = clientType.DosIsNullOrWhiteSpace("PC");
            var didValue = did.DosIsNullOrWhiteSpace(deviceClientId.DosIsNullOrWhiteSpace("Empty"));
            if (!tokenHash.DosIsNullOrWhiteSpace())
            {
                clientInfo.Terminals.RemoveAll(d => string.Equals(d.TokenHash, tokenHash, StringComparison.OrdinalIgnoreCase));
            }
            if (IsMeaningfulDid(didValue))
            {
                clientInfo.Terminals.RemoveAll(d =>
                    string.Equals(d.Did, didValue, StringComparison.OrdinalIgnoreCase)
                    && string.Equals(d.ClientType.DosIsNullOrWhiteSpace("PC"), clientTypeValue, StringComparison.OrdinalIgnoreCase));
            }
            if (!deviceClientId.DosIsNullOrWhiteSpace())
            {
                clientInfo.Terminals.RemoveAll(d =>
                    string.Equals(d.DeviceClientId, deviceClientId, StringComparison.OrdinalIgnoreCase)
                    && string.Equals(d.ClientType.DosIsNullOrWhiteSpace("PC"), clientTypeValue, StringComparison.OrdinalIgnoreCase));
            }
            clientInfo.Terminals.RemoveAll(d => d.ConnectionId == connectionId);
            clientInfo.Terminals.Insert(0, new ClientTerminalInfo
            {
                ConnectionId = connectionId,
                DeviceClientId = deviceClientId,
                ClientType = clientTypeValue,
                Did = didValue,
                Ip = ip,
                UserAgent = httpContext?.Request?.Headers["User-Agent"].ToString() ?? "",
                OtherInfo = otherInfo,
                TokenHash = tokenHash,
                ConnectedTime = DateTime.Now,
                LastActiveTime = DateTime.Now,
            });
            NormalizeTerminalList(clientInfo, clientModel);

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
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var clientModel = OsClient.GetClient(osClient);
            if (tokenEntries.Count == 0)
            {
                await cache.RemoveAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}").ConfigureAwait(false);
                return;
            }
            tokenEntries = tokenEntries
                .Where(d => IsTokenEntryStillActive(d, clientModel))
                .ToList();
            if (tokenEntries.Count == 0)
            {
                await cache.RemoveAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}").ConfigureAwait(false);
                return;
            }
            if (tokenModel.Tokens == null
                || tokenModel.Tokens.Count != tokenEntries.Count
                || tokenModel.Tokens.Any(d => d == null
                                              || !string.Equals(d.AuthVersion, DiyToken.CurrentAuthVersion, StringComparison.Ordinal)
                                              || !tokenEntries.Any(x => string.Equals(x.Token, d.Token, StringComparison.Ordinal))))
            {
                tokenModel.Tokens = tokenEntries;
                tokenModel.Token = tokenEntries[0].Token;
                tokenModel.UpdateTime = DateTime.Now;
                await cache.SetAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}", tokenModel).ConfigureAwait(false);
            }
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

                var isCurrentRequest = string.Equals(tokenHash, requestTokenHash, StringComparison.OrdinalIgnoreCase);
                var clientType = tokenEntry.ClientType.DosIsNullOrWhiteSpace(claimClientType.DosIsNullOrWhiteSpace("PC"));
                var did = tokenEntry.Did.DosIsNullOrWhiteSpace(
                    (isCurrentRequest ? requestDid : "").DosIsNullOrWhiteSpace(claimDid.DosIsNullOrWhiteSpace("Empty")));
                var ip = tokenEntry.IP.DosIsNullOrWhiteSpace(isCurrentRequest ? requestIp.DosIsNullOrWhiteSpace(claimIp) : "");
                var lastActiveTime = isCurrentRequest ? DateTime.Now : (tokenEntry.UpdateTime == default ? tokenEntry.CreateTime : tokenEntry.UpdateTime);
                var liveTerminal = clientInfo.Terminals.FirstOrDefault(d =>
                    !IsTokenConnectionId(d.ConnectionId)
                    && (string.Equals(d.TokenHash, tokenHash, StringComparison.OrdinalIgnoreCase)
                        || (IsMeaningfulDid(did)
                            && string.Equals(d.Did, did, StringComparison.OrdinalIgnoreCase)
                            && string.Equals(d.ClientType.DosIsNullOrWhiteSpace("PC"), clientType, StringComparison.OrdinalIgnoreCase))));

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
                if (!IsMeaningfulDid(did))
                {
                    clientInfo.Terminals.RemoveAll(d => d.ConnectionId == tokenConnectionId);
                    continue;
                }
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

            NormalizeTerminalList(clientInfo, clientModel);

            await SaveClientInfoAsync(cache, osClient, clientInfo).ConfigureAwait(false);
        }

        public static async Task PruneExpiredLoginTokensAsync(
            string osClient,
            string userId,
            CurrentToken tokenModel = null,
            OsClientSecret clientModel = null)
        {
            if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace())
            {
                return;
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            tokenModel ??= await cache.GetAsync<CurrentToken>($"Microi:{osClient}:LoginTokenSysUser:{userId}").ConfigureAwait(false);
            clientModel ??= OsClient.GetClient(osClient);
            PruneExpiredLoginTokens(cache, osClient, userId, clientModel, null, tokenModel);
        }

        public static List<object> ListOnlineUsers(string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new List<object>();
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var clientModel = OsClient.GetClient(osClient);
            var list = cache.HashGetAllValues<ClientInfo>(GetOnlineHashKey(osClient)) ?? new List<ClientInfo>();
            foreach (var clientInfo in list)
            {
                PruneExpiredLoginTokens(cache, osClient, clientInfo?.UserId, clientModel, clientInfo);
                NormalizeTerminalList(clientInfo, clientModel);
                SaveClientInfo(cache, osClient, clientInfo);
            }
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
            var clientModel = OsClient.GetClient(osClient);
            var clientInfo = cache.Get<ClientInfo>(GetChatOnlineKey(osClient, userId))
                             ?? cache.HashGet<ClientInfo>(GetOnlineHashKey(osClient), userId);
            if (clientInfo != null)
            {
                PruneExpiredLoginTokens(cache, osClient, userId, clientModel, clientInfo);
                NormalizeTerminalList(clientInfo, clientModel);
                SaveClientInfo(cache, osClient, clientInfo);
            }
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

        private static void NormalizeTerminalList(ClientInfo clientInfo)
        {
            NormalizeTerminalList(clientInfo, null);
        }

        private static void NormalizeTerminalList(ClientInfo clientInfo, OsClientSecret clientModel)
        {
            if (clientInfo?.Terminals == null)
            {
                return;
            }

            clientInfo.Terminals = clientInfo.Terminals
                .Where(d => d != null
                            && !d.ConnectionId.DosIsNullOrWhiteSpace()
                            && !IsAnonymousTerminal(d)
                            && !IsTerminalExpired(d, clientModel))
                .OrderBy(d => IsTokenConnectionId(d.ConnectionId) ? 1 : 0)
                .ThenByDescending(d => d.LastActiveTime == default ? d.ConnectedTime : d.LastActiveTime)
                .GroupBy(GetTerminalIdentity, StringComparer.OrdinalIgnoreCase)
                .Select(d => d.First())
                .OrderByDescending(d => d.LastActiveTime == default ? d.ConnectedTime : d.LastActiveTime)
                .Take(20)
                .ToList();
        }

        private static bool PruneExpiredLoginTokens(
            IMicroiCache cache,
            string osClient,
            string userId,
            OsClientSecret clientModel,
            ClientInfo clientInfo = null,
            CurrentToken tokenModel = null)
        {
            if (cache == null || osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace())
            {
                return false;
            }

            var key = $"Microi:{osClient}:LoginTokenSysUser:{userId}";
            tokenModel ??= cache.Get<CurrentToken>(key);
            var before = tokenModel?.Tokens?.Count ?? 0;
            var activeTokens = tokenModel?.Tokens?
                .Where(d => d != null
                            && string.Equals(d.AuthVersion, DiyToken.CurrentAuthVersion, StringComparison.Ordinal)
                            && !d.Token.DosIsNullOrWhiteSpace()
                            && IsTokenEntryStillActive(d, clientModel))
                .ToList() ?? new List<TokensModel>();

            if (before > 0 && activeTokens.Count != before)
            {
                if (activeTokens.Count == 0)
                {
                    cache.Remove(key);
                }
                else
                {
                    tokenModel.Tokens = activeTokens;
                    tokenModel.Token = activeTokens[0].Token;
                    tokenModel.UpdateTime = DateTime.Now;
                    cache.Set(key, tokenModel);
                }
            }

            if (clientInfo?.Terminals != null)
            {
                var activeHashes = activeTokens
                    .Select(d => HashToken(d.Token))
                    .Where(d => !d.DosIsNullOrWhiteSpace())
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                clientInfo.Terminals.RemoveAll(d =>
                    d == null
                    || IsAnonymousTerminal(d)
                    || IsTerminalExpired(d, clientModel)
                    || (!d.TokenHash.DosIsNullOrWhiteSpace()
                        && (activeHashes.Count == 0 || !activeHashes.Contains(d.TokenHash))));
            }

            return activeTokens.Count != before;
        }

        private static string GetTerminalIdentity(ClientTerminalInfo terminal)
        {
            if (terminal == null)
            {
                return Guid.NewGuid().ToString("N");
            }

            var clientType = terminal.ClientType.DosIsNullOrWhiteSpace("PC");
            if (IsMeaningfulDid(terminal.Did))
            {
                return $"did:{clientType}:{terminal.Did}";
            }
            if (IsMeaningfulDeviceId(terminal.DeviceClientId))
            {
                return $"device:{clientType}:{terminal.DeviceClientId}";
            }
            if (!terminal.TokenHash.DosIsNullOrWhiteSpace())
            {
                return $"token:{terminal.TokenHash}";
            }
            return $"connection:{terminal.ConnectionId}";
        }

        private static bool IsMeaningfulDid(string did)
        {
            return !did.DosIsNullOrWhiteSpace()
                   && !string.Equals(did, "Empty", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsMeaningfulDeviceId(string deviceClientId)
        {
            return !deviceClientId.DosIsNullOrWhiteSpace()
                   && !string.Equals(deviceClientId, "Empty", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsAnonymousTerminal(ClientTerminalInfo terminal)
        {
            return terminal != null
                   && (IsTokenConnectionId(terminal.ConnectionId) || terminal.TokenHash.DosIsNullOrWhiteSpace())
                   && !IsMeaningfulDid(terminal.Did)
                   && !IsMeaningfulDeviceId(terminal.DeviceClientId);
        }

        private static bool IsTerminalExpired(ClientTerminalInfo terminal, OsClientSecret clientModel)
        {
            if (terminal == null)
            {
                return true;
            }

            var lastActive = terminal.LastActiveTime == default ? terminal.ConnectedTime : terminal.LastActiveTime;
            if (lastActive == default)
            {
                return false;
            }

            var clientType = terminal.ClientType.DosIsNullOrWhiteSpace("PC");
            var tokenLifetime = DiyToken.ResolveClientTokenLifetime(clientModel, clientType);
            return tokenLifetime > TimeSpan.Zero && DateTime.Now - lastActive > tokenLifetime;
        }

        private static bool IsTokenEntryStillActive(TokensModel tokenEntry, OsClientSecret clientModel)
        {
            if (tokenEntry == null)
            {
                return false;
            }

            var clientType = tokenEntry.ClientType.DosIsNullOrWhiteSpace("Empty");
            var updateTime = tokenEntry.UpdateTime == default ? tokenEntry.CreateTime : tokenEntry.UpdateTime;
            if (updateTime == default)
            {
                return true;
            }

            var tokenLifetime = DiyToken.ResolveClientTokenLifetime(clientModel, clientType);
            return DateTime.Now - updateTime <= tokenLifetime;
        }

        private static void SaveClientInfo(IMicroiCache cache, string osClient, ClientInfo clientInfo)
        {
            if (cache == null || clientInfo?.UserId.DosIsNullOrWhiteSpace() != false)
            {
                return;
            }

            if ((clientInfo.ConnectionIds == null || clientInfo.ConnectionIds.Count == 0)
                && (clientInfo.Terminals == null || clientInfo.Terminals.Count == 0))
            {
                cache.Remove(GetChatOnlineKey(osClient, clientInfo.UserId));
                cache.HashDelete(GetOnlineHashKey(osClient), clientInfo.UserId);
                return;
            }

            cache.Set(GetChatOnlineKey(osClient, clientInfo.UserId), clientInfo);
            cache.HashSet(GetOnlineHashKey(osClient), clientInfo.UserId, clientInfo);
        }

        private static async Task SaveClientInfoAsync(IMicroiCache cache, string osClient, ClientInfo clientInfo)
        {
            if (cache == null || clientInfo?.UserId.DosIsNullOrWhiteSpace() != false)
            {
                return;
            }
            if ((clientInfo.ConnectionIds == null || clientInfo.ConnectionIds.Count == 0)
                && (clientInfo.Terminals == null || clientInfo.Terminals.Count == 0))
            {
                await cache.RemoveAsync(GetChatOnlineKey(osClient, clientInfo.UserId)).ConfigureAwait(false);
                cache.HashDelete(GetOnlineHashKey(osClient), clientInfo.UserId);
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
            NormalizeTerminalList(clientInfo);
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
