using Dos.ORM.Dialects.KingbaseEs;
using Dos.ORM.Dialects.PostgreSql;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Tests.TestInfrastructure;

internal static class DialectCases
{
    public static IEnumerable<object[]> PostgreSqlFamily
    {
        get
        {
            yield return new object[]
            {
                new Func<ISqlCompiler>(() => new PostgreSqlCompiler()),
                new SqlCompilationOptions(TestProfiles.PostgreSql17),
                "@"
            };
            yield return new object[]
            {
                new Func<ISqlCompiler>(() => new KingbaseEsCompiler()),
                new SqlCompilationOptions(TestProfiles.KingbaseEsV9),
                ":"
            };
        }
    }
}
