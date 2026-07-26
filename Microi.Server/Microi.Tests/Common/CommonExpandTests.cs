using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class CommonExpandTests
{
    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("\t")]
    public void Val_BlankStringReturnsDefaultForValueTypesWithoutConversionFailure(
        string value)
    {
        var token = JToken.FromObject(value);

        Assert.Equal(0, token.Val<int>());
        Assert.False(token.Val<bool>());
        Assert.Null(token.Val<int?>());
    }

    [Fact]
    public void Val_BlankStringRemainsAvailableWhenStringWasRequested()
    {
        var token = JToken.FromObject("  ");

        Assert.Equal("  ", token.Val<string>());
    }
}
