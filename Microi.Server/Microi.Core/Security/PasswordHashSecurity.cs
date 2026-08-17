using System;
using System.Security.Cryptography;

namespace Microi.net
{
    /// <summary>
    /// Versioned password hashing for newly issued login passwords. The iteration count is
    /// embedded in every value so the work factor can be raised without invalidating old rows.
    /// </summary>
    public static class PasswordHashSecurity
    {
        public const string EncodingName = "PBKDF2-SHA256";
        public const int DefaultIterations = 210000;

        private const string FormatPrefix = "pbkdf2-sha256";
        private const int SaltSize = 16;
        private const int HashSize = 32;
        private const int MinimumIterations = 100000;
        private const int MaximumAcceptedIterations = 2000000;

        public static bool IsSupportedEncoding(string value)
        {
            return string.Equals(
                (value ?? "").Trim(),
                EncodingName,
                StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Recognizes a versioned value as belonging to this one-way hash family.
        /// Full structural and cryptographic validation still happens in VerifyPassword.
        /// Treating even a malformed recognized value as a hash is intentional: callers
        /// must fail closed instead of falling back to a reversible legacy encoder.
        /// </summary>
        public static bool IsRecognizedHash(string storedValue)
        {
            return !string.IsNullOrWhiteSpace(storedValue)
                && storedValue.StartsWith(FormatPrefix + "$", StringComparison.Ordinal);
        }

        public static string HashPassword(string password, int iterations = DefaultIterations)
        {
            if (string.IsNullOrEmpty(password))
            {
                throw new ArgumentException("Password cannot be empty.", nameof(password));
            }
            if (iterations < MinimumIterations || iterations > MaximumAcceptedIterations)
            {
                throw new ArgumentOutOfRangeException(nameof(iterations));
            }

            var salt = new byte[SaltSize];
            RandomNumberGenerator.Fill(salt);
            var hash = Derive(password, salt, iterations, HashSize);
            return string.Join("$",
                FormatPrefix,
                iterations.ToString(System.Globalization.CultureInfo.InvariantCulture),
                Convert.ToBase64String(salt),
                Convert.ToBase64String(hash));
        }

        public static bool VerifyPassword(string password, string storedValue)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrWhiteSpace(storedValue))
            {
                return false;
            }

            var parts = storedValue.Split('$');
            if (parts.Length != 4
                || !string.Equals(parts[0], FormatPrefix, StringComparison.Ordinal)
                || !int.TryParse(
                    parts[1],
                    System.Globalization.NumberStyles.None,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out var iterations)
                || iterations < MinimumIterations
                || iterations > MaximumAcceptedIterations)
            {
                return false;
            }

            byte[] salt;
            byte[] expected;
            try
            {
                salt = Convert.FromBase64String(parts[2]);
                expected = Convert.FromBase64String(parts[3]);
            }
            catch (FormatException)
            {
                return false;
            }
            if (salt.Length < SaltSize || salt.Length > 64 || expected.Length < HashSize || expected.Length > 64)
            {
                return false;
            }

            var actual = Derive(password, salt, iterations, expected.Length);
            return FixedTimeEquals(actual, expected);
        }

        private static byte[] Derive(string password, byte[] salt, int iterations, int size)
        {
            using var deriveBytes = new Rfc2898DeriveBytes(
                password,
                salt,
                iterations,
                HashAlgorithmName.SHA256);
            return deriveBytes.GetBytes(size);
        }

        private static bool FixedTimeEquals(byte[] left, byte[] right)
        {
            if (left == null || right == null || left.Length != right.Length)
            {
                return false;
            }
            var difference = 0;
            for (var index = 0; index < left.Length; index++)
            {
                difference |= left[index] ^ right[index];
            }
            return difference == 0;
        }
    }
}
