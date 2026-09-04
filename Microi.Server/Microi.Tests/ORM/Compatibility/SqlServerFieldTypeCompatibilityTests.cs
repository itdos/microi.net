using Dos.ORM;

namespace Microi.Tests.ORM.Compatibility;

public sealed class SqlServerFieldTypeCompatibilityTests
{
    [Theory]
    [InlineData("tinytext")]
    [InlineData("text")]
    [InlineData("mediumtext")]
    [InlineData("MEDIUMTEXT")]
    [InlineData("longtext")]
    [InlineData("ntext")]
    public void NormalizeFieldType_MapsLegacyTextAliasesToUnicodeMax(string fieldType)
    {
        Assert.Equal("nvarchar(max)", SqlServerService.NormalizeFieldType(fieldType));
    }

    [Theory]
    [InlineData("varchar(255)")]
    [InlineData("nvarchar(max)")]
    [InlineData("int")]
    [InlineData("decimal(18,2)")]
    public void NormalizeFieldType_PreservesNativeSqlServerTypes(string fieldType)
    {
        Assert.Equal(fieldType, SqlServerService.NormalizeFieldType(fieldType));
    }

    [Theory]
    [InlineData("nvarchar", 20, null, null, null, "nvarchar(20)")]
    [InlineData("nvarchar", -1, null, null, null, "nvarchar(max)")]
    [InlineData("varchar", 500, null, null, null, "varchar(500)")]
    [InlineData("decimal", null, 18, 4, null, "decimal(18,4)")]
    [InlineData("datetime2", null, null, null, 7, "datetime2(7)")]
    [InlineData("int", null, 10, 0, null, "int")]
    public void BuildPhysicalColumnType_PreservesLengthAndPrecision(
        string dataType,
        int? maximumLength,
        int? numericPrecision,
        int? numericScale,
        int? datetimePrecision,
        string expected)
    {
        var column = new information_schema_columns
        {
            data_type = dataType,
            character_maximum_length = maximumLength,
            numeric_precision = numericPrecision,
            numeric_scale = numericScale,
            datetime_precision = datetimePrecision
        };

        Assert.Equal(expected, SqlServerService.BuildPhysicalColumnType(column));
    }

    [Fact]
    public void StartupPhysicalPrerequisiteColumnCreation_DelegatesDialectToDosOrm()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Upgrade.cs"));
        var start = source.IndexOf(
            "private void EnsureColumn(OsClientSecret", StringComparison.Ordinal);
        var end = source.IndexOf(
            "private bool ColumnExists(OsClientSecret", start, StringComparison.Ordinal);

        Assert.True(start >= 0 && end > start, "EnsureColumn source boundary was not found.");
        var method = source[start..end];
        Assert.Contains("MicroiEngine.ORM(dbInfo.DbType).AddColumn", method, StringComparison.Ordinal);
        Assert.DoesNotContain("ALTER TABLE", method, StringComparison.OrdinalIgnoreCase);
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.Server")))
                return current.FullName;
            current = current.Parent;
        }

        throw new DirectoryNotFoundException("未找到 Microi 仓库根目录。");
    }
}
