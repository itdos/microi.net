using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Normalizes legacy sys_menu JSON field selections at every platform boundary.
    /// Corrupt preference data must not make the menu or its table unreadable.
    /// </summary>
    public static class SysMenuConfigurationNormalizer
    {
        public const string NotShowFieldsName = "NotShowFields";

        public static string NormalizeNotShowFields(object rawValue)
        {
            var source = ParseArray(rawValue);
            var normalized = new JArray();
            foreach (var token in source)
            {
                if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                {
                    continue;
                }
                if (token.Type == JTokenType.String)
                {
                    var fieldName = token.Value<string>()?.Trim();
                    if (!string.IsNullOrWhiteSpace(fieldName))
                    {
                        normalized.Add(fieldName);
                    }
                    continue;
                }
                if (!(token is JObject item))
                {
                    continue;
                }

                var name = item["Name"]?.Type == JTokenType.String
                    ? item["Name"].Value<string>()?.Trim()
                    : null;
                var id = item["Id"]?.Type == JTokenType.String
                    ? item["Id"].Value<string>()?.Trim()
                    : null;
                if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(id))
                {
                    continue;
                }

                var clone = (JObject)item.DeepClone();
                if (string.IsNullOrWhiteSpace(name)) clone.Remove("Name");
                else clone["Name"] = name;
                if (string.IsNullOrWhiteSpace(id)) clone.Remove("Id");
                else clone["Id"] = id;
                normalized.Add(clone);
            }
            return normalized.ToString(Formatting.None);
        }

        public static bool NormalizeNotShowFieldsInRow(JObject row)
        {
            if (row == null) return false;
            var property = row.Properties().FirstOrDefault(item =>
                string.Equals(item.Name, NotShowFieldsName, StringComparison.OrdinalIgnoreCase));
            if (property == null) return false;
            property.Value = NormalizeNotShowFields(property.Value);
            return true;
        }

        public static void NormalizeNotShowFieldsForWrite(string tableName, JObject row)
        {
            if (!IsSysMenuTable(tableName)) return;
            NormalizeNotShowFieldsInRow(row);
        }

        public static T NormalizeRowForReturn<T>(T row, string tableName)
        {
            if (!IsSysMenuTable(tableName) || ReferenceEquals(row, null)) return row;
            NormalizeMenuObject(row);
            return row;
        }

        public static List<T> NormalizeRowsForReturn<T>(IEnumerable<T> rows, string tableName)
        {
            var result = rows?.ToList();
            if (result == null || !IsSysMenuTable(tableName)) return result;
            foreach (var row in result) NormalizeMenuObject(row);
            return result;
        }

        public static void NormalizeMenuObject(object row)
        {
            if (row == null) return;
            if (row is JObject jObject)
            {
                NormalizeNotShowFieldsInRow(jObject);
                return;
            }
            if (row is SysMenu menu)
            {
                menu.NotShowFields = NormalizeNotShowFields(menu.NotShowFields);
                return;
            }
            if (row is IDictionary<string, object> dictionary)
            {
                var key = dictionary.Keys.FirstOrDefault(item =>
                    string.Equals(item, NotShowFieldsName, StringComparison.OrdinalIgnoreCase));
                if (key != null) dictionary[key] = NormalizeNotShowFields(dictionary[key]);
                return;
            }

            var property = row.GetType().GetProperties().FirstOrDefault(item =>
                item.CanRead
                && item.CanWrite
                && item.PropertyType == typeof(string)
                && string.Equals(item.Name, NotShowFieldsName, StringComparison.OrdinalIgnoreCase));
            if (property != null)
            {
                property.SetValue(row, NormalizeNotShowFields(property.GetValue(row)));
            }
        }

        public static bool IsSysMenuTable(string tableName)
        {
            return string.Equals(tableName?.Trim(), "sys_menu", StringComparison.OrdinalIgnoreCase);
        }

        private static JArray ParseArray(object rawValue)
        {
            if (rawValue == null) return new JArray();
            JToken token;
            try
            {
                token = rawValue as JToken ?? JToken.FromObject(rawValue);
                if (token.Type == JTokenType.String)
                {
                    var text = token.Value<string>();
                    if (string.IsNullOrWhiteSpace(text)) return new JArray();
                    token = JToken.Parse(text);
                }
            }
            catch
            {
                return new JArray();
            }
            return token as JArray ?? new JArray();
        }
    }
}
