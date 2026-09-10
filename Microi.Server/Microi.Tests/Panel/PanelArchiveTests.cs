using System.Formats.Tar;
using System.Text;
using Microi.Panel;
using Microi.Panel.Panel;

namespace Microi.Tests.Panel;
public sealed class PanelArchiveTests
{
    [Fact]
    public void RootOwnershipAndModeAreReadForExplicitVolumeRepair()
    {
        using var archive=Archive(("./","",TarEntryType.Directory));var root=PanelArchive.RootMetadata(archive);
        Assert.Equal(1000,root.Uid);Assert.Equal(1000,root.Gid);Assert.Equal("600",root.Mode);
    }
    private static MemoryStream Archive(params (string Name,string Content,TarEntryType Type)[] entries)
    {
        var stream=new MemoryStream();using(var writer=new TarWriter(stream,TarEntryFormat.Pax,leaveOpen:true))
        foreach(var item in entries)
        {
            var entry=new PaxTarEntry(item.Type,item.Name){Mode=UnixFileMode.UserRead|UnixFileMode.UserWrite,Uid=1000,Gid=1000};
            if(item.Type==TarEntryType.SymbolicLink) entry.LinkName=item.Content;
            else if(item.Type==TarEntryType.RegularFile) entry.DataStream=new MemoryStream(Encoding.UTF8.GetBytes(item.Content));
            writer.WriteEntry(entry);entry.DataStream?.Dispose();
        }
        stream.Position=0;return stream;
    }
    [Fact]
    public async Task ContentHashIgnoresTarOrderingButDetectsChangedData()
    {
        var ct=TestContext.Current.CancellationToken;
        using var first=Archive(("./a","one",TarEntryType.RegularFile),("./b","two",TarEntryType.RegularFile));
        using var reordered=Archive(("./b","two",TarEntryType.RegularFile),("./a","one",TarEntryType.RegularFile));
        using var changed=Archive(("./a","changed",TarEntryType.RegularFile),("./b","two",TarEntryType.RegularFile));
        var hash=await PanelArchive.ContentHash(first,ct);Assert.Equal(hash,await PanelArchive.ContentHash(reordered,ct));Assert.NotEqual(hash,await PanelArchive.ContentHash(changed,ct));
    }
    [Theory]
    [InlineData("../escape","",false)][InlineData("/etc/passwd","",false)]
    [InlineData("./link","/etc/passwd",true)][InlineData("./dir/link","../../etc/passwd",true)]
    public async Task ArchiveTraversalAndExternalLinksAreRejected(string path,string content,bool link)
    {
        using var archive=Archive((path,content,link?TarEntryType.SymbolicLink:TarEntryType.RegularFile));
        await Assert.ThrowsAsync<OpsException>(()=>PanelArchive.ContentHash(archive,TestContext.Current.CancellationToken));
    }
    [Fact]
    public async Task DuplicatePathsCannotHideOverwrites()
    {
        using var archive=Archive(("./a","first",TarEntryType.RegularFile),("a","second",TarEntryType.RegularFile));
        await Assert.ThrowsAsync<OpsException>(()=>PanelArchive.ContentHash(archive,TestContext.Current.CancellationToken));
    }
    [Fact]
    public async Task InternalRelativeSymlinkRemainsSupported()
    {
        using var archive=Archive(("./a","value",TarEntryType.RegularFile),("./nested/link","../a",TarEntryType.SymbolicLink));
        Assert.NotEmpty(await PanelArchive.ContentHash(archive,TestContext.Current.CancellationToken));
    }
    [Fact]
    public async Task SymlinkChainsCannotTurnLexicallySafeTargetsIntoEscapes()
    {
        using var archive=Archive(("./alias",".",TarEntryType.SymbolicLink),("./escape","alias/../outside",TarEntryType.SymbolicLink));
        await Assert.ThrowsAsync<OpsException>(()=>PanelArchive.ContentHash(archive,TestContext.Current.CancellationToken));
    }
    [Fact]
    public async Task ArchivesCannotWriteThroughAnEarlierSymlink()
    {
        using var archive=Archive(("./alias","data",TarEntryType.SymbolicLink),("./alias/file","changed",TarEntryType.RegularFile));
        await Assert.ThrowsAsync<OpsException>(()=>PanelArchive.ContentHash(archive,TestContext.Current.CancellationToken));
    }
    [Fact]
    public async Task MysqlRuntimeSocketAliasIsExcludedButDatabaseFilesRemainVerified()
    {
        var ct=TestContext.Current.CancellationToken;
        using var source=Archive(("./","",TarEntryType.Directory),("./mysql.sock","/var/run/mysqld/mysqld.sock",TarEntryType.SymbolicLink),("./ibdata1","database-pages",TarEntryType.RegularFile));
        await Assert.ThrowsAsync<OpsException>(()=>PanelArchive.ContentHash(source,ct));source.Position=0;
        using var destination=new MemoryStream();
        Assert.Equal(new[]{"mysql.sock"},await PanelArchive.CopyForBackup(source,destination,"mysql",ct));destination.Position=0;
        using var expected=Archive(("./","",TarEntryType.Directory),("./ibdata1","database-pages",TarEntryType.RegularFile));
        Assert.Equal(await PanelArchive.ContentHash(expected,ct),await PanelArchive.ContentHash(destination,ct));
    }
    [Theory]
    [InlineData("nginx","mysql.sock","/var/run/mysqld/mysqld.sock")]
    [InlineData("mysql","mysql.sock","/etc/passwd")]
    [InlineData("mysql","other.sock","/var/run/mysqld/mysqld.sock")]
    public async Task RuntimeExceptionNeverPermitsOtherExternalLinks(string plugin,string name,string target)
    {
        var ct=TestContext.Current.CancellationToken;
        using var source=Archive(("./","",TarEntryType.Directory),(name,target,TarEntryType.SymbolicLink));
        using var destination=new MemoryStream();Assert.Empty(await PanelArchive.CopyForBackup(source,destination,plugin,ct));destination.Position=0;
        await Assert.ThrowsAsync<OpsException>(()=>PanelArchive.ContentHash(destination,ct));
    }
}
