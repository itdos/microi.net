using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;

namespace Dos.ORM.Platform
{

public sealed class DialectProfile : IEquatable<DialectProfile>
{
    public DialectProfile(
        DatabaseType databaseType,
        Version serverVersion,
        string compatibilityMode)
    {
        if (!Enum.IsDefined(typeof(DatabaseType), databaseType))
        {
            throw new ArgumentOutOfRangeException(nameof(databaseType));
        }
        if (serverVersion == null)
        {
            throw new ArgumentNullException(nameof(serverVersion));
        }
        if (compatibilityMode == null)
        {
            throw new ArgumentNullException(nameof(compatibilityMode));
        }
        if (compatibilityMode.Length > 0 &&
            string.IsNullOrWhiteSpace(compatibilityMode))
        {
            throw new ArgumentException(
                "Compatibility mode cannot contain only whitespace.",
                nameof(compatibilityMode));
        }
        for (var index = 0; index < compatibilityMode.Length; index++)
        {
            if (char.IsControl(compatibilityMode[index]))
            {
                throw new ArgumentException(
                    "Compatibility mode cannot contain control characters.",
                    nameof(compatibilityMode));
            }
        }

        DatabaseType = databaseType;
        ServerVersion = serverVersion;
        CompatibilityMode = compatibilityMode;

        var wire = new StableWireBuffer();
        wire.WriteUtf8("microi-dialect-profile-v1");
        DialectProfileWire.Write(wire, this);
        Fingerprint = wire.ComputeSha256Text();
    }

    public DatabaseType DatabaseType { get; }

    public Version ServerVersion { get; }

    public string CompatibilityMode { get; }

    public string Fingerprint { get; }

    public bool Equals(DialectProfile other)
    {
        if (ReferenceEquals(null, other))
        {
            return false;
        }
        if (ReferenceEquals(this, other))
        {
            return true;
        }

        return DatabaseType == other.DatabaseType &&
               ServerVersion.Major == other.ServerVersion.Major &&
               ServerVersion.Minor == other.ServerVersion.Minor &&
               ServerVersion.Build == other.ServerVersion.Build &&
               ServerVersion.Revision == other.ServerVersion.Revision &&
               string.Equals(
                   CompatibilityMode,
                   other.CompatibilityMode,
                   StringComparison.Ordinal);
    }

    public override bool Equals(object obj)
    {
        return Equals(obj as DialectProfile);
    }

    public override int GetHashCode()
    {
        unchecked
        {
            var hash = 17;
            hash = (hash * 31) + (int)DatabaseType;
            hash = (hash * 31) + ServerVersion.Major;
            hash = (hash * 31) + ServerVersion.Minor;
            hash = (hash * 31) + ServerVersion.Build;
            hash = (hash * 31) + ServerVersion.Revision;
            hash = (hash * 31) + CompatibilityMode.Length;
            for (var index = 0; index < CompatibilityMode.Length; index++)
            {
                hash = (hash * 31) + CompatibilityMode[index];
            }
            return hash;
        }
    }

    public override string ToString()
    {
        return "DialectProfile(DatabaseType=" + DatabaseType +
               ", ServerVersion=" + ServerVersion +
               ", CompatibilityMode=" + CompatibilityMode +
               ", Fingerprint=" + Fingerprint + ")";
    }
}

internal sealed class StableWireBuffer
{
    private static readonly UTF8Encoding StrictUtf8 =
        new UTF8Encoding(false, true);

    private readonly List<byte> _bytes = new List<byte>();

    internal void WriteByte(byte value)
    {
        _bytes.Add(value);
    }

    internal void WriteBoolean(bool value)
    {
        WriteByte(value ? (byte)1 : (byte)0);
    }

    internal void WriteInt32BigEndian(int value)
    {
        WriteUInt32BigEndian(unchecked((uint)value));
    }

    internal void WriteUInt32BigEndian(uint value)
    {
        _bytes.Add((byte)(value >> 24));
        _bytes.Add((byte)(value >> 16));
        _bytes.Add((byte)(value >> 8));
        _bytes.Add((byte)value);
    }

    internal void WriteUtf8(string value)
    {
        if (value == null)
        {
            throw new ArgumentNullException(nameof(value));
        }

        var encoded = StrictUtf8.GetBytes(value);
        WriteUInt32BigEndian(unchecked((uint)encoded.Length));
        _bytes.AddRange(encoded);
    }

    internal void WriteEnum(Type enumType, object value)
    {
        if (enumType == null)
        {
            throw new ArgumentNullException(nameof(enumType));
        }
        if (value == null)
        {
            throw new ArgumentNullException(nameof(value));
        }
        if (!enumType.IsEnum)
        {
            throw new ArgumentException(
                "The supplied type must be an enum.",
                nameof(enumType));
        }
        if (value.GetType() != enumType || !Enum.IsDefined(enumType, value))
        {
            throw new ArgumentOutOfRangeException(nameof(value));
        }

        var name = Enum.GetName(enumType, value);
        if (name == null)
        {
            throw new ArgumentOutOfRangeException(nameof(value));
        }
        WriteUtf8(name);
    }

    internal void WriteGuidRfc4122(Guid value)
    {
        var mixed = value.ToByteArray();
        _bytes.Add(mixed[3]);
        _bytes.Add(mixed[2]);
        _bytes.Add(mixed[1]);
        _bytes.Add(mixed[0]);
        _bytes.Add(mixed[5]);
        _bytes.Add(mixed[4]);
        _bytes.Add(mixed[7]);
        _bytes.Add(mixed[6]);
        for (var index = 8; index < 16; index++)
        {
            _bytes.Add(mixed[index]);
        }
    }

    internal string ComputeSha256Text()
    {
        byte[] hash;
        using (var sha256 = SHA256.Create())
        {
            hash = sha256.ComputeHash(_bytes.ToArray());
        }

        var text = new char[7 + (hash.Length * 2)];
        text[0] = 's';
        text[1] = 'h';
        text[2] = 'a';
        text[3] = '2';
        text[4] = '5';
        text[5] = '6';
        text[6] = ':';
        for (var index = 0; index < hash.Length; index++)
        {
            var offset = 7 + (index * 2);
            text[offset] = LowerHex(hash[index] >> 4);
            text[offset + 1] = LowerHex(hash[index] & 0x0f);
        }
        return new string(text);
    }

    internal static int GetUtf8ByteCount(string value)
    {
        if (value == null)
        {
            throw new ArgumentNullException(nameof(value));
        }
        return StrictUtf8.GetByteCount(value);
    }

    private static char LowerHex(int value)
    {
        return (char)(value < 10 ? '0' + value : 'a' + value - 10);
    }
}

internal static class DialectProfileWire
{
    internal static void Write(
        StableWireBuffer wire,
        DialectProfile profile)
    {
        if (wire == null)
        {
            throw new ArgumentNullException(nameof(wire));
        }
        if (profile == null)
        {
            throw new ArgumentNullException(nameof(profile));
        }

        wire.WriteEnum(typeof(DatabaseType), profile.DatabaseType);
        wire.WriteInt32BigEndian(profile.ServerVersion.Major);
        wire.WriteInt32BigEndian(profile.ServerVersion.Minor);
        wire.WriteInt32BigEndian(profile.ServerVersion.Build);
        wire.WriteInt32BigEndian(profile.ServerVersion.Revision);
        wire.WriteUtf8(profile.CompatibilityMode);
    }
}
}
