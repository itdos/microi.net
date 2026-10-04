using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Minio;
using Minio.DataModel.Args;

namespace Microi.net
{
    /// <summary>
    /// 只删除零字节目录标记的存储协议。调用方负责真实管理员鉴权和业务 NoPUT
    /// 核验；这里绝不递归删除，不能把空前缀观察当作历史上传未发生的证明。
    /// </summary>
    public static class EmptyDirectoryMarkerDeletion
    {
        public sealed class ObjectEntry
        {
            public string Key { get; set; }
            public long? Size { get; set; }
        }

        public sealed class PrefixSnapshot
        {
            public bool Complete { get; set; }
            public IReadOnlyList<ObjectEntry> Objects { get; set; }
        }

        /// <summary>MinIO 与 S3 共用同桶原始对象列举；不使用省略标记大小的目录投影。</summary>
        public static async Task<DosResult> DeleteMinioCompatibleAsync(
            HDFSParam param, IMinioClient client, string bucket)
        {
            if (param?.EmptyDirectoryOnly != true || param.ClientModel == null || !param.Limit.HasValue || client == null
                || string.IsNullOrWhiteSpace(bucket))
                return Failure("Validate", false, "当前租户或存储桶不可核验。");
            var original = client.Config.HttpClient;
            if (original == null) return Failure("Validate", false, "对象存储传输不可核验。");
            using var guard = new MinioEmptyDirectoryListingGuard(original, bucket);
            using var guardedHttp = new HttpClient(guard) { Timeout = original.Timeout };
            client.WithHttpClient(guardedHttp);
            try
            {
            return await DeleteAsync(param.ClientModel.OsClient, param.FileFullPath,
                async (key, token) =>
                {
                    guard.BeginSnapshot(key);
                    var entries = new List<ObjectEntry>();
                    await foreach (var item in client.ListObjectsEnumAsync(new ListObjectsArgs()
                        .WithBucket(bucket).WithPrefix(key).WithRecursive(true), token))
                    {
                        entries.Add(new ObjectEntry { Key = item.Key, Size = checked((long)item.Size) });
                        // 超过一个对象已经不可能是单空标记，停止读取但绝不宣称完整。
                        if (entries.Count > 1) return new PrefixSnapshot { Complete = false, Objects = entries };
                    }
                    return new PrefixSnapshot { Complete = guard.Complete, Objects = entries };
                },
                (key, token) => client.RemoveObjectAsync(new RemoveObjectArgs()
                    .WithBucket(bucket).WithObject(key), token), param.CancellationToken).ConfigureAwait(false);
            }
            finally { client.WithHttpClient(original); }
        }

        /// <summary>
        /// 委托必须固定在同一可信租户、同一桶和精确前缀。只接受完整原始对象
        /// 元数据，普通文件柜的文件夹投影缺少 Size，不能作为空标记的证据。
        /// </summary>
        public static async Task<DosResult> DeleteAsync(
            string osClient, string filePath,
            Func<string, CancellationToken, Task<PrefixSnapshot>> readPrefix,
            Func<string, CancellationToken, Task> deleteExact,
            CancellationToken cancellationToken = default)
        {
            var stage = "Validate";
            var deleted = false;
            try
            {
                var normalized = TenantConfigurationSecurity.NormalizeStorageDeletePath(osClient, filePath);
                if (!normalized.EndsWith("/", StringComparison.Ordinal))
                    return Failure(stage, false, "空目录模式必须指定末尾带斜杠的目录标记。");
                if (readPrefix == null || deleteExact == null)
                    return Failure(stage, false, "当前存储不支持严格空目录标记删除。");
                var key = normalized.TrimStart('/');
                cancellationToken.ThrowIfCancellationRequested();
                stage = "ReadBefore";
                var before = await readPrefix(key, cancellationToken).ConfigureAwait(false);
                if (!ValidSnapshot(before, key, allowMarker: true))
                    return Failure(stage, false, "目录非空、标记非零字节或对象集合尚未完整核验。");

                if (before.Objects.Count == 1)
                {
                    stage = "DeleteExact";
                    // SDK 回调只删除 key 本身。即使并发写入后代，也不能删除后代对象。
                    // 上传恢复仍须由上层保持原请求隔离并取得已知 NoPUT 事实。
                    await deleteExact(key, cancellationToken).ConfigureAwait(false);
                    deleted = true;
                }

                stage = "ReadAfter";
                cancellationToken.ThrowIfCancellationRequested();
                var after = await readPrefix(key, cancellationToken).ConfigureAwait(false);
                if (!ValidSnapshot(after, key, allowMarker: false))
                    return Failure(stage, deleted, "删除结果未完成严格回读；请保留原请求并继续只读核验。");
                return new DosResult(1, new
                {
                    FilePathName = normalized,
                    EmptyDirectoryOnly = true,
                    DeletionMode = "EmptyDirectoryMarkerOnly",
                    Deleted = deleted,
                    AlreadyAbsent = !deleted,
                    VerifiedAbsent = true
                });
            }
            catch
            {
                // 不把 SDK 凭据、签名 URL 或供应商正文交给可编辑脚本或普通错误页面。
                return Failure(stage, deleted || stage == "DeleteExact",
                    "空目录标记删除未完成；请保留原请求并回读同一对象。");
            }
        }

        internal static bool ValidSnapshot(PrefixSnapshot value, string key, bool allowMarker)
        {
            if (value == null || !value.Complete || value.Objects == null
                || value.Objects.Count > (allowMarker ? 1 : 0)) return false;
            foreach (var item in value.Objects)
            {
                if (item == null || !string.Equals(item.Key, key, StringComparison.Ordinal)
                    || !item.Size.HasValue || item.Size.Value != 0) return false;
            }
            return true;
        }

        private static DosResult Failure(string stage, bool outcomeUnknown, string message)
            => new DosResult(0, new { OutcomeUnknown = outcomeUnknown, Stage = stage }, message,
                0, new { ErrorType = "HdfsEmptyDirectoryMarkerDeleteRejected" });
    }
}
