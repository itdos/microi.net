using System;
using System.Collections.Generic;
using System.Security.Cryptography;

namespace Microi.net
{
    /// <summary>
    /// Generates one-time administrator passwords for owner-authorized SaaS tenant resets.
    /// The plaintext is returned only in the short-lived no-store response; the target
    /// tenant stores only the versioned one-way hash produced by PasswordHashSecurity.
    /// </summary>
    public static class TenantAdminCredentialSecurity
    {
        private const string Lowercase = "abcdefghijkmnopqrstuvwxyz";
        private const string Uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        private const string Digits = "23456789";
        private const string Symbols = "!@#$%*-_=+";
        private const string Alphabet = Lowercase + Uppercase + Digits + Symbols;

        public const int DefaultPasswordLength = 18;

        public static string GenerateRandomPassword(int length = DefaultPasswordLength)
        {
            if (length < 16 || length > 64)
            {
                throw new ArgumentOutOfRangeException(nameof(length), "随机密码长度必须在16到64位之间。");
            }

            using var random = RandomNumberGenerator.Create();
            var characters = new List<char>(length)
            {
                Pick(random, Lowercase),
                Pick(random, Uppercase),
                Pick(random, Digits),
                Pick(random, Symbols)
            };
            while (characters.Count < length)
            {
                characters.Add(Pick(random, Alphabet));
            }

            // Fisher-Yates with rejection sampling keeps every position unbiased.
            for (var index = characters.Count - 1; index > 0; index--)
            {
                var swapIndex = NextIndex(random, index + 1);
                (characters[index], characters[swapIndex]) = (characters[swapIndex], characters[index]);
            }
            return new string(characters.ToArray());
        }

        private static char Pick(RandomNumberGenerator random, string source)
        {
            return source[NextIndex(random, source.Length)];
        }

        private static int NextIndex(RandomNumberGenerator random, int exclusiveMax)
        {
            if (exclusiveMax <= 0 || exclusiveMax > byte.MaxValue)
            {
                throw new ArgumentOutOfRangeException(nameof(exclusiveMax));
            }

            var sample = new byte[1];
            var upperBound = 256 - (256 % exclusiveMax);
            do
            {
                random.GetBytes(sample);
            } while (sample[0] >= upperBound);
            return sample[0] % exclusiveMax;
        }
    }
}
