using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class DiskIoObservationTests
{
    [Fact]
    public void NumericWholeDevicesRemainVisible_RealPartitionsAndVirtualRamAreExcluded()
    {
        var names = new[] { "sata1", "nvme0n1", "md0", "dm-0", "sda", "sda1", "nvme0n1p1", "loop0", "ram0" };
        var input = string.Join('\n', names.Select((name, index) => $"8 {index} {name} 1 0 2 3 4 0 5 6 0 7 8"));
        var rows = DiskIoObservation.Parse(input, name => name is "sda1" or "nvme0n1p1", name => name is "sata1" or "nvme0n1" or "sda");
        Assert.Equal(new[] { "sata1", "nvme0n1", "md0", "dm-0", "sda" }, rows.Select(row => row.Name));
        Assert.Equal(3, rows.Count(row => row.Physical));
        Assert.Empty(DiskIoObservation.Parse("8 0 ../secret 1 0 2 3 4 0 5 6 0 7 8", _ => false, _ => true));
    }

    [Fact]
    public void DeviceRateUsesItsOwnWindowAndResetsToUnknown()
    {
        var old = new DiskIoObservation.Reading { Key = "8:0:sata1", Reads = 10, Writes = 20, ReadSectors = 100, WriteSectors = 200, ReadMs = 10, WriteMs = 20, BusyMs = 100 };
        var now = new DiskIoObservation.Reading { Key = old.Key, Name = "sata1", Physical = true, Reads = 14, Writes = 26, ReadSectors = 300, WriteSectors = 600, ReadMs = 30, WriteMs = 50, BusyMs = 600 };
        var row = DiskIoObservation.Project(now, old, 2);
        Assert.Equal(51200, row["ReadBytesPerSecond"]!.Value<double>());
        Assert.Equal(102400, row["WriteBytesPerSecond"]!.Value<double>());
        Assert.Equal(25, row["BusyPercent"]!.Value<double>());
        Assert.Equal(5, row["AwaitMs"]!.Value<double>());
        Assert.Equal(Newtonsoft.Json.Linq.JTokenType.Null, DiskIoObservation.Project(now, null, 2)["ReadBytesPerSecond"]!.Type);
        now.ReadSectors = 1;
        Assert.Equal(Newtonsoft.Json.Linq.JTokenType.Null, DiskIoObservation.Project(now, old, 2)["ReadBytesPerSecond"]!.Type);
    }
}
