using Microsoft.Data.Sqlite;

namespace Microi.Tests.Panel;

/// <summary>测试只拥有自己创建的随机目录；Dispose 在断言失败时同样回收数据库和夹具。</summary>
internal sealed class PanelTestDirectory : IDisposable
{
    public string Root { get; }
    private readonly string token = Guid.NewGuid().ToString("N");
    public PanelTestDirectory()
    {
        var workspace = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../.."));
        if (!File.Exists(Path.Combine(workspace, "Microi.Server/Microi.Panel/Microi.Panel.csproj")))
            throw new InvalidOperationException("Cannot identify the source workspace.");
        Root = Path.Combine(workspace, ".tmp", "panel-unit-" + token);
        CheckAncestors(Root);
        Directory.CreateDirectory(Root);
        File.WriteAllText(Path.Combine(Root, "owner.txt"), token);
    }
    private static void CheckAncestors(string path)
    {
        for (var item = new DirectoryInfo(path); item != null; item = item.Parent)
            if (item.Exists && item.Attributes.HasFlag(FileAttributes.ReparsePoint))
                throw new IOException("Refusing test cleanup through a reparse point.");
    }
    public void Dispose()
    {
        CheckAncestors(Root);
        if (File.ReadAllText(Path.Combine(Root, "owner.txt")) != token) throw new IOException("Test directory ownership changed.");
        // 两个责任类的连接串不同，分别清自己的池；不能清全局池影响并发测试或共享服务。
        foreach (var pooling in new bool?[] { null, true })
        {
            var builder = new SqliteConnectionStringBuilder { DataSource = Path.Combine(Root, "ops.db") };
            if (pooling.HasValue) builder.Pooling = pooling.Value;
            using var connection = new SqliteConnection(builder.ToString()); SqliteConnection.ClearPool(connection);
        }
        var pending = new Stack<string>(); pending.Push(Root);
        while (pending.TryPop(out var directory))
            foreach (var item in new DirectoryInfo(directory).EnumerateFileSystemInfos())
            {
                if (item.Attributes.HasFlag(FileAttributes.ReparsePoint) || item.Name == ".git")
                    throw new IOException("Unexpected linked or Git content in test directory; retained.");
                if (item is DirectoryInfo child) pending.Push(child.FullName);
            }
        Directory.Delete(Root, recursive: true);
        if (Directory.Exists(Root)) throw new IOException("Test directory cleanup was not confirmed.");
    }
}
