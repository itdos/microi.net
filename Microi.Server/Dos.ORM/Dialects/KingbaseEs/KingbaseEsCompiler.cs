using Dos.ORM.Dialects.PostgreSql;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.KingbaseEs
{
    internal sealed class KingbaseEsCompiler : SqlCompilerBase
    {
        internal override DatabaseCapabilities ResolveCapabilities(
            DialectProfile profile)
        {
            return KingbaseEsCapabilities.For(profile);
        }

        internal override SqlNode Lower(
            SqlNode node,
            SqlLoweringContext context)
        {
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
            return PostgreSqlFamilyCompiler.Render(
                node,
                context,
                SqlTextDialectFamily.KingbaseEs,
                "kingbasees");
        }

        internal override DestructiveImpact DeriveEffectiveImpact(
            SqlNode source,
            SqlNode lowered,
            SqlLoweringContext context)
        {
            return PostgreSqlFamilyCompiler.DeriveEffectiveImpact(source);
        }
    }
}
