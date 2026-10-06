using System.Data;
using System.Data.SqlClient;
using System.Globalization;
using System.Reflection;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

// Exercise the actual compiled FormEngine method. This is parameter binding
// coverage; database round trips and HTTP acceptance remain separate gates.
[Collection("TenantContextGlobal")]
public sealed class FormEngineDecimalInvariantTests
{
    private static readonly MethodInfo Binder = typeof(FormEngine).GetMethod(
        "SetDbParameter", BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("Production decimal binder is missing.");

    [Theory]
    [InlineData("en-US")]
    [InlineData("zh-CN")]
    [InlineData("de-DE")]
    [InlineData("fr-FR")]
    [InlineData("ar-SA")]
    [InlineData("tr-TR")]
    public void DecimalWireValues_PreserveEveryDigit_RegardlessOfRequestCulture(string culture)
    {
        WithCulture(culture, () =>
        {
            var inputs = new (object? Value, decimal? Expected)[]
            {
                (new JValue("1.500000"), 1.500000m),
                (new JValue("999999999999.123456"), 999999999999.123456m),
                (new JValue("-0.000001"), -0.000001m),
                (new JValue(999999999999.123456m), 999999999999.123456m),
                (new JValue(1.25d), 1.25m),
                (new JValue(17L), 17m),
                (3.125m, 3.125m),
                (42L, 42m),
                (JValue.CreateNull(), null),
                (null, null),
                (new JValue(""), null),
                (new JValue("  "), null),
                (new JValue("null"), null)
            };
            foreach (var type in new[] { "decimal(18,6)", "number(18,6)", "NUMBER(18, 6)" })
            foreach (var input in inputs)
            {
                var parameter = Bind(type, input.Value);
                Assert.Equal(DbType.Decimal, parameter.DbType);
                if (input.Expected is null) Assert.Null(parameter.Value);
                else Assert.Equal(input.Expected.Value, Assert.IsType<decimal>(parameter.Value));
            }
        });
    }

    [Theory]
    [InlineData("en-US")]
    [InlineData("zh-CN")]
    [InlineData("de-DE")]
    [InlineData("fr-FR")]
    [InlineData("ar-SA")]
    [InlineData("tr-TR")]
    public void AmbiguousLocalizedInvalidAndOverflowValues_FailBeforeAnyDatabaseWrite(string culture)
    {
        WithCulture(culture, () =>
        {
            foreach (var value in new[] { "1,23", "1,234.56", "1 234,56", "1e-6",
                "not-a-number", "NaN", "79228162514264337593543950336" })
            {
                var reflectionError = Assert.Throws<TargetInvocationException>(
                    () => Bind("decimal(18,6)", new JValue(value)));
                var error = Assert.IsType<Exception>(reflectionError.InnerException);
                Assert.Contains("Factor", error.Message);
                Assert.Contains("decimal(18,6)", error.Message);
                Assert.Contains(value, error.Message);
            }
        });
    }

    [Theory]
    [InlineData("en-US")]
    [InlineData("zh-CN")]
    [InlineData("de-DE")]
    [InlineData("fr-FR")]
    [InlineData("ar-SA")]
    [InlineData("tr-TR")]
    public void ExistingSignsWhitespaceAndNonDecimalFields_KeepTheirSemantics(string culture)
    {
        WithCulture(culture, () =>
        {
            Assert.Equal(1.500000m, Bind("decimal(18,6)", new JValue(" 1.500000 ")).Value);
            Assert.Equal(1.500000m, Bind("decimal(18,6)", new JValue("+1.500000")).Value);
            Assert.Equal(-1.500000m, Bind("decimal(18,6)", new JValue("1.500000-")).Value);
            var integer = Bind("int", new JValue(17));
            Assert.Equal(DbType.Int32, integer.DbType);
            Assert.Equal(17, integer.Value);
            var emptyDate = Bind("datetime", new JValue(""));
            Assert.Equal(DbType.String, emptyDate.DbType);
            Assert.Equal(DBNull.Value, emptyDate.Value);
            var text = Bind("varchar(255)", new JValue("1.500000"));
            Assert.Equal(DbType.String, text.DbType);
            Assert.Equal("1.500000", text.Value);
        });
    }

    private static SqlParameter Bind(string type, object? value)
    {
        var parameter = new SqlParameter();
        Binder.Invoke(null, new object?[] { parameter,
            new JObject { ["Name"] = "Factor", ["Label"] = "Factor", ["Type"] = type },
            value, new DbInfo { DbType = DatabaseType.SqlServer } });
        return parameter;
    }

    private static void WithCulture(string culture, Action assertions)
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo(culture);
            assertions();
        }
        finally { CultureInfo.CurrentCulture = previous; }
    }
}
