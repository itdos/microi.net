using System.Net.Http;
using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class OfficeHardeningTests
{
    [Fact]
    public async Task ExportWordByTpl_NullRequestReturnsStandardParameterError()
    {
        var result = await new MicroiOffice(null).ExportWordByTpl(null);

        Assert.NotNull(result);
        Assert.Equal(0, result.Code);
    }

    [Fact]
    public void WordTemplateImagesReuseOneBoundedHttpClient()
    {
        var field = typeof(MicroiOffice).GetField(
            "TemplateImageHttpClient",
            BindingFlags.Static | BindingFlags.NonPublic);

        var client = Assert.IsType<HttpClient>(field?.GetValue(null));
        Assert.Equal(TimeSpan.FromSeconds(30), client.Timeout);
        Assert.Equal(20L * 1024 * 1024, client.MaxResponseContentBufferSize);
    }
}
