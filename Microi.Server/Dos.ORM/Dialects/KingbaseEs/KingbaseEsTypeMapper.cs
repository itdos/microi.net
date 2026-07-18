using Dos.ORM.Dialects.PostgreSql;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.KingbaseEs
{
    internal sealed class KingbaseEsTypeMapper
    {
        internal void Write(
            SqlTypeDescriptor type,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            PostgreSqlFamilyTypeMapper.Write(type, writer, context,
                "kingbasees");
        }
    }
}
