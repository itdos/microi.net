using System.Reflection;
using Dos.ORM;

namespace Dos.ORM.Tests.Compatibility;

public sealed class PublicApiBaselineTests
{
    [Fact]
    public void DatabaseType_numeric_values_are_stable()
    {
        Assert.Equal(0, (int)DatabaseType.SqlServer);
        Assert.Equal(1, (int)DatabaseType.MsAccess);
        Assert.Equal(2, (int)DatabaseType.SqlServer9);
        Assert.Equal(3, (int)DatabaseType.Oracle);
        Assert.Equal(4, (int)DatabaseType.Sqlite3);
        Assert.Equal(5, (int)DatabaseType.MySql);
        Assert.Equal(6, (int)DatabaseType.PostgreSql);
        Assert.Equal(7, (int)DatabaseType.DaMeng);
        Assert.Equal(8, (int)DatabaseType.KingBase);
    }

    [Fact]
    public void DbSession_FromSql_signature_is_stable()
    {
        AssertPublicMethod(
            typeof(DbSession),
            nameof(DbSession.FromSql),
            typeof(SqlSection),
            isStatic: false,
            isVirtual: false,
            typeof(string));
    }

    [Fact]
    public void DbTrans_FromSql_signature_is_stable()
    {
        AssertPublicMethod(
            typeof(DbTrans),
            nameof(DbTrans.FromSql),
            typeof(SqlSection),
            isStatic: false,
            isVirtual: true,
            typeof(string));
    }

    [Fact]
    public void ProviderFactory_CreateDbProvider_signature_is_stable()
    {
        // The one-string overload is compiled only under NETFRAMEWORK. Dos.ORM
        // currently targets netstandard2.1, so it is not part of this assembly's
        // public contract. The four-parameter overload is the active contract.
        AssertPublicMethod(
            typeof(ProviderFactory),
            nameof(ProviderFactory.CreateDbProvider),
            typeof(DbProvider),
            isStatic: true,
            isVirtual: false,
            typeof(string),
            typeof(string),
            typeof(string),
            typeof(DatabaseType?));
    }

    [Fact]
    public void DbProvider_BuildParameterName_signature_is_stable()
    {
        AssertPublicMethod(
            typeof(DbProvider),
            nameof(DbProvider.BuildParameterName),
            typeof(string),
            isStatic: false,
            isVirtual: true,
            typeof(string));
    }

    [Fact]
    public void DbProvider_BuildTableName_signature_is_stable()
    {
        AssertPublicMethod(
            typeof(DbProvider),
            nameof(DbProvider.BuildTableName),
            typeof(string),
            isStatic: false,
            isVirtual: true,
            typeof(string),
            typeof(string));
    }

    [Fact]
    public void Public_signature_lookup_rejects_non_public_and_wrong_parameter_members()
    {
        Assert.Null(FindPublicDeclaredMethod(
            typeof(SignatureSensitivityFixture),
            "PrivateTarget",
            isStatic: false,
            typeof(string)));

        Assert.Null(FindPublicDeclaredMethod(
            typeof(SignatureSensitivityFixture),
            nameof(SignatureSensitivityFixture.WrongParameterTarget),
            isStatic: false,
            typeof(string)));
    }

    private static void AssertPublicMethod(
        Type declaringType,
        string methodName,
        Type returnType,
        bool isStatic,
        bool isVirtual,
        params Type[] parameterTypes)
    {
        var method = FindPublicDeclaredMethod(
            declaringType,
            methodName,
            isStatic,
            parameterTypes);

        Assert.NotNull(method);
        Assert.Same(declaringType, method!.DeclaringType);
        Assert.Same(returnType, method.ReturnType);
        Assert.True(method.IsPublic);
        Assert.Equal(isStatic, method.IsStatic);
        Assert.Equal(isVirtual, method.IsVirtual);
    }

    private static MethodInfo? FindPublicDeclaredMethod(
        Type declaringType,
        string methodName,
        bool isStatic,
        params Type[] parameterTypes)
    {
        var scope = isStatic ? BindingFlags.Static : BindingFlags.Instance;
        return declaringType.GetMethod(
            methodName,
            BindingFlags.Public | BindingFlags.DeclaredOnly | scope,
            binder: null,
            types: parameterTypes,
            modifiers: null);
    }

    private sealed class SignatureSensitivityFixture
    {
        private string PrivateTarget(string value) => value;

        public string WrongParameterTarget(int value) => value.ToString();
    }
}
