using Dos.ORM.Platform;
using Dos.ORM.Dialects.Oracle;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.Dm8
{
    internal sealed class Dm8Compiler : SqlCompilerBase
    {
        private static readonly Dm8LogicalTextLowerer TextLowerer =
            new Dm8LogicalTextLowerer();

        internal override DatabaseCapabilities ResolveCapabilities(
            DialectProfile profile)
        {
            return Dm8Capabilities.For(profile);
        }

        internal override SqlNode Lower(
            SqlNode node,
            SqlLoweringContext context)
        {
            TextLowerer.ValidateStorageContract(context);
            return node;
        }

        internal override SqlNode Optimize(
            SqlNode node,
            SqlLoweringContext context)
        {
            return node;
        }

        internal override RenderedSql Render(
            AllocatedSqlNode node,
            SqlLoweringContext context)
        {
            return OracleFamilyCompiler.Render(
                node,
                context,
                OracleFamilyDialect.Dm8,
                "dm8");
        }

        internal override DestructiveImpact DeriveEffectiveImpact(
            SqlNode source,
            SqlNode lowered,
            SqlLoweringContext context)
        {
            return OracleFamilyCompiler.DeriveEffectiveImpact(source);
        }
    }
}
