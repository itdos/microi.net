using Microi.net;

namespace Microi.Tests.Common;

public sealed class OsClientInitializationGuardTests
{
    [Fact]
    public void CacheInitializationRecursionGuardIsThreadLocal()
    {
        var original = OsClientExtend._isCacheInitializing;
        try
        {
            OsClientExtend._isCacheInitializing = true;
            var otherThreadValue = true;
            var thread = new Thread(() =>
            {
                otherThreadValue = OsClientExtend._isCacheInitializing;
            });

            thread.Start();
            thread.Join();

            Assert.True(OsClientExtend._isCacheInitializing);
            Assert.False(otherThreadValue);
        }
        finally
        {
            OsClientExtend._isCacheInitializing = original;
        }
    }
}
