using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Microi.net;

namespace Dos.Common.Tests;

public class V8ObjectHashStreamTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(101)]
    [InlineData(262147)]
    public void ComputesRawAndLegacyBase64HashesAcrossUnevenWrites(int size)
    {
        var bytes = new byte[size];
        RandomNumberGenerator.Fill(bytes);
        var type = typeof(V8Method).Assembly.GetType("Microi.net.V8ObjectHashStream", true)!;
        using var stream = (Stream)Activator.CreateInstance(type, nonPublic: true)!;
        var offset = 0;
        var steps = new[] { 1, 2, 7, 3, 65537 };
        for (var i = 0; offset < bytes.Length; i++)
        {
            var count = Math.Min(steps[i % steps.Length], bytes.Length - offset);
            stream.Write(bytes, offset, count);
            offset += count;
        }

        var result = type.GetMethod("Complete", BindingFlags.Public | BindingFlags.Instance)!
            .Invoke(stream, null)!;
        var fields = result.GetType();
        var raw = (string)fields.GetField("Item1")!.GetValue(result)!;
        var wire = (string)fields.GetField("Item2")!.GetValue(result)!;
        var length = (long)fields.GetField("Item3")!.GetValue(result)!;

        Assert.Equal(size, length);
        Assert.Equal(Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(), raw);
        Assert.Equal(Convert.ToHexString(SHA256.HashData(
            Encoding.ASCII.GetBytes(Convert.ToBase64String(bytes)))).ToLowerInvariant(), wire);
    }
}
