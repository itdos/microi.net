using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    internal static class SpiderCatalogReadPolicy
    {
        internal const string EngineKey = "mci-spider-reader";

        internal static DiyTableRowParam Create(
            string action, int pageIndex, int pageSize, string osClient, JObject currentUser)
        {
            if (string.IsNullOrWhiteSpace(osClient) || string.IsNullOrWhiteSpace(currentUser?["Id"]?.ToString()))
                throw new InvalidOperationException("读取采集目录需要有效的当前登录身份。");
            if (pageIndex < 1 || pageIndex > 1000 || pageSize < 1 || pageSize > 50)
                throw new ArgumentOutOfRangeException(nameof(pageSize), "页码范围 1–1000，每页范围 1–50。");

            var fields = new List<string> { "Id", "CreateTime", "Status" };
            string table;
            if (action == "Rules")
            {
                table = "mci_spider_rule";
                fields.AddRange(new[] { "Name", "SiteId", "SiteName" });
            }
            else if (action == "Tasks")
            {
                table = "mci_spider_task";
                fields.AddRange(new[] { "TaskNo", "RuleId", "RuleName", "SiteId", "SiteName", "Progress", "ResultCount", "AnswerCount" });
            }
            else throw new ArgumentException("不支持的采集目录动作。", nameof(action));

            return new DiyTableRowParam
            {
                FormEngineKey = table,
                OsClient = osClient,
                _CurrentUser = (JObject)currentUser.DeepClone(),
                _InvokeType = InvokeType.Client.ToString(),
                _TrustedServerInvocation = false,
                _IsAnonymous = false,
                IsDeleted = 0,
                _PageIndex = pageIndex,
                _PageSize = pageSize,
                _SelectFields = fields,
                _OrderBys = new Dictionary<string, string> { ["CreateTime"] = "DESC", ["Id"] = "DESC" }
            };
        }
    }
}
