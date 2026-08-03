using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Microi.net
{
    public sealed class DiyTableChildFieldRelation
    {
        public string ParentField { get; set; }
        public string ChildField { get; set; }
        public bool ImportMatch { get; set; }
        public string ParentFieldLabel { get; set; }
        public string ChildFieldLabel { get; set; }
    }

    /// <summary>
    /// Normalizes the compact TableChild field relation format together with
    /// all historical callback/import relation formats. It never mutates the
    /// stored configuration, so old and new tenant data can be processed by
    /// the same backend during deployment.
    /// </summary>
    public static class DiyTableChildFieldRelationHelper
    {
        public static IReadOnlyList<DiyTableChildFieldRelation> GetRelations(DiyFieldConfig config)
        {
            var result = new List<DiyTableChildFieldRelation>();
            var index = new Dictionary<string, DiyTableChildFieldRelation>(StringComparer.OrdinalIgnoreCase);
            var tableChild = config?.TableChild;

            if (tableChild?.FieldRelations != null)
            {
                foreach (var token in tableChild.FieldRelations)
                {
                    Add(result, index, FromToken(token, false));
                }
            }

            if (!string.IsNullOrWhiteSpace(config?.TableChildCallbackField))
            {
                try
                {
                    var legacy = JArray.Parse(config.TableChildCallbackField);
                    foreach (var token in legacy)
                    {
                        Add(result, index, FromToken(token, false));
                    }
                }
                catch
                {
                    // Invalid historical JSON is ignored here; the import path
                    // still has its heuristic matcher as a final fallback.
                }
            }

            if (tableChild?.ImportBackfillFields != null)
            {
                foreach (var relation in tableChild.ImportBackfillFields)
                {
                    if (relation == null) continue;
                    Add(result, index, new DiyTableChildFieldRelation
                    {
                        ParentField = FirstNotEmpty(
                            relation.ParentFieldName,
                            relation.FatherFieldName,
                            relation.Parent,
                            relation.Father),
                        ChildField = FirstNotEmpty(relation.ChildFieldName, relation.Child),
                        ParentFieldLabel = relation.ParentFieldLabel,
                        ChildFieldLabel = relation.ChildFieldLabel
                    });
                }
            }

            if (tableChild?.ImportRelations != null)
            {
                foreach (var relation in tableChild.ImportRelations)
                {
                    if (relation == null) continue;
                    Add(result, index, new DiyTableChildFieldRelation
                    {
                        ParentField = FirstNotEmpty(relation.ParentFieldName, relation.Parent),
                        ChildField = FirstNotEmpty(relation.ChildFieldName, relation.Child),
                        ImportMatch = true,
                        ParentFieldLabel = relation.ParentFieldLabel,
                        ChildFieldLabel = relation.ChildFieldLabel
                    });
                }
            }

            if (tableChild != null
                && !string.IsNullOrWhiteSpace(tableChild.ImportParentMatchFieldName)
                && !string.IsNullOrWhiteSpace(tableChild.ImportChildMatchFieldName))
            {
                Add(result, index, new DiyTableChildFieldRelation
                {
                    ParentField = tableChild.ImportParentMatchFieldName,
                    ChildField = tableChild.ImportChildMatchFieldName,
                    ImportMatch = true
                });
            }
            return result;
        }

        public static JArray ToCompactArray(IEnumerable<DiyTableChildFieldRelation> relations)
        {
            var result = new JArray();
            foreach (var relation in relations ?? Enumerable.Empty<DiyTableChildFieldRelation>())
            {
                if (relation == null
                    || string.IsNullOrWhiteSpace(relation.ParentField)
                    || string.IsNullOrWhiteSpace(relation.ChildField))
                {
                    continue;
                }
                var item = new JArray(relation.ParentField, relation.ChildField);
                if (relation.ImportMatch) item.Add(true);
                result.Add(item);
            }
            return result;
        }

        private static DiyTableChildFieldRelation FromToken(JToken token, bool importMatch)
        {
            if (token is JArray array)
            {
                return new DiyTableChildFieldRelation
                {
                    ParentField = array.Count > 0 ? array[0]?.ToString()?.Trim() : string.Empty,
                    ChildField = array.Count > 1 ? array[1]?.ToString()?.Trim() : string.Empty,
                    ImportMatch = importMatch || (array.Count > 2 && IsTrue(array[2]))
                };
            }
            if (!(token is JObject item)) return null;
            return new DiyTableChildFieldRelation
            {
                ParentField = FirstNotEmpty(
                    item.Value<string>("ParentField"),
                    item.Value<string>("ParentFieldName"),
                    item.Value<string>("FatherFieldName"),
                    item.Value<string>("Parent"),
                    item.Value<string>("Father")),
                ChildField = FirstNotEmpty(
                    item.Value<string>("ChildField"),
                    item.Value<string>("ChildFieldName"),
                    item.Value<string>("Child")),
                ImportMatch = importMatch
                    || IsTrue(item["ImportMatch"])
                    || IsTrue(item["IsImportMatch"])
                    || IsTrue(item["Match"]),
                ParentFieldLabel = FirstNotEmpty(
                    item.Value<string>("ParentFieldLabel"),
                    item.Value<string>("FatherFieldLabel")),
                ChildFieldLabel = item.Value<string>("ChildFieldLabel")
            };
        }

        private static void Add(
            ICollection<DiyTableChildFieldRelation> target,
            IDictionary<string, DiyTableChildFieldRelation> index,
            DiyTableChildFieldRelation relation)
        {
            if (relation == null) return;
            relation.ParentField = relation.ParentField?.Trim();
            relation.ChildField = relation.ChildField?.Trim();
            if (string.IsNullOrWhiteSpace(relation.ParentField)
                || string.IsNullOrWhiteSpace(relation.ChildField))
            {
                return;
            }
            var key = relation.ParentField + "\u001f" + relation.ChildField;
            if (index.TryGetValue(key, out var existing))
            {
                existing.ImportMatch = existing.ImportMatch || relation.ImportMatch;
                existing.ParentFieldLabel = FirstNotEmpty(existing.ParentFieldLabel, relation.ParentFieldLabel);
                existing.ChildFieldLabel = FirstNotEmpty(existing.ChildFieldLabel, relation.ChildFieldLabel);
                return;
            }
            index[key] = relation;
            target.Add(relation);
        }

        private static string FirstNotEmpty(params string[] values)
        {
            return values?.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim() ?? string.Empty;
        }

        private static bool IsTrue(JToken token)
        {
            if (token == null) return false;
            if (token.Type == JTokenType.Boolean) return token.Value<bool>();
            if (token.Type == JTokenType.Integer) return token.Value<long>() == 1;
            var value = token.ToString().Trim();
            return string.Equals(value, "true", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "match", StringComparison.OrdinalIgnoreCase)
                || value == "1";
        }
    }
}
