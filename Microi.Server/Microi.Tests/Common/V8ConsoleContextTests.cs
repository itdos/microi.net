using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microi.net;
using Xunit;

namespace Microi.Tests.Common
{
    public class V8ConsoleContextTests
    {
        [Fact]
        public void Capture_RestoresOuterScope_AfterNestedCapture()
        {
            var outer = new List<string>();
            var inner = new List<string>();

            using (V8ConsoleContext.Capture(entry => outer.Add(entry.Message)))
            {
                Assert.True(V8ConsoleContext.TryWrite("Log", "outer-before"));
                using (V8ConsoleContext.Capture(entry => inner.Add(entry.Message)))
                {
                    Assert.True(V8ConsoleContext.TryWrite("Warn", "inner"));
                }
                Assert.True(V8ConsoleContext.TryWrite("Log", "outer-after"));
            }

            Assert.Equal(new[] { "outer-before", "outer-after" }, outer);
            Assert.Equal(new[] { "inner" }, inner);
            Assert.False(V8ConsoleContext.TryWrite("Log", "outside"));
        }

        [Fact]
        public async Task Capture_IsolatesParallelAsyncExecutions()
        {
            async Task<string[]> CaptureAsync(string prefix)
            {
                var output = new List<string>();
                using (V8ConsoleContext.Capture(entry => output.Add(entry.Message)))
                {
                    Assert.True(V8ConsoleContext.TryWrite("Log", prefix + "-1"));
                    await Task.Yield();
                    Assert.True(V8ConsoleContext.TryWrite("Log", prefix + "-2"));
                }
                return output.ToArray();
            }

            var results = await Task.WhenAll(CaptureAsync("A"), CaptureAsync("B"));

            Assert.Equal(new[] { "A-1", "A-2" }, results[0]);
            Assert.Equal(new[] { "B-1", "B-2" }, results[1]);
        }
    }
}
