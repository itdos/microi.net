using Dos.ORM.SqlAst;

namespace Dos.ORM.SqlCompilation
{

public interface ISqlCompiler
{
    DatabaseExecutionPlan Compile(
        SqlStatement statement,
        SqlCompilationOptions options);

    DatabaseExecutionPlan CompileMigration(
        MigrationPlan plan,
        SqlCompilationOptions options);
}
}
