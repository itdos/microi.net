using System.Collections.Concurrent;
using Dos.Common;

namespace Microi.Tests.Common;

public sealed class MapperHelperTests
{
    [Fact]
    public void Map_PreservesLegacyPrimitiveAndJsonProjectionSemantics()
    {
        var result = MapperHelper.Map<MapperSource, MapperTarget>(new MapperSource
        {
            Name = "Alice",
            Enabled = 1,
            Details = new MapperDetails { Code = "A-001" },
            Items = new List<int> { 1, 2 }
        });

        Assert.Equal("Alice", result.Name);
        Assert.Equal(1, result.Enabled);
        Assert.Contains("A-001", result.Details, StringComparison.Ordinal);
        Assert.Equal("[1,2]", result.Items);
    }

    [Fact]
    public void MapNotNull_PreservesFallbackValues()
    {
        var result = MapperHelper.MapNotNull<MapperSource, MapperTarget>(
            new MapperSource { Name = "Updated", Keep = null },
            new MapperTarget { Name = "Old", Keep = "Preserved" });

        Assert.Equal("Updated", result.Name);
        Assert.Equal("Preserved", result.Keep);
    }

    [Fact]
    public void Map_UsesThreadSafeMetadataCaches()
    {
        var failures = new ConcurrentQueue<Exception>();
        Parallel.For(0, 1000, index =>
        {
            try
            {
                var mapped = MapperHelper.Map<MapperSource, MapperTarget>(new MapperSource
                {
                    Name = "Name-" + index,
                    Enabled = index
                });
                Assert.Equal("Name-" + index, mapped.Name);
                Assert.Equal(index, mapped.Enabled);
            }
            catch (Exception ex)
            {
                failures.Enqueue(ex);
            }
        });

        Assert.Empty(failures);
    }

    [Fact]
    public void EntityCopy_RejectsMissingRequiredArguments()
    {
        Assert.Throws<ArgumentNullException>(() =>
            MapperHelper.EntityCopy(null!, typeof(MapperTarget), false));
        Assert.Throws<ArgumentNullException>(() =>
            MapperHelper.EntityCopy(new MapperSource(), null!, false));
    }

    private sealed class MapperSource
    {
        public string? Name { get; set; }
        public int Enabled { get; set; }
        public MapperDetails? Details { get; set; }
        public List<int>? Items { get; set; }
        public string? Keep { get; set; }
    }

    private sealed class MapperTarget
    {
        public string? Name { get; set; }
        public int Enabled { get; set; }
        public string? Details { get; set; }
        public string? Items { get; set; }
        public string? Keep { get; set; }
    }

    private sealed class MapperDetails
    {
        public string? Code { get; set; }
    }
}
