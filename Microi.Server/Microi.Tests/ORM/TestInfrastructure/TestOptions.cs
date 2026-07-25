using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Tests.TestInfrastructure;

internal static class TestOptions
{
    internal static SqlCompilationOptions MySql80 =>
        new(TestProfiles.MySql80);

    internal static SqlCompilationOptions PostgreSql17 =>
        new(TestProfiles.PostgreSql17);

    internal static SqlCompilationOptions PostgreSql17RequiredMigration =>
        new(
            TestProfiles.PostgreSql17,
            AtomicityRequirement.Required,
            new SchemaToken("schema-v1"));
}
