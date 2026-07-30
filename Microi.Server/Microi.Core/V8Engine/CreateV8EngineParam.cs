using System;
using Dos.Common;

namespace Microi.net
{
    public class CreateV8EngineParam
    {
        public const int DefaultTimeout = 600;
        public const int MaxTimeout = 3600;
        public const int DefaultMaxStatements = 50_000_000;
        public const int MaxStatementsLimit = 500_000_000;
        public const int DefaultLimitMemory = 2048;
        public const int MaxLimitMemory = 4096;
        public const int DefaultLimitRecursion = 2000;
        public const int MaxLimitRecursion = 5000;
        public const int DefaultCallTreeLimitMemory = 8192;
        public const int MaxCallTreeLimitMemory = 32768;
        public const int DefaultNestedApiDepth = 32;
        public const int MaxNestedApiDepth = 64;
        public const bool DefaultIsolateNestedApiMemory = true;

        public int MaxTimeoutSeconds { get; set; } = MaxTimeout;
        public int MaxStatementsLimitValue { get; set; } = MaxStatementsLimit;
        public int MaxLimitMemoryMB { get; set; } = MaxLimitMemory;
        public int MaxLimitRecursionDepth { get; set; } = MaxLimitRecursion;
        public int MaxCallTreeLimitMemoryMB { get; set; } = MaxCallTreeLimitMemory;
        public int MaxNestedApiDepthValue { get; set; } = MaxNestedApiDepth;

        /// <summary>
        /// V8/Jint script timeout in seconds.
        /// </summary>
        public int Timeout { get; set; } = DefaultTimeout;

        /// <summary>
        /// Maximum JavaScript statements before Jint stops execution.
        /// </summary>
        public int MaxStatements { get; set; } = DefaultMaxStatements;

        /// <summary>
        /// Maximum memory available to a single V8/Jint execution, in MB.
        /// </summary>
        public int LimitMemory { get; set; } = DefaultLimitMemory;

        /// <summary>
        /// Maximum JavaScript recursion depth.
        /// </summary>
        public int LimitRecursion { get; set; } = DefaultLimitRecursion;

        /// <summary>
        /// Cumulative allocation budget for the whole nested V8/API call tree, in MB.
        /// Individual engines still use <see cref="LimitMemory"/> as their own budget.
        /// </summary>
        public int CallTreeLimitMemory { get; set; } = DefaultCallTreeLimitMemory;

        /// <summary>
        /// Maximum V8 nesting depth for one logical invocation tree. The root is depth 1.
        /// </summary>
        public int NestedApiDepth { get; set; } = DefaultNestedApiDepth;

        /// <summary>
        /// Prevents child interface engines from being charged repeatedly to every parent
        /// engine's individual allocation budget. The root call-tree budget remains active.
        /// </summary>
        public bool IsolateNestedApiMemory { get; set; } = DefaultIsolateNestedApiMemory;

        public static CreateV8EngineParam FromSysConfig(object sysConfig)
        {
            var param = new CreateV8EngineParam();
            param.ApplySysConfig(sysConfig);
            return param;
        }

        public void ApplySysConfig(object sysConfig)
        {
            if (sysConfig == null)
            {
                Normalize();
                return;
            }

            MaxTimeoutSeconds = NormalizeMaxLimit(GetConfigInt(sysConfig, MaxTimeoutSeconds, "V8MaxTimeoutSeconds"), MaxTimeoutSeconds, MaxTimeout);
            MaxStatementsLimitValue = NormalizeMaxLimit(GetConfigInt(sysConfig, MaxStatementsLimitValue, "V8MaxStatements"), MaxStatementsLimitValue, MaxStatementsLimit);
            MaxLimitMemoryMB = NormalizeMaxLimit(GetConfigInt(sysConfig, MaxLimitMemoryMB, "V8MaxLimitMemoryMB", "V8MaxLimitMemory"), MaxLimitMemoryMB, MaxLimitMemory);
            MaxLimitRecursionDepth = NormalizeMaxLimit(GetConfigInt(sysConfig, MaxLimitRecursionDepth, "V8MaxLimitRecursion"), MaxLimitRecursionDepth, MaxLimitRecursion);
            MaxCallTreeLimitMemoryMB = NormalizeMaxLimit(GetConfigInt(sysConfig, MaxCallTreeLimitMemoryMB, "V8MaxCallTreeLimitMemoryMB", "V8MaxCallTreeLimitMemory"), MaxCallTreeLimitMemoryMB, MaxCallTreeLimitMemory);
            MaxNestedApiDepthValue = NormalizeMaxLimit(GetConfigInt(sysConfig, MaxNestedApiDepthValue, "V8MaxNestedApiDepth"), MaxNestedApiDepthValue, MaxNestedApiDepth);

            Timeout = ClampPositive(GetConfigInt(sysConfig, Timeout, "V8DefaultTimeoutSeconds"), Timeout, MaxTimeoutSeconds);
            MaxStatements = ClampPositive(GetConfigInt(sysConfig, MaxStatements, "V8DefaultMaxStatements"), MaxStatements, MaxStatementsLimitValue);
            LimitMemory = ClampPositive(GetConfigInt(sysConfig, LimitMemory, "V8DefaultLimitMemoryMB", "V8DefaultLimitMemory"), LimitMemory, MaxLimitMemoryMB);
            LimitRecursion = ClampPositive(GetConfigInt(sysConfig, LimitRecursion, "V8DefaultLimitRecursion"), LimitRecursion, MaxLimitRecursionDepth);
            CallTreeLimitMemory = ClampPositive(GetConfigInt(sysConfig, CallTreeLimitMemory, "V8CallTreeLimitMemoryMB", "V8CallTreeLimitMemory"), CallTreeLimitMemory, MaxCallTreeLimitMemoryMB);
            NestedApiDepth = ClampPositive(GetConfigInt(sysConfig, NestedApiDepth, "V8NestedApiDepth"), NestedApiDepth, MaxNestedApiDepthValue);
            IsolateNestedApiMemory = DynamicHelper.GetDynamicBoolValue(
                sysConfig,
                "V8IsolateNestedApiMemory",
                IsolateNestedApiMemory);

            Normalize();
        }

        public void Normalize()
        {
            Timeout = NormalizeTimeoutValue(Timeout);
            MaxStatements = NormalizeMaxStatementsValue(MaxStatements);
            LimitMemory = NormalizeLimitMemoryValue(LimitMemory);
            LimitRecursion = NormalizeLimitRecursionValue(LimitRecursion);
            CallTreeLimitMemory = NormalizeCallTreeLimitMemoryValue(CallTreeLimitMemory);
            NestedApiDepth = NormalizeNestedApiDepthValue(NestedApiDepth);
        }

        public int NormalizeTimeoutValue(int value)
        {
            return ClampPositive(value, Timeout, MaxTimeoutSeconds);
        }

        public int NormalizeMaxStatementsValue(int value)
        {
            return ClampPositive(value, MaxStatements, MaxStatementsLimitValue);
        }

        public int NormalizeLimitMemoryValue(int value)
        {
            return ClampPositive(value, LimitMemory, MaxLimitMemoryMB);
        }

        public int NormalizeLimitRecursionValue(int value)
        {
            return ClampPositive(value, LimitRecursion, MaxLimitRecursionDepth);
        }

        public int NormalizeCallTreeLimitMemoryValue(int value)
        {
            var normalized = ClampPositive(value, CallTreeLimitMemory, MaxCallTreeLimitMemoryMB);
            return Math.Max(LimitMemory, normalized);
        }

        public int NormalizeNestedApiDepthValue(int value)
        {
            return ClampPositive(value, NestedApiDepth, MaxNestedApiDepthValue);
        }

        public static int NormalizeTimeout(int value)
        {
            return ClampPositive(value, DefaultTimeout, MaxTimeout);
        }

        public static int NormalizeMaxStatements(int value)
        {
            return ClampPositive(value, DefaultMaxStatements, MaxStatementsLimit);
        }

        public static int NormalizeLimitMemory(int value)
        {
            return ClampPositive(value, DefaultLimitMemory, MaxLimitMemory);
        }

        public static int NormalizeLimitRecursion(int value)
        {
            return ClampPositive(value, DefaultLimitRecursion, MaxLimitRecursion);
        }

        private static int GetConfigInt(object sysConfig, int defaultValue, params string[] fieldNames)
        {
            foreach (var fieldName in fieldNames)
            {
                var value = DynamicHelper.GetDynamicIntValue(sysConfig, fieldName, 0);
                if (value > 0)
                {
                    return value;
                }
            }
            return defaultValue;
        }

        private static int NormalizeMaxLimit(int value, int defaultValue, int hardMaxValue)
        {
            if (value <= 0)
            {
                return defaultValue;
            }
            if (hardMaxValue > 0 && value > hardMaxValue)
            {
                return hardMaxValue;
            }
            return value;
        }

        private static int ClampPositive(int value, int defaultValue, int maxValue)
        {
            if (value <= 0)
            {
                return defaultValue;
            }
            if (maxValue > 0 && value > maxValue)
            {
                return maxValue;
            }
            return value;
        }

    }
}
