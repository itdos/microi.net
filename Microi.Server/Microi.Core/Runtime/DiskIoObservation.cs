using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>按设备记录磁盘计数；物理盘汇总与 RAID/映射设备分开，避免丢失数字结尾设备或重复累计同一次 I/O。</summary>
    internal static class DiskIoObservation
    {
        private static readonly object Gate = new object();
        private static Dictionary<string, Reading> _previous = new Dictionary<string, Reading>();
        private static long _lastAt;

        internal static JObject Capture()
        {
            var current = Parse(File.ReadAllText("/proc/diskstats"),
                name => File.Exists("/sys/class/block/" + name + "/partition"),
                name => Directory.Exists("/sys/class/block/" + name + "/device"));
            lock (Gate)
            {
                var now = Stopwatch.GetTimestamp();
                var seconds = _lastAt == 0 ? 0 : (now - _lastAt) / (double)Stopwatch.Frequency;
                var rows = current.Select(row => Project(row, _previous.TryGetValue(row.Key, out var previous) ? previous : null, seconds)).ToArray();
                var physical = current.Where(row => row.Physical).ToArray();
                var physicalRates = rows.Where(row => row["Physical"]?.Value<bool>() == true).ToArray();
                bool complete = physicalRates.Length > 0 && physicalRates.All(row => row["ReadBytesPerSecond"]?.Type != JTokenType.Null && row["WriteBytesPerSecond"]?.Type != JTokenType.Null);
                var result = new JObject
                {
                    ["SampledAtUtc"] = DateTime.UtcNow, ["WindowSeconds"] = Math.Round(seconds, 3),
                    ["Scope"] = "VisibleKernelBlockDevices", ["AggregateScope"] = "PhysicalWholeDevices",
                    ["ReadMBTotal"] = physical.Length == 0 ? JValue.CreateNull() : new JValue(Math.Round(physical.Sum(row => row.ReadSectors / 2048d), 2)),
                    ["WriteMBTotal"] = physical.Length == 0 ? JValue.CreateNull() : new JValue(Math.Round(physical.Sum(row => row.WriteSectors / 2048d), 2)),
                    ["ReadSpeedKBps"] = complete ? new JValue(Math.Round(physicalRates.Sum(row => row["ReadBytesPerSecond"].Value<double>()) / 1024d, 2)) : JValue.CreateNull(),
                    ["WriteSpeedKBps"] = complete ? new JValue(Math.Round(physicalRates.Sum(row => row["WriteBytesPerSecond"].Value<double>()) / 1024d, 2)) : JValue.CreateNull(),
                    ["Devices"] = new JArray(rows),
                    ["Boundary"] = "包括 SATA/NVMe/RAID/device-mapper；分区按 sysfs 标记识别，不能按名称末尾数字排除。汇总只加物理整盘；映射/RAID 与物理盘不可再次相加。首次/计数重置为 null，I/O busy/await 是内核设备估计。"
                };
                _previous = current.ToDictionary(row => row.Key); _lastAt = now;
                return result;
            }
        }

        internal static Reading[] Parse(string text, Func<string, bool> isPartition, Func<string, bool> isPhysical)
        {
            var result = new List<Reading>();
            foreach (var line in (text ?? "").Split('\n'))
            {
                var fields = line.Split(new[] { ' ', '\t', '\r' }, StringSplitOptions.RemoveEmptyEntries);
                if (fields.Length < 14) continue;
                var name = fields[2];
                if (name.Length > 80 || name.Any(ch => !char.IsLetterOrDigit(ch) && ch != '-' && ch != '_' && ch != '!')
                    || name.StartsWith("loop", StringComparison.Ordinal) || name.StartsWith("ram", StringComparison.Ordinal) || isPartition(name)) continue;
                var values = new long[11]; var valid = true;
                for (var index = 0; index < values.Length; index++)
                    if (!long.TryParse(fields[index + 3], out values[index]) || values[index] < 0) { valid = false; break; }
                if (!valid) continue;
                result.Add(new Reading { Key = fields[0] + ":" + fields[1] + ":" + name, Name = name, Physical = isPhysical(name),
                    Reads = values[0], ReadSectors = values[2], ReadMs = values[3], Writes = values[4], WriteSectors = values[6], WriteMs = values[7], InFlight = values[8], BusyMs = values[9] });
                if (result.Count >= 512) break;
            }
            return result.ToArray();
        }

        internal static JObject Project(Reading current, Reading previous, double seconds)
        {
            var valid = previous != null && previous.Key == current.Key && seconds > 0
                && current.Reads >= previous.Reads && current.Writes >= previous.Writes
                && current.ReadSectors >= previous.ReadSectors && current.WriteSectors >= previous.WriteSectors
                && current.ReadMs >= previous.ReadMs && current.WriteMs >= previous.WriteMs && current.BusyMs >= previous.BusyMs;
            var operations = valid ? current.Reads - previous.Reads + current.Writes - previous.Writes : 0;
            return JObject.FromObject(new
            {
                Device = current.Name, current.Physical, current.InFlight,
                ReadBytesPerSecond = valid ? Math.Round((current.ReadSectors - previous.ReadSectors) * 512d / seconds, 2) : (double?)null,
                WriteBytesPerSecond = valid ? Math.Round((current.WriteSectors - previous.WriteSectors) * 512d / seconds, 2) : (double?)null,
                ReadIops = valid ? Math.Round((current.Reads - previous.Reads) / seconds, 2) : (double?)null,
                WriteIops = valid ? Math.Round((current.Writes - previous.Writes) / seconds, 2) : (double?)null,
                BusyPercent = valid ? Math.Round(Math.Min(100, (current.BusyMs - previous.BusyMs) / (seconds * 10)), 2) : (double?)null,
                AwaitMs = valid && operations > 0 ? Math.Round(((double)current.ReadMs - previous.ReadMs + current.WriteMs - previous.WriteMs) / operations, 2) : (double?)null
            });
        }
        internal sealed class Reading
        {
            internal string Key; internal string Name; internal bool Physical;
            internal long Reads, ReadSectors, ReadMs, Writes, WriteSectors, WriteMs, InFlight, BusyMs;
        }
    }
}
