using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    internal enum DatabaseStorageContractState
    {
        PendingImport = 0,
        Active = 1
    }

    internal sealed class DatabaseStorageContract
    {
        internal DatabaseStorageContract(
            int version,
            LogicalTextEncoding textEncoding,
            StructuralFingerprint catalogFingerprint,
            string targetProfileFingerprint,
            IEnumerable<string> encodedColumnKeys)
        {
            if (version <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(version));
            }
            if (!Enum.IsDefined(typeof(LogicalTextEncoding), textEncoding))
            {
                throw new ArgumentOutOfRangeException(nameof(textEncoding));
            }
            if (catalogFingerprint == null)
            {
                throw new ArgumentNullException(nameof(catalogFingerprint));
            }
            EnsureFingerprint(
                targetProfileFingerprint, nameof(targetProfileFingerprint));

            var columns = CopyColumnKeys(encodedColumnKeys);
            if (textEncoding == LogicalTextEncoding.Native
                && columns.Count != 0)
            {
                throw new ArgumentException(
                    "Native storage cannot declare encoded columns.",
                    nameof(encodedColumnKeys));
            }

            Version = version;
            TextEncoding = textEncoding;
            CatalogFingerprint = catalogFingerprint;
            TargetProfileFingerprint = targetProfileFingerprint;
            EncodedColumnKeys = columns;
            Fingerprint = ComputeFingerprint(
                version,
                textEncoding,
                catalogFingerprint,
                targetProfileFingerprint,
                columns);
        }

        internal DatabaseStorageContractState State
        {
            get { return DatabaseStorageContractState.Active; }
        }

        internal int Version { get; }

        internal LogicalTextEncoding TextEncoding { get; }

        internal StructuralFingerprint CatalogFingerprint { get; }

        internal string TargetProfileFingerprint { get; }

        internal IReadOnlyList<string> EncodedColumnKeys { get; }

        internal StructuralFingerprint Fingerprint { get; }

        internal bool IsNative
        {
            get { return TextEncoding == LogicalTextEncoding.Native; }
        }

        internal static DatabaseStorageContract Native(
            DialectProfile targetProfile)
        {
            if (targetProfile == null)
            {
                throw new ArgumentNullException(nameof(targetProfile));
            }

            var catalogWire = new StableWireBuffer();
            catalogWire.WriteUtf8("dosorm-native-storage-catalog-v1");
            DialectProfileWire.Write(catalogWire, targetProfile);
            return new DatabaseStorageContract(
                1,
                LogicalTextEncoding.Native,
                new StructuralFingerprint(catalogWire.ComputeSha256Text()),
                targetProfile.Fingerprint,
                Array.Empty<string>());
        }

        internal static DatabaseStorageContract ProfilelessNative()
        {
            var profileWire = new StableWireBuffer();
            profileWire.WriteUtf8(
                "dosorm-profileless-native-storage-profile-v1");
            var profileFingerprint = profileWire.ComputeSha256Text();

            var catalogWire = new StableWireBuffer();
            catalogWire.WriteUtf8(
                "dosorm-profileless-native-storage-catalog-v1");
            return new DatabaseStorageContract(
                1,
                LogicalTextEncoding.Native,
                new StructuralFingerprint(catalogWire.ComputeSha256Text()),
                profileFingerprint,
                Array.Empty<string>());
        }

        private static IReadOnlyList<string> CopyColumnKeys(
            IEnumerable<string> values)
        {
            if (values == null)
            {
                throw new ArgumentNullException(nameof(values));
            }

            var copy = new List<string>();
            var unique = new HashSet<string>(StringComparer.Ordinal);
            foreach (var value in values)
            {
                EnsureColumnKey(value, nameof(values));
                if (!unique.Add(value))
                {
                    throw new ArgumentException(
                        "Encoded column keys cannot contain duplicates.",
                        nameof(values));
                }
                copy.Add(value);
            }
            copy.Sort(StringComparer.Ordinal);
            return new ReadOnlyCollection<string>(copy);
        }

        private static void EnsureColumnKey(string value, string parameterName)
        {
            if (value == null)
            {
                throw new ArgumentNullException(parameterName);
            }
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException(
                    "An encoded column key cannot be empty.",
                    parameterName);
            }
            for (var index = 0; index < value.Length; index++)
            {
                if (char.IsControl(value[index]))
                {
                    throw new ArgumentException(
                        "An encoded column key cannot contain control characters.",
                        parameterName);
                }
            }
        }

        private static void EnsureFingerprint(
            string value,
            string parameterName)
        {
            if (value == null)
            {
                throw new ArgumentNullException(parameterName);
            }
            try
            {
                _ = new StructuralFingerprint(value);
            }
            catch (ArgumentException exception)
            {
                throw new ArgumentException(
                    "The value must be a canonical SHA-256 fingerprint.",
                    parameterName,
                    exception);
            }
        }

        private static StructuralFingerprint ComputeFingerprint(
            int version,
            LogicalTextEncoding textEncoding,
            StructuralFingerprint catalogFingerprint,
            string targetProfileFingerprint,
            IReadOnlyList<string> encodedColumnKeys)
        {
            var wire = new StableWireBuffer();
            wire.WriteUtf8("dosorm-database-storage-contract-v1");
            wire.WriteInt32BigEndian(version);
            wire.WriteEnum(typeof(LogicalTextEncoding), textEncoding);
            wire.WriteUtf8(catalogFingerprint.Value);
            wire.WriteUtf8(targetProfileFingerprint);
            wire.WriteUInt32BigEndian(
                unchecked((uint)encodedColumnKeys.Count));
            for (var index = 0; index < encodedColumnKeys.Count; index++)
            {
                wire.WriteUtf8(encodedColumnKeys[index]);
            }
            return new StructuralFingerprint(wire.ComputeSha256Text());
        }
    }

    internal sealed class PendingImportStorageContract
    {
        internal PendingImportStorageContract(
            ResourceContentDigest sourceContentDigest,
            DialectProfile targetProfile,
            StructuralFingerprint expectedLogicalSchemaFingerprint,
            StructuralFingerprint expectedActiveContractFingerprint,
            string compilerVersion)
        {
            SourceContentDigest = sourceContentDigest
                ?? throw new ArgumentNullException(nameof(sourceContentDigest));
            TargetProfile = targetProfile
                ?? throw new ArgumentNullException(nameof(targetProfile));
            ExpectedLogicalSchemaFingerprint =
                expectedLogicalSchemaFingerprint
                ?? throw new ArgumentNullException(
                    nameof(expectedLogicalSchemaFingerprint));
            ExpectedActiveContractFingerprint =
                expectedActiveContractFingerprint
                ?? throw new ArgumentNullException(
                    nameof(expectedActiveContractFingerprint));
            EnsureText(compilerVersion, nameof(compilerVersion));
            CompilerVersion = compilerVersion;
            ImportBindingFingerprint = ComputeFingerprint(this);
        }

        internal DatabaseStorageContractState State
        {
            get { return DatabaseStorageContractState.PendingImport; }
        }

        internal ResourceContentDigest SourceContentDigest { get; }

        internal DialectProfile TargetProfile { get; }

        internal StructuralFingerprint ExpectedLogicalSchemaFingerprint
        {
            get;
        }

        internal StructuralFingerprint ExpectedActiveContractFingerprint
        {
            get;
        }

        internal string CompilerVersion { get; }

        internal StructuralFingerprint ImportBindingFingerprint { get; }

        private static void EnsureText(string value, string parameterName)
        {
            if (value == null)
            {
                throw new ArgumentNullException(parameterName);
            }
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException(
                    "The value cannot be empty.", parameterName);
            }
            for (var index = 0; index < value.Length; index++)
            {
                if (char.IsControl(value[index]))
                {
                    throw new ArgumentException(
                        "The value cannot contain control characters.",
                        parameterName);
                }
            }
        }

        private static StructuralFingerprint ComputeFingerprint(
            PendingImportStorageContract contract)
        {
            var wire = new StableWireBuffer();
            wire.WriteUtf8("dosorm-pending-import-storage-contract-v1");
            wire.WriteUtf8(contract.SourceContentDigest.Value);
            DialectProfileWire.Write(wire, contract.TargetProfile);
            wire.WriteUtf8(
                contract.ExpectedLogicalSchemaFingerprint.Value);
            wire.WriteUtf8(
                contract.ExpectedActiveContractFingerprint.Value);
            wire.WriteUtf8(contract.CompilerVersion);
            return new StructuralFingerprint(wire.ComputeSha256Text());
        }
    }

    internal sealed class DatabaseStorageContractReadResult
    {
        private DatabaseStorageContractReadResult(
            DatabaseStorageContractState? state,
            PendingImportStorageContract pendingImportContract,
            DatabaseStorageContract activeContract)
        {
            State = state;
            PendingImportContract = pendingImportContract;
            ActiveContract = activeContract;
        }

        internal DatabaseStorageContractState? State { get; }

        internal bool IsAbsent
        {
            get { return !State.HasValue; }
        }

        internal PendingImportStorageContract PendingImportContract { get; }

        internal DatabaseStorageContract ActiveContract { get; }

        internal static DatabaseStorageContractReadResult Absent()
        {
            return new DatabaseStorageContractReadResult(null, null, null);
        }

        internal static DatabaseStorageContractReadResult FromPendingImport(
            PendingImportStorageContract contract)
        {
            if (contract == null)
            {
                throw new ArgumentNullException(nameof(contract));
            }
            return new DatabaseStorageContractReadResult(
                DatabaseStorageContractState.PendingImport,
                contract,
                null);
        }

        internal static DatabaseStorageContractReadResult FromActive(
            DatabaseStorageContract contract)
        {
            if (contract == null)
            {
                throw new ArgumentNullException(nameof(contract));
            }
            return new DatabaseStorageContractReadResult(
                DatabaseStorageContractState.Active,
                null,
                contract);
        }
    }
}
