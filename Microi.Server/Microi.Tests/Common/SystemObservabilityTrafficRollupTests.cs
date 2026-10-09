using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using Microi.net;
using MySql.Data.Types;

namespace Microi.Tests.Common;

public sealed class SystemObservabilityTrafficRollupTests
{
    [Theory]
    [InlineData("en-US", DateTimeKind.Utc)]
    [InlineData("zh-CN", DateTimeKind.Unspecified)]
    [InlineData("ar-SA", DateTimeKind.Utc)]
    public void RollupUtcText_FitsOfficialVarchar25AndPreservesUtcOrdering(string culture, DateTimeKind kind)
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo(culture);
            var utc = new DateTime(2026, 10, 9, 8, 58, 4, kind).AddTicks(1234567);
            var formatted = FormatUtc(utc);
            Assert.Equal("2026-10-09 08:58:04", formatted);
            Assert.Equal(19, formatted.Length);
            Assert.True(string.CompareOrdinal(formatted, FormatUtc(utc.AddMinutes(1))) < 0);
            Assert.Equal(utc.Ticks - utc.Ticks % TimeSpan.TicksPerSecond,
                DateTime.ParseExact(formatted, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture).Ticks);
        }
        finally { CultureInfo.CurrentCulture = previous; }
    }

    [Fact]
    public void MySqlDateTimeWireFormat_ExceedsOfficialVarchar25WhenFractionalSecondsExist()
    {
        var utc = new DateTime(2026, 10, 9, 8, 58, 4, DateTimeKind.Utc).AddTicks(1234567);
        var packetType = typeof(MySqlDateTime).Assembly.GetType("MySql.Data.MySqlClient.MySqlPacket")!;
        var packet = Activator.CreateInstance(packetType, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
            null, [Encoding.UTF8], null)!;
        var write = typeof(MySqlDateTime).GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
            .Single(method => method.Name.EndsWith("WriteValue", StringComparison.Ordinal));
        write.Invoke(new MySqlDateTime(utc), [packet, false, utc, 0]);
        var wire = Encoding.UTF8.GetString((byte[])packetType.GetProperty("Buffer", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)!.GetValue(packet)!);
        var temporal = Regex.Match(wire, @"\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+").Value;
        Assert.Equal("2026-10-09 08:58:04.123456", temporal);
        Assert.True(temporal.Length > 25);
        Assert.True(FormatUtc(utc).Length <= 25);
    }

    private static string FormatUtc(DateTime value)
    {
        var format = typeof(SystemObservabilityTrafficRollupService).GetMethod("DbUtc", BindingFlags.Static | BindingFlags.NonPublic)!;
        return Assert.IsType<string>(format.Invoke(null, [value]));
    }
}
