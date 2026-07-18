using System;
using Dos.ORM.Platform;

namespace Dos.ORM.SqlCompilation
{
    public sealed class UnsupportedDatabaseCapabilityException
        : NotSupportedException
    {
        internal UnsupportedDatabaseCapabilityException(
            DialectProfile profile,
            string feature,
            string nodePath)
            : this(CreateState(profile, feature, nodePath))
        {
        }

        private UnsupportedDatabaseCapabilityException(ExceptionState state)
            : base(state.Message)
        {
            DatabaseType = state.DatabaseType;
            ServerVersion = state.ServerVersion;
            CompatibilityMode = state.CompatibilityMode;
            Feature = state.Feature;
            NodePath = state.NodePath;
        }

        public DatabaseType DatabaseType { get; }

        public Version ServerVersion { get; }

        public string CompatibilityMode { get; }

        public string Feature { get; }

        public string NodePath { get; }

        private static ExceptionState CreateState(
            DialectProfile profile,
            string feature,
            string nodePath)
        {
            if (profile == null)
            {
                throw new ArgumentNullException(nameof(profile));
            }
            EnsureFeatureName(feature, nameof(feature));
            EnsureStructuralNodePath(nodePath, nameof(nodePath));

            var version = CopyVersion(profile.ServerVersion);
            var message = "Database capability is unsupported"
                + " (DatabaseType=" + profile.DatabaseType
                + ", ServerVersion=" + version
                + ", CompatibilityMode=" + profile.CompatibilityMode
                + ", Feature=" + feature
                + ", NodePath=" + nodePath + ").";
            return new ExceptionState(
                profile.DatabaseType,
                version,
                profile.CompatibilityMode,
                feature,
                nodePath,
                message);
        }

        internal static Version CopyVersion(Version version)
        {
            if (version == null)
            {
                throw new ArgumentNullException(nameof(version));
            }
            if (version.Revision >= 0)
            {
                return new Version(
                    version.Major,
                    version.Minor,
                    version.Build,
                    version.Revision);
            }
            if (version.Build >= 0)
            {
                return new Version(
                    version.Major,
                    version.Minor,
                    version.Build);
            }
            return new Version(version.Major, version.Minor);
        }

        internal static void EnsureSafeStructuralText(
            string value,
            string parameterName)
        {
            if (value == null)
            {
                throw new ArgumentNullException(parameterName);
            }
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException(
                    "Structural diagnostic text cannot be blank.",
                    parameterName);
            }
            if (value.Length > 1024)
            {
                throw new ArgumentOutOfRangeException(parameterName);
            }
            for (var index = 0; index < value.Length; index++)
            {
                if (char.IsControl(value[index]))
                {
                    throw new ArgumentException(
                        "Structural diagnostic text cannot contain controls.",
                        parameterName);
                }
            }
        }

        internal static void EnsureFeatureName(
            string value,
            string parameterName)
        {
            EnsureSafeStructuralText(value, parameterName);
            for (var index = 0; index < value.Length; index++)
            {
                var character = value[index];
                if (!(character >= 'a' && character <= 'z')
                    && !(character >= 'A' && character <= 'Z')
                    && !(character >= '0' && character <= '9')
                    && character != '_'
                    && character != '.')
                {
                    throw new ArgumentException(
                        "Feature must be a structural compiler name.",
                        parameterName);
                }
            }
        }

        internal static void EnsureStructuralNodePath(
            string value,
            string parameterName)
        {
            EnsureSafeStructuralText(value, parameterName);
            if (value[0] != '$')
            {
                throw new ArgumentException(
                    "Node path must start at the SQL AST root.",
                    parameterName);
            }

            var index = 1;
            while (index < value.Length)
            {
                if (value[index] == '.')
                {
                    index++;
                    var start = index;
                    while (index < value.Length
                           && (char.IsLetterOrDigit(value[index])
                               || value[index] == '_'))
                    {
                        index++;
                    }
                    if (index == start)
                    {
                        throw new ArgumentException(
                            "Node path contains an invalid property segment.",
                            parameterName);
                    }
                    continue;
                }

                if (value[index] == '[')
                {
                    index++;
                    var start = index;
                    while (index < value.Length
                           && value[index] >= '0'
                           && value[index] <= '9')
                    {
                        index++;
                    }
                    if (index == start
                        || index >= value.Length
                        || value[index] != ']')
                    {
                        throw new ArgumentException(
                            "Node path contains an invalid collection index.",
                            parameterName);
                    }
                    index++;
                    continue;
                }

                throw new ArgumentException(
                    "Node path contains an invalid structural token.",
                    parameterName);
            }
        }

        private sealed class ExceptionState
        {
            internal ExceptionState(
                DatabaseType databaseType,
                Version serverVersion,
                string compatibilityMode,
                string feature,
                string nodePath,
                string message)
            {
                DatabaseType = databaseType;
                ServerVersion = serverVersion;
                CompatibilityMode = compatibilityMode;
                Feature = feature;
                NodePath = nodePath;
                Message = message;
            }

            internal DatabaseType DatabaseType { get; }
            internal Version ServerVersion { get; }
            internal string CompatibilityMode { get; }
            internal string Feature { get; }
            internal string NodePath { get; }
            internal string Message { get; }
        }
    }
}
