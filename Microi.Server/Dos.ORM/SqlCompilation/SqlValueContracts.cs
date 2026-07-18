using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Data;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{
    internal sealed class SqlValueContract
    {
        internal SqlValueContract(
            LogicalDbType logicalType,
            int? length = null,
            LogicalTextEncoding textEncoding = LogicalTextEncoding.Native)
        {
            if (!Enum.IsDefined(typeof(LogicalDbType), logicalType))
            {
                throw new ArgumentOutOfRangeException(nameof(logicalType));
            }
            if (length.HasValue && length.Value <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(length));
            }
            if (!Enum.IsDefined(typeof(LogicalTextEncoding), textEncoding))
            {
                throw new ArgumentOutOfRangeException(nameof(textEncoding));
            }
            if (textEncoding != LogicalTextEncoding.Native
                && !IsLogicalText(logicalType))
            {
                throw new ArgumentException(
                    "A non-native text encoding requires a logical text type.",
                    nameof(textEncoding));
            }

            LogicalType = logicalType;
            Length = length;
            TextEncoding = textEncoding;
        }

        internal LogicalDbType LogicalType { get; }

        internal int? Length { get; }

        internal LogicalTextEncoding TextEncoding { get; }

        private static bool IsLogicalText(LogicalDbType logicalType)
        {
            return logicalType == LogicalDbType.String
                || logicalType == LogicalDbType.AnsiString
                || logicalType == LogicalDbType.Json
                || logicalType == LogicalDbType.Clob;
        }
    }

    internal sealed class SqlParameterValueContract
    {
        internal SqlParameterValueContract(
            ParameterDefinition definition,
            SqlValueContract valueContract)
        {
            if (definition == null)
            {
                throw new ArgumentNullException(nameof(definition));
            }
            if (valueContract == null)
            {
                throw new ArgumentNullException(nameof(valueContract));
            }
            if (definition.Type.LogicalType != valueContract.LogicalType
                || definition.Type.Length != valueContract.Length)
            {
                throw new ArgumentException(
                    "The parameter definition and value contract must have "
                    + "the same logical type and length.",
                    nameof(valueContract));
            }

            Definition = definition;
            ValueContract = valueContract;
        }

        internal ParameterDefinition Definition { get; }

        internal SqlValueContract ValueContract { get; }
    }

    internal sealed class SqlResultValueContract
    {
        internal SqlResultValueContract(
            int ordinal,
            SqlValueContract valueContract)
        {
            if (ordinal < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(ordinal));
            }

            Ordinal = ordinal;
            ValueContract = valueContract
                ?? throw new ArgumentNullException(nameof(valueContract));
        }

        internal int Ordinal { get; }

        internal SqlValueContract ValueContract { get; }
    }

    internal sealed class SqlCommandValueContract
    {
        internal SqlCommandValueContract(
            DatabaseStorageContract storageContract,
            IEnumerable<SqlParameterValueContract> parameters,
            IEnumerable<SqlResultValueContract> results)
        {
            StorageContract = storageContract
                ?? throw new ArgumentNullException(nameof(storageContract));
            Parameters = CopyParameters(parameters);
            Results = CopyResults(results);
            ValidateEncodingConsistency(
                storageContract, Parameters, Results);

            StorageContractFingerprint = storageContract.Fingerprint;
            IsNative = storageContract.IsNative;
            RequiresPlanExtension = !storageContract.IsNative
                || Results.Count != 0;
            Fingerprint = ComputeFingerprint(
                storageContract, Parameters, Results);
        }

        internal DatabaseStorageContract StorageContract { get; }

        internal IReadOnlyList<SqlParameterValueContract> Parameters { get; }

        internal IReadOnlyList<SqlResultValueContract> Results { get; }

        internal StructuralFingerprint StorageContractFingerprint { get; }

        internal bool IsNative { get; }

        internal bool RequiresPlanExtension { get; }

        internal StructuralFingerprint Fingerprint { get; }

        internal static SqlCommandValueContract Native(
            IEnumerable<ParameterDefinition> parameters)
        {
            return Native(
                DatabaseStorageContract.ProfilelessNative(),
                parameters);
        }

        internal static SqlCommandValueContract Native(
            DatabaseStorageContract storageContract,
            IEnumerable<ParameterDefinition> parameters)
        {
            if (storageContract == null)
            {
                throw new ArgumentNullException(nameof(storageContract));
            }
            if (!storageContract.IsNative)
            {
                throw new ArgumentException(
                    "The default command value contract requires Native storage.",
                    nameof(storageContract));
            }
            if (parameters == null)
            {
                throw new ArgumentNullException(nameof(parameters));
            }

            var contracts = new List<SqlParameterValueContract>();
            foreach (var definition in parameters)
            {
                if (definition == null)
                {
                    throw new ArgumentException(
                        "A parameter definition cannot be null.",
                        nameof(parameters));
                }
                contracts.Add(new SqlParameterValueContract(
                    definition,
                    new SqlValueContract(
                        definition.Type.LogicalType,
                        definition.Type.Length)));
            }

            return new SqlCommandValueContract(
                storageContract,
                contracts,
                Array.Empty<SqlResultValueContract>());
        }

        private static IReadOnlyList<SqlParameterValueContract>
            CopyParameters(IEnumerable<SqlParameterValueContract> values)
        {
            if (values == null)
            {
                throw new ArgumentNullException(nameof(values));
            }

            var copy = new List<SqlParameterValueContract>();
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var value in values)
            {
                if (value == null)
                {
                    throw new ArgumentException(
                        "A parameter value contract cannot be null.",
                        nameof(values));
                }
                if (!names.Add(value.Definition.Name))
                {
                    throw new ArgumentException(
                        "Parameter value contracts cannot contain duplicate "
                        + "logical names.",
                        nameof(values));
                }
                copy.Add(value);
            }
            return new ReadOnlyCollection<SqlParameterValueContract>(copy);
        }

        private static IReadOnlyList<SqlResultValueContract>
            CopyResults(IEnumerable<SqlResultValueContract> values)
        {
            if (values == null)
            {
                throw new ArgumentNullException(nameof(values));
            }

            var copy = new List<SqlResultValueContract>();
            var ordinals = new HashSet<int>();
            foreach (var value in values)
            {
                if (value == null)
                {
                    throw new ArgumentException(
                        "A result value contract cannot be null.",
                        nameof(values));
                }
                if (!ordinals.Add(value.Ordinal))
                {
                    throw new ArgumentException(
                        "Result value contracts cannot contain duplicate ordinals.",
                        nameof(values));
                }
                copy.Add(value);
            }
            return new ReadOnlyCollection<SqlResultValueContract>(copy);
        }

        private static void ValidateEncodingConsistency(
            DatabaseStorageContract storageContract,
            IReadOnlyList<SqlParameterValueContract> parameters,
            IReadOnlyList<SqlResultValueContract> results)
        {
            for (var index = 0; index < parameters.Count; index++)
            {
                ValidateEncoding(
                    storageContract,
                    parameters[index].ValueContract,
                    nameof(parameters));
            }
            for (var index = 0; index < results.Count; index++)
            {
                ValidateEncoding(
                    storageContract,
                    results[index].ValueContract,
                    nameof(results));
            }
        }

        private static void ValidateEncoding(
            DatabaseStorageContract storageContract,
            SqlValueContract valueContract,
            string parameterName)
        {
            if (valueContract.TextEncoding != LogicalTextEncoding.Native
                && valueContract.TextEncoding != storageContract.TextEncoding)
            {
                throw new ArgumentException(
                    "A value encoding must be Native or match the active "
                    + "database storage contract.",
                    parameterName);
            }
        }

        private static StructuralFingerprint ComputeFingerprint(
            DatabaseStorageContract storageContract,
            IReadOnlyList<SqlParameterValueContract> parameters,
            IReadOnlyList<SqlResultValueContract> results)
        {
            var wire = new StableWireBuffer();
            wire.WriteUtf8("dosorm-sql-command-value-contract-v1");
            wire.WriteUtf8(storageContract.Fingerprint.Value);
            wire.WriteUInt32BigEndian(unchecked((uint)parameters.Count));
            for (var index = 0; index < parameters.Count; index++)
            {
                WriteParameter(wire, parameters[index]);
            }
            wire.WriteUInt32BigEndian(unchecked((uint)results.Count));
            for (var index = 0; index < results.Count; index++)
            {
                WriteResult(wire, results[index]);
            }
            return new StructuralFingerprint(wire.ComputeSha256Text());
        }

        private static void WriteParameter(
            StableWireBuffer wire,
            SqlParameterValueContract contract)
        {
            wire.WriteUtf8("parameter");
            wire.WriteUtf8(contract.Definition.Name);
            WriteType(wire, contract.Definition.Type);
            wire.WriteEnum(
                typeof(ParameterDirection),
                contract.Definition.Direction);
            wire.WriteBoolean(contract.Definition.IsNullable);
            WriteValue(wire, contract.ValueContract);
        }

        private static void WriteResult(
            StableWireBuffer wire,
            SqlResultValueContract contract)
        {
            wire.WriteUtf8("result");
            wire.WriteInt32BigEndian(contract.Ordinal);
            WriteValue(wire, contract.ValueContract);
        }

        private static void WriteValue(
            StableWireBuffer wire,
            SqlValueContract contract)
        {
            wire.WriteEnum(typeof(LogicalDbType), contract.LogicalType);
            WriteOptionalInt32(wire, contract.Length);
            wire.WriteEnum(
                typeof(LogicalTextEncoding), contract.TextEncoding);
        }

        private static void WriteType(
            StableWireBuffer wire,
            SqlTypeDescriptor type)
        {
            wire.WriteEnum(typeof(LogicalDbType), type.LogicalType);
            WriteOptionalInt32(wire, type.Length);
            WriteOptionalInt32(wire, type.Precision);
            WriteOptionalInt32(wire, type.Scale);
        }

        private static void WriteOptionalInt32(
            StableWireBuffer wire,
            int? value)
        {
            if (value.HasValue)
            {
                wire.WriteByte(1);
                wire.WriteInt32BigEndian(value.Value);
            }
            else
            {
                wire.WriteByte(0);
            }
        }
    }
}
