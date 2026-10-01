using System;
using System.Globalization;
using System.Linq;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private static DosResult ReadMqttLogs(string tenant, JObject request, bool history)
        {
            var month = GetJsonString(request, "SearchMonth");
            var clientId = GetJsonString(request, "ClientId").Trim();
            if (!DateTime.TryParseExact(month, "yyyyMM", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var start) || clientId.Length > 100)
                return new DosResult(0, null, "请选择有效的 MQTT 日志月份和客户端。");
            var size = Math.Clamp((int?)request["PageSize"] ?? 20, 1, 100);
            var beforeText = GetJsonString(request, "BeforeLogTime");
            var beforeId = GetJsonString(request, "BeforeLogId");
            if (string.IsNullOrWhiteSpace(beforeText) != string.IsNullOrWhiteSpace(beforeId))
                return new DosResult(0, null, "日志翻页游标不合法。");
            DateTime? before = null;
            if (!string.IsNullOrWhiteSpace(beforeText))
            {
                if (!DateTime.TryParse(beforeText, CultureInfo.InvariantCulture,
                        DateTimeStyles.RoundtripKind, out var parsed) || beforeId.Length > 100)
                    return new DosResult(0, null, "日志翻页游标不合法。");
                before = parsed;
            }
            if (!history)
            {
                DosResultList<SysLog> result = null;
                try
                {
                    result = MicroiEngine.MongoDB.GetSysLog(new SysLogParam
                    {
                        OsClient = tenant, TargetType = "MqttEvent", TargetId = clientId,
                        _SearchMonth = month, _PageSize = size,
                        BeforeLogTime = before, BeforeLogId = beforeId
                    }).ConfigureAwait(false).GetAwaiter().GetResult();
                }
                catch { /* MongoDB 查询不可用，继续尝试当前租户关系库。 */ }
                if (result?.Code == 1)
                {
                    var cursor = result.DataAppend == null ? new JObject() : JObject.FromObject(result.DataAppend);
                    cursor["Source"] = "MongoDB";
                    return new DosResult(1, result.Data, result.Msg)
                    {
                        DataCount = result.DataCount,
                        DataAppend = cursor
                    };
                }
            }

            var client = OsClientExtend.GetClient(tenant);
            if (client?.Db == null || !string.Equals(client.OsClient, tenant, StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "MQTT 日志存储均不可用。");
            const string table = "mci_mqtt_log";
            var id = new Field("Id", table);
            var time = new Field("CreateTime", table);
            var device = new Field("ClientId", table);
            var deleted = new Field("IsDeleted", table);
            var where = time >= start & time < start.AddMonths(1) & (deleted == 0 | deleted == null);
            if (!string.IsNullOrWhiteSpace(clientId)) where &= device == clientId;
            if (before.HasValue) where &= time < before.Value | (time == before.Value & id < beforeId);
            var query = client.Db.From(table).Select(id, time, device,
                    new Field("Type", table), new Field("Data", table))
                .Where(where).OrderBy(time.Desc, id.Desc);
            var bounded = client.Db.Db.DbProvider.CreatePageFromSection(query, 1, size + 1);
            var command = client.Db.FromSql(bounded.SqlString);
            foreach (var parameter in bounded.Parameters)
                command.AddInParameter(parameter.ParameterName, parameter.ParameterValue);
            var data = command.SetCommandTimeout(10).ToDataTable();
            var more = data.Rows.Count > size;
            if (more) data.Rows.RemoveAt(data.Rows.Count - 1);
            var rows = JArray.FromObject(data);
            var last = rows.LastOrDefault();
            return new DosResult(1, rows)
            {
                DataCount = rows.Count,
                DataAppend = new
                {
                    Source = "MySQL", HasMore = more,
                    BeforeLogTime = last?["CreateTime"], BeforeLogId = last?["Id"], ExactTotal = false
                }
            };
        }
    }
}
