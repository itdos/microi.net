using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static class OnlineTerminalService
    {
        private const string TokenConnectionPrefix = "token:";
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
            var clientModel = OsClientExtend.GetClient(osClient);
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
            RemoveNullTerminals(clientInfo);
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
            RemoveNullTerminals(clientInfo);
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
            var clientModel = OsClientExtend.GetClient(osClient);
            if (tokenEntries.Count == 0)
            {
                await cache.RemoveAsync(GetLoginTokenKey(osClient, userId)).ConfigureAwait(false);
                return;
            }
            tokenEntries = tokenEntries
                .Where(d => IsTokenEntryStillActive(d, clientModel))
                .ToList();
            if (tokenEntries.Count == 0)
            {
                await cache.RemoveAsync(GetLoginTokenKey(osClient, userId)).ConfigureAwait(false);
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
                await cache.SetAsync(GetLoginTokenKey(osClient, userId), tokenModel).ConfigureAwait(false);
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
            RemoveNullTerminals(clientInfo);

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

                tokenTerminal.DeviceClientId = IsMeaningfulDid(did) ? did : tokenTerminal.DeviceClientId;
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
            tokenModel ??= await cache.GetAsync<CurrentToken>(GetLoginTokenKey(osClient, userId)).ConfigureAwait(false);
            clientModel ??= OsClientExtend.GetClient(osClient);
            PruneExpiredLoginTokens(cache, osClient, userId, clientModel, null, tokenModel);
        }

        public static List<object> ListOnlineUsers(string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new List<object>();
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var clientModel = OsClientExtend.GetClient(osClient);
            var users = BuildOnlineUserMap(cache, osClient);
            MergeLoginTokenUsers(cache, osClient, clientModel, users);
            foreach (var clientInfo in users.Values.ToList())
            {
                PruneExpiredLoginTokens(cache, osClient, clientInfo?.UserId, clientModel, clientInfo);
                NormalizeTerminalList(clientInfo, clientModel);
                SaveClientInfo(cache, osClient, clientInfo);
            }
            return users.Values
                .Where(d => d != null && !d.UserId.DosIsNullOrWhiteSpace() && (d.ConnectionIds?.Count > 0 || d.Terminals?.Count > 0))
                .OrderByDescending(GetClientLastActiveTime)
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
            var clientModel = OsClientExtend.GetClient(osClient);
            var clientInfo = cache.Get<ClientInfo>(GetChatOnlineKey(osClient, userId))
                             ?? cache.HashGet<ClientInfo>(GetOnlineHashKey(osClient), userId);
            var tokenModel = cache.Get<CurrentToken>(GetLoginTokenKey(osClient, userId));
            var activeTokens = GetActiveTokenEntries(tokenModel, clientModel);
            if (activeTokens.Count > 0)
            {
                clientInfo = MergeTokenModelIntoClientInfo(clientInfo, tokenModel, activeTokens, clientModel);
                SaveActiveTokenEntries(cache, osClient, userId, tokenModel, activeTokens);
            }
            else if (tokenModel?.Tokens?.Count > 0)
            {
                cache.Remove(GetLoginTokenKey(osClient, userId));
            }
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

        private static Dictionary<string, ClientInfo> BuildOnlineUserMap(IMicroiCache cache, string osClient)
        {
            var result = new Dictionary<string, ClientInfo>(StringComparer.OrdinalIgnoreCase);
            var list = cache?.HashGetAllValues<ClientInfo>(GetOnlineHashKey(osClient)) ?? new List<ClientInfo>();
            foreach (var item in list)
            {
                if (item?.UserId.DosIsNullOrWhiteSpace() != false)
                {
                    continue;
                }
                result[item.UserId] = item;
            }
            return result;
        }

        private static void MergeLoginTokenUsers(
            IMicroiCache cache,
            string osClient,
            OsClientSecret clientModel,
            Dictionary<string, ClientInfo> users)
        {
            if (cache == null || users == null || osClient.DosIsNullOrWhiteSpace())
            {
                return;
            }

            foreach (var key in ScanLoginTokenKeys(cache, osClient))
            {
                var tokenModel = cache.Get<CurrentToken>(key);
                var userId = tokenModel?.CurrentUser?["Id"]?.Val<string>() ?? ExtractUserIdFromLoginTokenKey(osClient, key);
                if (tokenModel?.CurrentUser == null || userId.DosIsNullOrWhiteSpace())
                {
                    cache.Remove(key);
                    continue;
                }

                var activeTokens = GetActiveTokenEntries(tokenModel, clientModel);
                if (activeTokens.Count == 0)
                {
                    cache.Remove(key);
                    users.Remove(userId);
                    continue;
                }

                users.TryGetValue(userId, out var clientInfo);
                users[userId] = MergeTokenModelIntoClientInfo(clientInfo, tokenModel, activeTokens, clientModel);
                SaveActiveTokenEntries(cache, osClient, userId, tokenModel, activeTokens);
            }
        }

        private static IEnumerable<string> ScanLoginTokenKeys(IMicroiCache cache, string osClient)
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                var db = cache.GetIDatabase();
                var multiplexer = db?.Multiplexer;
                if (multiplexer == null)
                {
                    return keys;
                }

                var pattern = $"{GetLoginTokenKeyPrefix(osClient)}*";
                foreach (var endpoint in multiplexer.GetEndPoints())
                {
                    var server = multiplexer.GetServer(endpoint);
                    if (server == null || !server.IsConnected)
                    {
                        continue;
                    }

                    foreach (var key in server.Keys(db.Database, pattern, pageSize: 1000))
                    {
                        var keyText = key.ToString();
                        if (!keyText.DosIsNullOrWhiteSpace())
                        {
                            keys.Add(keyText);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(osClient, "OnlineTerminal", "LoginTokenScanFailed", "扫描登录 Token 缓存失败", ex.ToString(), 2);
            }
            return keys;
        }

        private static string ExtractUserIdFromLoginTokenKey(string osClient, string key)
        {
            var prefix = GetLoginTokenKeyPrefix(osClient);
            if (key.DosIsNullOrWhiteSpace() || !key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return "";
            }
            return key.Substring(prefix.Length);
        }

        private static List<TokensModel> GetActiveTokenEntries(CurrentToken tokenModel, OsClientSecret clientModel)
        {
            return tokenModel?.Tokens?
                .Where(d => d != null
                            && string.Equals(d.AuthVersion, DiyToken.CurrentAuthVersion, StringComparison.Ordinal)
                            && !d.Token.DosIsNullOrWhiteSpace()
                            && IsTokenEntryStillActive(d, clientModel))
                .ToList() ?? new List<TokensModel>();
        }

        private static void SaveActiveTokenEntries(
            IMicroiCache cache,
            string osClient,
            string userId,
            CurrentToken tokenModel,
            List<TokensModel> activeTokens)
        {
            if (cache == null || tokenModel == null || osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace())
            {
                return;
            }

            var key = GetLoginTokenKey(osClient, userId);
            if (activeTokens == null || activeTokens.Count == 0)
            {
                cache.Remove(key);
                return;
            }

            if (tokenModel.Tokens == null
                || tokenModel.Tokens.Count != activeTokens.Count
                || tokenModel.Tokens.Any(d => d == null || !activeTokens.Any(x => string.Equals(x.Token, d.Token, StringComparison.Ordinal))))
            {
                tokenModel.Tokens = activeTokens;
                tokenModel.Token = activeTokens[0].Token;
                tokenModel.UpdateTime = DateTime.Now;
                cache.Set(key, tokenModel);
            }
        }

        private static ClientInfo MergeTokenModelIntoClientInfo(
            ClientInfo clientInfo,
            CurrentToken tokenModel,
            List<TokensModel> activeTokens,
            OsClientSecret clientModel)
        {
            if (tokenModel?.CurrentUser == null || activeTokens == null || activeTokens.Count == 0)
            {
                return clientInfo;
            }

            var currentUser = tokenModel.CurrentUser;
            var userId = currentUser["Id"]?.Val<string>() ?? clientInfo?.UserId ?? "";
            if (userId.DosIsNullOrWhiteSpace())
            {
                return clientInfo;
            }

            clientInfo ??= new ClientInfo
            {
                UserId = userId,
                ConnectedTime = DateTime.Now,
            };
            clientInfo.UserId = userId;
            clientInfo.UserName = (currentUser["Name"]?.Val<string>() ?? "").DosIsNullOrWhiteSpace(currentUser["Account"]?.Val<string>() ?? "");
            clientInfo.Account = currentUser["Account"]?.Val<string>() ?? clientInfo.Account;
            clientInfo.Level = currentUser["Level"]?.Val<int>() ?? clientInfo.Level;
            clientInfo.UserAvatar = currentUser["Avatar"]?.Val<string>() ?? clientInfo.UserAvatar;
            clientInfo.Terminals ??= new List<ClientTerminalInfo>();
            RemoveNullTerminals(clientInfo);

            var activeHashes = activeTokens
                .Select(d => HashToken(d.Token))
                .Where(d => !d.DosIsNullOrWhiteSpace())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            clientInfo.Terminals.RemoveAll(d =>
                IsTokenConnectionId(d.ConnectionId)
                && !d.TokenHash.DosIsNullOrWhiteSpace()
                && !activeHashes.Contains(d.TokenHash));

            foreach (var tokenEntry in activeTokens)
            {
                UpsertTokenTerminal(clientInfo, tokenEntry);
            }

            NormalizeTerminalList(clientInfo, clientModel);
            return clientInfo;
        }

        private static void UpsertTokenTerminal(ClientInfo clientInfo, TokensModel tokenEntry)
        {
            var tokenHash = HashToken(tokenEntry?.Token);
            if (clientInfo == null || tokenEntry == null || tokenHash.DosIsNullOrWhiteSpace())
            {
                return;
            }

            var clientType = tokenEntry.ClientType.DosIsNullOrWhiteSpace("PC");
            var did = tokenEntry.Did.DosIsNullOrWhiteSpace("Empty");
            var ip = tokenEntry.IP.DosIsNullOrWhiteSpace(clientInfo.Ip);
            var lastActiveTime = tokenEntry.UpdateTime == default ? tokenEntry.CreateTime : tokenEntry.UpdateTime;
            if (lastActiveTime == default)
            {
                lastActiveTime = DateTime.Now;
            }

            var liveTerminal = clientInfo.Terminals.FirstOrDefault(d =>
                !IsTokenConnectionId(d.ConnectionId)
                && (string.Equals(d.TokenHash, tokenHash, StringComparison.OrdinalIgnoreCase)
                    || (IsMeaningfulDid(did)
                        && string.Equals(d.Did, did, StringComparison.OrdinalIgnoreCase)
                        && string.Equals(d.ClientType.DosIsNullOrWhiteSpace("PC"), clientType, StringComparison.OrdinalIgnoreCase))));
            if (liveTerminal != null)
            {
                liveTerminal.DeviceClientId = liveTerminal.DeviceClientId.DosIsNullOrWhiteSpace(IsMeaningfulDid(did) ? did : "");
                liveTerminal.ClientType = clientType;
                liveTerminal.Did = did;
                liveTerminal.Ip = ip.DosIsNullOrWhiteSpace(liveTerminal.Ip);
                liveTerminal.TokenHash = tokenHash;
                liveTerminal.LastActiveTime = lastActiveTime;
                return;
            }

            var connectionId = GetTokenConnectionId(tokenHash);
            var tokenTerminal = clientInfo.Terminals.FirstOrDefault(d => d.ConnectionId == connectionId);
            if (tokenTerminal == null)
            {
                tokenTerminal = new ClientTerminalInfo
                {
                    ConnectionId = connectionId,
                    ConnectedTime = tokenEntry.CreateTime == default ? DateTime.Now : tokenEntry.CreateTime,
                };
                clientInfo.Terminals.Insert(0, tokenTerminal);
            }

            tokenTerminal.DeviceClientId = IsMeaningfulDid(did) ? did : tokenTerminal.DeviceClientId;
            tokenTerminal.ClientType = clientType;
            tokenTerminal.Did = did;
            tokenTerminal.Ip = ip;
            tokenTerminal.TokenHash = tokenHash;
            tokenTerminal.LastActiveTime = lastActiveTime;
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
            RemoveNullTerminals(clientInfo);
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

        /// <summary>仅注销当前请求对应终端，保留同一用户的其它设备登录态。</summary>
        public static async Task<DosResult> LogoutCurrentTokenAsync(CurrentToken currentToken, string requestToken)
        {
            requestToken = (requestToken ?? "").Trim();
            if (requestToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) requestToken = requestToken.Substring(7).Trim();
            var osClient = currentToken?.OsClient;
            var user = currentToken?.CurrentUser;
            var userId = user?["Id"].Val<string>();
            if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace() || requestToken.DosIsNullOrWhiteSpace())
                return new DosResult(1001, null, "登录身份已过期");

            var entry = currentToken.Tokens?.FirstOrDefault(d => d != null && string.Equals(d.Token, requestToken, StringComparison.Ordinal));
            if (entry == null && string.Equals(currentToken.Token, requestToken, StringComparison.Ordinal))
            {
                entry = new TokensModel
                {
                    Token = requestToken,
                    CreateTime = currentToken.CreateTime,
                    UpdateTime = currentToken.UpdateTime,
                    ClientType = "Empty",
                    Did = "Empty"
                };
            }
            if (entry == null) return new DosResult(1001, null, "未找到当前终端登录态");
            var durationSeconds = Math.Max(0, (long)(DateTime.Now - entry.CreateTime).TotalSeconds);
            var clientType = entry.ClientType.DosIsNullOrWhiteSpace("Empty");
            var did = entry.Did.DosIsNullOrWhiteSpace("Empty");
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var key = GetLoginTokenKey(osClient, userId);

            currentToken.Tokens = currentToken.Tokens?
                .Where(d => d != null && !(string.Equals(d.Token, requestToken, StringComparison.Ordinal)
                                            || (IsMeaningfulDid(did)
                                                && string.Equals(d.Did, did, StringComparison.Ordinal)
                                                && string.Equals(d.ClientType, clientType, StringComparison.Ordinal))))
                .ToList() ?? new List<TokensModel>();
            if (currentToken.Tokens.Count == 0)
            {
                await cache.RemoveAsync(key).ConfigureAwait(false);
            }
            else
            {
                currentToken.Token = currentToken.Tokens[0].Token;
                currentToken.UpdateTime = DateTime.Now;
                await cache.SetAsync(key, currentToken).ConfigureAwait(false);
            }

            var clientInfo = await cache.GetAsync<ClientInfo>(GetChatOnlineKey(osClient, userId)).ConfigureAwait(false)
                             ?? cache.HashGet<ClientInfo>(GetOnlineHashKey(osClient), userId);
            if (clientInfo != null)
            {
                var tokenHash = HashToken(requestToken);
                clientInfo.Terminals?.RemoveAll(d => d != null &&
                    (string.Equals(d.TokenHash, tokenHash, StringComparison.OrdinalIgnoreCase)
                     || (IsMeaningfulDid(did) && string.Equals(d.Did, did, StringComparison.Ordinal)
                         && string.Equals(d.ClientType, clientType, StringComparison.Ordinal))));
                if ((clientInfo.Terminals?.Count ?? 0) == 0 && (clientInfo.ConnectionIds?.Count ?? 0) == 0)
                {
                    await cache.RemoveAsync(GetChatOnlineKey(osClient, userId)).ConfigureAwait(false);
                    cache.HashDelete(GetOnlineHashKey(osClient), userId);
                }
                else await SaveClientInfoAsync(cache, osClient, clientInfo).ConfigureAwait(false);
            }

            var context = new BaseParam { OsClient = osClient, _CurrentUser = user, _ClientType = clientType, _InvokeType = InvokeType.Client.ToString() };
            var duration = UserBehaviorAudit.FormatDuration(durationSeconds);
            UserBehaviorAudit.Track(context, "Session", "Logout", "用户退出", "Session", UserBehaviorAudit.HashIdentifier(requestToken),
                $"退出登录，本次登录共计{duration}", new { Duration = duration, ClientType = clientType, Did = did }, true,
                durationSeconds, "TokenLifecycle", UserBehaviorAudit.HashIdentifier(requestToken), did,
                UserBehaviorAudit.DeterministicEventId($"session-logout|{osClient}|{UserBehaviorAudit.HashIdentifier(requestToken)}"));
            await NotifyOnlineChangedAsync(osClient, userId).ConfigureAwait(false);
            return new DosResult(1, new { DurationSeconds = durationSeconds, Duration = duration }, "退出登录成功");
        }

        /// <summary>
        /// 清除指定用户的全部终端登录信息，立即吊销其所有 Token，并向在线终端推送强制退出事件。
        /// </summary>
        public static async Task<DosResult> ClearUserLoginInfoAsync(
            string osClient,
            JObject operatorUser,
            string targetUserId,
            string reason = null)
        {
            var operatorUserId = operatorUser?["Id"]?.Val<string>() ?? "";
            var operatorLevel = operatorUser?["Level"]?.Val<int>() ?? 0;
            var isAdmin = operatorLevel >= 9999 || (operatorUser?["_IsAdmin"]?.Val<bool>() ?? false);
            if (operatorUserId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(1001, null, "登录身份已过期");
            }
            if (!isAdmin)
            {
                return new DosResult(0, null, "仅系统管理员可清除用户登录信息");
            }
            if (osClient.DosIsNullOrWhiteSpace() || targetUserId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "租户和用户Id不能为空");
            }

            return await RevokeUserSessionsAsync(osClient, targetUserId, reason)
                .ConfigureAwait(false);
        }

        /// <summary>
        /// 服务端用户生命周期逻辑专用：吊销指定用户的全部终端会话。
        /// 仅在当前程序集内开放，外部管理接口仍必须经过 ClearUserLoginInfoAsync 的管理员校验。
        /// </summary>
        internal static async Task<DosResult> RevokeUserSessionsAsync(
            string osClient,
            string targetUserId,
            string reason = null)
        {
            if (osClient.DosIsNullOrWhiteSpace() || targetUserId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "租户和用户Id不能为空");
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var loginTokenKey = GetLoginTokenKey(osClient, targetUserId);
            var tokenModel = await cache.GetAsync<CurrentToken>(loginTokenKey).ConfigureAwait(false);
            var revokedTokenCount = tokenModel?.Tokens?.Count ?? (tokenModel?.Token.DosIsNullOrWhiteSpace() == false ? 1 : 0);
            var clientInfo = await cache.GetAsync<ClientInfo>(GetChatOnlineKey(osClient, targetUserId)).ConfigureAwait(false)
                             ?? cache.HashGet<ClientInfo>(GetOnlineHashKey(osClient), targetUserId);
            var connectionIds = (clientInfo?.ConnectionIds ?? new List<string>())
                .Concat(clientInfo?.Terminals?.Select(d => d?.ConnectionId) ?? Enumerable.Empty<string>())
                .Where(d => !d.DosIsNullOrWhiteSpace() && !IsTokenConnectionId(d))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // 先删除用户级 Token 集合。旧 Token、轮换宽限 Token 和 RefreshToken 都会立即失去 Redis 事实源。
            await cache.RemoveAsync(loginTokenKey).ConfigureAwait(false);

            var logoutReason = reason.DosIsNullOrWhiteSpace("登录信息已被管理员清除，请重新登录。");
            if (RealtimePushRuntime.IsConfigured && connectionIds.Count > 0)
            {
                await RealtimePushRuntime.SendAsync(
                    connectionIds,
                    "ReceiveForceLogout",
                    new
                    {
                        Reason = logoutReason,
                        Time = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }).ConfigureAwait(false);
            }

            await cache.RemoveAsync(GetChatOnlineKey(osClient, targetUserId)).ConfigureAwait(false);
            cache.HashDelete(GetOnlineHashKey(osClient), targetUserId);
            await NotifyOnlineChangedAsync(osClient, targetUserId).ConfigureAwait(false);

            return new DosResult(1, new
            {
                UserId = targetUserId,
                RevokedTokenCount = revokedTokenCount,
                ForcedTerminalCount = connectionIds.Count
            }, "用户所有终端登录信息已清除");
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

        private static void RemoveNullTerminals(ClientInfo clientInfo)
        {
            if (clientInfo == null)
            {
                return;
            }

            clientInfo.Terminals = (clientInfo.Terminals ?? new List<ClientTerminalInfo>())
                .Where(d => d != null)
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

            var key = GetLoginTokenKey(osClient, userId);
            tokenModel ??= cache.Get<CurrentToken>(key);
            var before = tokenModel?.Tokens?.Count ?? 0;
            var activeTokens = tokenModel?.Tokens?
                .Where(d => d != null
                            && string.Equals(d.AuthVersion, DiyToken.CurrentAuthVersion, StringComparison.Ordinal)
                            && !d.Token.DosIsNullOrWhiteSpace()
                            && IsTokenEntryStillActive(d, clientModel))
                .ToList() ?? new List<TokensModel>();

            if (before > 0 && tokenModel?.CurrentUser != null)
            {
                foreach (var expired in tokenModel.Tokens.Where(d => d != null && !d.RetiredTime.HasValue && !activeTokens.Contains(d)))
                {
                    var startedAt = expired.CreateTime == default ? tokenModel.CreateTime : expired.CreateTime;
                    var seconds = startedAt == default ? 0 : Math.Max(0, (long)(DateTime.Now - startedAt).TotalSeconds);
                    var context = new BaseParam
                    {
                        OsClient = osClient,
                        _CurrentUser = tokenModel.CurrentUser,
                        _ClientType = expired.ClientType,
                        _InvokeType = InvokeType.Client.ToString()
                    };
                    var duration = UserBehaviorAudit.FormatDuration(seconds);
                    UserBehaviorAudit.Track(context, "Session", "SessionExpired", "登录失效", "Session",
                        UserBehaviorAudit.HashIdentifier(expired.Token), $"登录状态因超时失效，本次登录共计{duration}",
                        new { Duration = duration, ClientType = expired.ClientType, Did = expired.Did }, true, seconds,
                        "TokenLifecycle", UserBehaviorAudit.HashIdentifier(expired.Token), expired.Did,
                        UserBehaviorAudit.DeterministicEventId($"session-expired|{osClient}|{UserBehaviorAudit.HashIdentifier(expired.Token)}"));
                }
            }

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
                   && terminal.TokenHash.DosIsNullOrWhiteSpace()
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
            if (!DiyToken.IsTokenEntryWithinRotationGrace(tokenEntry))
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
            var tokenModel = await cache.GetAsync<CurrentToken>(GetLoginTokenKey(osClient, userId)).ConfigureAwait(false);
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
                    await cache.SetAsync(GetLoginTokenKey(osClient, userId), tokenModel).ConfigureAwait(false);
                }
                else
                {
                    await cache.RemoveAsync(GetLoginTokenKey(osClient, userId)).ConfigureAwait(false);
                }
            }
        }

        private static async Task NotifyOnlineChangedAsync(string osClient, string changedUserId)
        {
            if (!RealtimePushRuntime.IsConfigured || osClient.DosIsNullOrWhiteSpace())
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

            await RealtimePushRuntime.SendAsync(
                targetConnections,
                "ReceiveOnlineTerminalChanged",
                new
                {
                    OnlineUserCount = users.Count,
                    ChangedUserId = changedUserId,
                    UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                }).ConfigureAwait(false);
        }

        private static async Task SendForceLogoutAsync(string connectionId, string reason)
        {
            if (!RealtimePushRuntime.IsConfigured || connectionId.DosIsNullOrWhiteSpace())
            {
                return;
            }
            await RealtimePushRuntime.SendAsync(
                new[] { connectionId },
                "ReceiveForceLogout",
                new
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
            var terminals = (clientInfo.Terminals ?? new List<ClientTerminalInfo>())
                .OrderByDescending(d => d.LastActiveTime == default ? d.ConnectedTime : d.LastActiveTime)
                .ToList();
            var terminalCount = terminals.Count;
            var connectionCount = clientInfo.ConnectionIds?.Count ?? 0;
            var lastActiveTime = GetClientLastActiveTime(clientInfo);
            return new
            {
                clientInfo.UserId,
                clientInfo.UserName,
                clientInfo.Account,
                clientInfo.Level,
                clientInfo.UserAvatar,
                clientInfo.Ip,
                OnlineCount = terminalCount > 0 ? terminalCount : connectionCount,
                LastActiveTime = lastActiveTime == default ? clientInfo.ConnectedTime : lastActiveTime,
                Terminals = terminals
                    .Select(ToTerminalView)
                    .ToList()
            };
        }

        private static DateTime GetClientLastActiveTime(ClientInfo clientInfo)
        {
            if (clientInfo == null)
            {
                return default;
            }

            var terminalLastActive = (clientInfo.Terminals ?? new List<ClientTerminalInfo>())
                .Select(d => d == null ? default : (d.LastActiveTime == default ? d.ConnectedTime : d.LastActiveTime))
                .DefaultIfEmpty(default)
                .Max();
            return terminalLastActive == default ? clientInfo.ConnectedTime : terminalLastActive;
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

        private static string GetLoginTokenKeyPrefix(string osClient) => $"Microi:{osClient}:LoginTokenSysUser:";

        private static string GetLoginTokenKey(string osClient, string userId) => $"{GetLoginTokenKeyPrefix(osClient)}{userId}";

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
            return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(token))).Replace("-", "");
        }
    }
}
