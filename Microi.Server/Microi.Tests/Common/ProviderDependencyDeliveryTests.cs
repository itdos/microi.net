using System.Reflection;
using Oracle.ManagedDataAccess.Client;

namespace Microi.Tests.Common;

/// <summary>发行依赖必须能在实际 CLR 中解析；不连接 Oracle、Azure 或 OCI，也不申请云凭据。</summary>
public sealed class ProviderDependencyDeliveryTests
{
    [Fact]
    public void Drawing_provider_support_dependencies_are_delivered_with_the_platform()
    {
        var drawing = typeof(System.Drawing.Image).Assembly;
        var support = Assert.Single(drawing.GetReferencedAssemblies(),
            reference => reference.Name == "System.Private.Windows.Core");
        var supportAssembly = Assembly.Load(support);
        var nrbf = Assert.Single(supportAssembly.GetReferencedAssemblies(),
            reference => reference.Name == "System.Formats.Nrbf");
        var loaded = Assembly.Load(nrbf);
        Assert.Equal(nrbf.Name, loaded.GetName().Name);
        Assert.True(loaded.GetName().Version >= nrbf.Version);
        Assert.True(File.Exists(loaded.Location));
    }

    [Fact]
    public void Oracle_provider_extension_references_are_delivered_with_the_platform()
    {
        var provider = typeof(OracleConnection).Assembly;
        var extensions = provider.GetReferencedAssemblies()
            .Where(name => name.Name?.StartsWith("Oracle.ManagedDataAccess.", StringComparison.Ordinal) == true)
            .ToArray();
        Assert.NotEmpty(extensions);
        foreach (var reference in extensions)
        {
            var loaded = Assembly.Load(reference);
            Assert.Equal(reference.Name, loaded.GetName().Name);
            Assert.True(loaded.GetName().Version >= reference.Version);
            Assert.False(string.IsNullOrEmpty(loaded.Location));
            Assert.True(File.Exists(loaded.Location));
        }
    }
}
