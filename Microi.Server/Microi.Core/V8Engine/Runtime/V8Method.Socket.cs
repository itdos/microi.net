using Dos.Common;

namespace Microi.net
{
    public partial class V8Method
    {
        public DosResult RequireApiEngineSocketContext()
        {
            var context = V8TenantContext.Current;
            return context != null && ApiEngineSocketRuntime.IsTransportAllowed(
                context.OsClient, context.ApiEngineKey, ApiEngineSocketRuntime.ResponseType)
                ? new DosResult(1)
                : new DosResult(0, null, "当前接口不具有可信的实时连接上下文。");
        }
    }
}
