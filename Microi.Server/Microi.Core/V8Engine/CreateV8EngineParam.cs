using System;
using Dos.Common;

namespace Microi.net
{
    public class CreateV8EngineParam
    {
        public static int DefaultTimeout => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_DEFAULT_TIMEOUT_SECONDS", "V8Limits:DefaultTimeoutSeconds", 600);
        public static int MaxTimeout => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_MAX_TIMEOUT_SECONDS", "V8Limits:MaxTimeoutSeconds", 3600);
        public static int DefaultMaxStatements => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_DEFAULT_MAX_STATEMENTS", "V8Limits:DefaultMaxStatements", 50_000_000);
        public static int MaxStatementsLimit => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_MAX_STATEMENTS", "V8Limits:MaxStatements", 500_000_000);
        public static int DefaultLimitMemory => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_DEFAULT_LIMIT_MEMORY_MB", "V8Limits:DefaultLimitMemoryMB", 1024);
        public static int MaxLimitMemory => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_MAX_LIMIT_MEMORY_MB", "V8Limits:MaxLimitMemoryMB", 4096);
        public static int DefaultLimitRecursion => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_DEFAULT_LIMIT_RECURSION", "V8Limits:DefaultLimitRecursion", 2000);
        public static int MaxLimitRecursion => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_MAX_LIMIT_RECURSION", "V8Limits:MaxLimitRecursion", 5000);

        public int MaxTimeoutSeconds { get; set; } = MaxTimeout;
        public int MaxStatementsLimitValue { get; set; } = MaxStatementsLimit;
        public int MaxLimitMemoryMB { get; set; } = MaxLimitMemory;
        public int MaxLimitRecursionDepth { get; set; } = MaxLimitRecursion;

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

            Timeout = ClampPositive(GetConfigInt(sysConfig, Timeout, "V8DefaultTimeoutSeconds"), Timeout, MaxTimeoutSeconds);
            MaxStatements = ClampPositive(GetConfigInt(sysConfig, MaxStatements, "V8DefaultMaxStatements"), MaxStatements, MaxStatementsLimitValue);
            LimitMemory = ClampPositive(GetConfigInt(sysConfig, LimitMemory, "V8DefaultLimitMemoryMB", "V8DefaultLimitMemory"), LimitMemory, MaxLimitMemoryMB);
            LimitRecursion = ClampPositive(GetConfigInt(sysConfig, LimitRecursion, "V8DefaultLimitRecursion"), LimitRecursion, MaxLimitRecursionDepth);

            Normalize();
        }

        public void Normalize()
        {
            Timeout = NormalizeTimeoutValue(Timeout);
            MaxStatements = NormalizeMaxStatementsValue(MaxStatements);
            LimitMemory = NormalizeLimitMemoryValue(LimitMemory);
            LimitRecursion = NormalizeLimitRecursionValue(LimitRecursion);
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
