using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>测试子进程输出只保留有界私有正文；继续排空并记录全文摘要，避免管道阻塞或秘密进入断言。</summary>
internal sealed record BoundedNativeProcessOutput(string Text, long Characters, string Utf16LeSha256, bool Truncated)
{
    internal const int MaximumCharacters = 65536;
    private static readonly HashSet<string> ErrorTypes = new(StringComparer.Ordinal)
    {
        "BoundaryError", "RuntimeError", "TimeoutError", "OperationalError", "InterfaceError", "InternalError",
        "ProgrammingError", "IntegrityError", "DataError", "ValueError", "JSONDecodeError", "OSError",
        "PermissionError", "FileNotFoundError", "ImportError", "ModuleNotFoundError", "AssertionError", "SystemExit"
    };

    internal static async Task<BoundedNativeProcessOutput> ReadAsync(TextReader reader)
    {
        var text = new StringBuilder();
        var buffer = new char[4096];
        long total = 0;
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        int count;
        while ((count = await reader.ReadAsync(buffer.AsMemory(), CancellationToken.None)) != 0)
        {
            // 对解码后的 UTF-16 code unit 原始字节做摘要，不在分块边界重新编码代理对。
            AppendCharacters(hash, buffer, count);
            total += count;
            text.Append(buffer, 0, Math.Min(count, MaximumCharacters - text.Length));
        }
        // 截断点不能留下半个代理对，否则 JSON 私有回执会在 UTF-8 落盘时失败。
        if (text.Length > 0 && char.IsHighSurrogate(text[^1])) text.Length--;
        return new(text.ToString(), total, Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant(), total > text.Length);
    }

    private static void AppendCharacters(IncrementalHash hash, char[] buffer, int count) =>
        hash.AppendData(MemoryMarshal.AsBytes(buffer.AsSpan(0, count)));

    internal JObject PrivateBody() => new()
    {
        ["text"] = Text, ["characters"] = Characters, ["utf16LeSha256"] = Utf16LeSha256, ["truncated"] = Truncated
    };

    internal string SafeFailureSummary()
    {
        if (Truncated) return "UnknownNativeControlFailure";
        try
        {
            var value = JObject.Parse(Text);
            var type = value.Value<string>("errorType");
            if (value.Value<int?>("Code") != 0 || type == null || !ErrorTypes.Contains(type)) return "UnknownNativeControlFailure";
            var code = value["errorCode"];
            return type + (code?.Type == JTokenType.Integer && code.Value<long>() is >= int.MinValue and <= int.MaxValue
                ? "/" + code.Value<int>() : "");
        }
        catch { return "UnknownNativeControlFailure"; }
    }
}
