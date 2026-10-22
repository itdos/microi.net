using System;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private DosResult RequireLicenseReader(string key, out string tenant, out JObject user)
        {
            return ResolveTrustedManagedCurrentUser(key, true, 0, out tenant, out user);
        }

        public DosResult ReadLicenseVerification()
        {
            var denied = RequireLicenseReader("platform-license-management-state", out var tenant, out var user);
            if (denied != null) return denied;
            var reader = MicroiEngine.TryGetService<IPlatformLicenseReader>();
            if (reader == null) return new DosResult(0, null, "授权读取内核尚未注册。");
            var result = reader.ReadVerification();
            if (!TenantConfigurationSecurity.IsRuntimeMainTenant(tenant)
                || !PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(tenant, user))
            {
                result.Remove("HID");
                result.Remove("Company");
            }
            return new DosResult(1, result);
        }

        public DosResult ReadLicenseSubject()
        {
            var denied = RequireLicenseReader("platform-license-management-state", out var tenant, out var user);
            if (denied != null) return denied;
            if (!TenantConfigurationSecurity.IsRuntimeMainTenant(tenant)
                || !PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(tenant, user))
                return new DosResult(0, null, "您没有权限读取授权主体信息。");
            var reader = MicroiEngine.TryGetService<IPlatformLicenseReader>();
            return reader == null ? new DosResult(0, null, "授权读取内核尚未注册。")
                : new DosResult(1, reader.ReadSubject());
        }

        public DosResult ReadAiLicenseVerification()
        {
            var denied = RequireLicenseReader("platform-license-management-state", out _, out _);
            if (denied != null) return denied;
            var reader = MicroiEngine.TryGetService<IPlatformLicenseReader>();
            return reader == null ? new DosResult(0, null, "授权读取内核尚未注册。")
                : new DosResult(1, reader.ReadAiVerification());
        }

        public DosResult ReadLicenseAccessScope()
        {
            var key = V8TenantContext.Current?.ApiEngineKey;
            if (key != "platform-license-management-state" && key != "platform-license-server-nodes")
                return new DosResult(0, null, "授权读取接口上下文无效。");
            var denied = RequireLicenseReader(key, out var tenant, out var user);
            if (denied != null) return denied;
            var main = OsClientExtend.GetConfigOsClient();
            if (string.IsNullOrWhiteSpace(main)) main = OsClientDefault.OsClient;
            var isMain = string.Equals(main, tenant, StringComparison.OrdinalIgnoreCase);
            var admin = PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(tenant, user);
            return new DosResult(1, new { CurrentOsClient = tenant, MainOsClient = isMain ? main : "",
                IsMainTenant = isMain, IsAdministrator = admin, CanReadServerNodes = isMain && admin });
        }

        public DosResult ReadLicenseServerNodes()
        {
            var denied = RequireLicenseReader("platform-license-server-nodes", out var tenant, out var user);
            if (denied != null) return denied;
            if (!TenantConfigurationSecurity.IsRuntimeMainTenant(tenant)
                || !PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(tenant, user))
                return new DosResult(0, null, "您没有权限读取服务器节点。");
            var reader = MicroiEngine.TryGetService<IPlatformLicenseReader>();
            return reader == null ? new DosResult(0, null, "授权读取内核尚未注册。") : reader.ReadServerNodes();
        }
    }
}
