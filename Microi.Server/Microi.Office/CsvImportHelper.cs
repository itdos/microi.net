using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Text;

namespace Microi.net
{
    /// <summary>
    /// CSV 导入解析器。支持 RFC 4180 引号/换行、UTF-8 与 GBK 自动识别，
    /// 并与 Excel 智能导入保持相同的一基行号和零基列映射协议。
    /// </summary>
    public static class CsvImportHelper
    {
        private static readonly char[] DelimiterCandidates = { ',', '\t', ';', '|' };

        private sealed class CsvDynamicColumnDefinition
        {
            public int ColumnIndex { get; set; }
            public string FieldName { get; set; }
        }

        public sealed class CsvImportResult
        {
            public List<dynamic> Rows { get; set; } = new List<dynamic>();
            public string Encoding { get; set; }
            public string Delimiter { get; set; }
        }

        public static CsvImportResult CsvToListDynamic(
            byte[] fileBytes,
            int? maxDataRows = null,
            int? maxColumns = null,
            int? headerStartRow = null,
            int? headerEndRow = null,
            int? dataStartRow = null,
            int? dataEndRow = null,
            IEnumerable<ExcelImportColumnParam> columnMappings = null,
            string encoding = null,
            string delimiter = null)
        {
            if (fileBytes == null || fileBytes.Length == 0)
            {
                throw new ArgumentException("CSV 文件为空。");
            }

            var decoded = DecodeCsv(fileBytes, encoding);
            var resolvedDelimiter = ResolveDelimiter(decoded.Text, delimiter);
            var sourceRows = ParseRows(decoded.Text, resolvedDelimiter);
            if (sourceRows.Count == 0)
            {
                throw new ArgumentException("CSV 文件未读取到任何数据行。");
            }

            var normalizedHeaderStartRow = headerStartRow ?? 1;
            var normalizedHeaderEndRow = headerEndRow ?? normalizedHeaderStartRow;
            var normalizedDataStartRow = dataStartRow ?? normalizedHeaderEndRow + 1;
            var normalizedDataEndRow = Math.Min(dataEndRow ?? sourceRows.Count, sourceRows.Count);
            if (normalizedHeaderStartRow < 1 || normalizedHeaderStartRow > sourceRows.Count)
            {
                throw new ArgumentException($"表头起始行{normalizedHeaderStartRow}超出 CSV 有效范围1-{sourceRows.Count}。");
            }
            if (normalizedHeaderEndRow < normalizedHeaderStartRow || normalizedHeaderEndRow >= normalizedDataStartRow)
            {
                throw new ArgumentException("表头行范围无效，表头结束行必须不小于起始行且位于数据起始行之前。");
            }
            if (normalizedDataStartRow < 1 || normalizedDataEndRow < normalizedDataStartRow)
            {
                throw new ArgumentException("数据行范围无效，请确认数据起始行和结束行。");
            }

            var configuredColumns = (columnMappings ?? Enumerable.Empty<ExcelImportColumnParam>())
                .Where(item => item != null)
                .ToList();
            if (maxColumns.HasValue && configuredColumns.Count > maxColumns.Value)
            {
                throw new ArgumentException($"CSV 有效列数{configuredColumns.Count}超过上限{maxColumns.Value}，请精简后导入。");
            }

            var columnDefinitions = BuildColumnDefinitions(
                sourceRows,
                normalizedHeaderStartRow,
                normalizedHeaderEndRow,
                configuredColumns,
                maxColumns);
            if (!columnDefinitions.Any())
            {
                throw new ArgumentException("CSV 未读取到有效表头或列映射。");
            }
            if (maxDataRows.HasValue
                && normalizedDataEndRow - normalizedDataStartRow + 1 > maxDataRows.Value * 5L)
            {
                throw new ArgumentException("CSV 数据范围包含过多空行，请重新指定紧凑的数据起止行。");
            }

            var rows = new List<dynamic>();
            var enhancedMode = headerStartRow.HasValue
                || headerEndRow.HasValue
                || dataStartRow.HasValue
                || dataEndRow.HasValue
                || configuredColumns.Any();
            for (var rowNumber = normalizedDataStartRow; rowNumber <= normalizedDataEndRow; rowNumber++)
            {
                var sourceRow = sourceRows[rowNumber - 1];
                dynamic expando = new ExpandoObject();
                var dictionary = (IDictionary<string, object>)expando;
                var hasValue = false;
                foreach (var column in columnDefinitions)
                {
                    var value = column.ColumnIndex < sourceRow.Count
                        ? NormalizeValue(sourceRow[column.ColumnIndex])
                        : null;
                    dictionary[column.FieldName] = value;
                    if (value != null) hasValue = true;
                }
                if (!hasValue) continue;
                if (maxDataRows.HasValue && rows.Count >= maxDataRows.Value)
                {
                    throw new ArgumentException($"CSV 数据行数超过上限{maxDataRows.Value}，请拆分后导入。");
                }
                if (enhancedMode) dictionary["_ExcelRow"] = rowNumber;
                rows.Add(expando);
            }

            return new CsvImportResult
            {
                Rows = rows,
                Encoding = decoded.EncodingName,
                Delimiter = resolvedDelimiter == '\t' ? "\\t" : resolvedDelimiter.ToString()
            };
        }

        private static List<CsvDynamicColumnDefinition> BuildColumnDefinitions(
            IReadOnlyList<List<string>> sourceRows,
            int headerStartRow,
            int headerEndRow,
            IReadOnlyList<ExcelImportColumnParam> configuredColumns,
            int? maxColumns)
        {
            var result = new List<CsvDynamicColumnDefinition>();
            if (configuredColumns.Any())
            {
                var fieldNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var mapping in configuredColumns)
                {
                    var columnIndex = mapping.ColumnIndex ?? ExcelColumnNameToIndex(mapping.Column);
                    var fieldName = !string.IsNullOrWhiteSpace(mapping.Name)
                        ? mapping.Name.Trim()
                        : (!string.IsNullOrWhiteSpace(mapping.Label) ? mapping.Label.Trim() : mapping.Header?.Trim());
                    if (columnIndex < 0 || string.IsNullOrWhiteSpace(fieldName))
                    {
                        throw new ArgumentException("CSV 列映射包含无效的列索引或目标字段。");
                    }
                    if (maxColumns.HasValue && columnIndex >= maxColumns.Value)
                    {
                        throw new ArgumentException($"CSV 列索引{columnIndex}超过上限{maxColumns.Value - 1}。");
                    }
                    if (!fieldNames.Add(fieldName))
                    {
                        throw new ArgumentException($"CSV 列映射中的目标字段[{fieldName}]重复。");
                    }
                    result.Add(new CsvDynamicColumnDefinition { ColumnIndex = columnIndex, FieldName = fieldName });
                }
                return result;
            }

            var lastColumnIndex = -1;
            for (var rowNumber = headerStartRow; rowNumber <= headerEndRow; rowNumber++)
            {
                lastColumnIndex = Math.Max(lastColumnIndex, sourceRows[rowNumber - 1].Count - 1);
            }
            if (maxColumns.HasValue) lastColumnIndex = Math.Min(lastColumnIndex, maxColumns.Value - 1);
            var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (var columnIndex = 0; columnIndex <= lastColumnIndex; columnIndex++)
            {
                var headerParts = new List<string>();
                for (var rowNumber = headerStartRow; rowNumber <= headerEndRow; rowNumber++)
                {
                    var row = sourceRows[rowNumber - 1];
                    var part = columnIndex < row.Count ? NormalizeValue(row[columnIndex]) : null;
                    if (part != null && (headerParts.Count == 0 || headerParts.Last() != part)) headerParts.Add(part);
                }
                if (!headerParts.Any()) continue;
                var fieldName = string.Join(" / ", headerParts);
                var uniqueName = fieldName;
                var suffix = 2;
                while (!usedNames.Add(uniqueName)) uniqueName = $"{fieldName}_{suffix++}";
                result.Add(new CsvDynamicColumnDefinition { ColumnIndex = columnIndex, FieldName = uniqueName });
            }
            return result;
        }

        private static int ExcelColumnNameToIndex(string column)
        {
            if (string.IsNullOrWhiteSpace(column)) return -1;
            var value = 0;
            foreach (var character in column.Trim().ToUpperInvariant())
            {
                if (character < 'A' || character > 'Z') return -1;
                value = value * 26 + character - 'A' + 1;
            }
            return value - 1;
        }

        private static string NormalizeValue(string value)
        {
            var normalized = value?.Trim();
            return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
        }

        private static List<List<string>> ParseRows(string text, char delimiter)
        {
            var rows = new List<List<string>>();
            var row = new List<string>();
            var field = new StringBuilder();
            var inQuotes = false;
            var source = (text ?? string.Empty).TrimStart('\uFEFF');
            for (var index = 0; index < source.Length; index++)
            {
                var character = source[index];
                if (character == '"')
                {
                    if (inQuotes && index + 1 < source.Length && source[index + 1] == '"')
                    {
                        field.Append('"');
                        index++;
                    }
                    else
                    {
                        inQuotes = !inQuotes;
                    }
                    continue;
                }
                if (!inQuotes && character == delimiter)
                {
                    row.Add(field.ToString());
                    field.Clear();
                    continue;
                }
                if (!inQuotes && (character == '\r' || character == '\n'))
                {
                    if (character == '\r' && index + 1 < source.Length && source[index + 1] == '\n') index++;
                    row.Add(field.ToString());
                    field.Clear();
                    rows.Add(row);
                    row = new List<string>();
                    continue;
                }
                field.Append(character);
            }
            if (inQuotes) throw new ArgumentException("CSV 存在未闭合的引号字段。");
            if (field.Length > 0 || row.Count > 0)
            {
                row.Add(field.ToString());
                rows.Add(row);
            }
            while (rows.Count > 0 && rows.Last().All(string.IsNullOrWhiteSpace)) rows.RemoveAt(rows.Count - 1);
            return rows;
        }

        private static char ResolveDelimiter(string text, string configuredDelimiter)
        {
            if (!string.IsNullOrEmpty(configuredDelimiter))
            {
                if (configuredDelimiter == "\\t") return '\t';
                var configured = configuredDelimiter[0];
                if (DelimiterCandidates.Contains(configured)) return configured;
                throw new ArgumentException("CSV 分隔符只支持逗号、制表符、分号或竖线。");
            }

            var bestDelimiter = ',';
            var bestScore = -1;
            foreach (var candidate in DelimiterCandidates)
            {
                var counts = CountDelimitersByRow(text, candidate);
                var populated = counts.Where(value => value > 0).ToList();
                if (!populated.Any()) continue;
                var mode = populated.GroupBy(value => value)
                    .OrderByDescending(group => group.Count())
                    .ThenByDescending(group => group.Key)
                    .First();
                var score = populated.Count * 100 + mode.Count() * 20 + mode.Key;
                if (score <= bestScore) continue;
                bestScore = score;
                bestDelimiter = candidate;
            }
            return bestDelimiter;
        }

        private static List<int> CountDelimitersByRow(string text, char delimiter)
        {
            var counts = new List<int>();
            var current = 0;
            var inQuotes = false;
            var source = text ?? string.Empty;
            for (var index = 0; index < source.Length && counts.Count < 20; index++)
            {
                var character = source[index];
                if (character == '"')
                {
                    if (inQuotes && index + 1 < source.Length && source[index + 1] == '"') index++;
                    else inQuotes = !inQuotes;
                    continue;
                }
                if (inQuotes) continue;
                if (character == delimiter) current++;
                if (character != '\r' && character != '\n') continue;
                if (character == '\r' && index + 1 < source.Length && source[index + 1] == '\n') index++;
                counts.Add(current);
                current = 0;
            }
            if (counts.Count < 20 && current > 0) counts.Add(current);
            return counts;
        }

        private sealed class DecodedCsv
        {
            public string Text { get; set; }
            public string EncodingName { get; set; }
        }

        private static DecodedCsv DecodeCsv(byte[] bytes, string configuredEncoding)
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            if (!string.IsNullOrWhiteSpace(configuredEncoding))
            {
                var selected = GetEncoding(configuredEncoding);
                return new DecodedCsv
                {
                    Text = selected.GetString(RemoveKnownBom(bytes)),
                    EncodingName = NormalizeEncodingName(configuredEncoding)
                };
            }
            if (HasPrefix(bytes, 0xEF, 0xBB, 0xBF))
            {
                return new DecodedCsv { Text = Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3), EncodingName = "UTF-8" };
            }
            if (HasPrefix(bytes, 0xFF, 0xFE))
            {
                return new DecodedCsv { Text = Encoding.Unicode.GetString(bytes, 2, bytes.Length - 2), EncodingName = "UTF-16LE" };
            }
            if (HasPrefix(bytes, 0xFE, 0xFF))
            {
                return new DecodedCsv { Text = Encoding.BigEndianUnicode.GetString(bytes, 2, bytes.Length - 2), EncodingName = "UTF-16BE" };
            }
            try
            {
                var utf8 = new UTF8Encoding(false, true);
                return new DecodedCsv { Text = utf8.GetString(bytes), EncodingName = "UTF-8" };
            }
            catch (DecoderFallbackException)
            {
                return new DecodedCsv { Text = GetEncoding("GBK").GetString(bytes), EncodingName = "GBK" };
            }
        }

        private static Encoding GetEncoding(string encodingName)
        {
            var normalized = NormalizeEncodingName(encodingName);
            if (normalized == "UTF-8") return new UTF8Encoding(false, true);
            if (normalized == "UTF-16LE") return Encoding.Unicode;
            if (normalized == "UTF-16BE") return Encoding.BigEndianUnicode;
            try
            {
                return Encoding.GetEncoding(54936, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
            }
            catch (ArgumentException)
            {
                return Encoding.GetEncoding(936, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
            }
        }

        private static string NormalizeEncodingName(string value)
        {
            var normalized = (value ?? string.Empty).Trim().Replace("_", "-").ToUpperInvariant();
            if (normalized == "UTF8" || normalized == "UTF-8-BOM") return "UTF-8";
            if (normalized == "UTF16" || normalized == "UTF-16" || normalized == "UTF16LE") return "UTF-16LE";
            if (normalized == "UTF16BE") return "UTF-16BE";
            if (normalized == "GB2312" || normalized == "GB18030" || normalized == "CP936") return "GBK";
            if (normalized == "GBK" || normalized == "UTF-8" || normalized == "UTF-16LE" || normalized == "UTF-16BE") return normalized;
            throw new ArgumentException($"不支持的 CSV 编码：{value}。仅支持 UTF-8、GBK、UTF-16LE、UTF-16BE。");
        }

        private static byte[] RemoveKnownBom(byte[] bytes)
        {
            var offset = HasPrefix(bytes, 0xEF, 0xBB, 0xBF) ? 3 : (HasPrefix(bytes, 0xFF, 0xFE) || HasPrefix(bytes, 0xFE, 0xFF) ? 2 : 0);
            if (offset == 0) return bytes;
            var result = new byte[bytes.Length - offset];
            Buffer.BlockCopy(bytes, offset, result, 0, result.Length);
            return result;
        }

        private static bool HasPrefix(byte[] bytes, params byte[] prefix)
        {
            return bytes != null
                && bytes.Length >= prefix.Length
                && prefix.Select((value, index) => bytes[index] == value).All(match => match);
        }
    }
}
