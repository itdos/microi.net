using System;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 文件流只保留在当前 HTTP 请求的可信宿主中。V8 只能让已验证的上传执行一次，
    /// 不能覆盖租户、用户、文件流或桶策略；本作用域不承担跨请求幂等或持久任务。
    /// </summary>
    public sealed class HdfsUploadRequestContext : IDisposable
    {
        public const string EngineKey = "platform-hdfs-upload";
        public const string CompatibilityField = "CompatiblePlatformOldVersion";
        private static readonly AsyncLocal<HdfsUploadRequestContext> Slot = new AsyncLocal<HdfsUploadRequestContext>();
        private readonly HdfsUploadRequestContext previous;
        private readonly string osClient;
        private readonly string engineKey;
        private readonly bool legacyEnabled;
        private readonly Lazy<Task<DosResult>> upload;
        private bool disposed;

        private HdfsUploadRequestContext(string tenant, string key, bool enabled, Func<Task<DosResult>> execute)
        {
            previous = Slot.Value;
            osClient = tenant;
            engineKey = key;
            legacyEnabled = enabled;
            upload = new Lazy<Task<DosResult>>(execute, LazyThreadSafetyMode.ExecutionAndPublication);
            Slot.Value = this;
        }

        /// <summary>仅由完成 DiyToken 和请求参数验证的宿主建立；普通 V8 没有创建入口。</summary>
        public static HdfsUploadRequestContext Enter(string tenant, string key, bool enabled, Func<Task<DosResult>> execute)
        {
            if (string.IsNullOrWhiteSpace(tenant) || string.IsNullOrWhiteSpace(key) || execute == null)
                throw new ArgumentException("上传协议上下文不完整。");
            return new HdfsUploadRequestContext(tenant, key, enabled, execute);
        }

        /// <summary>宿主据此跳过重复读取 multipart 和 Base64 转换，不能由请求参数开启。</summary>
        public static bool HasCurrentRequest => Slot.Value != null && !Slot.Value.disposed;

        private static HdfsUploadRequestContext AuthorizedCurrent()
        {
            var scope = Slot.Value;
            var tenant = V8TenantContext.Current;
            return scope != null && !scope.disposed && tenant != null
                && string.Equals(scope.osClient, tenant.OsClient, StringComparison.OrdinalIgnoreCase)
                && string.Equals(scope.engineKey, tenant.ApiEngineKey, StringComparison.OrdinalIgnoreCase)
                    ? scope : null;
        }

        /// <summary>重复调用返回同一个上传任务；失败也不再次写对象存储。</summary>
        public static Task<DosResult> UploadAsync()
        {
            var scope = AuthorizedCurrent();
            return scope == null
                ? Task.FromResult(new DosResult(0, null, "此方法仅允许当前上传 HTTP 请求选定的接口引擎调用。"))
                : scope.upload.Value;
        }

        public static bool IsLegacyEnabled() => AuthorizedCurrent()?.legacyEnabled == true;

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            Slot.Value = previous;
        }
    }
}
