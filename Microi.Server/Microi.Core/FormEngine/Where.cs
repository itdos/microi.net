using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;

namespace Microi.net
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Linq;

    /// <summary>
    /// 统一的 Where 条件解析器
    /// </summary>
    public static class WhereParser
    {
        /// <summary>
        /// 将前端传入的 Where 参数统一解析为 DiyWhere 列表
        /// </summary>
        public static List<DiyWhere> ParseWhere(object whereParam)
        {
            var result = new List<DiyWhere>();

            if (whereParam == null)
                return result;

            try
            {
                // 1. 首先处理 JArray (Newtonsoft.Json.Linq.JArray)
                if (whereParam is Newtonsoft.Json.Linq.JArray jArray)
                {
                    return ParseJArray(jArray);
                }

                // 2. 尝试处理新格式：List<List<object>>
                if (whereParam is List<List<object>> newFormat)
                {
                    return ParseNewFormat(newFormat);
                }

                // 3. 新增：处理 List<List<string>>
                if (whereParam is List<List<string>> stringFormat)
                {
                    // 转换为 List<List<object>>
                    var objectFormat = stringFormat.Select(inner => inner.Cast<object>().ToList()).ToList();
                    return ParseNewFormat(objectFormat);
                }

                // 3. 尝试处理旧格式：List<DiyWhere>
                if (whereParam is List<DiyWhere> oldFormat)
                {
                    return oldFormat;
                }

                // 4. 尝试处理 JSON 字符串
                if (whereParam is string jsonString && !string.IsNullOrWhiteSpace(jsonString))
                {
                    // 【性能优化】先检查字符串是否以 [ 开头，避免无效解析
                    var trimmed = jsonString.TrimStart();
                    if (trimmed.StartsWith("["))
                    {
                        try
                        {
                            var parsedJArray = Newtonsoft.Json.Linq.JArray.Parse(jsonString);
                            return ParseJArray(parsedJArray);
                        }
                        catch
                        {
                            // 忽略解析错误
                        }
                    }
                }

                // 5. 如果以上都不匹配，尝试使用动态转换
                // 先检查是否为 JArray 类型，避免不必要的序列化
                var jArray2 = whereParam as Newtonsoft.Json.Linq.JArray;
                if (jArray2 != null)
                {
                    return ParseJArray(jArray2);
                }

                // 最后尝试序列化为 JSON 再解析
                try
                {
                    string json = Dos.Common.JsonHelper.Serialize(whereParam);
                    if (!string.IsNullOrWhiteSpace(json) && json.TrimStart().StartsWith("["))
                    {
                        var parsedJArray = Newtonsoft.Json.Linq.JArray.Parse(json);
                        return ParseJArray(parsedJArray);
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"动态转换失败: {ex.Message}");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ParseWhere 解析失败: {ex.Message}");
            }

            return result;
        }

        /// <summary>
        /// 解析 JArray 类型的 Where 参数
        /// </summary>
        private static List<DiyWhere> ParseJArray(Newtonsoft.Json.Linq.JArray jArray)
        {
            var result = new List<DiyWhere>();

            if (jArray == null || jArray.Count == 0)
                return result;

            // 判断是旧格式还是新格式
            if (jArray[0].Type == Newtonsoft.Json.Linq.JTokenType.Object)
            {
                // 旧格式: List<DiyWhere>
                return jArray.ToObject<List<DiyWhere>>();
            }
            else if (jArray[0].Type == Newtonsoft.Json.Linq.JTokenType.Array)
            {
                // 新格式: List<List<object>>
                var newFormatList = new List<List<object>>();

                foreach (var item in jArray)
                {
                    if (item.Type == Newtonsoft.Json.Linq.JTokenType.Array)
                    {
                        var innerList = new List<object>();
                        foreach (var innerItem in item)
                        {
                            // 处理各种类型的值
                            switch (innerItem.Type)
                            {
                                case Newtonsoft.Json.Linq.JTokenType.String:
                                    innerList.Add(innerItem.Value<string>());
                                    break;
                                case Newtonsoft.Json.Linq.JTokenType.Integer:
                                    innerList.Add(innerItem.Value<int>());
                                    break;
                                case Newtonsoft.Json.Linq.JTokenType.Float:
                                    innerList.Add(innerItem.Value<double>());
                                    break;
                                case Newtonsoft.Json.Linq.JTokenType.Boolean:
                                    innerList.Add(innerItem.Value<bool>());
                                    break;
                                case Newtonsoft.Json.Linq.JTokenType.Null:
                                    innerList.Add(null);
                                    break;
                                default:
                                    innerList.Add(innerItem.ToString());
                                    break;
                            }
                        }
                        newFormatList.Add(innerList);
                    }
                }

                return ParseNewFormat(newFormatList);
            }

            return result;
        }

        /// <summary>
        /// 解析新格式的数组条件
        /// </summary>
        private static List<DiyWhere> ParseNewFormat(List<List<object>> newFormat)
        {
            var result = new List<DiyWhere>();

            foreach (var whereArray in newFormat)
            {
                try
                {
                    var diyWhere = ParseWhereArray(whereArray);
                    if (diyWhere != null)
                    {
                        result.Add(diyWhere);
                    }
                }
                catch (Exception ex)
                {
                    // 记录日志
                    System.Diagnostics.Debug.WriteLine($"解析Where条件失败: {ex.Message}, 数据: {string.Join(",", whereArray)}");
                }
            }

            return result;
        }

        /// <summary>
        /// 解析单个数组条件 - 增强版
        /// </summary>
        private static DiyWhere ParseWhereArray(List<object> whereArray)
        {
            if (whereArray == null || whereArray.Count < 3)
                return null;

            var diyWhere = new DiyWhere();

            // 创建处理列表，过滤掉空值并转换为字符串
            var processedArray = whereArray
                // .Where(item => item != null)
                .Select(item => item?.ToString())
                .ToList();

            // 【修复】过滤掉字段名为空/null的非法Where条件，避免生成 "A.=@p0" 之类的无效SQL，
            // 同时防止树形懒加载场景下因字段名为空导致误判"未传ParentId"而添加根节点过滤条件。
            if (processedArray.Count == 3 &&
                processedArray[0] != "(" &&
                processedArray[0].ToUpper() != "AND" &&
                processedArray[0].ToUpper() != "OR")
            {
                if (string.IsNullOrWhiteSpace(processedArray[0]))
                {
                    System.Diagnostics.Debug.WriteLine("ParseWhereArray: 字段名为空，忽略此Where条件：" + string.Join(",", processedArray));
                    return null;
                }
                diyWhere.AndOr = "AND";
                if (processedArray[0].DosSplit('.').Length > 1)
                {
                    diyWhere.FormEngineKey = processedArray[0].DosSplit('.')[0];
                    diyWhere.Name = processedArray[0].DosSplit('.')[1];
                }
                else
                {
                    diyWhere.Name = processedArray[0];
                }
                diyWhere.Type = processedArray[1];
                diyWhere.Value = whereArray[2];
                return diyWhere;
            }

            int index = 0;

            // 处理开头的括号
            while (index < processedArray.Count && processedArray[index] == "(")
            {
                diyWhere.GroupStart = true;
                index++;
            }

            // 处理 AND/OR
            if (index < processedArray.Count && (processedArray[index].ToUpper() == "AND" || processedArray[index].ToUpper() == "OR"))
            {
                diyWhere.AndOr = processedArray[index].ToUpper();
                index++;

                // 处理在 AND/OR 之后的括号
                while (index < processedArray.Count && processedArray[index] == "(")
                {
                    diyWhere.GroupStart = true;
                    index++;
                }
            }
            else
            {
                diyWhere.AndOr = "AND"; // 默认 AND
            }

            // 提取字段名、操作符和值
            int remainingElements = processedArray.Count - index;
            if (remainingElements < 3)
                return null;

            // 【修复】过滤掉字段名为空/null的非法Where条件
            if (string.IsNullOrWhiteSpace(processedArray[index]))
            {
                System.Diagnostics.Debug.WriteLine("ParseWhereArray: 字段名为空，忽略此Where条件：" + string.Join(",", processedArray));
                return null;
            }

            // 获取字段名、操作符和值
            if (processedArray[index].DosSplit('.').Length > 1)
            {
                diyWhere.FormEngineKey = processedArray[index].DosSplit('.')[0];
                diyWhere.Name = processedArray[index].DosSplit('.')[1];
            }
            else
            {
                diyWhere.Name = processedArray[index];
            }
            diyWhere.Type = processedArray[index + 1];
            diyWhere.Value = whereArray[index + 2];
            index += 3;

            // 处理结尾的括号
            while (index < processedArray.Count && processedArray[index] == ")")
            {
                diyWhere.GroupEnd = true;
                index++;
            }

            return diyWhere;
        }
    }
    public partial class WhereCondition
    {
        /// <summary>
        /// 获取 Where SQL 条件
        /// </summary>
        public async Task<string> GetWhereSql(object whereParam,
            List<JObject> fieldList, List<DiyTable> joinTables,
            DbInfo dbInfo, List<DbParameter> sqlParams, DbSession dbSession,
            string sqlType = "select"
            )
        {
            // 统一解析 Where 参数
            List<DiyWhere> whereConditions = WhereParser.ParseWhere(whereParam);

            if (whereConditions == null || whereConditions.Count == 0)
                return "";

            var where = "";
            var hasValidConditions = false; // 跟踪是否有有效的条件

            foreach (var fieldWhere in whereConditions)
            {
                if (!IsValidWhereCondition(fieldWhere, fieldList))
                    continue;

                hasValidConditions = true; // 标记找到有效条件

                var sqlFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(fieldWhere.Name);
                var tableAsName = GetTableAsName(fieldWhere, fieldList, joinTables, sqlType);
                if (!tableAsName.DosIsNullOrWhiteSpace())
                {
                    tableAsName = tableAsName + ".";
                }

                JObject filedModel = null;
                if (fieldList != null && fieldList.Any())
                {
                    if (fieldWhere.FormEngineKey.DosIsNullOrWhiteSpace())
                    {
                        filedModel = fieldList.FirstOrDefault(f => f["Name"].Val<string>() == fieldWhere.Name);
                    }
                    else
                    {
                        filedModel = fieldList.FirstOrDefault(f => (f["TableId"].Val<string>() == fieldWhere.FormEngineKey || f["TableName"].Val<string>() == fieldWhere.FormEngineKey)
                                                                    && f["Name"].Val<string>() == fieldWhere.Name);
                        if (filedModel == null)
                        {
                            filedModel = fieldList.FirstOrDefault(f => f["Name"].Val<string>() == fieldWhere.Name);
                        }
                    }
                }

                var andOr = GetAndOrClause(fieldWhere, where);

                // 判断是否为 NULL 值
                bool isNullValue = fieldWhere.Value == null;

                // 判断是否为空字符串
                bool isEmptyString = fieldWhere.Value is string valueStr2 && valueStr2 == "";

                if (isNullValue)
                {
                    // 处理真正的 NULL 值
                    var nullCondition = HandleNullCondition(fieldWhere, tableAsName, sqlFieldName);
                    where += andOr +
                            (fieldWhere.GroupStart ? " (" : "") +
                            nullCondition +
                            (fieldWhere.GroupEnd ? ") " : "");
                }
                else if (isEmptyString)
                {
                    // 处理空字符串
                    var emptyStringCondition = HandleEmptyStringCondition(fieldWhere, tableAsName, sqlFieldName);
                    where += andOr +
                            (fieldWhere.GroupStart ? " (" : "") +
                            emptyStringCondition +
                            (fieldWhere.GroupEnd ? ") " : "");
                }
                else
                {
                    // 处理参数化值
                    var (paramValue, isParameterized) = ProcessParameterValue(fieldWhere, filedModel, dbInfo, sqlParams, dbSession);

                    // 构建条件语句
                    where += andOr +
                            (fieldWhere.GroupStart ? " (" : "") +
                            $" {tableAsName}{sqlFieldName} {GetOperator(fieldWhere.Type)} {paramValue} " +
                            (fieldWhere.GroupEnd ? ") " : "");
                }
            }

            // 如果没有有效条件，返回空字符串避免生成 "WHERE ()" 的 SQL 错误
            if (!hasValidConditions)
            {
                return "";
            }

            if (!where.DosIsNullOrWhiteSpace())
            {
                where = " ( " + where + " ) ";
            }

            return where;
        }

        /// <summary>
        /// 处理 NULL 值的条件
        /// </summary>
        private string HandleNullCondition(DiyWhere fieldWhere, string tableAsName, string sqlFieldName)
        {
            switch (fieldWhere.Type.ToLower())
            {
                case "equal":
                case "=":
                case "==":
                    return $" {tableAsName}{sqlFieldName} IS NULL ";

                case "notequal":
                case "<>":
                case "!=":
                    return $" {tableAsName}{sqlFieldName} IS NOT NULL ";

                case "in":
                    return $" {tableAsName}{sqlFieldName} IS NULL ";

                case "notin":
                    return $" {tableAsName}{sqlFieldName} IS NOT NULL ";

                default:
                    // 对于其他操作符，默认使用 IS NULL
                    return $" {tableAsName}{sqlFieldName} IS NULL ";
            }
        }

        /// <summary>
        /// 处理空字符串的条件
        /// </summary>
        private string HandleEmptyStringCondition(DiyWhere fieldWhere, string tableAsName, string sqlFieldName)
        {
            switch (fieldWhere.Type.ToLower())
            {
                case "equal":
                case "=":
                case "==":
                    return $" {tableAsName}{sqlFieldName} = '' ";

                case "notequal":
                case "<>":
                case "!=":
                    return $" {tableAsName}{sqlFieldName} <> '' ";

                case "like":
                    return $" {tableAsName}{sqlFieldName} LIKE '%%' ";
                case "notlike":
                    return $" {tableAsName}{sqlFieldName} NOT LIKE '%%' ";
                case "startlike":
                    return $" {tableAsName}{sqlFieldName} LIKE '%' ";
                case "notstartlike":
                    return $" {tableAsName}{sqlFieldName} NOT LIKE '%' ";

                case "endlike":
                    return $" {tableAsName}{sqlFieldName} LIKE '%' ";
                case "notendlike":
                    return $" {tableAsName}{sqlFieldName} NOT LIKE '%' ";

                case "in":
                    return $" {tableAsName}{sqlFieldName} IN ('') ";

                case "notin":
                    return $" {tableAsName}{sqlFieldName} NOT IN ('') ";

                default:
                    return $" {tableAsName}{sqlFieldName} {GetOperator(fieldWhere.Type)} '' ";
            }
        }

        /// <summary>
        /// 验证 where 条件是否有效
        /// </summary>
        private bool IsValidWhereCondition(DiyWhere fieldWhere, List<JObject> fieldList)
        {
            // 基本验证：Name 和 Type 必须有效
            if (string.IsNullOrWhiteSpace(fieldWhere.Name)
                || string.IsNullOrWhiteSpace(fieldWhere.Type)
                || !DiyCommon.FieldWhereTypes.ContainsKey(fieldWhere.Type))
            {
                return false;
            }

            // 如果 fieldList 为 null 或空（可能是系统表未配置字段元数据）
            // 则跳过字段存在性验证，允许查询继续执行
            // 这样可以让系统表在没有配置 Diy_Field 的情况下仍然可以使用 WHERE 条件
            if (fieldList == null || !fieldList.Any())
            {
                return true;
            }

            // 正常情况：验证字段是否在 fieldList 或 DefaultFields 中
            return fieldList.Any(d => d["Name"].Val<string>()?.ToLower() == fieldWhere.Name.ToLower())
                   || DiyCommon.DefaultFields.Any(d => d.ToLower() == fieldWhere.Name.ToLower());
        }

        /// <summary>
        /// 获取表别名
        /// </summary>
        private string GetTableAsName(DiyWhere fieldWhere, List<JObject> fieldList, List<DiyTable> joinTables, string sqlType = "select")
        {
            //注意：所有数据库都支持 select * from tableName A 别名，别加AS
            //sqlserver 不支持 update/delete tableName A 别名，只能是在 FROM tableName 后加别名，但是mysql又不支持
            // 所以除了 select 之外的语句都不加别名
            if(sqlType.ToLower() != "select")
            {
                return "";
            }
            var tableAsName = "A";
            JObject fieldModel = null;

            if (fieldList == null || !fieldList.Any())
            {
                return tableAsName;
            }

            if (!string.IsNullOrWhiteSpace(fieldWhere.FormEngineKey))
            {
                fieldModel = fieldList.FirstOrDefault(d =>
                    (d["TableName"].Val<string>().ToLower() == fieldWhere.FormEngineKey?.ToLower() || d["TableId"].Val<string>() == fieldWhere.FormEngineKey)
                    && d["Name"].Val<string>().ToLower() == fieldWhere.Name.ToLower());
            }
            else
            {
                //先从主表找字段model
                fieldModel = fieldList.FirstOrDefault(d => d["Name"].Val<string>()?.ToLower() == fieldWhere.Name.ToLower() && !joinTables.Any(o => o.Id == d["TableId"].Val<string>()));
                //如果找不到再从关联表中找字段model
                if (fieldModel == null)
                {
                    fieldModel = fieldList.FirstOrDefault(d => d["Name"].Val<string>()?.ToLower() == fieldWhere.Name.ToLower());
                }
            }
            if (fieldModel != null)
            {
                var tempJoinTable = joinTables.FirstOrDefault(d => d.Id == fieldModel["TableId"].Val<string>());
                if (tempJoinTable != null && !string.IsNullOrWhiteSpace(tempJoinTable.AsName))
                {
                    tableAsName = tempJoinTable.AsName;
                }
            }
            return tableAsName;
        }

        /// <summary>
        /// 处理参数值
        /// </summary>
        private (string paramValue, bool isParameterized) ProcessParameterValue(DiyWhere fieldWhere, JObject filedModel, DbInfo dbInfo, List<DbParameter> sqlParams, DbSession dbSession)
        {
            // 保留原始值用于类型检测
            var originalValue = fieldWhere.Value;
            var value = originalValue?.ToString();

            // 处理真正的 null 值
            if (originalValue == null)
            {
                return ("NULL", false);
            }

            // 处理空字符串
            if (originalValue is string strValue && strValue == "")
            {
                return ("''", false);
            }

            // 注意：参数化查询不需要手动转义单引号，数据库驱动会自动处理

            var sqlParamName = GenerateParameterName(fieldWhere.Name, sqlParams);
            var pushParam = dbSession.Db.DbProviderFactory.CreateParameter();
            pushParam.ParameterName = sqlParamName;

            // 处理不同类型的参数
            switch (fieldWhere.Type.ToLower())
            {
                case "like":
                case "notlike":
                    pushParam.DbType = DbType.String;
                    pushParam.Value = "%" + value + "%";
                    sqlParams.Add(pushParam);
                    return ($"{dbInfo.P}{sqlParamName}", true);

                case "startlike":
                case "notstartlike":
                    pushParam.DbType = DbType.String;
                    pushParam.Value = value + "%";
                    sqlParams.Add(pushParam);
                    return ($"{dbInfo.P}{sqlParamName}", true);

                case "endlike":
                case "notendlike":
                    pushParam.DbType = DbType.String;
                    pushParam.Value = "%" + value;
                    sqlParams.Add(pushParam);
                    return ($"{dbInfo.P}{sqlParamName}", true);

                case "in":
                case "notin":
                    // 使用参数化查询防止 SQL 注入
                    return ProcessInConditionParameterized(value, dbInfo, sqlParams, dbSession);

                default:
                    var dbType = GetDbType(fieldWhere.Type, originalValue, filedModel);
                    if ((dbInfo.DbType == DatabaseType.PostgreSql || dbInfo.DbType == DatabaseType.KingBase)
                        && dbType == DbType.Boolean)
                    {
                        // PostgreSQL/Kingbase official seed packages normalize the
                        // platform's cross-database bit switches to SMALLINT 0/1.
                        // Keep WHERE parameters on the same contract so Npgsql does
                        // not generate an invalid `smallint = boolean` comparison.
                        dbType = DbType.Int16;
                    }
                    pushParam.DbType = dbType;
                    pushParam.Value = ConvertToDbValue(originalValue, dbType);
                    sqlParams.Add(pushParam);
                    return ($"{dbInfo.P}{sqlParamName}", true);
            }
        }

        /// <summary>
        /// 处理 IN 条件（安全的字符串拼接版本，保留用于兼容）
        /// </summary>
        [Obsolete("请使用 ProcessInConditionParameterized 方法")]
        private string ProcessInCondition(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return "(NULL)";

            try
            {
                var inValues = JsonHelper.Deserialize<List<string>>(value);
                inValues = inValues ?? new List<string>();

                if (inValues.Count == 0)
                    return "(NULL)";

                var result = "(";
                foreach (var inValue in inValues)
                {
                    if (string.IsNullOrEmpty(inValue))
                    {
                        result += "''";
                    }
                    else
                    {
                        // 扩展转义：防止 SQL 注入
                        var safeValue = inValue
                            .Replace("\\", "\\\\")  // 先转义反斜杠
                            .Replace("'", "''");    // 转义单引号
                        result += "'" + safeValue + "'";
                    }
                    result += ",";
                }
                result = result.TrimEnd(',');
                result += ")";

                return result;
            }
            catch (Exception)
            {
                return "(NULL)";
            }
        }

        /// <summary>
        /// 处理 IN 条件（参数化版本，防止 SQL 注入）
        /// </summary>
        private (string paramValue, bool isParameterized) ProcessInConditionParameterized(
            string value, DbInfo dbInfo, List<DbParameter> sqlParams, DbSession dbSession)
        {
            if (string.IsNullOrWhiteSpace(value))
                return ("(NULL)", false);

            try
            {
                var inValues = JsonHelper.Deserialize<List<string>>(value);
                inValues = inValues ?? new List<string>();

                if (inValues.Count == 0)
                    return ("(NULL)", false);

                var paramNames = new List<string>();
                var baseParamName = $"in_param_{sqlParams.Count}";

                for (int i = 0; i < inValues.Count; i++)
                {
                    var paramName = $"{baseParamName}_{i}";
                    var param = dbSession.Db.DbProviderFactory.CreateParameter();
                    param.ParameterName = paramName;
                    param.DbType = DbType.String;
                    param.Value = inValues[i] ?? "";
                    sqlParams.Add(param);
                    paramNames.Add($"{dbInfo.P}{paramName}");
                }

                return ($"({string.Join(",", paramNames)})", true);
            }
            catch (Exception)
            {
                return ("(NULL)", false);
            }
        }

        /// <summary>
        /// 生成参数名
        /// </summary>
        private string GenerateParameterName(string fieldName, List<DbParameter> sqlParams)
        {
            var baseName = fieldName.Replace(".", "_").Replace(" ", "_");
            var sqlParamName = baseName;

            if (sqlParams.Any(d => d.ParameterName.StartsWith(baseName)))
            {
                sqlParamName = baseName + (sqlParams.Count(d => d.ParameterName.StartsWith(baseName)) + 1);
            }

            return sqlParamName;
        }

        /// <summary>
        /// 获取 AND/OR 子句
        /// </summary>
        private string GetAndOrClause(DiyWhere fieldWhere, string currentWhere)
        {
            if (string.IsNullOrWhiteSpace(currentWhere))
                return " ";

            return fieldWhere.AndOr?.ToUpper() == "OR" ? " OR " : " AND ";
        }

        /// <summary>
        /// 获取操作符
        /// </summary>
        private string GetOperator(string type)
        {
            return DiyCommon.FieldWhereTypes.ContainsKey(type) ? DiyCommon.FieldWhereTypes[type] : "=";
        }

        /// <summary>
        /// 获取参数的数据类型
        /// </summary>
        private DbType GetDbType(string type, object value, JObject filedModel)
        {
            // 根据类型和值判断数据类型
            if (type.ToLower() == "in" || type.ToLower() == "notin")
            {
                return DbType.String;
            }

            // 优先从字段模型判断类型
            if (filedModel != null && filedModel["Type"] != null)
            {
                var fieldType = filedModel["Type"].Val<string>().ToLower();
                if (fieldType.Contains("int"))
                {
                    return DbType.Int32;
                }
                else if (fieldType.Contains("decimal"))
                {
                    return DbType.Decimal;
                }
                else if (fieldType.Contains("bit"))
                {
                    return DbType.Boolean;
                }
                else if (fieldType.Contains("date") || fieldType.Contains("time"))
                {
                    return DbType.DateTime;
                }
            }

            // 当 filedModel 为空时（如系统字段 IsDeleted 等），从原始值的运行时类型推断
            if (value != null && !(value is string))
            {
                if (value is int || value is long || value is short || value is byte)
                    return DbType.Int32;
                if (value is decimal)
                    return DbType.Decimal;
                if (value is double || value is float)
                    return DbType.Double;
                if (value is bool)
                    return DbType.Boolean;
                if (value is DateTime)
                    return DbType.DateTime;
            }

            // 默认字符串
            return DbType.String;
        }

        /// <summary>
        /// 将原始值转换为与 DbType 匹配的类型
        /// </summary>
        private object ConvertToDbValue(object originalValue, DbType dbType)
        {
            if (originalValue == null) return DBNull.Value;

            // 如果原始值已经是正确的非字符串类型，直接返回
            if (!(originalValue is string))
            {
                switch (dbType)
                {
                    case DbType.Int32:
                        if (originalValue is int) return originalValue;
                        if (originalValue is long longV) return (int)longV;
                        if (originalValue is short shortV) return (int)shortV;
                        if (originalValue is byte byteV) return (int)byteV;
                        break;
                    case DbType.Int16:
                        if (originalValue is bool boolV16) return (short)(boolV16 ? 1 : 0);
                        if (originalValue is short) return originalValue;
                        if (originalValue is int intV16) return (short)intV16;
                        if (originalValue is long longV16) return (short)longV16;
                        if (originalValue is byte byteV16) return (short)byteV16;
                        break;
                    case DbType.Decimal:
                        if (originalValue is decimal) return originalValue;
                        if (originalValue is double dblV) return (decimal)dblV;
                        if (originalValue is float fltV) return (decimal)fltV;
                        if (originalValue is int intV2) return (decimal)intV2;
                        break;
                    case DbType.Double:
                        if (originalValue is double) return originalValue;
                        if (originalValue is float fltV2) return (double)fltV2;
                        break;
                    case DbType.Boolean:
                        if (originalValue is bool) return originalValue;
                        break;
                    case DbType.DateTime:
                        if (originalValue is DateTime) return originalValue;
                        break;
                }
            }

            // 字符串类型的值需要转换为目标类型
            var strValue = originalValue.ToString();
            switch (dbType)
            {
                case DbType.Int16:
                    if (bool.TryParse(strValue, out var boolInt16)) return (short)(boolInt16 ? 1 : 0);
                    if (short.TryParse(strValue, out var shortVal)) return shortVal;
                    return strValue;
                case DbType.Int32:
                    if (int.TryParse(strValue, out var intVal)) return intVal;
                    return strValue;
                case DbType.Decimal:
                    if (decimal.TryParse(strValue, out var decVal)) return decVal;
                    return strValue;
                case DbType.Double:
                    if (double.TryParse(strValue, out var dblVal)) return dblVal;
                    return strValue;
                case DbType.Boolean:
                    if (bool.TryParse(strValue, out var boolVal)) return boolVal;
                    if (strValue == "0") return false;
                    if (strValue == "1") return true;
                    return strValue;
                case DbType.DateTime:
                    if (DateTime.TryParse(strValue, out var dtVal)) return dtVal;
                    return strValue;
                default:
                    return strValue;
            }
        }
    }
}
