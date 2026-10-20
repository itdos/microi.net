using System;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>宿主与 V8 共用的受限命令存储；实现必须跨节点原子抢占，不重放已经开始发送的命令。</summary>
    public interface IIoTCommandStore
    {
        Task BindAsync(string tenant, string device, string session, IoTDownlinkPolicy policy);
        Task<bool> RenewAsync(string tenant, string device, string session, IoTDownlinkPolicy policy);
        Task ReleaseAsync(string tenant, string device, string session);
        Task<JObject> EnqueueAsync(string tenant, string device, string commandId, string frameHex,
            string caller, string userId, int expireSeconds, IoTDownlinkPolicy policy);
        Task<IoTCommandClaim> ClaimAsync(string tenant, string device, string session, IoTDownlinkPolicy policy);
        Task CompleteAsync(string tenant, string device, string session, string commandId, string state, IoTDownlinkPolicy policy);
    }

    public sealed class IoTCommandClaim
    {
        public bool OwnsConnection { get; set; }
        public JObject Command { get; set; }
    }

    /// <summary>
    /// 使用既有租户 Redis，不新增 MQ/进程。所有权、去重和出队在 Redis 原子执行；
    /// 私有前缀不位于 V8.Cache 的 Microi:{tenant}: 空间，脚本不能伪造连接或命令。
    /// </summary>
    public sealed class RedisIoTCommandStore : IIoTCommandStore
    {
        private readonly IDatabase _db;
        public RedisIoTCommandStore(IDatabase db) { _db = db ?? throw new ArgumentNullException(nameof(db)); }

        // 同租户 Key 使用相同 Redis Cluster hash tag；不把设备号/业务数据直接放进键名。
        private static string Prefix(string tenant, string device) => "__MicroiIoT__:{" +
            IoTDownlinkPolicy.Hash(TenantConfigurationSecurity.NormalizeTenantId(tenant).ToLowerInvariant()) + "}:" + IoTDownlinkPolicy.Hash(device);
        private static string Owner(string session, IoTDownlinkPolicy policy) => session + ":" + policy.Fingerprint;
        private static string StateKey(string prefix, string command) => prefix + ":c:" + IoTDownlinkPolicy.Hash(command);

        public Task BindAsync(string tenant, string device, string session, IoTDownlinkPolicy policy) =>
            _db.StringSetAsync(Prefix(tenant, device) + ":owner", Owner(session, policy), TimeSpan.FromSeconds(policy.LeaseSeconds));

        public async Task<bool> RenewAsync(string tenant, string device, string session, IoTDownlinkPolicy policy)
        {
            var result = await _db.ScriptEvaluateAsync(
                "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('EXPIRE',KEYS[1],ARGV[2]); return 1 end return 0",
                new RedisKey[] { Prefix(tenant, device) + ":owner" },
                new RedisValue[] { Owner(session, policy), policy.LeaseSeconds }).ConfigureAwait(false);
            return (int)result == 1;
        }

        public async Task ReleaseAsync(string tenant, string device, string session)
        {
            // 旧连接关闭时只删除自己的租约，不得误删新连接的所有权。
            await _db.ScriptEvaluateAsync(
                "local o=redis.call('GET',KEYS[1]); if o and string.sub(o,1,string.len(ARGV[1])+1)==ARGV[1]..':' then return redis.call('DEL',KEYS[1]) end return 0",
                new RedisKey[] { Prefix(tenant, device) + ":owner" }, new RedisValue[] { session }).ConfigureAwait(false);
        }

        private const string EnqueueScript = @"
local t=redis.call('TIME'); local now=t[1]*1000+math.floor(t[2]/1000)
local old=redis.call('GET',KEYS[2])
if old then
 local c=cjson.decode(old)
 if c.Fingerprint~=ARGV[1] then return {0,'Conflict',1} end
 if c.State=='Queued' and c.ExpiresAt<=now then
  c.State='Expired'; redis.call('SET',KEYS[2],cjson.encode(c),'PX',math.max(1,redis.call('PTTL',KEYS[2])))
 end
 return {1,c.State,1}
end
local owner=redis.call('GET',KEYS[1])
if not owner or string.sub(owner,-string.len(ARGV[2]))~=ARGV[2] then return {0,'Offline',0} end
local session=string.sub(owner,1,string.len(owner)-string.len(ARGV[2])-1)
local queue=ARGV[3]..session
if redis.call('LLEN',queue)>=tonumber(ARGV[4]) then return {0,'QueueFull',0} end
local c=cjson.decode(ARGV[5]); c.SessionId=session; c.State='Queued'; c.ExpiresAt=now+tonumber(ARGV[6])*1000
redis.call('SET',KEYS[2],cjson.encode(c),'EX',ARGV[7])
redis.call('RPUSH',queue,KEYS[2]); redis.call('EXPIRE',queue,ARGV[8])
return {1,'Queued',0}";

        public async Task<JObject> EnqueueAsync(string tenant, string device, string commandId, string frameHex,
            string caller, string userId, int expireSeconds, IoTDownlinkPolicy policy)
        {
            var prefix = Prefix(tenant, device);
            var fingerprint = IoTDownlinkPolicy.Hash(frameHex + "|" + expireSeconds + "|" + caller.ToLowerInvariant() + "|" + userId + "|" + policy.Fingerprint);
            var body = new JObject { ["CommandId"] = commandId, ["FrameHex"] = frameHex, ["Fingerprint"] = fingerprint };
            var raw = await _db.ScriptEvaluateAsync(EnqueueScript,
                new RedisKey[] { prefix + ":owner", StateKey(prefix, commandId) },
                new RedisValue[] { fingerprint, policy.Fingerprint, prefix + ":q:", policy.MaxPendingCommands,
                    body.ToString(Formatting.None), expireSeconds, policy.DeduplicateSeconds,
                    policy.MaxExpireSeconds + policy.LeaseSeconds }).ConfigureAwait(false);
            var parts = (RedisResult[])raw;
            return new JObject
            {
                ["Code"] = (int)parts[0],
                ["Msg"] = (int)parts[0] == 1 ? "指令已接收；请以设备回执确认执行结果。" : "指令未接收：" + (string)parts[1],
                ["Data"] = new JObject { ["CommandId"] = commandId, ["State"] = (string)parts[1], ["Duplicate"] = (int)parts[2] == 1 }
            };
        }

        private const string ClaimScript = @"
if redis.call('GET',KEYS[1])~=ARGV[1] then return {0,''} end
local t=redis.call('TIME'); local now=t[1]*1000+math.floor(t[2]/1000)
for i=1,tonumber(ARGV[2]) do
 local key=redis.call('LPOP',KEYS[2]); if not key then return {1,''} end
 local raw=redis.call('GET',key)
 if raw then
  local c=cjson.decode(raw)
  if c.State=='Queued' then
   if c.ExpiresAt<=now then c.State='Expired'
   else c.State='Sending' end
   local body=cjson.encode(c); redis.call('SET',key,body,'PX',math.max(1,redis.call('PTTL',key)))
   if c.State=='Sending' then return {1,body} end
  end
 end
end
return {1,''}";

        public async Task<IoTCommandClaim> ClaimAsync(string tenant, string device, string session, IoTDownlinkPolicy policy)
        {
            var prefix = Prefix(tenant, device);
            var raw = await _db.ScriptEvaluateAsync(ClaimScript,
                new RedisKey[] { prefix + ":owner", prefix + ":q:" + session },
                new RedisValue[] { Owner(session, policy), policy.MaxPendingCommands }).ConfigureAwait(false);
            var parts = (RedisResult[])raw;
            var body = (string)parts[1];
            return new IoTCommandClaim { OwnsConnection = (int)parts[0] == 1,
                Command = string.IsNullOrEmpty(body) ? null : JObject.Parse(body) };
        }

        public async Task CompleteAsync(string tenant, string device, string session, string commandId, string state, IoTDownlinkPolicy policy)
        {
            if (state != "Written" && state != "Unknown") throw new ArgumentException("无效的传输完成状态。");
            await _db.ScriptEvaluateAsync(@"
local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end
local c=cjson.decode(raw)
if c.State~='Sending' or c.SessionId~=ARGV[1] then return 0 end
c.State=ARGV[2]; redis.call('SET',KEYS[1],cjson.encode(c),'PX',math.max(1,redis.call('PTTL',KEYS[1]))); return 1",
                new RedisKey[] { StateKey(Prefix(tenant, device), commandId) }, new RedisValue[] { session, state }).ConfigureAwait(false);
        }
    }
}
