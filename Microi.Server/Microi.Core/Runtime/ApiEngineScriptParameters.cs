using System;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>Script business parameters are separate from the authenticated V8.CurrentUser.</summary>
    internal static class ApiEngineScriptParameters
    {
        internal static JObject Copy(JObject source)
        {
            var result = new JObject();
            if (source == null) return result;
            foreach (var item in source)
            {
                // This host-only identity already has an independent snapshot in
                // V8.CurrentUser. Copying it into Param duplicates every role limit
                // and forwards that entire identity to native business arguments.
                if (string.Equals(item.Key, "_CurrentUser", StringComparison.OrdinalIgnoreCase)
                    || item.Key == "_McpDebugExecute" || item.Key == "_McpDebugV8Code") continue;
                result.Add(item.Key, item.Value);
            }
            return result;
        }
    }
}
