using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 接口引擎控制面权威读取。路由冷启动、后台任务和启动缓存初始化不能依赖
    /// 可能延迟的 DbRead；这些低频路径必须从租户主库读取并随后修复共享缓存。
    /// </summary>
    public static class ApiEngineAuthoritativeStore
    {
        private const int CommandTimeoutSeconds = 10;

        public static DosResult<dynamic> GetEnabledModel(
            OsClientSecret client,
            ApiEngineParam param)
        {
            if (client?.Db == null)
            {
                return new DosResult<dynamic>(0, null, "接口引擎权威读取缺少租户主库连接。");
            }
            if (param == null)
            {
                return new DosResult<dynamic>(0, null, "接口引擎权威读取参数不能为空。");
            }

            string lookupField;
            string lookupValue;
            if (!param.ApiEngineKey.DosIsNullOrWhiteSpace())
            {
                lookupField = "ApiEngineKey";
                lookupValue = param.ApiEngineKey;
            }
            else if (!param.Id.DosIsNullOrWhiteSpace())
            {
                lookupField = "Id";
                lookupValue = param.Id;
            }
            else if (!param.ApiAddress.DosIsNullOrWhiteSpace())
            {
                lookupField = "ApiAddress";
                lookupValue = param.ApiAddress;
            }
            else
            {
                return new DosResult<dynamic>(0, null, "ApiEngineKey、Id、ApiAddress 不能同时为空。");
            }

            var rows = ReadRows(
                client,
                $"{lookupField} = @lookup",
                "@lookup",
                lookupValue);
            if (rows.Count == 0)
            {
                return new DosResult<dynamic>(1, null);
            }
            if (rows.Count > 1)
            {
                return new DosResult<dynamic>(0, null,
                    $"接口引擎权威读取冲突：字段[{lookupField}]值[{lookupValue}]匹配到{rows.Count}条启用记录。");
            }
            return new DosResult<dynamic>(1, rows[0]);
        }

        public static DosResult<dynamic> GetEnabledByMultiRoute(
            OsClientSecret client,
            string apiAddress)
        {
            if (client?.Db == null)
            {
                return new DosResult<dynamic>(0, null, "接口引擎多路由权威读取缺少租户主库连接。");
            }
            if (apiAddress.DosIsNullOrWhiteSpace())
            {
                return new DosResult<dynamic>(1, null);
            }

            var candidates = ReadRows(
                client,
                $"{ApiEngineRouteAliases.MultiRouteFieldName} LIKE @route",
                "@route",
                "%" + apiAddress.Trim() + "%");
            var matches = candidates
                .Where(row => ApiEngineRouteAliases.ContainsExactRoute((object)row, apiAddress))
                .ToList();
            if (matches.Count == 0)
            {
                return new DosResult<dynamic>(1, null);
            }
            if (matches.Count > 1)
            {
                return new DosResult<dynamic>(0, null,
                    $"接口引擎多路由冲突：地址[{apiAddress}]匹配到{matches.Count}个启用接口，请修复后重试。");
            }
            return new DosResult<dynamic>(1, matches[0]);
        }

        /// <summary>
        /// 判断一个显式地址是否已被当前租户配置。这里故意包含停用记录：
        /// 停用地址必须继续阻断按路径尾部 Key 的兼容回退，避免请求误执行另一个
        /// 同名接口。软删除记录不再占用地址。
        /// </summary>
        public static DosResult<bool> HasConfiguredRoute(
            OsClientSecret client,
            string apiAddress)
        {
            if (client?.Db == null)
            {
                return new DosResult<bool>(0, false, "接口引擎路由占用检查缺少租户主库连接。");
            }
            if (apiAddress.DosIsNullOrWhiteSpace())
            {
                return new DosResult<bool>(1, false);
            }

            var primaryRows = ReadRows(
                client,
                "ApiAddress = @lookup",
                "@lookup",
                apiAddress,
                false);
            if (primaryRows.Count > 0)
            {
                return new DosResult<bool>(1, true);
            }

            var candidates = ReadRows(
                client,
                $"{ApiEngineRouteAliases.MultiRouteFieldName} LIKE @route",
                "@route",
                "%" + apiAddress.Trim() + "%",
                false);
            return new DosResult<bool>(1, candidates.Any(row =>
                ApiEngineRouteAliases.ContainsExactRoute((object)row, apiAddress)));
        }

        public static List<dynamic> GetAllEnabled(OsClientSecret client)
        {
            if (client?.Db == null)
            {
                throw new InvalidOperationException("接口引擎路由缓存初始化缺少租户主库连接。");
            }
            return ReadRows(client, null, null, null);
        }

        private static List<dynamic> ReadRows(
            OsClientSecret client,
            string predicate,
            string parameterName,
            object parameterValue,
            bool enabledOnly = true)
        {
            var sql = "SELECT * FROM sys_apiengine "
                + "WHERE (IsDeleted = 0 OR IsDeleted IS NULL)";
            if (enabledOnly)
            {
                sql += " AND IsEnable = @enabled";
            }
            if (!predicate.DosIsNullOrWhiteSpace())
            {
                sql += " AND " + predicate;
            }

            var section = client.Db.FromSql(sql);
            if (enabledOnly)
            {
                section.AddInParameter("@enabled", 1);
            }
            if (!parameterName.DosIsNullOrWhiteSpace())
            {
                section.AddInParameter(parameterName, parameterValue);
            }
            section.SetCommandTimeout(CommandTimeoutSeconds);
            return section.ToList<dynamic>() ?? new List<dynamic>();
        }
    }
}
