using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;

namespace Microi.net
{
    internal static class RealtimeResultMetadata
    {
        // Notification detection needs only the envelope. Never walk ordinary
        // Data (a user, a large table or a file) merely to discover no event.
        internal static JObject Read(object result)
        {
            if (result == null) return null;
            if (result is JObject json) return json;
            var serializer = JsonSerializer.CreateDefault();
            var contract = serializer.ContractResolver.ResolveContract(result.GetType());
            if (contract.Converter != null || serializer.Converters.Any(c => c.CanConvert(result.GetType())))
                return JObject.FromObject(result, serializer); // Preserve custom root wire contracts.
            object code = null, append = null;
            if (result is IDictionary<string, object> dictionary)
            {
                dictionary.TryGetValue("Code", out code);
                dictionary.TryGetValue("DataAppend", out append);
            }
            else
            {
                var properties = (contract as JsonObjectContract)?.Properties
                    ?? (contract as JsonDynamicContract)?.Properties;
                if (properties == null) return JObject.FromObject(result, serializer);
                // Arbitrary DynamicObject wire members and extension overrides
                // retain the original serializer path. Ordinary DosResult has
                // declared Code/DataAppend and an empty extension dictionary.
                if (contract is JsonDynamicContract)
                {
                    var extensions = result.GetType().GetProperty("DynamicProperties")?.GetValue(result)
                        as IDictionary<string, object>;
                    if (extensions?.Count > 0 || !properties.Any(p => p.PropertyName == "Code"))
                        return JObject.FromObject(result, serializer);
                }
                object ReadProperty(string name)
                {
                    var property = properties.FirstOrDefault(p => p.PropertyName == name);
                    if (property == null || property.Ignored || !property.Readable
                        || property.ShouldSerialize?.Invoke(result) == false
                        || property.GetIsSpecified?.Invoke(result) == false) return null;
                    return property.ValueProvider.GetValue(result);
                }
                code = ReadProperty("Code"); append = ReadProperty("DataAppend");
                if (contract is JsonObjectContract obj && obj.ExtensionDataGetter != null)
                    foreach (var item in obj.ExtensionDataGetter(result) ?? Enumerable.Empty<KeyValuePair<object, object>>())
                    {
                        if (item.Key?.ToString() == "Code") code = item.Value;
                        else if (item.Key?.ToString() == "DataAppend") append = item.Value;
                    }
            }
            // A dictionary projection references existing JTokens without moving
            // them or copying unrelated response fields. Result readers are read-only.
            return JObject.FromObject(new { Code = code, DataAppend = append }, serializer);
        }
    }
}
