using System;

namespace Microi.net
{
    public class CreateV8EngineParam
    {
        public static readonly int DefaultTimeout = ReadPositiveEnvironmentInt("MICROI_V8_DEFAULT_TIMEOUT_SECONDS", 600);
        public static readonly int MaxTimeout = ReadPositiveEnvironmentInt("MICROI_V8_MAX_TIMEOUT_SECONDS", 3600);
        public static readonly int DefaultMaxStatements = ReadPositiveEnvironmentInt("MICROI_V8_DEFAULT_MAX_STATEMENTS", 50_000_000);
        public static readonly int MaxStatementsLimit = ReadPositiveEnvironmentInt("MICROI_V8_MAX_STATEMENTS", 500_000_000);
        public static readonly int DefaultLimitMemory = ReadPositiveEnvironmentInt("MICROI_V8_DEFAULT_LIMIT_MEMORY_MB", 512);
        public static readonly int MaxLimitMemory = ReadPositiveEnvironmentInt("MICROI_V8_MAX_LIMIT_MEMORY_MB", 2048);
        public static readonly int DefaultLimitRecursion = ReadPositiveEnvironmentInt("MICROI_V8_DEFAULT_LIMIT_RECURSION", 2000);
        public static readonly int MaxLimitRecursion = ReadPositiveEnvironmentInt("MICROI_V8_MAX_LIMIT_RECURSION", 5000);

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

        private static int ReadPositiveEnvironmentInt(string name, int defaultValue)
        {
            var value = Environment.GetEnvironmentVariable(name);
            if (int.TryParse(value, out var parsed) && parsed > 0)
            {
                return parsed;
            }
            return defaultValue;
        }
    }
}
