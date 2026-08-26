using System.Data;
using System.Data.Common;
using System.Globalization;
using Dos.ORM;

namespace Microi.Tests.ORM.Db;

public sealed class SqlParameterInferenceTests
{
    [Fact]
    public void AddInParameter_ObjectOverload_PreservesClrTypesUnderEnUsCulture()
    {
        var originalCulture = CultureInfo.CurrentCulture;
        var originalUiCulture = CultureInfo.CurrentUICulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("en-US");
            CultureInfo.CurrentUICulture = CultureInfo.GetCultureInfo("en-US");

            var session = new DbSession(
                DatabaseType.MySql,
                "Server=127.0.0.1;Database=microi_parameter_test;Uid=test;Pwd=test;");
            var section = new InspectableSqlSection(session, "SELECT @created,@count,@enabled,@id,@payload,@text");
            var timestamp = new DateTime(2026, 8, 26, 7, 37, 10, DateTimeKind.Local);
            var id = Guid.NewGuid();
            var payload = new byte[] { 1, 2, 3 };

            section
                .AddInParameter("created", timestamp)
                .AddInParameter("count", 42)
                .AddInParameter("enabled", true)
                .AddInParameter("id", id)
                .AddInParameter("payload", payload)
                .AddInParameter("text", "08/26/2026 07:37:10");

            AssertParameter(section.Command, "created", DbType.DateTime, timestamp);
            AssertParameter(section.Command, "count", DbType.Int32, 42);
            AssertParameter(section.Command, "enabled", DbType.Boolean, true);
            AssertParameter(section.Command, "id", DbType.Guid, id);
            AssertParameter(section.Command, "payload", DbType.Binary, payload);
            AssertParameter(section.Command, "text", DbType.String, "08/26/2026 07:37:10");
        }
        finally
        {
            CultureInfo.CurrentCulture = originalCulture;
            CultureInfo.CurrentUICulture = originalUiCulture;
        }
    }

    [Fact]
    public void AddSensitiveInParameter_ObjectOverload_UsesTheSameTypeInferenceAndRemainsRedacted()
    {
        var session = new DbSession(
            DatabaseType.MySql,
            "Server=127.0.0.1;Database=microi_parameter_test;Uid=test;Pwd=test;");
        var section = new InspectableSqlSection(session, "SELECT @secretCreated");
        var timestamp = new DateTime(2026, 8, 26, 7, 37, 10);

        section.AddSensitiveInParameter("secretCreated", timestamp);

        AssertParameter(section.Command, "secretCreated", DbType.DateTime, timestamp);
        Assert.True(Section.IsSensitiveParameter(section.Command, "secretCreated"));
    }

    private static void AssertParameter(
        DbCommand command,
        string name,
        DbType expectedType,
        object expectedValue)
    {
        var parameter = Assert.Single(
            command.Parameters.Cast<DbParameter>(),
            item => string.Equals(
                item.ParameterName.TrimStart('@', '?', ':'),
                name.TrimStart('@', '?', ':'),
                StringComparison.OrdinalIgnoreCase));
        Assert.Equal(expectedType, parameter.DbType);
        Assert.Equal(expectedValue, parameter.Value);
    }

    private sealed class InspectableSqlSection : SqlSection
    {
        public InspectableSqlSection(DbSession session, string sql)
            : base(session, sql)
        {
        }

        public DbCommand Command => cmd;
    }
}
