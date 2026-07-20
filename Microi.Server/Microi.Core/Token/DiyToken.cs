using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class DiyToken
    {
        public const string AuthVersionClaimType = "MicroiAuthVersion";
        public const string TokenIssuedAtClaimType = "MicroiTokenIssuedAt";
        public const string CurrentAuthVersion = "2026-07-09-official-security-v2";
        public static readonly TimeSpan TokenRotationGracePeriod = TimeSpan.FromMinutes(2);

        public static bool IsWeakJwtSecret(string secret, string osClient)
        {
            if (secret.DosIsNullOrWhiteSpace())
            {
                return true;
            }

            var value = secret.Trim();
            if (value.Length < 32)
            {
                return true;
            }

            return !osClient.DosIsNullOrWhiteSpace()
                && value.Equals(osClient, StringComparison.OrdinalIgnoreCase);
        }

        public static string ResolveJwtSigningKey(OsClientSecret clientModel)
        {
            var jwtKey = clientModel?.OsClientModel?["AuthSecret"]?.Val<string>();
            if (IsWeakJwtSecret(jwtKey, clientModel?.OsClient))
            {
                throw new Exception($"租户[{clientModel?.OsClient}]的JWT AuthSecret为空、过短或等于租户Key，请在SaaS引擎中配置强随机AuthSecret后重试。");
            }

            jwtKey = jwtKey.Trim();
            return jwtKey.Length > 32 ? jwtKey.Substring(0, 32) : jwtKey.PadRight(32, '.');
        }

        private static int ReadPositiveInt(OsClientSecret clientModel, params string[] keys)
        {
            if (clientModel?.OsClientModel == null || keys == null)
            {
                return 0;
            }

            foreach (var key in keys)
            {
                var raw = clientModel.OsClientModel[key]?.Val<string>();
                if (!raw.DosIsNullOrWhiteSpace() && int.TryParse(raw, out var value) && value > 0)
                {
                    return value;
                }
            }

            return 0;
        }

        public static TimeSpan ResolveClientTokenLifetime(OsClientSecret clientModel, string clientType)
        {
            var normalizedClientType = (clientType ?? "").Trim();
            if (normalizedClientType.Equals("PC", StringComparison.OrdinalIgnoreCase))
            {
                var minutes = ReadPositiveInt(clientModel, "SessionAuthTimeout");
                return TimeSpan.FromMinutes(minutes > 0 ? minutes : 20);
            }

            var days = 0;
            if (normalizedClientType.Equals("VSCode", StringComparison.OrdinalIgnoreCase))
            {
                days = ReadPositiveInt(clientModel, "VSCodeAccessTokenLifetime", "AccessTokenLifetime");
            }
            else if (normalizedClientType.Equals("MCP", StringComparison.OrdinalIgnoreCase))
            {
                days = ReadPositiveInt(clientModel, "McpAccessTokenLifetime", "AccessTokenLifetime");
            }
            else
            {
                days = ReadPositiveInt(clientModel, "AccessTokenLifetime");
            }

            return TimeSpan.FromDays(days > 0 ? days : 30);
        }

        public static string DescribeClientTokenLifetime(OsClientSecret clientModel, string clientType)
        {
            var lifetime = ResolveClientTokenLifetime(clientModel, clientType);
            return lifetime.TotalDays >= 1
                ? $"{lifetime.TotalDays:0.##}天"
                : $"{lifetime.TotalMinutes:0.##}分钟";
        }

        public static TimeSpan ResolveClientTokenRefreshLeadTime(OsClientSecret clientModel, string clientType)
        {
            var lifetime = ResolveClientTokenLifetime(clientModel, clientType);
            var leadTime = TimeSpan.FromTicks(Math.Max(1, lifetime.Ticks / 10));
            if (leadTime < TimeSpan.FromMinutes(5))
            {
                leadTime = TimeSpan.FromMinutes(5);
            }
            if (leadTime > TimeSpan.FromDays(1))
            {
                leadTime = TimeSpan.FromDays(1);
            }
            if (leadTime >= lifetime)
            {
                leadTime = TimeSpan.FromTicks(Math.Max(1, lifetime.Ticks / 2));
            }
            return leadTime;
        }

        public static bool ShouldRotateClientToken(
            string token,
            OsClientSecret clientModel,
            string clientType,
            DateTime activeTokenUpdateTime)
        {
            var refreshLeadTime = ResolveClientTokenRefreshLeadTime(clientModel, clientType);
            try
            {
                var jwtToken = new JwtSecurityTokenHandler().ReadJwtToken(NormalizeBearerToken(token));
                if (jwtToken.ValidTo != DateTime.MinValue)
                {
                    return jwtToken.ValidTo <= DateTime.UtcNow.Add(refreshLeadTime);
                }
            }
            catch
            {
                return true;
            }

            if (activeTokenUpdateTime == default)
            {
                return true;
            }
            var refreshAge = ResolveClientTokenLifetime(clientModel, clientType) - refreshLeadTime;
            return DateTime.Now - activeTokenUpdateTime >= refreshAge;
        }

        private static string NormalizeBearerToken(string token)
        {
            return token.DosTrim().DosReplace("Bearer ", "");
        }

        public static bool IsTokenEntryWithinRotationGrace(TokensModel tokenEntry, DateTime? now = null)
        {
            if (tokenEntry == null)
            {
                return false;
            }
            if (!tokenEntry.RetiredTime.HasValue)
            {
                return true;
            }
            return (now ?? DateTime.Now) - tokenEntry.RetiredTime.Value <= TokenRotationGracePeriod;
        }

        public static bool IsCurrentAuthVersion(IEnumerable<Claim> claims)
        {
            var authVersion = claims?.FirstOrDefault(d => d.Type == AuthVersionClaimType)?.Value;
            return string.Equals(authVersion, CurrentAuthVersion, StringComparison.Ordinal);
        }

        public static TokensModel GetActiveCachedTokenEntry(CurrentToken tokenModel, string requestToken)
        {
            var normalizedToken = NormalizeBearerToken(requestToken);
            if (tokenModel == null || normalizedToken.DosIsNullOrWhiteSpace())
            {
                return null;
            }

            if (!string.Equals(tokenModel.AuthVersion, CurrentAuthVersion, StringComparison.Ordinal))
            {
                return null;
            }

            var tokenEntry = tokenModel.Tokens?.FirstOrDefault(d =>
                string.Equals(d.AuthVersion, CurrentAuthVersion, StringComparison.Ordinal)
                && IsTokenEntryWithinRotationGrace(d)
                && string.Equals(NormalizeBearerToken(d.Token), normalizedToken, StringComparison.Ordinal));

            if (tokenEntry != null)
            {
                return tokenEntry;
            }

            if (string.Equals(NormalizeBearerToken(tokenModel.Token), normalizedToken, StringComparison.Ordinal))
            {
                return new TokensModel
                {
                    Token = tokenModel.Token,
                    AuthVersion = tokenModel.AuthVersion,
                    CreateTime = tokenModel.CreateTime,
                    UpdateTime = tokenModel.UpdateTime
                };
            }

            return null;
        }

        public static bool IsActiveCachedToken(CurrentToken tokenModel, string requestToken)
        {
            return GetActiveCachedTokenEntry(tokenModel, requestToken) != null;
        }

        /// <summary>
        /// 将 Token 已过期时长转换为面向用户的分钟、小时或天描述。
        /// </summary>
        public static string DescribeExpiredDuration(TimeSpan elapsed)
        {
            if (elapsed < TimeSpan.Zero)
            {
                elapsed = TimeSpan.Zero;
            }
            if (elapsed.TotalMinutes < 1)
            {
                return "不足1分钟";
            }
            if (elapsed.TotalHours < 1)
            {
                return $"{Math.Max(1, (int)Math.Floor(elapsed.TotalMinutes))}分钟";
            }
            if (elapsed.TotalDays < 1)
            {
                var hours = Math.Max(1, (int)Math.Floor(elapsed.TotalHours));
                var minutes = elapsed.Minutes;
                return minutes > 0 ? $"{hours}小时{minutes}分钟" : $"{hours}小时";
            }

            var days = Math.Max(1, (int)Math.Floor(elapsed.TotalDays));
            var remainingHours = elapsed.Hours;
            return remainingHours > 0 ? $"{days}天{remainingHours}小时" : $"{days}天";
        }

        /// <summary>
        /// 获取当前 OsClient
        /// </summary>
        /// <param name="returnDefaultOsClient">当未从当前上下文获取到OsClient时，是否返回默认的OsClient</param>
        /// <returns></returns>
        public static string GetCurrentOsClient(bool returnDefaultOsClient = true)
        {
            try
            {
                var context = DiyHttpContext.Current;
                if (context == null)
                {
                    return returnDefaultOsClient ? OsClientExtend.GetConfigOsClient() : "";
                }
                var osClient = "";
                //先从query、form、headers中获取
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Query["osclient"].ToString();
                }
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Query["OsClient"].ToString();
                }
                
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Query["_osclient"].ToString();
                }
                if (context.Request?.HasFormContentType == true)
                {
                    if (osClient.DosIsNullOrWhiteSpace())
                    {
                        osClient = context.Request?.Form["osclient"].ToString();
                    }
                    if (osClient.DosIsNullOrWhiteSpace())
                    {
                        osClient = context.Request?.Form["OsClient"].ToString();
                    }
                    if (osClient.DosIsNullOrWhiteSpace())
                    {
                        osClient = context.Request?.Form["_osclient"].ToString();
                    }
                }
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Headers["osclient"].ToString();
                }

                //再从Token中获取，如果不对等，可能是B租户在调用A租户的公开接口，此时需要将CurrentUser置空
                var claims = context.User.Claims;
                var token = context.Request?.Headers["Authorization"].ToString();
                if (token.DosIsNullOrWhiteSpace() && context.Request?.HasFormContentType == true)
                {
                    token = context.Request?.Form["authorization"].ToString();
                }
                token = token.DosTrim().DosReplace("Bearer ", "");
                if (!token.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token)?.Claims?.ToList();
                    }
                    catch (System.Exception ex)
                    {
                        // 2026-05-01 安全审计：记录 JWT 解析失败（可能是伪造、篡改或格式错误的 Token）
                        Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】JWT 解析失败: {ex.Message}");
                    }
                }
                var tokenOsClient = claims?.FirstOrDefault(d => d.Type == "OsClient")?.Value;

                //2026-05-01 修复跨租户越权：如果 Token 中的 OsClient 与请求参数中的 OsClient 不一致，
                //说明 B 租户携带 A 租户 Token 调用，必须清空登录身份强制按匿名处理（防止越权）。
                //保留原 osClient（请求参数指定的租户），但当前用户身份不再生效。
                if (!tokenOsClient.DosIsNullOrWhiteSpace()
                    && !osClient.DosIsNullOrWhiteSpace()
                    && tokenOsClient != osClient)
                {
                    Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】跨租户调用：Token.OsClient={tokenOsClient}，请求 OsClient={osClient}，已清空当前用户身份");
                    try
                    {
                        if (context.User?.Identity is ClaimsIdentity ci)
                        {
                            // 移除 ClaimsIdentity 中的所有 Claim，使后续 GetCurrentToken/GetCurrentUser 拿不到身份
                            var allClaims = ci.Claims.ToList();
                            foreach (var c in allClaims) ci.TryRemoveClaim(c);
                        }
                    }
                    catch (System.Exception ex)
                    {
                        Console.WriteLine($"Microi：【⚠️安全】清空跨租户身份失败：{ex.Message}");
                    }
                }

                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = tokenOsClient;
                }

                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = OsClientExtend.GetConfigOsClient();
                    return returnDefaultOsClient ? OsClientExtend.GetConfigOsClient() : "";
                }
                return osClient;
            }
            catch (Exception ex)
            {
                return returnDefaultOsClient ? OsClientExtend.GetConfigOsClient() : "";
            }
        }
         /// <summary>
        /// 设置用户信息
        /// </summary>
        public JObject SetSysUserRoleInfo(dynamic userModel, string osClient)
        {
            #region GetSysUserOtherInfo
            JObject sysUser = JObject.FromObject(userModel);

            //2022-11-17 从sys_user表的RoleIds字段中获取所有角色Id
            var roleIds = new List<string>();
            try
            {
                try
                {
                    if (!sysUser["RoleIds"].Val<string>().Contains("{"))
                    {
                        roleIds = JsonHelper.Deserialize<List<string>>(sysUser["RoleIds"].Val<string>());
                    }
                    else
                    {
                        var roles = JsonHelper.Deserialize<List<SysRole>>(sysUser["RoleIds"].Val<string>());
                        roleIds = roles.Select(d => d.Id).ToList();
                    }
                }
                catch (Exception ex)
                {
                    var roles = JsonHelper.Deserialize<List<SysRole>>(sysUser["RoleIds"].Val<string>());
                    roleIds = roles.Select(d => d.Id).ToList();
                }
                if (!roleIds.Any())
                {
                    sysUser["_IsAdmin"] = false;
                    sysUser["_Roles"] = JTokenEx.FromObject(new List<SysRole>());
                    sysUser["_RoleLimits"] = JTokenEx.FromObject(new List<SysRoleLimit>());
                }
                else
                {
                    var roleList = MicroiEngine.FormEngine.GetTableDataAsync<SysRole>(new
                    {
                        FormEngineKey = "sys_role",
                        _Where = new List<DiyWhere>() {
                                            new DiyWhere(){
                                                Name = "Id",
                                                Value = JsonHelper.Serialize(roleIds),
                                                Type = "In"
                                            }
                                        },
                        //Ids = roleIds,
                        OsClient = osClient
                    }).GetAwaiter().GetResult();

                    sysUser["_Roles"] = JTokenEx.FromObject(roleList.Data);


                    //var sysMenuLimits = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
                    //{
                    //    RoleIds = roleList.Data.Select(d => d.Id).ToList(),
                    //    OsClient = osClient
                    //});

                    var sysMenuLimits = MicroiEngine.FormEngine.GetTableDataAsync<SysRoleLimit>(new
                    {
                        FormEngineKey = "sys_rolelimit",
                        _Where = new List<DiyWhere>() {
                                            new DiyWhere(){
                                                Name = "RoleId",
                                                Value = JsonHelper.Serialize(roleList.Data.Select(d => d.Id).ToList()),
                                                Type = "In"
                                            }
                                        },
                        OsClient = osClient
                    }).GetAwaiter().GetResult();
                    if (sysMenuLimits.Code == 1)
                    {
                        sysUser["_RoleLimits"] = JTokenEx.FromObject(sysMenuLimits.Data);
                    }
                    else
                    {
                        sysUser["_RoleLimits"] = JTokenEx.FromObject(new List<SysRoleLimit>());
                        sysUser["_RoleLimitsError1"] = sysMenuLimits.Msg;
                    }
                    sysUser["_IsAdmin"] = sysUser["Level"].Val<int>() >= DiyCommon.MaxRoleLevel;
                }
            }
            catch (Exception ex)
            {

                sysUser["_IsAdmin"] = false;
                sysUser["_Roles"] = JTokenEx.FromObject(new List<SysRole>());
                sysUser["_RoleLimits"] = JTokenEx.FromObject(new List<SysRoleLimit>());
                sysUser["_RoleLimitsError2"] = ex.Message;
            }

            #endregion

            return sysUser;
        }

        /// <summary>
        /// 必传OsClient
        /// 生成全新Token，如登陆成功获取Token、Token过期刷新Token（注：DiyFilter会自动判断即将过期的Token并自动获取、更新Token），
        /// 请勿频繁调用，每次调用均会生成新的Token
        /// 获取当前身份信息请使用GetCurrentUser
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult<CurrentToken>> GetAccessToken(DiyTokenParam param)
        {
            var osClient = "";
            var currentToken = await GetCurrentToken(false);
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient;
            }
            else
            {
                osClient = param.OsClient;
            }
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<CurrentToken>(0, null, "OsClient不能为空！");
            }
            var clientModel = OsClientExtend.GetClient(osClient);
            var access_token = "";
            var context = DiyHttpContext.Current;
            try
            {
                //客户端设备Id
                var did = param.Did;
                if (context != null)
                {
                    var headerDid = context.Request.Headers["did"].ToString();
                    if (!headerDid.DosIsNullOrWhiteSpace())
                    {
                        did = headerDid;
                    }
                }
                did = did.DosIsNullOrWhiteSpace() ? "Empty" : did;
                var ip = IPHelper.GetClientIP(context).Data ?? "";
                {
                    JObject currentUser = param.CurrentUser;
                    List<Claim> claims = new List<Claim>();
                    var userId = currentUser["Id"].ToString();
                    var clientType = param._ClientType.DosIsNullOrWhiteSpace() ? "Empty" : param._ClientType;
                    var dateTimeNow = DateTime.Now;
                    claims.Add(new Claim("UserId", userId));
                    claims.Add(new Claim("OsClient", osClient));
                    claims.Add(new Claim("ClientType", clientType));
                    claims.Add(new Claim("Did", did));
                    claims.Add(new Claim("IP", ip));
                    claims.Add(new Claim("CreateTime", dateTimeNow.ToString("yyyy-MM-dd HH:mm:ss")));
                    claims.Add(new Claim(AuthVersionClaimType, CurrentAuthVersion));
                    claims.Add(new Claim(TokenIssuedAtClaimType, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()));
                    #region header返回
                    if (context != null)
                    {
                        if (!context.Response.Headers.Any(d => d.Key.ToLower() == "osclient"))
                        {
                            DiyCommon.TryAction(() =>
                            {
                                context.Response.Headers.Add("osclient", osClient);
                            });
                        }
                    }
                    #endregion
                    var tokenExpires = DateTime.Now.Add(ResolveClientTokenLifetime(clientModel, clientType));

                    var handler = new JwtSecurityTokenHandler();

                    var jwtKey = ResolveJwtSigningKey(clientModel);

                    var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
                    var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

                    var token = new JwtSecurityToken(
                        issuer: "microi",
                        audience: "microi",
                        claims: claims,
                        expires: tokenExpires,
                        signingCredentials: credentials
                    );
                    var jwtTokenHandler = new JwtSecurityTokenHandler();
                    access_token = jwtTokenHandler.WriteToken(token);


                    //不能用.Result，否则 redis 会超时 timeout 5000
                    var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);
                    var userTokenCacheKey = $"Microi:{osClient}:LoginTokenSysUser:{userId}";

                    CurrentToken tokenModel = null;
                    var rotateFromToken = NormalizeBearerToken(param.RotateFromToken);
                    var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                    {
                        Key = $"{userTokenCacheKey}:Rotate",
                        OsClient = osClient,
                        Expiry = TimeSpan.FromSeconds(10),
                        RetryIntervalMs = 10,
                        UseExponentialBackoff = true
                    }, async () =>
                    {
                        try
                        {
                            tokenModel = await DiyCacheBase.GetAsync<CurrentToken>(userTokenCacheKey);
                        }
                        catch
                        {
                            tokenModel = null;
                        }

                        if (tokenModel == null)
                        {
                            tokenModel = new CurrentToken
                            {
                                CurrentUser = currentUser,
                                CreateTime = dateTimeNow,
                                UpdateTime = dateTimeNow,
                                Token = access_token,
                                AuthVersion = CurrentAuthVersion,
                                OsClient = osClient,
                                Tokens = new List<TokensModel>
                                {
                                    new TokensModel
                                    {
                                        Token = access_token,
                                        AuthVersion = CurrentAuthVersion,
                                        ClientType = clientType,
                                        Did = did,
                                        IP = ip,
                                        CreateTime = dateTimeNow,
                                        UpdateTime = dateTimeNow
                                    }
                                }
                            };
                        }
                        else
                        {
                            tokenModel.CurrentUser = currentUser;
                            tokenModel.UpdateTime = dateTimeNow;
                            tokenModel.AuthVersion = CurrentAuthVersion;
                            tokenModel.OsClient = osClient;
                            tokenModel.Tokens = tokenModel.Tokens?
                                .Where(d => d != null
                                            && string.Equals(d.AuthVersion, CurrentAuthVersion, StringComparison.Ordinal)
                                            && IsTokenEntryWithinRotationGrace(d, dateTimeNow))
                                .ToList() ?? new List<TokensModel>();

                            var currentTerminalToken = tokenModel.Tokens.FirstOrDefault(d =>
                                !d.RetiredTime.HasValue
                                && string.Equals(d.Did, did, StringComparison.Ordinal)
                                && string.Equals(d.ClientType, clientType, StringComparison.Ordinal));

                            // 同一终端已有另一个并发请求完成了续签时，复用它的新 Token，避免连续轮换和响应乱序。
                            var reuseConcurrentRotation = !rotateFromToken.DosIsNullOrWhiteSpace()
                                && currentTerminalToken != null
                                && !string.Equals(
                                    NormalizeBearerToken(currentTerminalToken.Token),
                                    rotateFromToken,
                                    StringComparison.Ordinal);
                            if (reuseConcurrentRotation)
                            {
                                access_token = currentTerminalToken.Token;
                                currentTerminalToken.IP = ip;
                                currentTerminalToken.UpdateTime = dateTimeNow;
                            }
                            else
                            {
                                if (rotateFromToken.DosIsNullOrWhiteSpace())
                                {
                                    // 主动登录/换号应立即替换同终端旧登录态，不应用自动续签的兼容窗口。
                                    tokenModel.Tokens.RemoveAll(d =>
                                        string.Equals(d.Did, did, StringComparison.Ordinal)
                                        && string.Equals(d.ClientType, clientType, StringComparison.Ordinal));
                                }
                                else
                                {
                                    foreach (var oldToken in tokenModel.Tokens.Where(d =>
                                                 !d.RetiredTime.HasValue
                                                 && string.Equals(d.Did, did, StringComparison.Ordinal)
                                                 && string.Equals(d.ClientType, clientType, StringComparison.Ordinal)))
                                    {
                                        oldToken.RetiredTime = dateTimeNow;
                                    }
                                }
                                tokenModel.Tokens.Insert(0, new TokensModel
                                {
                                    Token = access_token,
                                    AuthVersion = CurrentAuthVersion,
                                    ClientType = clientType,
                                    Did = did,
                                    IP = ip,
                                    CreateTime = dateTimeNow,
                                    UpdateTime = dateTimeNow
                                });
                            }
                            tokenModel.Token = access_token;
                        }

                        await DiyCacheBase.SetAsync(userTokenCacheKey, tokenModel);
                    });
                    if (lockResult.Code != 1 || tokenModel == null)
                    {
                        return new DosResult<CurrentToken>(
                            lockResult.Code == 1 ? 0 : lockResult.Code,
                            null,
                            lockResult.Msg.DosIsNullOrWhiteSpace() ? "Token续签繁忙，请稍后重试。" : lockResult.Msg);
                    }
                    if (context != null && !context.Response.Headers.Any(d => d.Key.ToLower() == "authorization"))
                    {
                        try
                        {
                            context.Response.Headers.Add("authorization", access_token);
                        }
                        catch (Exception)
                        {

                        }
                    }
                    if (rotateFromToken.DosIsNullOrWhiteSpace())
                    {
                        UserBehaviorAudit.Track(new BaseParam
                        {
                            OsClient = osClient,
                            _CurrentUser = currentUser,
                            _ClientType = clientType,
                            _InvokeType = InvokeType.Client.ToString()
                        }, "Session", "Login", "用户登录", "Session", UserBehaviorAudit.HashIdentifier(access_token),
                            $"登录系统，终端[{clientType}]", new { ClientType = clientType, Did = did, IP = ip }, true, null,
                            "TokenLifecycle", UserBehaviorAudit.HashIdentifier(access_token), did,
                            UserBehaviorAudit.DeterministicEventId($"session-login|{osClient}|{UserBehaviorAudit.HashIdentifier(access_token)}"));
                    }
                    return new DosResult<CurrentToken>(1, tokenModel);
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "获取iTdosToken",
                    Title = "获取AccessToken抛出异常",
                    Content = ex.Message,
                    OsClient = osClient
                });
                return new DosResult<CurrentToken>(0, null, ex.Message);
            }
        }
        /// <summary>
        /// 获取当前登录身份信息
        /// </summary>
        /// <returns></returns>
        public static async Task<JObject> GetCurrentUser()
        {
            var currentToken = await GetCurrentToken();
            return currentToken.CurrentUser;
        }
        /// <summary>
        /// 获取当前登录身份信息，包含Token、OsClient
        /// </summary>
        public static async Task<JObject> GetCurrentUser(string token, string osClient = "")
        {
            try
            {
                token = token.DosTrim().DosReplace("Bearer ", "");
                if (!token.DosIsNullOrWhiteSpace())
                {
                    var jwtHandler = new JwtSecurityTokenHandler();
                    var claims = new List<Claim>();
                    JwtSecurityToken jwtToken = null;

                    try
                    {
                        jwtToken = jwtHandler.ReadJwtToken(token);
                        claims = jwtToken?.Claims.ToList();
                    }
                    catch (System.Exception)
                    {

                    }

                    if (jwtToken == null || claims == null || claims.Count == 0)
                    {
                        return null;
                    }
                    if (jwtToken.ValidTo != DateTime.MinValue && jwtToken.ValidTo < DateTime.UtcNow)
                    {
                        return null;
                    }

                    var userId = claims.FirstOrDefault(d => d.Type == "UserId")?.Value;
                    osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                    var clientType = claims.FirstOrDefault(d => d.Type == "ClientType")?.Value;
                    clientType = clientType.DosIsNullOrWhiteSpace("Empty");

                    if (!IsCurrentAuthVersion(claims))
                    {
                        return null;
                    }

                    if (!userId.DosIsNullOrWhiteSpace() && !osClient.DosIsNullOrWhiteSpace())
                    {
                        var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);

                        var tokenModel = await DiyCacheBase.GetAsync<CurrentToken>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                        if (tokenModel != null && tokenModel.CurrentUser != null && IsActiveCachedToken(tokenModel, token))
                        {
                            return tokenModel.CurrentUser;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "GetCurrentToken",
                    Title = "根据token字符串获取iTdosToken出错",
                    Content = ex.Message,// + "。" + ex.StackTrace,
                    OsClient = osClient //必传
                });
            }
            return null;
        }

        /// <summary>
        /// 从缓存中获取当前登录令牌信息（包含用户信息、Token、OsClient等）
        /// </summary>
        /// <param name="returnDefaultOsClient">当未从当前上下文获取到OsClient时，是否返回默认的OsClient</param>
        /// <returns></returns>
        public static async Task<CurrentToken> GetCurrentToken(bool returnDefaultOsClient = true)
        {
            var osClient = GetCurrentOsClient(returnDefaultOsClient);
            var token  = "";
            try
            {
                var context = DiyHttpContext.Current;
                if (context == null)
                {
                    return new CurrentToken()
                    {
                        OsClient = osClient
                    };
                }
                var claims = context.User.Claims;

                token = context.Request.Headers["Authorization"].ToString();
                if (token.DosIsNullOrWhiteSpace() && context.Request?.HasFormContentType == true)
                {
                    token = context.Request?.Form["authorization"].ToString();
                }
                token = token.DosTrim().DosReplace("Bearer ", "");
                if (!token.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token)?.Claims?.ToList();
                    }
                    catch (System.Exception)
                    {

                    }
                }
                var tokenOsClient = claims?.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                if(!tokenOsClient.DosIsNullOrWhiteSpace() && tokenOsClient != osClient)
                {
                    return new CurrentToken()
                    {
                        OsClient = osClient
                    };
                }


                var attributeList = new List<object>();
                var userId = claims?.FirstOrDefault(d => d.Type == "UserId")?.Value;
                var clientType = claims?.FirstOrDefault(d => d.Type == "ClientType")?.Value;


                clientType = clientType.DosIsNullOrWhiteSpace("Empty");

                if (!token.DosIsNullOrWhiteSpace() && !IsCurrentAuthVersion(claims))
                {
                    return new CurrentToken()
                    {
                        OsClient = osClient,
                        Token = token
                    };
                }

                if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace())
                {
                    return new CurrentToken()
                    {
                        OsClient = osClient,
                        Token = token
                    };
                }

                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);

                var tokenModel = await DiyCacheBase.GetAsync<CurrentToken>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                if (tokenModel == null || tokenModel.CurrentUser == null)
                {
                    return new CurrentToken()
                    {
                        OsClient = osClient,
                        Token = token
                    };
                }
                if (!IsActiveCachedToken(tokenModel, token))
                {
                    return new CurrentToken()
                    {
                        OsClient = osClient,
                        Token = token
                    };
                }
                tokenModel.OsClient = osClient;
                return tokenModel;
            }
            catch (Exception ex)
            {
                return new CurrentToken()
                {
                    OsClient = osClient,
                    Token = token
                };
            }
        }

        /// <summary>
        /// osClient可不传，传的话若获取token信息失败，会正确的写系统日志。
        /// </summary>
        public static async Task<CurrentToken> GetCurrentToken(string token, string osClient = "")
        {
            try
            {
                token = token.DosTrim().DosReplace("Bearer ", "");
                if (!token.DosIsNullOrWhiteSpace())
                {
                    var jwtHandler = new JwtSecurityTokenHandler();
                    var claims = new List<Claim>();

                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token)?.Claims.ToList();
                    }
                    catch (System.Exception)
                    {

                    }

                    var userId = claims.FirstOrDefault(d => d.Type == "UserId")?.Value;
                    var thisOsClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                    if (!osClient.DosIsNullOrWhiteSpace() && osClient != thisOsClient)
                    {
                        return null;
                    }
                    var clientType = claims.FirstOrDefault(d => d.Type == "ClientType")?.Value;
                    clientType = clientType.DosIsNullOrWhiteSpace("Empty");
                    if (!IsCurrentAuthVersion(claims))
                    {
                        return null;
                    }

                    if (!userId.DosIsNullOrWhiteSpace() && !thisOsClient.DosIsNullOrWhiteSpace())
                    {
                        var DiyCacheBase = MicroiEngine.CacheTenant.Cache(thisOsClient);
                        var tokenModel = await DiyCacheBase.GetAsync<CurrentToken>($"Microi:{thisOsClient}:LoginTokenSysUser:{userId}");
                        if (tokenModel != null && tokenModel.CurrentUser != null && IsActiveCachedToken(tokenModel, token))
                        {
                            tokenModel.OsClient = thisOsClient;
                            return tokenModel;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "GetCurrentToken",
                    Title = "根据token字符串获取iTdosToken出错",
                    Content = ex.Message,// + "。" + ex.StackTrace,
                    OsClient = osClient //必传
                });
            }
            return null;
        }

        public static async Task<TokenAuthDiagnostic> DiagnoseInactiveTokenDetail(string token, string osClient = "")
        {
            var diagnostic = new TokenAuthDiagnostic
            {
                RequestOsClient = osClient?.Trim() ?? ""
            };
            try
            {
                var normalizedToken = NormalizeBearerToken(token);
                if (normalizedToken.DosIsNullOrWhiteSpace())
                {
                    diagnostic.ReasonCode = "MissingToken";
                    diagnostic.UserMessage = "请求未携带Token，请重新登录。";
                    return diagnostic;
                }

                JwtSecurityToken jwtToken;
                try
                {
                    jwtToken = new JwtSecurityTokenHandler().ReadJwtToken(normalizedToken);
                }
                catch
                {
                    diagnostic.ReasonCode = "MalformedToken";
                    diagnostic.UserMessage = "当前Token格式无效，请重新登录。";
                    return diagnostic;
                }

                var claims = jwtToken.Claims?.ToList();
                var userId = claims?.FirstOrDefault(d => d.Type == "UserId")?.Value;
                var tokenOsClient = claims?.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                var clientType = claims?.FirstOrDefault(d => d.Type == "ClientType")?.Value;
                var did = claims?.FirstOrDefault(d => d.Type == "Did")?.Value;
                diagnostic.TokenOsClient = tokenOsClient ?? "";
                diagnostic.ClientType = clientType.DosIsNullOrWhiteSpace("Empty");
                diagnostic.Did = did.DosIsNullOrWhiteSpace("Empty");
                if (long.TryParse(claims?.FirstOrDefault(d => d.Type == TokenIssuedAtClaimType)?.Value, out var issuedAtSeconds))
                {
                    diagnostic.IssuedAt = DateTimeOffset.FromUnixTimeSeconds(issuedAtSeconds)
                        .LocalDateTime
                        .ToString("yyyy-MM-dd HH:mm:ss");
                }
                if (userId.DosIsNullOrWhiteSpace() || tokenOsClient.DosIsNullOrWhiteSpace())
                {
                    diagnostic.ReasonCode = "MissingClaims";
                    diagnostic.UserMessage = "当前Token缺少用户或租户信息，请重新登录。";
                    return diagnostic;
                }
                if (!osClient.DosIsNullOrWhiteSpace()
                    && !string.Equals(osClient, tokenOsClient, StringComparison.OrdinalIgnoreCase))
                {
                    diagnostic.ReasonCode = "TenantMismatch";
                    diagnostic.IsTenantMismatch = true;
                    diagnostic.UserMessage = $"当前Token属于租户【{tokenOsClient}】，不能用于当前租户【{osClient}】，请切换到正确租户或重新登录。";
                    return diagnostic;
                }
                if (!IsCurrentAuthVersion(claims))
                {
                    diagnostic.ReasonCode = "AuthVersionChanged";
                    diagnostic.UserMessage = "当前Token的安全版本已失效，请重新登录。";
                    return diagnostic;
                }
                if (jwtToken.ValidTo != DateTime.MinValue && jwtToken.ValidTo < DateTime.UtcNow)
                {
                    diagnostic.ReasonCode = "JwtExpired";
                    diagnostic.SetExpired(jwtToken.ValidTo);
                    diagnostic.UserMessage = $"当前Token已过期{diagnostic.ExpiredFor}（过期时间：{diagnostic.ExpiresAt}），请重新登录。";
                    return diagnostic;
                }
                if (jwtToken.ValidTo != DateTime.MinValue)
                {
                    diagnostic.ExpiresAt = jwtToken.ValidTo.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss");
                }

                CurrentToken tokenModel;
                try
                {
                    var cache = MicroiEngine.CacheTenant.Cache(tokenOsClient);
                    tokenModel = await cache.GetAsync<CurrentToken>($"Microi:{tokenOsClient}:LoginTokenSysUser:{userId}");
                }
                catch
                {
                    diagnostic.ReasonCode = "CacheUnavailable";
                    diagnostic.UserMessage = "暂时无法读取服务端登录状态，请稍后重试。";
                    return diagnostic;
                }
                if (tokenModel == null || tokenModel.CurrentUser == null)
                {
                    diagnostic.ReasonCode = "SessionMissing";
                    diagnostic.UserMessage = "当前Token对应的服务端登录身份已失效，可能已退出、被管理员清除或登录缓存已重建，请重新登录。";
                    return diagnostic;
                }
                if (!string.Equals(tokenModel.AuthVersion, CurrentAuthVersion, StringComparison.Ordinal))
                {
                    diagnostic.ReasonCode = "AuthVersionChanged";
                    diagnostic.UserMessage = "当前Token的安全版本已失效，请重新登录。";
                    return diagnostic;
                }

                var activeTokenEntry = GetActiveCachedTokenEntry(tokenModel, normalizedToken);
                if (activeTokenEntry == null)
                {
                    diagnostic.ReasonCode = "TokenReplaced";
                    diagnostic.UserMessage = "当前Token已被同一终端的新Token替换，可能是其它标签页或并发请求已完成续签，请重试；仍失败时请重新登录。";
                    return diagnostic;
                }

                var clientModel = OsClientExtend.GetClient(tokenOsClient);
                var tokenLifetime = ResolveClientTokenLifetime(clientModel, diagnostic.ClientType);
                var activeUpdateTime = activeTokenEntry.UpdateTime == default
                    ? tokenModel.UpdateTime
                    : activeTokenEntry.UpdateTime;
                if (activeUpdateTime != default)
                {
                    var sessionExpiresAt = activeUpdateTime.Add(tokenLifetime);
                    if (sessionExpiresAt < DateTime.Now)
                    {
                        diagnostic.ReasonCode = "SessionExpired";
                        diagnostic.SetExpired(sessionExpiresAt.ToUniversalTime());
                        diagnostic.UserMessage = $"当前{diagnostic.ClientType}终端登录已过期{diagnostic.ExpiredFor}（有效期：{DescribeClientTokenLifetime(clientModel, diagnostic.ClientType)}，过期时间：{diagnostic.ExpiresAt}），请重新登录。";
                        return diagnostic;
                    }
                }

                diagnostic.ReasonCode = "Unknown";
                diagnostic.UserMessage = "当前Token未处于有效登录状态，请重试；仍失败时请重新登录。";
                return diagnostic;
            }
            catch
            {
                return diagnostic;
            }
        }

        public static async Task<string> DiagnoseInactiveToken(string token, string osClient = "")
        {
            var diagnostic = await DiagnoseInactiveTokenDetail(token, osClient);
            return diagnostic?.ReasonCode ?? "Unknown";
        }

    }
}
