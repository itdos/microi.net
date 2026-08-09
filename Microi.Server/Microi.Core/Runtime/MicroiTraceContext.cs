using System;
using System.Collections.Generic;
using System.Diagnostics;

namespace Microi.net
{
    /// <summary>
    /// Microi W3C Trace 上下文桥。只传播 traceparent/tracestate，不把它们当作身份或权限依据。
    /// </summary>
    public static class MicroiTraceContext
    {
        public static string CurrentTraceParent
        {
            get
            {
                var activity = Activity.Current;
                return activity != null && activity.IdFormat == ActivityIdFormat.W3C
                    ? activity.Id
                    : null;
            }
        }

        public static string CurrentTraceState => Activity.Current?.TraceStateString;

        public static bool IsValidTraceParent(string traceParent, string traceState = null)
        {
            if (string.IsNullOrWhiteSpace(traceParent)) return false;
            return ActivityContext.TryParse(traceParent.Trim(), traceState, out _);
        }

        public static Activity StartActivity(
            string operationName,
            string traceParent = null,
            string traceState = null,
            IReadOnlyDictionary<string, object> tags = null)
        {
            var activity = new Activity(string.IsNullOrWhiteSpace(operationName) ? "Microi.Operation" : operationName)
                .SetIdFormat(ActivityIdFormat.W3C);
            if (IsValidTraceParent(traceParent, traceState))
            {
                activity.SetParentId(traceParent.Trim());
                activity.TraceStateString = traceState;
            }
            activity.Start();
            if (tags != null)
            {
                foreach (var pair in tags)
                    activity.SetTag(pair.Key, pair.Value);
            }
            return activity;
        }
    }
}
