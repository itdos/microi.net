using System;
using System.Globalization;
using Dos.ORM.Platform;

namespace Dos.ORM.SqlAst
{

public enum SqlSafetyOrigin
{
    PlatformGenerated,
    UserProvided,
    LegacyAiGenerated,
    LegacyUnknown
}

public enum NativeSqlCommandKind
{
    Read,
    Write,
    Schema,
    DatabaseAdmin,
    Unknown
}

public sealed class NativeSqlText
{
    private NativeSqlText(
        string text,
        DialectProfile targetProfile,
        NativeSqlCommandKind kind,
        SqlSafetyOrigin origin)
    {
        if (text == null)
        {
            throw new ArgumentNullException(nameof(text));
        }
        if (targetProfile == null)
        {
            throw new ArgumentNullException(nameof(targetProfile));
        }
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException(
                "Native SQL text cannot be empty or whitespace.",
                nameof(text));
        }
        if (text.IndexOf('\0') >= 0)
        {
            throw new ArgumentException(
                "Native SQL text cannot contain a NUL character.",
                nameof(text));
        }
        if (!Enum.IsDefined(typeof(NativeSqlCommandKind), kind))
        {
            throw new ArgumentOutOfRangeException(nameof(kind));
        }
        if (!Enum.IsDefined(typeof(SqlSafetyOrigin), origin))
        {
            throw new ArgumentOutOfRangeException(nameof(origin));
        }

        var utf8Length = StableWireBuffer.GetUtf8ByteCount(text);
        var wire = new StableWireBuffer();
        wire.WriteUtf8("microi-native-sql-text-v1");
        DialectProfileWire.Write(wire, targetProfile);
        wire.WriteEnum(typeof(SqlSafetyOrigin), origin);
        wire.WriteEnum(typeof(NativeSqlCommandKind), kind);
        wire.WriteUtf8(text);

        Text = text;
        TargetProfile = targetProfile;
        TargetDatabase = targetProfile.DatabaseType;
        Kind = kind;
        Origin = origin;
        Digest = wire.ComputeSha256Text();
        Utf8Length = utf8Length;
    }

    public string Text { get; }

    public DialectProfile TargetProfile { get; }

    public DatabaseType TargetDatabase { get; }

    public NativeSqlCommandKind Kind { get; }

    public SqlSafetyOrigin Origin { get; }

    public string Digest { get; }

    public int Utf8Length { get; }

    public static NativeSqlText UserProvided(
        string text,
        DialectProfile targetProfile,
        NativeSqlCommandKind kind)
    {
        return new NativeSqlText(
            text,
            targetProfile,
            kind,
            SqlSafetyOrigin.UserProvided);
    }

    public static NativeSqlText LegacyAiGenerated(
        string text,
        DialectProfile targetProfile,
        NativeSqlCommandKind kind)
    {
        return new NativeSqlText(
            text,
            targetProfile,
            kind,
            SqlSafetyOrigin.LegacyAiGenerated);
    }

    public static NativeSqlText LegacyUnknown(
        string text,
        DialectProfile targetProfile)
    {
        return new NativeSqlText(
            text,
            targetProfile,
            NativeSqlCommandKind.Unknown,
            SqlSafetyOrigin.LegacyUnknown);
    }

    public override string ToString()
    {
        return "NativeSqlText(TargetProfileFingerprint=" +
               TargetProfile.Fingerprint +
               ", Origin=" + Origin +
               ", Kind=" + Kind +
               ", Utf8Length=" +
               Utf8Length.ToString(CultureInfo.InvariantCulture) +
               ", Digest=" + Digest + ")";
    }
}
}
