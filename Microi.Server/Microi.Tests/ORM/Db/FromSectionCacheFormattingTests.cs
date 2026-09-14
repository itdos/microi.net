using System.Reflection;
using Dos.ORM;
using Microi.net;

namespace Microi.Tests.ORM.Db;

public class FromSectionCacheFormattingTests(ITestOutputHelper output)
{
    private static string Format(string sql, params Parameter[] parameters)
    {
        // 只准备 MySQL Section，不连接数据库；测量真实 ORM 缓存键路径。
        var session = MicroiORMExtensions.CreateDbSession("Server=127.0.0.1;Port=1;Database=unused;User Id=unused;Password=unused;", DatabaseType.MySql);
        var from = new FromSection(session.Db, "menu").Where(new WhereClip("1=1", parameters));
        return (string)typeof(FromSection).GetMethod("formatSql", BindingFlags.Instance | BindingFlags.NonPublic)!
            .Invoke(from, new object[] { sql, from })!;
    }

    [Fact]
    public void LargeInCacheFormatting_HasLinearAllocationAndKeepsEveryValue()
    {
        var parameters = Enumerable.Range(0, 3000).Select(i => new Parameter("@item_" + i + "_end", "menu-" + i)).ToArray();
        var sql = "SELECT Id FROM menu WHERE Id IN (" + string.Join(",", parameters.Select(p => p.ParameterName)) + ")";
        _ = Format("SELECT @p", new Parameter("@p", 1));
        var before = GC.GetAllocatedBytesForCurrentThread();
        var formatted = Format(sql, parameters);
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        output.WriteLine($"ORM cache-key formatting allocated {allocated:N0} bytes");
        Assert.True(allocated < 12_000_000, $"ORM cache-key formatting allocated {allocated:N0} bytes");
        Assert.StartsWith("SELECT Id FROM menu WHERE Id IN (menu-0,menu-1,", formatted);
        Assert.EndsWith("menu-2999)", formatted);
        Assert.DoesNotContain("@item", formatted);
    }

    [Fact]
    public void CacheFormatting_OnlyRewritesOriginalParameterTokens()
    {
        var actual = Format("SELECT @p, @p1, @p10, '@p', `@p` /* @p */ -- @p\n, @none",
            new Parameter("@p", "value @p1"), new Parameter("@p1", "one"), new Parameter("@p10", "ten"));
        Assert.Equal("SELECT value @p1, one, ten, '@p', `@p` /* @p */ -- @p\n, @none", actual);
    }

    [Fact]
    public void CacheFormatting_PreservesLegacyValueTextAndIsRepeatable()
    {
        var parameters = new[] { new Parameter("@id", "abc"), new Parameter("@n", null), new Parameter("@empty", "") };
        const string sql = "SELECT @id, @n, @empty";
        Assert.Equal("SELECT abc, , ", Format(sql, parameters));
        Assert.Equal(Format(sql, parameters), Format(sql, parameters));
        Assert.NotEqual(Format(sql, parameters), Format(sql, new Parameter("@id", "changed"), parameters[1], parameters[2]));
    }
}
