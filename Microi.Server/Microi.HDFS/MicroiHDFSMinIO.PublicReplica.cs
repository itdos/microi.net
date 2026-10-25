using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Minio.DataModel.Args;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class MicroiHDFSMinIO : IPublicResourceReplicaStore
    {
        /// <summary>只用可信 SaaS 对象测试公有桶；不回传地址、账号、签名或供应商异常正文。</summary>
        public async Task<DosResult> ProbePublicReplicaStoreAsync(OsClientSecret storageOwner,
            CancellationToken cancellationToken)
        {
            try
            {
                var config = storageOwner?.OsClientModel ?? throw new InvalidOperationException();
                using var client = BuildMinioClient(config.Value<string>("MinIOEndPoint"),
                    config.Value<int?>("MinIOEndPointSSL") == 1, config.Value<string>("MinIOAccessKey"),
                    config.Value<string>("MinIOSecretKey"), config.Value<string>("MinIORegion"));
                var bucket = config.Value<string>("MinIOPublicBucketName");
                var exists = await client.BucketExistsAsync(new BucketExistsArgs().WithBucket(bucket), cancellationToken)
                    .ConfigureAwait(false);
                return new DosResult(exists ? 1 : 0, new { ConfiguredPublicBucketExists = exists },
                    exists ? "BackupPublicBucketVerified" : "BackupPublicBucketMissing");
            }
            catch (OperationCanceledException) { throw; }
            catch { return new DosResult(0, null, "BackupStorageProbeFailed"); }
        }

        /// <summary>
        /// 整组流式回读校验完成后才公开本次唯一前缀。合并已有策略，仅增加 GetObject；
        /// 不允许列桶、写入、删除、私有桶或 staging 命名空间，也不覆盖用户其它策略。
        /// 同桶策略合并由调用方持有共享存储租约，失败关闭，不以异常当作空策略。
        /// </summary>
        public async Task<DosResult> AllowVerifiedPublicReplicaPrefixAsync(OsClientSecret storageOwner,
            string verifiedPrefix, CancellationToken cancellationToken)
        {
            if (!IsPublicReplicaPrefix(verifiedPrefix)) return new DosResult(0, null, "InvalidPublicReplicaPrefix");
            try
            {
                var config = storageOwner?.OsClientModel ?? throw new InvalidOperationException();
                var bucket = config.Value<string>("MinIOPublicBucketName");
                if (string.IsNullOrWhiteSpace(bucket)
                    || string.Equals(bucket, config.Value<string>("MinIOPrivateBucketName"), StringComparison.Ordinal))
                    return new DosResult(0, null, "SeparatePublicBucketRequired");
                using var client = BuildMinioClient(config.Value<string>("MinIOEndPoint"),
                    config.Value<int?>("MinIOEndPointSSL") == 1, config.Value<string>("MinIOAccessKey"),
                    config.Value<string>("MinIOSecretKey"), config.Value<string>("MinIORegion"));
                var existing = await client.GetPolicyAsync(new GetPolicyArgs().WithBucket(bucket), cancellationToken)
                    .ConfigureAwait(false);
                var policy = JObject.Parse(existing);
                var statements = policy["Statement"] as JArray ?? throw new InvalidOperationException();
                var resource = "arn:aws:s3:::" + bucket + "/" + verifiedPrefix + "*";
                var alreadyPresent = statements.OfType<JObject>().Any(statement =>
                    statement.Value<string>("Sid") == "MicroiVerifiedHotspotReadV2"
                    && statement["Resource"] is JArray resources && resources.Values<string>().Contains(resource));
                if (!alreadyPresent)
                {
                    // 每条只授权一个不可变发布组。限定策略体积，不能以截断或丢弃旧条目继续。
                    var managed = statements.OfType<JObject>().SingleOrDefault(statement =>
                        statement.Value<string>("Sid") == "MicroiVerifiedHotspotReadV2");
                    if (managed != null)
                    {
                        // 只维护本协议拥有的唯一语句，其它用户策略保持原文；拒绝已被改成其它权限的同名项。
                        if (managed.Value<string>("Effect") != "Allow"
                            || managed["Action"]?.ToString(Newtonsoft.Json.Formatting.None) != "[\"s3:GetObject\"]"
                            || managed["Principal"]?["AWS"]?.ToString(Newtonsoft.Json.Formatting.None) != "[\"*\"]"
                            || !(managed["Resource"] is JArray existingResources))
                            return new DosResult(0, null, "ManagedPublicPolicyConflict");
                        existingResources.Add(resource);
                    }
                    else statements.Add(new JObject
                    {
                        ["Sid"] = "MicroiVerifiedHotspotReadV2", ["Effect"] = "Allow",
                        ["Principal"] = new JObject { ["AWS"] = new JArray("*") },
                        ["Action"] = new JArray("s3:GetObject"), ["Resource"] = new JArray(resource)
                    });
                    var serialized = policy.ToString(Newtonsoft.Json.Formatting.None);
                    if (System.Text.Encoding.UTF8.GetByteCount(serialized) > 20480)
                        return new DosResult(0, null, "BackupPublicPolicyCapacityReached");
                    await client.SetPolicyAsync(new SetPolicyArgs().WithBucket(bucket).WithPolicy(serialized), cancellationToken)
                        .ConfigureAwait(false);
                }
                // 策略成功响应不代替浏览器可读性；调用方仍须无签名严格 TLS + SHA/Range 验证。
                return new DosResult(1, new { PublicPrefixAuthorized = true, ListsAllowed = false, WritesAllowed = false });
            }
            catch (OperationCanceledException) { throw; }
            catch { return new DosResult(0, null, "BackupPublicPolicyUpdateFailed"); }
        }

        internal static bool IsPublicReplicaPrefix(string prefix) => prefix != null
            && Regex.IsMatch(prefix,
                @"\A_microi-hotspot/public/v2/[a-z0-9_-]{1,64}/[a-z0-9_-]{1,120}/[a-f0-9]{64}/[a-f0-9]{32}/\z",
                RegexOptions.CultureInvariant);
    }
}
