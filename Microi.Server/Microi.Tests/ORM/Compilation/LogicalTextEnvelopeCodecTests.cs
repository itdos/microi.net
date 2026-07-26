using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Tests.Compilation;

public sealed class LogicalTextEnvelopeCodecTests
{
    [Theory]
    [InlineData(null, null)]
    [InlineData("", "\uE000")]
    [InlineData("abc", "\uE000abc")]
    [InlineData(" ", "\uE000 ")]
    [InlineData("中文😀", "\uE000中文😀")]
    [InlineData("\uE000x", "\uE000\uE000x")]
    public void Non_empty_envelope_is_reversible(
        string? logical,
        string? physical)
    {
        Assert.Equal(physical, LogicalTextEnvelopeCodec.Encode(logical));
        Assert.Equal(logical, LogicalTextEnvelopeCodec.Decode(physical));
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("中文")]
    public void Decode_rejects_non_null_unmarked_physical_values(
        string physical)
    {
        var exception = Assert.Throws<InvalidDataException>(() =>
            LogicalTextEnvelopeCodec.Decode(physical));

        Assert.Contains("marker", exception.Message,
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Encoding_always_adds_exactly_one_marker()
    {
        const string logical = "\uE000\uE000value";

        var physical = LogicalTextEnvelopeCodec.Encode(logical);

        Assert.Equal(logical.Length + 1, physical!.Length);
        Assert.Equal('\uE000', physical[0]);
        Assert.Equal(logical, physical[1..]);
    }
}
