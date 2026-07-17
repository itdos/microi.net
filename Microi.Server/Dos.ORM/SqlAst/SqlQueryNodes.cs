using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Dos.ORM.SqlAst
{
    public enum SqlJoinType
    {
        Inner,
        Left,
        Right,
        Full,
        Cross
    }

    public enum SqlSortDirection
    {
        Ascending,
        Descending
    }

    public enum SqlNullSortOrder
    {
        Default,
        First,
        Last
    }

    public enum SqlLockMode
    {
        Update,
        Share
    }

    public enum SqlLockWait
    {
        Wait,
        NoWait,
        SkipLocked
    }

    public enum SqlSetOperator
    {
        Union,
        UnionAll,
        Intersect,
        Except
    }

    public abstract class SqlStatement : SqlNode
    {
    }

    public abstract class SqlTableSource : SqlNode
    {
    }

    public sealed class NamedTableSource : SqlTableSource
    {
        public NamedTableSource(SqlObjectName name, SqlAlias alias = null)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            Alias = alias;
        }

        public SqlObjectName Name { get; }

        public SqlAlias Alias { get; }
    }

    public sealed class DerivedTableSource : SqlTableSource
    {
        public DerivedTableSource(SelectStatement query, SqlAlias alias)
        {
            Query = query ?? throw new ArgumentNullException(nameof(query));
            Alias = alias ?? throw new ArgumentNullException(nameof(alias));
        }

        public SelectStatement Query { get; }

        public SqlAlias Alias { get; }
    }

    public sealed class JoinSource : SqlTableSource
    {
        public JoinSource(
            SqlTableSource left,
            SqlJoinType joinType,
            SqlTableSource right,
            SqlExpression condition = null)
        {
            Left = left ?? throw new ArgumentNullException(nameof(left));
            if (!Enum.IsDefined(typeof(SqlJoinType), joinType))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(joinType), "Join type must be defined.");
            }

            Right = right ?? throw new ArgumentNullException(nameof(right));
            if (joinType == SqlJoinType.Cross && condition != null)
            {
                throw new ArgumentException(
                    "Cross join cannot have a condition.", nameof(condition));
            }

            if (joinType != SqlJoinType.Cross && condition == null)
            {
                throw new ArgumentException(
                    "Non-cross join requires a condition.", nameof(condition));
            }

            JoinType = joinType;
            Condition = condition;
        }

        public SqlTableSource Left { get; }

        public SqlJoinType JoinType { get; }

        public SqlTableSource Right { get; }

        public SqlExpression Condition { get; }
    }

    public sealed class WildcardExpression : SqlExpression
    {
        public WildcardExpression(SqlAlias source = null)
        {
            Source = source;
        }

        public SqlAlias Source { get; }
    }

    public sealed class SelectProjection : SqlNode
    {
        public SelectProjection(SqlExpression expression, SqlAlias alias = null)
        {
            Expression = expression ??
                throw new ArgumentNullException(nameof(expression));
            Alias = alias;
        }

        public SqlExpression Expression { get; }

        public SqlAlias Alias { get; }
    }

    public sealed class OrderByExpression : SqlNode
    {
        public OrderByExpression(
            SqlExpression expression,
            SqlSortDirection direction = SqlSortDirection.Ascending,
            SqlNullSortOrder nullSortOrder = SqlNullSortOrder.Default)
        {
            Expression = expression ??
                throw new ArgumentNullException(nameof(expression));
            if (!Enum.IsDefined(typeof(SqlSortDirection), direction))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(direction), "Sort direction must be defined.");
            }

            if (!Enum.IsDefined(typeof(SqlNullSortOrder), nullSortOrder))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(nullSortOrder), "NULL sort order must be defined.");
            }

            Direction = direction;
            NullSortOrder = nullSortOrder;
        }

        public SqlExpression Expression { get; }

        public SqlSortDirection Direction { get; }

        public SqlNullSortOrder NullSortOrder { get; }
    }

    public abstract class PageSpec : SqlNode
    {
    }

    public sealed class OffsetPageSpec : PageSpec
    {
        public OffsetPageSpec(int offset, int limit)
        {
            if (offset < 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(offset), "Offset cannot be negative.");
            }

            if (limit <= 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(limit), "Limit must be positive.");
            }

            Offset = offset;
            Limit = limit;
        }

        public int Offset { get; }

        public int Limit { get; }
    }

    public sealed class KeysetPageSpec : PageSpec
    {
        public KeysetPageSpec(
            IEnumerable<SqlExpression> boundaries,
            int limit)
        {
            if (limit <= 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(limit), "Limit must be positive.");
            }

            Boundaries = SqlAstCollection.Copy(
                boundaries, nameof(boundaries), allowEmpty: true);
            Limit = limit;
        }

        public IReadOnlyList<SqlExpression> Boundaries { get; }

        public int Limit { get; }
    }

    public sealed class LockSpec : SqlNode
    {
        public LockSpec(
            SqlLockMode mode,
            SqlLockWait wait = SqlLockWait.Wait)
        {
            if (!Enum.IsDefined(typeof(SqlLockMode), mode))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(mode), "Lock mode must be defined.");
            }

            if (!Enum.IsDefined(typeof(SqlLockWait), wait))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(wait), "Lock wait behavior must be defined.");
            }

            Mode = mode;
            Wait = wait;
        }

        public SqlLockMode Mode { get; }

        public SqlLockWait Wait { get; }
    }

    public sealed class CommonTableExpression : SqlNode
    {
        public CommonTableExpression(
            SqlIdentifier name,
            SelectStatement query,
            IEnumerable<SqlIdentifier> columns = null,
            bool recursive = false)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            Query = query ?? throw new ArgumentNullException(nameof(query));
            Columns = SqlAstCollection.Copy(
                columns ?? Array.Empty<SqlIdentifier>(),
                nameof(columns),
                allowEmpty: true);
            Recursive = recursive;
        }

        public SqlIdentifier Name { get; }

        public SelectStatement Query { get; }

        public IReadOnlyList<SqlIdentifier> Columns { get; }

        public bool Recursive { get; }
    }

    public sealed class SetOperationClause : SqlNode
    {
        public SetOperationClause(
            SqlSetOperator @operator,
            SelectStatement rightQuery)
        {
            if (!Enum.IsDefined(typeof(SqlSetOperator), @operator))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(@operator), "Set operator must be defined.");
            }

            RightQuery = rightQuery ??
                throw new ArgumentNullException(nameof(rightQuery));
            Operator = @operator;
        }

        public SqlSetOperator Operator { get; }

        public SelectStatement RightQuery { get; }
    }

    public sealed class SelectStatement : SqlStatement
    {
        public SelectStatement(
            SqlTableSource from,
            IEnumerable<SelectProjection> projections,
            bool distinct = false,
            SqlExpression whereExpression = null,
            IEnumerable<SqlExpression> groupBy = null,
            SqlExpression havingExpression = null,
            IEnumerable<OrderByExpression> orderBy = null,
            PageSpec page = null,
            LockSpec lockSpec = null,
            IEnumerable<CommonTableExpression> commonTableExpressions = null,
            IEnumerable<SetOperationClause> setOperations = null)
            : this(
                from,
                projections,
                distinct,
                whereExpression,
                groupBy,
                havingExpression,
                orderBy,
                page,
                lockSpec,
                commonTableExpressions,
                setOperations,
                requireFrom: true)
        {
        }

        public SelectStatement(
            IEnumerable<SelectProjection> projections,
            bool distinct = false,
            SqlExpression whereExpression = null,
            IEnumerable<SqlExpression> groupBy = null,
            SqlExpression havingExpression = null,
            IEnumerable<OrderByExpression> orderBy = null,
            PageSpec page = null,
            LockSpec lockSpec = null,
            IEnumerable<CommonTableExpression> commonTableExpressions = null,
            IEnumerable<SetOperationClause> setOperations = null)
            : this(
                null,
                projections,
                distinct,
                whereExpression,
                groupBy,
                havingExpression,
                orderBy,
                page,
                lockSpec,
                commonTableExpressions,
                setOperations,
                requireFrom: false)
        {
        }

        private SelectStatement(
            SqlTableSource from,
            IEnumerable<SelectProjection> projections,
            bool distinct,
            SqlExpression whereExpression,
            IEnumerable<SqlExpression> groupBy,
            SqlExpression havingExpression,
            IEnumerable<OrderByExpression> orderBy,
            PageSpec page,
            LockSpec lockSpec,
            IEnumerable<CommonTableExpression> commonTableExpressions,
            IEnumerable<SetOperationClause> setOperations,
            bool requireFrom)
        {
            if (requireFrom && from == null)
            {
                throw new ArgumentNullException(nameof(from));
            }

            From = from;
            Projections = SqlAstCollection.Copy(
                projections, nameof(projections), allowEmpty: false);
            Distinct = distinct;
            Where = whereExpression;
            GroupBy = SqlAstCollection.Copy(
                groupBy ?? Array.Empty<SqlExpression>(),
                nameof(groupBy),
                allowEmpty: true);
            Having = havingExpression;
            OrderBy = SqlAstCollection.Copy(
                orderBy ?? Array.Empty<OrderByExpression>(),
                nameof(orderBy),
                allowEmpty: true);
            Page = page;
            Lock = lockSpec;
            CommonTableExpressions = SqlAstCollection.Copy(
                commonTableExpressions ?? Array.Empty<CommonTableExpression>(),
                nameof(commonTableExpressions),
                allowEmpty: true);
            SetOperations = SqlAstCollection.Copy(
                setOperations ?? Array.Empty<SetOperationClause>(),
                nameof(setOperations),
                allowEmpty: true);
        }

        public IReadOnlyList<SelectProjection> Projections { get; }

        public SqlTableSource From { get; }

        public bool Distinct { get; }

        public SqlExpression Where { get; }

        public IReadOnlyList<SqlExpression> GroupBy { get; }

        public SqlExpression Having { get; }

        public IReadOnlyList<OrderByExpression> OrderBy { get; }

        public PageSpec Page { get; }

        public LockSpec Lock { get; }

        public IReadOnlyList<CommonTableExpression> CommonTableExpressions { get; }

        public IReadOnlyList<SetOperationClause> SetOperations { get; }
    }

    public sealed class SqlAstDiagnostic
    {
        internal SqlAstDiagnostic(string code, string message, string path)
        {
            Code = code ?? throw new ArgumentNullException(nameof(code));
            Message = message ?? throw new ArgumentNullException(nameof(message));
            Path = path ?? throw new ArgumentNullException(nameof(path));
        }

        public string Code { get; }

        public string Message { get; }

        public string Path { get; }
    }

    public static class SqlAstRules
    {
        public static IReadOnlyList<SqlAstDiagnostic> ValidateShape(
            SelectStatement statement)
        {
            if (statement == null)
            {
                throw new ArgumentNullException(nameof(statement));
            }

            var diagnostics = new List<SqlAstDiagnostic>();
            ValidateSelect(statement, "$", diagnostics);
            return new ReadOnlyCollection<SqlAstDiagnostic>(diagnostics);
        }

        private static void ValidateSelect(
            SelectStatement statement,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            ValidatePage(statement, path + ".Page", diagnostics);

            for (var index = 0;
                 index < statement.CommonTableExpressions.Count;
                 index++)
            {
                ValidateSelect(
                    statement.CommonTableExpressions[index].Query,
                    path + ".CommonTableExpressions[" + index + "].Query",
                    diagnostics);
            }

            if (statement.From != null)
            {
                ValidateTableSource(
                    statement.From, path + ".From", diagnostics);
            }

            for (var index = 0; index < statement.SetOperations.Count; index++)
            {
                ValidateSelect(
                    statement.SetOperations[index].RightQuery,
                    path + ".SetOperations[" + index + "].RightQuery",
                    diagnostics);
            }
        }

        private static void ValidatePage(
            SelectStatement statement,
            string pagePath,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            if (statement.Page is OffsetPageSpec &&
                statement.OrderBy.Count == 0)
            {
                diagnostics.Add(new SqlAstDiagnostic(
                    "AST_PAGE_ORDER_REQUIRED",
                    "Offset pagination requires at least one ORDER BY expression.",
                    pagePath));
                return;
            }

            if (!(statement.Page is KeysetPageSpec keyset))
            {
                return;
            }

            if (statement.OrderBy.Count == 0)
            {
                diagnostics.Add(new SqlAstDiagnostic(
                    "AST_KEYSET_ORDER_REQUIRED",
                    "Keyset pagination requires at least one ORDER BY expression.",
                    pagePath));
            }

            if (keyset.Boundaries.Count == 0)
            {
                diagnostics.Add(new SqlAstDiagnostic(
                    "AST_KEYSET_BOUNDARY_REQUIRED",
                    "Keyset pagination requires at least one boundary expression.",
                    pagePath));
            }

            if (statement.OrderBy.Count != keyset.Boundaries.Count)
            {
                diagnostics.Add(new SqlAstDiagnostic(
                    "AST_KEYSET_ARITY_MISMATCH",
                    "Keyset ORDER BY and boundary expression counts must match.",
                    pagePath));
            }
        }

        private static void ValidateTableSource(
            SqlTableSource source,
            string path,
            ICollection<SqlAstDiagnostic> diagnostics)
        {
            if (source is DerivedTableSource derived)
            {
                ValidateSelect(
                    derived.Query, path + ".Query", diagnostics);
                return;
            }

            if (source is JoinSource join)
            {
                ValidateTableSource(
                    join.Left, path + ".Left", diagnostics);
                ValidateTableSource(
                    join.Right, path + ".Right", diagnostics);
            }
        }
    }
}
