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
        public static int DefaultLimitMemory => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_DEFAULT_LIMIT_MEMORY_MB", "V8Limits:DefaultLimitMemoryMB", 512);
        public static int MaxLimitMemory => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_MAX_LIMIT_MEMORY_MB", "V8Limits:MaxLimitMemoryMB", 2048);
        public static int DefaultLimitRecursion => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_DEFAULT_LIMIT_RECURSION", "V8Limits:DefaultLimitRecursion", 2000);
        public static int MaxLimitRecursion => ConfigHelper.GetEnvOrConfigurationInt("MICROI_V8_MAX_LIMIT_RECURSION", "V8Limits:MaxLimitRecursion", 5000);

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

        public void Normalize()
        {
            Timeout = NormalizeTimeout(Timeout);
            MaxStatements = NormalizeMaxStatements(MaxStatements);
            LimitMemory = NormalizeLimitMemory(LimitMemory);
            LimitRecursion = NormalizeLimitRecursion(LimitRecursion);
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
