using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Dos.ORM.SqlAst
{
    public enum SqlBinaryOperator
    {
        Equal,
        NotEqual,
        GreaterThan,
        GreaterThanOrEqual,
        LessThan,
        LessThanOrEqual,
        Add,
        Subtract,
        Multiply,
        Divide,
        And,
        Or,
        Like
    }

    public enum SqlUnaryOperator
    {
        Not,
        Negate,
        IsNull,
        IsNotNull
    }

    public abstract class SqlExpression : SqlNode
    {
    }

    public sealed class ColumnExpression : SqlExpression
    {
        public ColumnExpression(SqlIdentifier name, SqlAlias source = null)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            Source = source;
        }

        public SqlIdentifier Name { get; }

        public SqlAlias Source { get; }
    }

    public sealed class ParameterExpression : SqlExpression
    {
        public ParameterExpression(ParameterDefinition definition)
        {
            Definition = definition ?? throw new ArgumentNullException(nameof(definition));
        }

        public ParameterDefinition Definition { get; }
    }

    public sealed class NullExpression : SqlExpression
    {
        private NullExpression()
        {
        }

        public static NullExpression Instance { get; } = new NullExpression();
    }

    public sealed class BooleanExpression : SqlExpression
    {
        private BooleanExpression(bool value)
        {
            Value = value;
        }

        public static BooleanExpression True { get; } = new BooleanExpression(true);

        public static BooleanExpression False { get; } = new BooleanExpression(false);

        public bool Value { get; }
    }

    public sealed class BinaryExpression : SqlExpression
    {
        public BinaryExpression(
            SqlExpression left,
            SqlBinaryOperator @operator,
            SqlExpression right)
        {
            Left = left ?? throw new ArgumentNullException(nameof(left));
            if (!Enum.IsDefined(typeof(SqlBinaryOperator), @operator))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(@operator), "Binary operator must be defined.");
            }

            Right = right ?? throw new ArgumentNullException(nameof(right));
            Operator = @operator;
        }

        public SqlExpression Left { get; }

        public SqlBinaryOperator Operator { get; }

        public SqlExpression Right { get; }
    }

    public sealed class UnaryExpression : SqlExpression
    {
        public UnaryExpression(SqlUnaryOperator @operator, SqlExpression operand)
        {
            if (!Enum.IsDefined(typeof(SqlUnaryOperator), @operator))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(@operator), "Unary operator must be defined.");
            }

            Operand = operand ?? throw new ArgumentNullException(nameof(operand));
            Operator = @operator;
        }

        public SqlUnaryOperator Operator { get; }

        public SqlExpression Operand { get; }
    }

    public sealed class InExpression : SqlExpression
    {
        public InExpression(SqlExpression operand, IEnumerable<SqlExpression> values)
        {
            Operand = operand ?? throw new ArgumentNullException(nameof(operand));
            Values = SqlAstCollection.Copy(values, nameof(values), allowEmpty: true);
        }

        public SqlExpression Operand { get; }

        public IReadOnlyList<SqlExpression> Values { get; }
    }

    public sealed class BetweenExpression : SqlExpression
    {
        public BetweenExpression(
            SqlExpression operand,
            SqlExpression lower,
            SqlExpression upper)
        {
            Operand = operand ?? throw new ArgumentNullException(nameof(operand));
            Lower = lower ?? throw new ArgumentNullException(nameof(lower));
            Upper = upper ?? throw new ArgumentNullException(nameof(upper));
        }

        public SqlExpression Operand { get; }

        public SqlExpression Lower { get; }

        public SqlExpression Upper { get; }
    }

    public sealed class CaseWhenClause
    {
        public CaseWhenClause(SqlExpression when, SqlExpression then)
        {
            When = when ?? throw new ArgumentNullException(nameof(when));
            Then = then ?? throw new ArgumentNullException(nameof(then));
        }

        public SqlExpression When { get; }

        public SqlExpression Then { get; }
    }

    public sealed class CaseExpression : SqlExpression
    {
        public CaseExpression(
            IEnumerable<CaseWhenClause> whenClauses,
            SqlExpression elseExpression = null)
        {
            WhenClauses = SqlAstCollection.Copy(
                whenClauses, nameof(whenClauses), allowEmpty: false);
            ElseExpression = elseExpression;
        }

        public CaseExpression(
            SqlExpression inputExpression,
            IEnumerable<CaseWhenClause> whenClauses,
            SqlExpression elseExpression = null)
        {
            InputExpression = inputExpression ??
                throw new ArgumentNullException(nameof(inputExpression));
            WhenClauses = SqlAstCollection.Copy(
                whenClauses, nameof(whenClauses), allowEmpty: false);
            ElseExpression = elseExpression;
        }

        public IReadOnlyList<CaseWhenClause> WhenClauses { get; }

        public SqlExpression ElseExpression { get; }

        public SqlExpression InputExpression { get; }
    }

    public sealed class CastExpression : SqlExpression
    {
        public CastExpression(SqlExpression expression, SqlTypeDescriptor type)
        {
            Expression = expression ?? throw new ArgumentNullException(nameof(expression));
            Type = type ?? throw new ArgumentNullException(nameof(type));
        }

        public SqlExpression Expression { get; }

        public SqlTypeDescriptor Type { get; }
    }

    public sealed class SubqueryExpression : SqlExpression
    {
        public SubqueryExpression(SqlNode query)
        {
            Query = query ?? throw new ArgumentNullException(nameof(query));
        }

        public SqlNode Query { get; }
    }

    public sealed class ExistsExpression : SqlExpression
    {
        public ExistsExpression(SubqueryExpression subquery)
        {
            Subquery = subquery ?? throw new ArgumentNullException(nameof(subquery));
        }

        public SubqueryExpression Subquery { get; }
    }

    public sealed class AggregateExpression : SqlExpression
    {
        public AggregateExpression(
            SemanticFunctionId function,
            SqlExpression argument = null,
            bool distinct = false)
        {
            if (function == null)
            {
                throw new ArgumentNullException(nameof(function));
            }

            if (!SemanticFunctions.IsRegistered(function) || !function.IsAggregate)
            {
                throw new ArgumentException(
                    "Aggregate function must be a registered aggregate semantic ID.",
                    nameof(function));
            }

            Function = function;
            Argument = argument;
            Distinct = distinct;
        }

        public SemanticFunctionId Function { get; }

        public SqlExpression Argument { get; }

        public bool Distinct { get; }
    }

    public sealed class FunctionExpression : SqlExpression
    {
        public FunctionExpression(
            SemanticFunctionId function,
            IEnumerable<SqlExpression> arguments)
        {
            if (function == null)
            {
                throw new ArgumentNullException(nameof(function));
            }

            if (!SemanticFunctions.IsRegistered(function))
            {
                throw new ArgumentException(
                    "Function must be a registered semantic ID.", nameof(function));
            }

            if (function.IsAggregate)
            {
                throw new ArgumentException(
                    "Aggregate semantic functions must use AggregateExpression.",
                    nameof(function));
            }

            Function = function;
            Arguments = SqlAstCollection.Copy(
                arguments, nameof(arguments), allowEmpty: true);
        }

        public SemanticFunctionId Function { get; }

        public IReadOnlyList<SqlExpression> Arguments { get; }
    }

    internal static class SqlAstCollection
    {
        public static IReadOnlyList<T> Copy<T>(
            IEnumerable<T> items,
            string parameterName,
            bool allowEmpty)
            where T : class
        {
            if (items == null)
            {
                throw new ArgumentNullException(parameterName);
            }

            var copy = new List<T>();
            foreach (var item in items)
            {
                if (item == null)
                {
                    throw new ArgumentException(
                        "Collection cannot contain null items.", parameterName);
                }

                copy.Add(item);
            }

            if (!allowEmpty && copy.Count == 0)
            {
                throw new ArgumentException(
                    "Collection must contain at least one item.", parameterName);
            }

            return new ReadOnlyCollection<T>(copy);
        }
    }
}
