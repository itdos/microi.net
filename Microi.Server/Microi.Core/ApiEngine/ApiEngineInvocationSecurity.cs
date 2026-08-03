using System;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Keeps StopHttp closed to external callers while allowing a persisted
    /// background-task worker to retain Client invocation semantics.
    /// </summary>
    public static class ApiEngineInvocationSecurity
    {
        public static bool ShouldBlockStopHttp(
            bool stopHttp,
            string invokeType,
            bool preserveTrustedCurrentUser,
            JObject param)
        {
            if (!stopHttp || !string.Equals(invokeType, "Client", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return !IsTrustedBackgroundWorkerInvocation(param, preserveTrustedCurrentUser);
        }

        public static bool IsTrustedBackgroundWorkerInvocation(
            JObject param,
            bool preserveTrustedCurrentUser)
        {
            if (!preserveTrustedCurrentUser || param == null || !IsTrue(param["_TrustedServerInvocation"]))
            {
                return false;
            }

            var taskId = param["_BackgroundTaskId"]?.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(taskId) || !(param["_BackgroundTask"] is JObject taskEnvelope))
            {
                return false;
            }

            if (!string.Equals(taskEnvelope["Id"]?.ToString()?.Trim(), taskId, StringComparison.Ordinal))
            {
                return false;
            }

            return TryReadPositiveInt64(param["_BackgroundTaskFencingToken"]);
        }

        private static bool IsTrue(JToken token)
        {
            if (token?.Type == JTokenType.Boolean)
            {
                return token.Value<bool>();
            }

            return bool.TryParse(token?.ToString(), out var value) && value;
        }

        private static bool TryReadPositiveInt64(JToken token)
        {
            return long.TryParse(token?.ToString(), out var value) && value > 0;
        }
    }
}
