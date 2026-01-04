using System;
using System.Collections.Generic;
using System.Linq;
using MongoDB.Driver;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8MongoDB
    {
        /// <summary>
        /// 处理Where条件，生成MongoDB过滤器
        /// </summary>
        /// <param name="whereObj">Where条件对象</param>
        /// <param name="filters">过滤器列表</param>
        private void GetWhereSql(object whereObj, List<FilterDefinition<dynamic>> filters)
        {
            if (whereObj == null) return;

            try
            {
                List<List<object>> whereConditions = null;

                // 处理前端传入的JSON数组格式
                if (whereObj is JArray jArray)
                {
                    whereConditions = jArray.ToObject<List<List<object>>>();
                }
                // 处理后端传入的List<List<string>>格式
                else if (whereObj is List<List<string>> stringList)
                {
                    whereConditions = stringList.Select(list => list.Cast<object>().ToList()).ToList();
                }
                else
                {
                    throw new ArgumentException("不支持的Where条件格式");
                }

                if (whereConditions != null && whereConditions.Count > 0)
                {
                    var filter = BuildCompleteFilter(whereConditions);
                    if (filter != null && filter != Builders<dynamic>.Filter.Empty)
                    {
                        filters.Add(filter);
                        System.Diagnostics.Debug.WriteLine($"成功构建过滤器: {filter}");
                    }
                    else
                    {
                        System.Diagnostics.Debug.WriteLine("构建的过滤器为空");
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"解析Where条件时出错: {ex.Message}");
                throw new ArgumentException($"解析Where条件时出错: {ex.Message}");
            }
        }

        /// <summary>
        /// 构建完整的过滤器，处理分组和分组外的条件
        /// </summary>
        private FilterDefinition<dynamic> BuildCompleteFilter(List<List<object>> conditions)
        {
            if (conditions == null || conditions.Count == 0)
                return Builders<dynamic>.Filter.Empty;

            // 分离分组条件和独立条件
            var (groupedConditions, standaloneConditions) = SeparateConditions(conditions);
            
            var allFilters = new List<FilterDefinition<dynamic>>();

            // 处理分组条件
            if (groupedConditions.Count > 0)
            {
                var groupFilter = ProcessGroupedConditions(groupedConditions);
                if (groupFilter != null && groupFilter != Builders<dynamic>.Filter.Empty)
                {
                    allFilters.Add(groupFilter);
                }
            }

            // 处理独立条件
            if (standaloneConditions.Count > 0)
            {
                var standaloneFilter = ProcessStandaloneConditions(standaloneConditions);
                if (standaloneFilter != null && standaloneFilter != Builders<dynamic>.Filter.Empty)
                {
                    allFilters.Add(standaloneFilter);
                }
            }

            // 组合所有过滤器
            if (allFilters.Count == 0)
            {
                return Builders<dynamic>.Filter.Empty;
            }
            else if (allFilters.Count == 1)
            {
                return allFilters[0];
            }
            else
            {
                // 使用AND组合分组条件和独立条件
                return Builders<dynamic>.Filter.And(allFilters);
            }
        }

        /// <summary>
        /// 分离分组条件和独立条件
        /// </summary>
        private (List<List<object>> groupedConditions, List<List<object>> standaloneConditions) SeparateConditions(List<List<object>> conditions)
        {
            var groupedConditions = new List<List<object>>();
            var standaloneConditions = new List<List<object>>();
            
            var inGroup = false;
            var currentGroup = new List<List<object>>();

            foreach (var condition in conditions)
            {
                if (condition == null || condition.Count == 0) continue;

                // 检查是否包含括号
                var cleanCondition = new List<object>();
                bool hasOpenParen = false;
                bool hasCloseParen = false;

                foreach (var item in condition)
                {
                    var itemStr = item?.ToString();
                    if (itemStr == "(")
                    {
                        hasOpenParen = true;
                    }
                    else if (itemStr == ")")
                    {
                        hasCloseParen = true;
                    }
                    else
                    {
                        cleanCondition.Add(item);
                    }
                }

                // 处理开括号
                if (hasOpenParen)
                {
                    if (!inGroup)
                    {
                        inGroup = true;
                        currentGroup = new List<List<object>>();
                    }
                    
                    // 如果有清理后的条件，添加到当前组
                    if (cleanCondition.Count >= 3)
                    {
                        currentGroup.Add(cleanCondition);
                    }
                }
                // 处理闭括号
                else if (hasCloseParen)
                {
                    // 如果有清理后的条件，添加到当前组
                    if (cleanCondition.Count >= 3)
                    {
                        currentGroup.Add(cleanCondition);
                    }
                    
                    // 结束当前组
                    if (currentGroup.Count > 0)
                    {
                        groupedConditions.AddRange(currentGroup);
                    }
                    
                    inGroup = false;
                    currentGroup = new List<List<object>>();
                }
                // 普通条件
                else
                {
                    if (inGroup)
                    {
                        // 在分组内，添加到当前组
                        currentGroup.Add(condition);
                    }
                    else
                    {
                        // 不在分组内，添加到独立条件
                        standaloneConditions.Add(condition);
                    }
                }
            }

            // 处理未结束的分组
            if (inGroup && currentGroup.Count > 0)
            {
                groupedConditions.AddRange(currentGroup);
            }

            return (groupedConditions, standaloneConditions);
        }

        /// <summary>
        /// 处理分组条件
        /// </summary>
        private FilterDefinition<dynamic> ProcessGroupedConditions(List<List<object>> conditions)
        {
            if (conditions == null || conditions.Count == 0)
                return Builders<dynamic>.Filter.Empty;

            var filters = new List<FilterDefinition<dynamic>>();
            string currentLogic = "AND"; // 默认

            foreach (var condition in conditions)
            {
                if (condition == null || condition.Count < 3) continue;

                // 检查是否是逻辑运算符
                if (condition.Count == 1 && IsLogicOperator(condition[0]?.ToString()))
                {
                    currentLogic = condition[0].ToString().ToUpper();
                    continue;
                }

                // 处理可能包含逻辑运算符的条件
                int startIndex = 0;
                string logicOperator = currentLogic;

                if (condition.Count >= 4 && IsLogicOperator(condition[0]?.ToString()))
                {
                    logicOperator = condition[0].ToString().ToUpper();
                    startIndex = 1;
                }

                // 确保有足够的元素
                if (condition.Count - startIndex < 3) continue;

                string field = condition[startIndex]?.ToString();
                string operatorStr = condition[startIndex + 1]?.ToString();
                object value = condition[startIndex + 2];

                if (string.IsNullOrEmpty(field) || string.IsNullOrEmpty(operatorStr))
                    continue;

                // 标准化操作符
                if (!DiyCommon.FieldWhereTypes.TryGetValue(operatorStr, out string normalizedOperator))
                {
                    normalizedOperator = operatorStr;
                }

                var filter = CreateFieldFilter(field, normalizedOperator, value);
                if (filter != null && filter != Builders<dynamic>.Filter.Empty)
                {
                    filters.Add(filter);
                }

                // 更新当前逻辑运算符
                currentLogic = logicOperator;
            }

            // 根据逻辑运算符组合过滤器
            if (filters.Count == 0)
            {
                return Builders<dynamic>.Filter.Empty;
            }
            else if (filters.Count == 1)
            {
                return filters[0];
            }
            else
            {
                if (currentLogic == "OR")
                {
                    return Builders<dynamic>.Filter.Or(filters);
                }
                else
                {
                    return Builders<dynamic>.Filter.And(filters);
                }
            }
        }

        /// <summary>
        /// 处理独立条件
        /// </summary>
        private FilterDefinition<dynamic> ProcessStandaloneConditions(List<List<object>> conditions)
        {
            if (conditions == null || conditions.Count == 0)
                return Builders<dynamic>.Filter.Empty;

            var filters = new List<FilterDefinition<dynamic>>();
            string currentLogic = "AND"; // 默认

            foreach (var condition in conditions)
            {
                if (condition == null || condition.Count < 3) continue;

                // 检查是否是逻辑运算符
                if (condition.Count == 1 && IsLogicOperator(condition[0]?.ToString()))
                {
                    currentLogic = condition[0].ToString().ToUpper();
                    continue;
                }

                // 处理可能包含逻辑运算符的条件
                int startIndex = 0;
                string logicOperator = currentLogic;

                if (condition.Count >= 4 && IsLogicOperator(condition[0]?.ToString()))
                {
                    logicOperator = condition[0].ToString().ToUpper();
                    startIndex = 1;
                }

                // 确保有足够的元素
                if (condition.Count - startIndex < 3) continue;

                string field = condition[startIndex]?.ToString();
                string operatorStr = condition[startIndex + 1]?.ToString();
                object value = condition[startIndex + 2];

                if (string.IsNullOrEmpty(field) || string.IsNullOrEmpty(operatorStr))
                    continue;

                // 标准化操作符
                if (!DiyCommon.FieldWhereTypes.TryGetValue(operatorStr, out string normalizedOperator))
                {
                    normalizedOperator = operatorStr;
                }

                var filter = CreateFieldFilter(field, normalizedOperator, value);
                if (filter != null && filter != Builders<dynamic>.Filter.Empty)
                {
                    filters.Add(filter);
                }

                // 更新当前逻辑运算符
                currentLogic = logicOperator;
            }

            // 根据逻辑运算符组合过滤器
            if (filters.Count == 0)
            {
                return Builders<dynamic>.Filter.Empty;
            }
            else if (filters.Count == 1)
            {
                return filters[0];
            }
            else
            {
                if (currentLogic == "OR")
                {
                    return Builders<dynamic>.Filter.Or(filters);
                }
                else
                {
                    return Builders<dynamic>.Filter.And(filters);
                }
            }
        }

        /// <summary>
        /// 创建字段过滤器
        /// </summary>
        private FilterDefinition<dynamic> CreateFieldFilter(string field, string operatorStr, object value)
        {
            if (string.IsNullOrEmpty(field) || value == null)
            {
                System.Diagnostics.Debug.WriteLine($"创建字段过滤器失败: 字段或值为空 - {field}, {operatorStr}, {value}");
                return Builders<dynamic>.Filter.Empty;
            }

            try
            {
                System.Diagnostics.Debug.WriteLine($"创建字段过滤器: {field} {operatorStr} {value}");

                switch (operatorStr.ToUpper())
                {
                    case "=":
                    case "EQ":
                        return Builders<dynamic>.Filter.Eq(field, value);

                    case "<>":
                    case "!=":
                    case "NE":
                        return Builders<dynamic>.Filter.Ne(field, value);

                    case ">":
                        var gtValue = ConvertValue(value);
                        return Builders<dynamic>.Filter.Gt(field, gtValue);

                    case ">=":
                        var gteValue = ConvertValue(value);
                        return Builders<dynamic>.Filter.Gte(field, gteValue);

                    case "<":
                        var ltValue = ConvertValue(value);
                        return Builders<dynamic>.Filter.Lt(field, ltValue);

                    case "<=":
                        var lteValue = ConvertValue(value);
                        return Builders<dynamic>.Filter.Lte(field, lteValue);

                    case "LIKE":
                        var regexPattern = $".*{EscapeRegex(value.ToString())}.*";
                        return Builders<dynamic>.Filter.Regex(field,
                            new MongoDB.Bson.BsonRegularExpression(regexPattern, "i"));

                    case "NOT LIKE":
                        var notRegexPattern = $".*{EscapeRegex(value.ToString())}.*";
                        return Builders<dynamic>.Filter.Not(
                            Builders<dynamic>.Filter.Regex(field,
                                new MongoDB.Bson.BsonRegularExpression(notRegexPattern, "i")));

                    case "STARTLIKE":
                        var startPattern = $"^{EscapeRegex(value.ToString())}";
                        return Builders<dynamic>.Filter.Regex(field,
                            new MongoDB.Bson.BsonRegularExpression(startPattern, "i"));

                    case "NOTSTARTLIKE":
                        var notStartPattern = $"^{EscapeRegex(value.ToString())}";
                        return Builders<dynamic>.Filter.Not(
                            Builders<dynamic>.Filter.Regex(field,
                                new MongoDB.Bson.BsonRegularExpression(notStartPattern, "i")));

                    case "ENDLIKE":
                        var endPattern = $"{EscapeRegex(value.ToString())}$";
                        return Builders<dynamic>.Filter.Regex(field,
                            new MongoDB.Bson.BsonRegularExpression(endPattern, "i"));

                    case "NOTENDLIKE":
                        var notEndPattern = $"{EscapeRegex(value.ToString())}$";
                        return Builders<dynamic>.Filter.Not(
                            Builders<dynamic>.Filter.Regex(field,
                                new MongoDB.Bson.BsonRegularExpression(notEndPattern, "i")));

                    case "IN":
                        if (value is string strValue)
                        {
                            var values = strValue.Split(',').Select(v => v.Trim()).Where(v => !string.IsNullOrEmpty(v)).ToArray();
                            if (values.Length > 0)
                            {
                                return Builders<dynamic>.Filter.In(field, values);
                            }
                        }
                        break;

                    case "NOT IN":
                        if (value is string notInStrValue)
                        {
                            var notInValues = notInStrValue.Split(',').Select(v => v.Trim()).Where(v => !string.IsNullOrEmpty(v)).ToArray();
                            if (notInValues.Length > 0)
                            {
                                return Builders<dynamic>.Filter.Nin(field, notInValues);
                            }
                        }
                        break;

                    default:
                        return Builders<dynamic>.Filter.Eq(field, value);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"创建字段过滤器时出错: {ex.Message}");
                return Builders<dynamic>.Filter.Empty;
            }

            return Builders<dynamic>.Filter.Empty;
        }

        /// <summary>
        /// 转换值
        /// </summary>
        private object ConvertValue(object value)
        {
            if (value == null) return null;

            var strValue = value.ToString();
            
            if (int.TryParse(strValue, out int intValue))
                return intValue;
            if (long.TryParse(strValue, out long longValue))
                return longValue;
            if (double.TryParse(strValue, out double doubleValue))
                return doubleValue;
            if (decimal.TryParse(strValue, out decimal decimalValue))
                return decimalValue;
            if (bool.TryParse(strValue, out bool boolValue))
                return boolValue;
            if (DateTime.TryParse(strValue, out DateTime dateValue))
                return dateValue;
            
            return value;
        }

        /// <summary>
        /// 转义正则表达式特殊字符
        /// </summary>
        private string EscapeRegex(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            
            var specialChars = new[] { '\\', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '^', '$', '#' };
            var result = new System.Text.StringBuilder();
            
            foreach (char c in input)
            {
                if (specialChars.Contains(c))
                {
                    result.Append('\\');
                }
                result.Append(c);
            }
            
            return result.ToString();
        }

        /// <summary>
        /// 判断是否为逻辑运算符
        /// </summary>
        private bool IsLogicOperator(string value)
        {
            if (string.IsNullOrEmpty(value)) return false;
            
            var logicOperators = new[] { "AND", "OR", "&&", "||" };
            return logicOperators.Contains(value.ToUpper());
        }
    }
}