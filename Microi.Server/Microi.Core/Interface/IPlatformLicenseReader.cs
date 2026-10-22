using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    // 授权验证内核留在闭源程序集；这里只提供只读事实，不承担页面响应组装。
    public interface IPlatformLicenseReader
    {
        JObject ReadVerification();
        JObject ReadSubject();
        JObject ReadAiVerification();
        DosResult ReadServerNodes();
    }
}
