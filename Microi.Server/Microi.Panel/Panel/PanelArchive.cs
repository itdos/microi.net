using System.Formats.Tar;
using System.Security.Cryptography;
using System.Text;

namespace Microi.Panel.Panel;

/// <summary>在恢复前检查 TAR 结构，并以内容、权限、所有者和路径生成与 TAR 排序/访问时间无关的校验。</summary>
public static class PanelArchive
{
    public static async Task<string[]> CopyForBackup(Stream source, Stream destination, string plugin, CancellationToken ct)
    {
        using var reader=new TarReader(source,leaveOpen:true);
        await using var writer=new TarWriter(destination,TarEntryFormat.Pax,leaveOpen:true);
        var skipped=new List<string>();var names=new HashSet<string>(StringComparer.Ordinal);
        while(await reader.GetNextEntryAsync(cancellationToken:ct) is { } entry)
        {
            var name=Normalize(entry.Name);
            if(!names.Add(name)||names.Count>100000)throw new OpsException("归档含重复路径或超过 100000 项。");
            // MySQL 官方入口每次启动都会重建此 socket 别名；不允许把这个例外推广为任意绝对链接。
            if(plugin=="mysql" && name=="mysql.sock" && entry.EntryType==TarEntryType.SymbolicLink && entry.LinkName is "/var/run/mysqld/mysqld.sock" or "/run/mysqld/mysqld.sock")
            {skipped.Add(name);continue;}
            await writer.WriteEntryAsync(entry,cancellationToken:ct);
        }
        return skipped.ToArray();
    }
    public static (int Uid,int Gid,string Mode) RootMetadata(Stream source)
    {
        using var reader=new TarReader(source,leaveOpen:true);var entry=reader.GetNextEntry();
        if(entry==null||Normalize(entry.Name)!="."||entry.EntryType!=TarEntryType.Directory||entry.Uid<0||entry.Gid<0)throw new OpsException("归档缺少有效的数据卷根目录元数据。");
        return(entry.Uid,entry.Gid,Convert.ToString((int)entry.Mode & 4095,8));
    }
    public static string Normalize(string path)
    {
        while (path.StartsWith("./", StringComparison.Ordinal)) path = path[2..];
        path = path.TrimEnd('/'); if (path is "" or ".") return ".";
        DockerEngine.SafeArchivePath(path); return path;
    }
    private static void CheckLink(string path, string target, bool hard)
    {
        if (string.IsNullOrEmpty(target) || target.StartsWith('/') || target.Contains('\\') || target.Contains(':') || target.Any(char.IsControl)) throw new OpsException("归档含有指向数据卷外部的链接，不能安全备份或恢复。");
        var parts = hard ? new List<string>() : path.Split('/').SkipLast(1).ToList();
        foreach (var part in target.Split('/'))
        {
            if (part is "" or ".") continue;
            if (part == "..") { if (parts.Count == 0) throw new OpsException("归档链接越过数据卷根目录。"); parts.RemoveAt(parts.Count - 1); }
            else parts.Add(part);
        }
    }
    public static async Task<string> ContentHash(Stream source, CancellationToken ct)
    {
        using var reader = new TarReader(source, leaveOpen:true); var names = new HashSet<string>(StringComparer.Ordinal); var hashes = new List<string>();
        var links=new Dictionary<string,(TarEntryType Type,string Target)>(StringComparer.Ordinal);
        while (await reader.GetNextEntryAsync(cancellationToken:ct) is { } entry)
        {
            var name = Normalize(entry.Name); if (!names.Add(name) || names.Count > 100000) throw new OpsException("归档含重复路径或超过 100000 项。");
            if (entry.EntryType is not (TarEntryType.Directory or TarEntryType.RegularFile or TarEntryType.V7RegularFile or TarEntryType.SymbolicLink or TarEntryType.HardLink)) throw new OpsException("归档含特殊设备或不支持的条目类型。");
            if (entry.EntryType is TarEntryType.SymbolicLink or TarEntryType.HardLink) CheckLink(name, entry.LinkName, entry.EntryType == TarEntryType.HardLink);
            links.Add(name,(entry.EntryType,entry.LinkName));
            var dataHash = entry.DataStream == null ? "" : Convert.ToHexStringLower(await SHA256.HashDataAsync(entry.DataStream, ct));
            var type = entry.EntryType == TarEntryType.V7RegularFile ? TarEntryType.RegularFile : entry.EntryType;
            var metadata = string.Join('\0', name, type.ToString(), ((int)entry.Mode).ToString(), entry.Uid.ToString(), entry.Gid.ToString(), entry.Length.ToString(), entry.LinkName, dataHash);
            hashes.Add(Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(metadata))));
        }
        // 单个链接词法上位于根内仍可能经另一个链接再通过 .. 越界；必须对整份归档解析链接关系。
        foreach(var entry in links)
        {
            var segments=entry.Key.Split('/');var parent="";
            foreach(var part in segments.SkipLast(1))
            {
                parent=parent.Length==0?part:parent+"/"+part;
                if(links.TryGetValue(parent,out var ancestor)&&ancestor.Type is not TarEntryType.Directory)throw new OpsException("归档文件的父路径不能是链接或普通文件。");
            }
            if(entry.Value.Type is not (TarEntryType.SymbolicLink or TarEntryType.HardLink))continue;
            var stack=entry.Value.Type==TarEntryType.HardLink?new List<string>():segments.SkipLast(1).ToList();
            var pending=new LinkedList<string>(entry.Value.Target.Split('/'));var followed=0;
            while(pending.First!=null)
            {
                var part=pending.First.Value;pending.RemoveFirst();if(part is "" or ".")continue;
                if(part=="..") {if(stack.Count==0)throw new OpsException("归档链接链越过数据卷根目录。");stack.RemoveAt(stack.Count-1);continue;}
                var candidate=string.Join('/',stack.Append(part));
                if(links.TryGetValue(candidate,out var target)&&target.Type==TarEntryType.SymbolicLink)
                {
                    if(++followed>40)throw new OpsException("归档含循环或过长的符号链接链。");
                    foreach(var segment in target.Target.Split('/').Reverse())pending.AddFirst(segment);
                }
                else stack.Add(part);
            }
        }
        if (hashes.Count == 0) throw new OpsException("归档不包含有效条目。");
        hashes.Sort(StringComparer.Ordinal); return PanelFiles.Hash(Encoding.ASCII.GetBytes(string.Join('\n', hashes)));
    }
}
