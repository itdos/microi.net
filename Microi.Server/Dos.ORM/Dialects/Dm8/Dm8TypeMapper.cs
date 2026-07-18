using Dos.ORM.Dialects.Oracle;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Dialects.Dm8
{
    internal sealed class Dm8TypeMapper
    {
        internal void Write(
            SqlTypeDescriptor type,
            SqlTextWriter writer,
            SqlLoweringContext context)
        {
            OracleFamilyTypeMapper.Write(
                type, writer, context, "dm8");
        }
    }
}
