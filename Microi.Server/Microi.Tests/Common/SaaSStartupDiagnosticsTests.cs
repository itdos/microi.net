using System;
using System.Data.Common;
using System.IO;
using System.Reflection;
using Microi.net;
using Xunit;

namespace Microi.Tests.Common
{
    public sealed class SaaSStartupDiagnosticsTests
    {
        [Fact]
        public void StartupDatabaseRetry_OnlyAcceptsTransportFailures()
        {
            Assert.True(IsTransient(new TimeoutException("timeout")));
            Assert.True(IsTransient(new IOException("connection reset")));
            Assert.True(IsTransient(new InvalidOperationException(
                "outer",
                new FakeDbException("Unable to connect to any of the specified MySQL hosts."))));

            Assert.False(IsTransient(new ArgumentException("Requested value 'None' was not found.")));
            Assert.False(IsTransient(new FakeDbException("Table 'sys_osclients' doesn't exist")));
            Assert.False(IsTransient(new InvalidOperationException("主租户三元组不匹配")));
        }

        [Fact]
        public void StartupDatabaseFailureMessage_RedactsEmbeddedPassword()
        {
            var message = SafeMessage(new InvalidOperationException(
                "连接失败；Server=db;User Id=root;Password=top-secret;Database=microi;"));

            Assert.DoesNotContain("top-secret", message, StringComparison.Ordinal);
            Assert.Contains("Password=***", message, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void SaaSLoader_DoesNotContinueToJwtGateAfterMainTenantLoadFailure()
        {
            var root = FindRepositoryRoot();
            var source = File.ReadAllText(Path.Combine(
                root,
                "Microi.Server",
                "Microi.net",
                "Common",
                "OsClient.cs"));
            var start = source.IndexOf("private void LoadOsClientsFromDatabase()", StringComparison.Ordinal);
            var end = source.IndexOf("private static bool IsTransientStartupDatabaseFailure", start, StringComparison.Ordinal);
            Assert.True(start >= 0 && end > start);
            var block = source.Substring(start, end - start);

            Assert.Contains("LoadOsClientsFromDatabaseOnce();", block, StringComparison.Ordinal);
            Assert.Contains("throw new InvalidOperationException(message, ex);", block, StringComparison.Ordinal);
            Assert.Contains("ProcessOsClientItem(mainTenantItem, currentClientModel, seenAuthSecrets, true);", block, StringComparison.Ordinal);
            Assert.Contains("IsPlaceholderOnly(OsClientDefault.OsClient)", block, StringComparison.Ordinal);
            Assert.Contains("? GetSafeStartupDatabaseFailure(ex)", source, StringComparison.Ordinal);

            var coordinatorSource = File.ReadAllText(Path.Combine(
                root,
                "Microi.Server",
                "Microi.Core",
                "Token",
                "TenantJwtSigningKeyCoordinator.cs"));
            Assert.Contains("JWT 租户级签名密钥收敛异常：\" + ex.Message,", coordinatorSource, StringComparison.Ordinal);
            Assert.Contains("ex);", coordinatorSource, StringComparison.Ordinal);
        }

        private static bool IsTransient(Exception exception)
        {
            var method = typeof(OsClient).GetMethod(
                "IsTransientStartupDatabaseFailure",
                BindingFlags.NonPublic | BindingFlags.Static);
            Assert.NotNull(method);
            return Assert.IsType<bool>(method.Invoke(null, new object[] { exception }));
        }

        private static string SafeMessage(Exception exception)
        {
            var method = typeof(OsClient).GetMethod(
                "GetSafeStartupDatabaseFailure",
                BindingFlags.NonPublic | BindingFlags.Static);
            Assert.NotNull(method);
            return Assert.IsType<string>(method.Invoke(null, new object[] { exception }));
        }

        private static string FindRepositoryRoot()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory != null)
            {
                if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
                {
                    return directory.FullName;
                }
                directory = directory.Parent;
            }
            throw new DirectoryNotFoundException("未找到 Microi 工作区根目录。");
        }

        private sealed class FakeDbException : DbException
        {
            public FakeDbException(string message) : base(message)
            {
            }
        }
    }
}
