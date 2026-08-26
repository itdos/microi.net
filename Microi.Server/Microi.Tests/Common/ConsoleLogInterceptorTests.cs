using System.IO;
using Microi.net;
using Xunit;

namespace Microi.Tests.Common
{
    public class ConsoleLogInterceptorTests
    {
        [Fact]
        public void WriteLine_KeepsOnlyPlatformCriticalMessageAndNormalizesOriginalOutput()
        {
            using var original = new StringWriter();
            var interceptor = new ConsoleLogInterceptor(original);

            interceptor.WriteLine("Microi：普通租户运行警告");
            Assert.Equal(string.Empty, original.ToString());

            interceptor.WriteLine("Microi：【✅成功】【2026-07-26 00:00:00】Microi全部启动成功！");
            Assert.Contains("Microi：【✅成功】【2026-07-26 00:00:00】Microi全部启动成功", original.ToString());

            interceptor.WriteLine("Microi：【✅成功】【2026-07-30 00:00:00】注入【MQ消息队列】插件成功！");
            Assert.Contains("注入【MQ消息队列】插件成功", original.ToString());

            interceptor.WriteLine("Microi：【❌Error】【2026-07-30 00:00:01】【MQ消息队列】插件启动失败：连接不可用");
            Assert.Contains("Microi：【❌失败】【2026-07-30 00:00:01】【MQ消息队列】插件启动失败", original.ToString());

            interceptor.WriteLine("Microi：【Error异常】SaaS引擎初始化异常：数据库连接失败");
            Assert.Contains("SaaS引擎初始化异常", original.ToString());

            interceptor.WriteLine("Microi：【❌启动失败】主租户[iTdos]SaaS配置数据库加载失败");
            Assert.Contains("SaaS配置数据库加载失败", original.ToString());

            interceptor.WriteLine("Microi：【自动升级状态】【xjy】【平台运行时接口闭包】成功");
            Assert.Contains("Microi：【✅成功】【", original.ToString());
            Assert.Contains("【自动升级状态】【xjy】", original.ToString());

            interceptor.WriteLine("Microi：【成功】平台自动升级【xjy】完成！");
            Assert.Contains("平台自动升级【xjy】完成", original.ToString());
        }

        [Theory]
        [InlineData("Microi：【自动升级状态】【启动前门禁汇总】租户数=74，成功=74，失败=0，失败明细=无。", "【✅成功】")]
        [InlineData("Microi：【Error异常】【xjy】平台自动升级出现异常：数据库错误", "【❌失败】")]
        [InlineData("info: Microsoft.Hosting.Lifetime[14] Now listening on: https://localhost:61501", "【✅成功】")]
        [InlineData("warn: Microsoft.AspNetCore.Server 请求未能完成", "【❌失败】")]
        public void NormalizeLine_UsesCanonicalStatusAndTimestamp(string input, string expectedStatus)
        {
            var normalized = ConsoleLogInterceptor.NormalizeLine(input);

            Assert.StartsWith("Microi：" + expectedStatus + "【", normalized);
            Assert.Matches(@"^Microi：【(?:✅成功|❌失败)】【\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}】", normalized);
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
