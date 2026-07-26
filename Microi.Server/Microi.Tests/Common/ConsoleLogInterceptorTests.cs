using System.IO;
using Microi.net;
using Xunit;

namespace Microi.Tests.Common
{
    public class ConsoleLogInterceptorTests
    {
        [Fact]
        public void WriteLine_KeepsOnlyPlatformCriticalMessageInOriginalOutput()
        {
            using var original = new StringWriter();
            var interceptor = new ConsoleLogInterceptor(original);

            interceptor.WriteLine("Microi：普通租户运行警告");
            Assert.Equal(string.Empty, original.ToString());

            interceptor.WriteLine("Microi：【✅成功】【2026-07-26 00:00:00】Microi全部启动成功！");
            Assert.Contains("Microi全部启动成功", original.ToString());
        }

        [Fact]
        public void WriteCharacters_RoutesCompletedLineWithoutDroppingText()
        {
            using var original = new StringWriter();
            var interceptor = new ConsoleLogInterceptor(original);
            const string critical = "Microi：【❌Error】注入【测试插件】失败\n";

            foreach (var character in critical)
            {
                interceptor.Write(character);
            }

            Assert.Contains("注入【测试插件】失败", original.ToString());
        }
    }
}
