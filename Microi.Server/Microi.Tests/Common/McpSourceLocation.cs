namespace Microi.Tests.Common;

/// <summary>从仓库定位 MCP 源码，使迁移回归可在隔离 artifacts 目录运行。</summary>
internal static class McpSourceLocation
{
    internal static string File(string relativePath)
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory != null; directory = directory.Parent)
        {
            var server = Path.Combine(directory.FullName, "Microi.Server");
            if (System.IO.File.Exists(Path.Combine(server, "Directory.Build.props")))
                return Path.Combine(server, relativePath);
        }
        throw new DirectoryNotFoundException("未找到 Microi.Server 源码目录。");
    }
}
