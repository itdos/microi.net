using System;
using System.Collections.Generic;
using System.Linq;

namespace Microi.net
{
    /// <summary>
    /// 有界的目录 glob；不解释正则、不访问文件系统。动态规划避免恶意规则造成回溯爆炸。
    /// 缓存仅保存不可变语法，不保存租户配置或授权结果，规则修改仍按共享系统设置立即生效。
    /// </summary>
    internal sealed class HdfsUploadPathPattern
    {
        private const int MaxAlternatives = 32;
        private const int MaxTokens = 4096;
        private const int CacheTokenBudget = 32768;
        private static readonly object CacheLock = new object();
        private static readonly Dictionary<string, HdfsUploadPathPattern> Cache = new Dictionary<string, HdfsUploadPathPattern>(StringComparer.Ordinal);
        private static readonly Queue<string> CacheOrder = new Queue<string>();
        private static int cacheTokens;
        private readonly Segment[][] alternatives;
        private readonly int tokenCount;
        internal string Path { get; }

        private HdfsUploadPathPattern(string path)
        {
            Path = path;
            alternatives = Expand(path).Select(value =>
            {
                // 每个展开结果独立校验，不能把穿越或保留目录藏在候选分支中。
                HdfsUploadDirectoryPolicy.ValidatePathParts(value.Split('/'));
                return value.Split('/').Select(part => new Segment(part)).ToArray();
            }).ToArray();
            tokenCount = alternatives.Sum(parts => parts.Sum(part => part.Cost));
            if (tokenCount > MaxTokens) throw Invalid("展开后的规则过于复杂，最多4096个字符令牌。");
        }

        internal static HdfsUploadPathPattern Parse(string value)
        {
            var path = (value ?? string.Empty).Trim().Trim('/');
            if (path.Length == 0 || path.Length > 512 || path.Any(char.IsControl)
                || path.IndexOfAny(new[] { '\\', ':', '%', '#' }) >= 0)
                throw Invalid("目录应为1至512字符的租户内相对路径，不接受根目录、URL、反斜杠或百分号编码。");
            lock (CacheLock)
                if (Cache.TryGetValue(path, out var found)) return found;
            var compiled = new HdfsUploadPathPattern(path);
            lock (CacheLock)
            {
                if (Cache.TryGetValue(path, out var found)) return found;
                while (Cache.Count >= 128 || cacheTokens + compiled.tokenCount > CacheTokenBudget)
                {
                    var oldest = CacheOrder.Dequeue();
                    cacheTokens -= Cache[oldest].tokenCount;
                    Cache.Remove(oldest);
                }
                Cache.Add(path, compiled);
                CacheOrder.Enqueue(path);
                cacheTokens += compiled.tokenCount;
            }
            return compiled;
        }

        internal bool IsMatch(string[] path, bool includeSubdirectories)
        {
            foreach (var parts in alternatives)
            {
                var previous = new bool[path.Length + 1];
                var current = new bool[path.Length + 1];
                previous[0] = true;
                foreach (var part in parts)
                {
                    Array.Clear(current, 0, current.Length);
                    if (part.GlobStar) current[0] = previous[0];
                    for (var i = 1; i <= path.Length; i++)
                        current[i] = part.GlobStar ? previous[i] || current[i - 1]
                            : previous[i - 1] && part.IsMatch(path[i - 1]);
                    var swap = previous; previous = current; current = swap;
                }
                if (previous[path.Length] || (includeSubdirectories && previous.Any(value => value))) return true;
            }
            return false;
        }

        private static IEnumerable<string> Expand(string pattern)
        {
            var pending = new Queue<string>();
            var result = new List<string>();
            pending.Enqueue(pattern);
            while (pending.Count > 0)
            {
                var value = pending.Dequeue();
                var start = -1; var depth = 0; var choiceStart = -1; var end = -1;
                var inClass = false;
                var choices = new List<string>();
                for (var i = 0; i < value.Length; i++)
                {
                    var c = value[i];
                    if (c == '[') inClass = true;
                    if (c == ']') inClass = false;
                    if (inClass) continue;
                    if (c == '{')
                    {
                        if (++depth > 4) throw Invalid("花括号最多嵌套4层。");
                        if (start < 0) { start = i; choiceStart = i + 1; }
                    }
                    else if (c == '}')
                    {
                        if (depth == 0) throw Invalid("花括号不成对。");
                        if (--depth == 0) { choices.Add(value.Substring(choiceStart, i - choiceStart)); end = i; break; }
                    }
                    else if (c == ',' && depth == 1)
                    { choices.Add(value.Substring(choiceStart, i - choiceStart)); choiceStart = i + 1; }
                }
                if (depth != 0) throw Invalid("花括号不成对。");
                if (start < 0) { result.Add(value); continue; }
                if (choices.Count < 2 || choices.Any(choice => choice.Length == 0))
                    throw Invalid("花括号需包含至少两个非空候选，例如{inspection,quality}。");
                if (result.Count + pending.Count + choices.Count > MaxAlternatives)
                    throw Invalid("单条规则最多展开为32个候选目录。");
                foreach (var choice in choices)
                    pending.Enqueue(value.Substring(0, start) + choice + value.Substring(end + 1));
            }
            return result.Distinct(StringComparer.Ordinal);
        }

        private static ArgumentException Invalid(string message) => new ArgumentException("上传目录通配符无效：" + message);

        private sealed class Segment
        {
            internal bool GlobStar { get; }
            internal int Cost { get; }
            private readonly Token[] tokens;

            internal Segment(string part)
            {
                Cost = part.Length + 1;
                GlobStar = part == "**";
                if (GlobStar) { tokens = Array.Empty<Token>(); return; }
                if (part.Contains("**")) throw Invalid("**必须独占一个目录层级；普通层级使用*。");
                var parsed = new List<Token>();
                for (var i = 0; i < part.Length; i++)
                {
                    var c = part[i];
                    if (c == '*') parsed.Add(new Token { Star = true });
                    else if (c == '?') parsed.Add(new Token { Any = true });
                    else if (c == '[')
                    {
                        var end = part.IndexOf(']', i + 1);
                        if (end < 0) throw Invalid("字符集合缺少]。");
                        var body = part.Substring(i + 1, end - i - 1);
                        var negate = body.StartsWith("!", StringComparison.Ordinal) || body.StartsWith("^", StringComparison.Ordinal);
                        if (negate) body = body.Substring(1);
                        if (body.Length == 0 || body.IndexOfAny(new[] { '[', '{', '}', '*', '?' }) >= 0)
                            throw Invalid("字符集合不能为空或包含其它通配符。");
                        var ranges = new List<(char Start, char End)>();
                        for (var j = 0; j < body.Length; j++)
                        {
                            var first = body[j]; var last = first;
                            if (j + 2 < body.Length && body[j + 1] == '-') { last = body[j + 2]; j += 2; }
                            if (first > last) throw Invalid("字符范围应从小到大，例如[0-9]。");
                            ranges.Add((first, last));
                        }
                        parsed.Add(new Token { Ranges = ranges.ToArray(), Negate = negate });
                        i = end;
                    }
                    else
                    {
                        if (c == ']' || c == '{' || c == '}') throw Invalid("括号不成对。");
                        parsed.Add(new Token { Literal = c });
                    }
                }
                tokens = parsed.ToArray();
            }

            internal bool IsMatch(string value)
            {
                var previous = new bool[value.Length + 1];
                var current = new bool[value.Length + 1];
                previous[0] = true;
                foreach (var token in tokens)
                {
                    Array.Clear(current, 0, current.Length);
                    if (token.Star) current[0] = previous[0];
                    for (var i = 1; i <= value.Length; i++)
                        current[i] = token.Star ? previous[i] || current[i - 1]
                            : previous[i - 1] && token.Matches(value[i - 1]);
                    var swap = previous; previous = current; current = swap;
                }
                return previous[value.Length];
            }
        }

        private sealed class Token
        {
            internal bool Star, Any, Negate;
            internal char Literal;
            internal (char Start, char End)[] Ranges;
            internal bool Matches(char value) => Any || (Ranges == null ? Literal == value
                : Ranges.Any(range => value >= range.Start && value <= range.End) != Negate);
        }
    }
}
