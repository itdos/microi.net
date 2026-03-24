#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8McpService.cs
* Copyright(c) Microi.net
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：2026-03-21
* 文件描述：V8引擎MCP 核心服务（开源部分）
*           提供代码插桩、安全序列化等纯工具方法
*           不依赖 ASP.NET Core / Microi.net 内部类型
*******************************************************/
#endregion
using System;
using System.Text;
using Newtonsoft.Json;

namespace Microi.net
{
    /// <summary>
    /// V8 MCP 核心服务（开源工具方法）
    /// 代码插桩、安全序列化等不依赖闭源类型的方法
    /// </summary>
    public static class V8McpService
    {
        /// <summary>
        /// 代码插桩：在每个有效语句行前插入 __dbg(lineNumber) 检查点调用
        /// lineNumber 从 1 开始（与 VS Code 行号一致）
        /// </summary>
        /// <param name="code">原始 JavaScript 代码</param>
        /// <returns>插桩后的代码</returns>
        public static string InstrumentCode(string code)
        {
            var lines = code.Split('\n');
            var sb = new StringBuilder();
            bool inMultiLineComment = false;

            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i];
                var trimmed = line.TrimStart();

                // 处理多行注释
                if (inMultiLineComment)
                {
                    if (trimmed.Contains("*/"))
                    {
                        inMultiLineComment = false;
                    }
                    sb.AppendLine(line);
                    continue;
                }

                if (trimmed.StartsWith("/*"))
                {
                    inMultiLineComment = !trimmed.Contains("*/");
                    sb.AppendLine(line);
                    continue;
                }

                // 跳过不需要插桩的行
                if (ShouldSkipInstrumentation(trimmed))
                {
                    sb.AppendLine(line);
                    continue;
                }

                // 在有效代码行前插入调试检查点
                var indent = line.Substring(0, line.Length - line.TrimStart().Length);
                sb.AppendLine($"{indent}__dbg({i + 1});");
                sb.AppendLine(line);
            }

            return sb.ToString();
        }

        /// <summary>
        /// 判断某行是否应该跳过插桩
        /// </summary>
        public static bool ShouldSkipInstrumentation(string trimmedLine)
        {
            if (string.IsNullOrWhiteSpace(trimmedLine)) return true;
            if (trimmedLine.StartsWith("//")) return true;
            if (trimmedLine.StartsWith("*")) return true;  // 多行注释中间行
            if (trimmedLine == "{") return true;
            if (trimmedLine == "}") return true;
            if (trimmedLine == "});") return true;
            if (trimmedLine == "})") return true;
            if (trimmedLine == ");") return true;
            if (trimmedLine == "]") return true;
            if (trimmedLine == "} else {") return true;
            if (trimmedLine == "else {") return true;
            if (trimmedLine.StartsWith("} else")) return true;
            if (trimmedLine.StartsWith("else")) return true;
            if (trimmedLine.StartsWith("case ")) return true;
            if (trimmedLine == "default:") return true;
            if (trimmedLine.StartsWith("catch")) return true;
            if (trimmedLine.StartsWith("finally")) return true;
            return false;
        }

        /// <summary>
        /// 安全序列化对象为字符串（带深度和长度限制）
        /// </summary>
        /// <param name="obj">待序列化的对象</param>
        /// <param name="maxLength">最大字符串长度，默认 2000</param>
        /// <param name="maxDepth">最大序列化深度，默认 5</param>
        public static string SafeSerialize(object obj, int maxLength = 2000, int maxDepth = 5)
        {
            if (obj == null) return "null";
            try
            {
                var json = JsonConvert.SerializeObject(obj, new JsonSerializerSettings
                {
                    ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    MaxDepth = maxDepth,
                    NullValueHandling = NullValueHandling.Include,
                    Formatting = Formatting.None
                });
                return json.Length > maxLength ? json.Substring(0, maxLength) + "..." : json;
            }
            catch
            {
                return obj.ToString();
            }
        }
    }
}
