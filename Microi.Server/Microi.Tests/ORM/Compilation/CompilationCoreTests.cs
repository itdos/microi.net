using System.Reflection;
using System.Reflection.Emit;
using System.Runtime.CompilerServices;
using System.Data;
using System.Globalization;
using System.Text;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Compilation;

public sealed partial class CompilationCoreTests
{
    public static IEnumerable<object[]> ExpressionTraversalEdgeCases =>
        AstSamples.ExpressionTraversalEdgeCases();

    public static IEnumerable<object[]> QueryDmlTraversalEdgeCases =>
        AstSamples.QueryDmlTraversalEdgeCases();

    public static IEnumerable<object[]> SchemaMigrationTraversalEdgeCases =>
        AstSamples.SchemaMigrationTraversalEdgeCases();

    public static IEnumerable<object[]> RetainedHolderCases =>
        AstSamples.RetainedHolderCases();

    public static IEnumerable<object[]> RetainedExpressionCases =>
        AstSamples.RetainedExpressionCases();

    public static IEnumerable<object[]> RetainedQueryCases =>
        AstSamples.RetainedQueryCases();

    public static IEnumerable<object[]> RetainedDmlCases =>
        AstSamples.RetainedDmlCases();

    public static IEnumerable<object[]> RetainedSchemaCases =>
        AstSamples.RetainedSchemaCases();

    public static IEnumerable<object[]> RetainedOperationAdminCases =>
        AstSamples.RetainedOperationAdminCases();

    public static IEnumerable<object[]> InvalidDuplicatePrerequisiteCases =>
        InvalidDuplicatePrerequisiteSamples();

    public static IEnumerable<object[]> InvalidDuplicateNonKeyCases =>
        InvalidDuplicateNonKeySamples();

    [Fact]
    public void Traversal_edge_case_catalog_is_complete()
    {
        Assert.Equal(12, System.Linq.Enumerable.Count(ExpressionTraversalEdgeCases));
        Assert.Equal(24, System.Linq.Enumerable.Count(QueryDmlTraversalEdgeCases));
        Assert.Equal(21, System.Linq.Enumerable.Count(SchemaMigrationTraversalEdgeCases));
    }

    [Fact]
    public void Retained_case_catalogs_are_complete_and_case_names_are_unique()
    {
        AssertCaseCatalog(RetainedHolderCases, 3);
        AssertCaseCatalog(RetainedExpressionCases, 8);
        AssertCaseCatalog(RetainedQueryCases, 7);
        AssertCaseCatalog(RetainedDmlCases, 7);
        AssertCaseCatalog(RetainedSchemaCases, 6);
        AssertCaseCatalog(RetainedOperationAdminCases, 26);
        AssertCaseCatalog(InvalidDuplicatePrerequisiteCases, 8);
        AssertCaseCatalog(InvalidDuplicateNonKeyCases, 5);
    }

    [Theory]
    [MemberData(nameof(ExpressionTraversalEdgeCases))]
    public void Expression_traversal_edges_have_exact_paths_and_order(
        string caseName,
        SqlNode root,
        string[] expectedFullSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        Assert.Equal(expectedFullSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Theory]
    [MemberData(nameof(QueryDmlTraversalEdgeCases))]
    public void Query_and_dml_traversal_edges_have_exact_paths_and_order(
        string caseName,
        SqlNode root,
        string[] expectedFullSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        Assert.Equal(expectedFullSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Theory]
    [MemberData(nameof(SchemaMigrationTraversalEdgeCases))]
    public void Schema_and_migration_traversal_edges_have_exact_paths_and_order(
        string caseName,
        SqlNode root,
        string[] expectedFullSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        Assert.Equal(expectedFullSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Theory]
    [MemberData(nameof(RetainedHolderCases))]
    public void Holder_retained_inventory_is_exact(
        string caseName, SqlNode root, string[] expectedFullSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        Assert.Equal(expectedFullSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Theory]
    [MemberData(nameof(RetainedExpressionCases))]
    public void Expression_retained_inventory_is_exact(
        string caseName, SqlNode root, string[] expectedFullSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        Assert.Equal(expectedFullSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Theory]
    [MemberData(nameof(RetainedQueryCases))]
    public void Query_retained_inventory_is_exact(
        string caseName, SqlNode root, string[] expectedFullSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        if (string.Equals(
                caseName,
                "join-required-before-enum",
                StringComparison.Ordinal))
        {
            expectedFullSnapshot = new[]
            {
                "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f$.Left",
                "AST_UNDEFINED_ENUM\u001fSQL AST contains an undefined enumeration value.\u001f$.JoinType",
                "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f$.Right"
            };
        }
        Assert.Equal(expectedFullSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Theory]
    [MemberData(nameof(RetainedDmlCases))]
    public void Dml_retained_inventory_is_exact(
        string caseName, SqlNode root, string[] expectedFullSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        Assert.Equal(expectedFullSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Theory]
    [MemberData(nameof(RetainedSchemaCases))]
    public void Schema_retained_inventory_is_exact(
        string caseName, SqlNode root, string[] expectedFullSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        Assert.Equal(expectedFullSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Theory]
    [MemberData(nameof(RetainedOperationAdminCases))]
    public void Operation_and_admin_retained_inventory_is_exact(
        string caseName, SqlNode root, string[] expectedFullSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        Assert.Equal(expectedFullSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Fact]
    public void Public_surface_is_exact_and_traversal_is_internal()
    {
        var assembly = typeof(SqlAstValidator).Assembly;
        var traversal = assembly.GetType(
            "Dos.ORM.SqlCompilation.SqlAstTraversal",
            throwOnError: true)!;
        Assert.False(traversal.IsVisible);

        var publicTypes = new[]
        {
            typeof(SqlAstNormalizer), typeof(SqlAstValidator),
            typeof(SqlParameterAllocator), typeof(SqlParameterSlot)
        };
        Assert.Equal(
            publicTypes.OrderBy(type => type.FullName, StringComparer.Ordinal),
            Task8OwnedTypes()
                .Where(type => type.IsVisible)
                .OrderBy(type => type.FullName, StringComparer.Ordinal));
        Assert.All(publicTypes, type =>
        {
            Assert.True(type.IsPublic, type.FullName);
            Assert.True(type.IsSealed, type.FullName);
            Assert.Empty(type.GetFields(
                BindingFlags.Instance | BindingFlags.Static |
                BindingFlags.Public | BindingFlags.DeclaredOnly));
            Assert.Empty(type.GetEvents(
                BindingFlags.Instance | BindingFlags.Static |
                BindingFlags.Public | BindingFlags.DeclaredOnly));
            Assert.Empty(type.GetNestedTypes(BindingFlags.Public));
        });

        foreach (var serviceType in new[]
                 {
                     typeof(SqlAstNormalizer), typeof(SqlAstValidator),
                     typeof(SqlParameterAllocator)
                 })
        {
            var constructor = Assert.Single(serviceType.GetConstructors(
                BindingFlags.Instance | BindingFlags.Public |
                BindingFlags.DeclaredOnly));
            Assert.Empty(constructor.GetParameters());
            Assert.Empty(serviceType.GetProperties(
                BindingFlags.Instance | BindingFlags.Static |
                BindingFlags.Public | BindingFlags.DeclaredOnly));
        }

        AssertTask8PublicMethod(
            typeof(SqlAstNormalizer), nameof(SqlAstNormalizer.Normalize),
            typeof(SqlExpression), typeof(SqlExpression));
        AssertTask8PublicMethod(
            typeof(SqlAstNormalizer), nameof(SqlAstNormalizer.Normalize),
            typeof(SqlStatement), typeof(SqlStatement));
        AssertTask8PublicMethod(
            typeof(SqlAstNormalizer), nameof(SqlAstNormalizer.Normalize),
            typeof(MigrationPlan), typeof(MigrationPlan));
        Assert.Equal(3, typeof(SqlAstNormalizer).GetMethods(
            BindingFlags.Instance | BindingFlags.Public |
            BindingFlags.DeclaredOnly).Length);

        AssertTask8PublicMethod(
            typeof(SqlAstValidator), nameof(SqlAstValidator.Validate),
            typeof(IReadOnlyList<SqlAstDiagnostic>), typeof(SqlNode));
        Assert.Single(typeof(SqlAstValidator).GetMethods(
            BindingFlags.Instance | BindingFlags.Public |
            BindingFlags.DeclaredOnly));

        AssertTask8PublicMethod(
            typeof(SqlParameterAllocator), nameof(SqlParameterAllocator.Allocate),
            typeof(IReadOnlyList<SqlParameterSlot>), typeof(SqlNode));
        AssertTask8PublicMethod(
            typeof(SqlParameterAllocator), nameof(SqlParameterAllocator.Bind),
            typeof(IReadOnlyList<BoundParameter>),
            typeof(IReadOnlyList<SqlParameterSlot>), typeof(ParameterBag));
        Assert.Equal(2, typeof(SqlParameterAllocator).GetMethods(
            BindingFlags.Instance | BindingFlags.Public |
            BindingFlags.DeclaredOnly).Length);

        var slotConstructor = Assert.Single(
            typeof(SqlParameterSlot).GetConstructors(
                BindingFlags.Instance | BindingFlags.Public |
                BindingFlags.NonPublic | BindingFlags.DeclaredOnly));
        Assert.True(slotConstructor.IsAssembly);
        Assert.Equal(
            new[] { typeof(int), typeof(string), typeof(ParameterDefinition) },
            slotConstructor.GetParameters()
                .Select(parameter => parameter.ParameterType).ToArray());
        Assert.Equal(
            new[] { "ordinal", "placeholder", "definition" },
            slotConstructor.GetParameters()
                .Select(parameter => parameter.Name).ToArray());
        Assert.All(slotConstructor.GetParameters(), parameter =>
        {
            Assert.False(parameter.IsOptional);
            Assert.False(parameter.IsOut);
            Assert.False(parameter.ParameterType.IsByRef);
        });
        Assert.Empty(typeof(SqlParameterSlot).GetConstructors(
            BindingFlags.Instance | BindingFlags.Public |
            BindingFlags.DeclaredOnly));

        var slotProperties = typeof(SqlParameterSlot).GetProperties(
            BindingFlags.Instance | BindingFlags.Public |
            BindingFlags.DeclaredOnly);
        Assert.Equal(
            new[] { "Definition", "Ordinal", "Placeholder" },
            slotProperties.Select(property => property.Name)
                .OrderBy(name => name, StringComparer.Ordinal).ToArray());
        Assert.Equal(
            new[]
            {
                typeof(ParameterDefinition).FullName,
                typeof(int).FullName,
                typeof(string).FullName
            },
            slotProperties.OrderBy(property => property.Name, StringComparer.Ordinal)
                .Select(property => property.PropertyType.FullName).ToArray());
        Assert.All(slotProperties, property =>
        {
            Assert.NotNull(property.GetGetMethod(nonPublic: false));
            Assert.Null(property.GetSetMethod(nonPublic: true));
        });
        Assert.Equal(
            new[] { "get_Definition", "get_Ordinal", "get_Placeholder" },
            typeof(SqlParameterSlot).GetMethods(
                    BindingFlags.Instance | BindingFlags.Public |
                    BindingFlags.DeclaredOnly)
                .Select(method => method.Name)
                .OrderBy(name => name, StringComparer.Ordinal).ToArray());
    }

    [Fact]
    public void Task8_services_and_value_state_are_stateless_and_runtime_value_free()
    {
        var ownedTypes = Task8OwnedTypes();
        foreach (var serviceType in new[]
                 {
                     typeof(SqlAstNormalizer), typeof(SqlAstValidator),
                     typeof(SqlParameterAllocator)
                 })
        {
            Assert.Empty(serviceType.GetFields(
                BindingFlags.Instance | BindingFlags.Public |
                BindingFlags.NonPublic | BindingFlags.DeclaredOnly));
        }

        foreach (var type in ownedTypes)
        {
            foreach (var field in type.GetFields(
                         BindingFlags.Instance | BindingFlags.Static |
                         BindingFlags.Public | BindingFlags.NonPublic |
                         BindingFlags.DeclaredOnly))
            {
                Assert.True(
                    Task8FieldStateIsSafe(field),
                    $"{type.FullName}.{field.Name} contains mutable static " +
                    "or runtime-value state.");
            }

            foreach (var property in type.GetProperties(
                         BindingFlags.Instance | BindingFlags.Static |
                         BindingFlags.Public | BindingFlags.NonPublic |
                         BindingFlags.DeclaredOnly))
            {
                Assert.True(
                    Task8PropertyStateIsSafe(property),
                    $"{type.FullName}.{property.Name} contains " +
                    "runtime-value or untyped Value state.");
                var getter = property.GetGetMethod(nonPublic: true);
                var setter = property.GetSetMethod(nonPublic: true);
                if (getter?.IsStatic == true || setter?.IsStatic == true)
                {
                    Assert.Null(setter);
                }
            }
        }

        var bind = AssertTask8PublicMethod(
            typeof(SqlParameterAllocator), nameof(SqlParameterAllocator.Bind),
            typeof(IReadOnlyList<BoundParameter>),
            typeof(IReadOnlyList<SqlParameterSlot>), typeof(ParameterBag));
        var publicRuntimeBoundaries = new[]
            {
                typeof(SqlAstNormalizer), typeof(SqlAstValidator),
                typeof(SqlParameterAllocator), typeof(SqlParameterSlot)
            }
            .SelectMany(type => type.GetMethods(
                BindingFlags.Instance | BindingFlags.Static |
                BindingFlags.Public | BindingFlags.DeclaredOnly))
            .Where(method => Task8MemberSignatureTypes(method)
                .SelectMany(Task8TypeShape)
                .Any(IsTask8RuntimeValueType))
            .ToArray();
        Assert.Equal(new[] { Task8MethodKey(bind) },
            publicRuntimeBoundaries.Select(Task8MethodKey).Distinct().ToArray());

        var bindKey = Task8MethodKey(bind);
        foreach (var method in Task8OwnedMethods(ownedTypes))
        {
            var referencesRuntimeValue = ReadReferencedMembers(method)
                .SelectMany(Task8MemberSignatureTypes)
                .SelectMany(Task8TypeShape)
                .Any(IsTask8RuntimeValueType);
            if (referencesRuntimeValue)
            {
                Assert.Equal(bindKey, Task8MethodKey(method));
            }
        }
    }

    [Fact]
    public void Task8_has_no_task7_native_or_provider_dependency()
    {
        var ownedTypes = Task8OwnedTypes();
        var ownedSet = new HashSet<Type>(ownedTypes);

        foreach (var type in ownedTypes)
        {
            if (type.BaseType != null)
            {
                AssertTask8DependencyAllowed(type, type.BaseType, ownedSet);
            }
            foreach (var contract in type.GetInterfaces())
            {
                AssertTask8DependencyAllowed(type, contract, ownedSet);
            }
            foreach (var dependency in Task8MetadataDependencyTypes(type))
            {
                AssertTask8DependencyAllowed(type, dependency, ownedSet);
            }
            foreach (var member in Task8DeclaredMembers(type))
            {
                foreach (var dependency in Task8MemberSignatureTypes(member))
                {
                    AssertTask8DependencyAllowed(member, dependency, ownedSet);
                }
                foreach (var dependency in Task8MetadataDependencyTypes(member))
                {
                    AssertTask8DependencyAllowed(member, dependency, ownedSet);
                }
            }
        }

        foreach (var method in Task8OwnedMethods(ownedTypes))
        {
            Assert.False(
                Task8HasForbiddenMethodImplementation(method),
                $"{method.DeclaringType?.FullName}.{method.Name} uses " +
                "P/Invoke, native, unmanaged, or internal-call execution.");
            foreach (var dependency in Task8MethodBodyDependencyTypes(method))
            {
                AssertTask8DependencyAllowed(method, dependency, ownedSet);
            }
            foreach (var member in ReadReferencedMembers(method))
            {
                Assert.False(
                    Task8IsForbiddenBclMember(member),
                    $"{method.DeclaringType?.FullName}.{method.Name} uses " +
                    $"forbidden BCL member " +
                    $"{member.DeclaringType?.FullName}.{member.Name}.");
                foreach (var dependency in Task8MemberSignatureTypes(member))
                {
                    AssertTask8DependencyAllowed(method, dependency, ownedSet);
                }
            }
        }
    }

    [Fact]
    public void Task8_production_has_no_ast_depth_recursion_or_reflection()
    {
        var ownedTypes = Task8OwnedTypes();
        var methods = Task8OwnedMethods(ownedTypes);
        var methodsByKey = methods.ToDictionary(Task8MethodKey);
        var graph = methods.ToDictionary(
            Task8MethodKey,
            method => ReadReferencedMethods(method)
                .Select(Task8MethodKey)
                .Where(methodsByKey.ContainsKey)
                .Distinct()
                .ToArray());
        var recursiveKeys = graph.Keys
            .Where(key => Task8MethodCanReach(key, graph))
            .ToArray();

        var cursor = typeof(SqlAstValidator).Assembly.GetType(
            "Dos.ORM.SqlCompilation.SqlAstTraversalCursor",
            throwOnError: true)!;
        var nextCaseMethods = cursor.GetMethods(
                BindingFlags.Instance | BindingFlags.NonPublic |
                BindingFlags.DeclaredOnly)
            .Where(method => method.Name == "NextCase")
            .ToArray();
        Assert.True(nextCaseMethods.Length <= 1);
        if (recursiveKeys.Length != 0)
        {
            var nextCase = Assert.Single(nextCaseMethods);
            var allowedKey = Task8MethodKey(nextCase);
            Assert.Equal(new[] { allowedKey }, recursiveKeys);
            Assert.Equal(1, ReadReferencedMethods(nextCase)
                .Count(method => Task8MethodKey(method) == allowedKey));
        }

        foreach (var method in methods)
        {
            foreach (var referencedMember in ReadReferencedMembers(method))
            {
                Assert.False(
                    IsTask8ReflectionExecution(referencedMember),
                    $"{method.DeclaringType?.FullName}.{method.Name} uses " +
                    $"reflection API {referencedMember.DeclaringType?.FullName}." +
                    referencedMember.Name);
            }
        }
    }

    [Fact]
    public void Task8_owned_type_parser_accepts_legal_declarations_without_poison()
    {
        const string source =
            "// public class LineCommentPoison { }\n" +
            "/* internal struct BlockCommentPoison { } */\n" +
            "var regular = \"private class RegularStringPoison { }\";\n" +
            "var verbatim = @\"sealed class VerbatimStringPoison { }\";\n" +
            "var interpolated = $\"unsafe class InterpolatedStringPoison {{ }}\";\n" +
            "var raw = \"\"\"private class RawStringPoison { }\"\"\";\n" +
            "var rawInterpolated = $$\"\"\"class RawInterpolatedPoison { }\"\"\";\n" +
            "[Marker] unsafe public sealed partial class ModifierOrder { }\n" +
            "class ImplicitInternal { struct ImplicitPrivate { } }\n" +
            "record struct ImplicitRecord;\n" +
            "delegate void ImplicitDelegate();\n" +
            "void Constraints<T, U>() where T : class where U : class { }\n" +
            "var record = new object();\n";

        Assert.Equal(
            new[]
            {
                "<global>::ImplicitDelegate",
                "<global>::ImplicitInternal",
                "<global>::ImplicitPrivate",
                "<global>::ImplicitRecord",
                "<global>::ModifierOrder"
            },
            Task8DeclaredTypeNames(source)
                .OrderBy(name => name, StringComparer.Ordinal).ToArray());
    }

    [Fact]
    public void Task8_owned_type_identity_preserves_namespace_for_same_name_poison()
    {
        const string source =
            "namespace Dos.ORM.SqlCompilation { class SameName { } }\n" +
            "namespace Foreign.Namespace { class SameName { } }\n" +
            "class SameName { }\n";

        Assert.Equal(
            new[]
            {
                "<global>::SameName",
                "Dos.ORM.SqlCompilation::SameName",
                "Foreign.Namespace::SameName"
            },
            Task8DeclaredTypeNames(source)
                .OrderBy(identity => identity, StringComparer.Ordinal)
                .ToArray());

        Assert.Equal(
            new[] { "Dos.ORM.SqlCompilation::FileScoped" },
            Task8DeclaredTypeNames(
                "namespace Dos.ORM.SqlCompilation; class FileScoped { }"));
    }

    [Fact]
    public void Task8_dependency_allowlist_rejects_provider_cache_and_third_party_poison()
    {
        var stackAssembly = typeof(Stack<>).Assembly;
        var readOnlyCollectionAssembly =
            typeof(System.Collections.ObjectModel.ReadOnlyCollection<>).Assembly;
        Assert.True(Task8IsTrustedBclAssembly(stackAssembly));
        Assert.True(Task8IsTrustedBclAssembly(readOnlyCollectionAssembly));
        Assert.False(Task8IsTrustedBclAssembly(
            typeof(CompilationCoreTests).Assembly));

        var privateImplementationDetails = typeof(SqlNode).Assembly.GetType(
            "<PrivateImplementationDetails>",
            throwOnError: false);
        bool CompilerInfrastructureIdentity(
            bool isDosOrmAssembly = true,
            string namespaceName = "",
            bool isPublic = false,
            bool isNestedPublic = false,
            bool containerHasDeclaringType = false,
            string containerName = "<PrivateImplementationDetails>",
            bool containerIsCompilerGenerated = true,
            bool isContainer = true,
            bool isDirectNested = false,
            bool isValueType = false,
            string typeName = "<PrivateImplementationDetails>") =>
            Task8CompilerInfrastructureIdentityIsAllowed(
                isDosOrmAssembly,
                namespaceName,
                isPublic,
                isNestedPublic,
                containerHasDeclaringType,
                containerName,
                containerIsCompilerGenerated,
                isContainer,
                isDirectNested,
                isValueType,
                typeName);

        Assert.True(CompilerInfrastructureIdentity());
        Assert.True(CompilerInfrastructureIdentity(
            isContainer: false,
            isDirectNested: true,
            isValueType: true,
            typeName: "__StaticArrayInitTypeSize=16"));
        Assert.False(CompilerInfrastructureIdentity(isDosOrmAssembly: false));
        Assert.False(CompilerInfrastructureIdentity(
            namespaceName: "Dos.ORM"));
        Assert.False(CompilerInfrastructureIdentity(isPublic: true));
        Assert.False(CompilerInfrastructureIdentity(isNestedPublic: true));
        Assert.False(CompilerInfrastructureIdentity(
            containerHasDeclaringType: true));
        Assert.False(CompilerInfrastructureIdentity(
            containerName: "PrivateImplementationDetails"));
        Assert.False(CompilerInfrastructureIdentity(
            containerIsCompilerGenerated: false));
        Assert.False(CompilerInfrastructureIdentity(
            isContainer: false,
            isDirectNested: true,
            isValueType: false,
            typeName: "__StaticArrayInitTypeSize=16"));
        Assert.False(CompilerInfrastructureIdentity(
            isContainer: false,
            isDirectNested: true,
            isValueType: true,
            typeName: "StaticArrayInitTypeSize=16"));

        if (privateImplementationDetails != null)
        {
            Assert.True(Task8IsCompilerInfrastructure(
                privateImplementationDetails));
            Assert.All(
                privateImplementationDetails.GetNestedTypes(
                    BindingFlags.Public | BindingFlags.NonPublic),
                nested =>
                {
                    if (nested.IsValueType && nested.Name.StartsWith(
                            "__StaticArrayInitTypeSize=",
                            StringComparison.Ordinal))
                    {
                        Assert.True(Task8IsCompilerInfrastructure(nested));
                    }
                });
        }
        Assert.False(Task8IsCompilerInfrastructure(
            typeof(Task8CompilerGeneratedStatePoison)));
        Assert.False(Task8IsCompilerInfrastructure(
            typeof(SqlCompilationOptions)));
        Assert.False(Task8IsCompilerInfrastructure(
            typeof(SqlNode).Assembly.GetType(
                "Dos.ORM.Platform.DialectProfile",
                throwOnError: true)!));

        Assert.True(Task8DependencyIdentityIsAllowed(
            "Dos.ORM.SqlCompilation", "Owned.Support", isOwned: true,
            isGenericParameter: false, isDosOrmAssembly: true,
            isTrustedBclAssembly: false, isParameterDirection: false));
        Assert.True(Task8DependencyIdentityIsAllowed(
            "Dos.ORM.SqlAst", "Dos.ORM.SqlAst.ParameterExpression",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: true, isTrustedBclAssembly: false,
            isParameterDirection: false));
        Assert.True(Task8DependencyIdentityIsAllowed(
            "System.Collections.Generic",
            "System.Collections.Generic.IReadOnlyList`1",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: false, isTrustedBclAssembly: true,
            isParameterDirection: false));
        Assert.True(Task8DependencyIdentityIsAllowed(
            "System.Collections.Generic",
            "System.Collections.Generic.Stack`1",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: false,
            isTrustedBclAssembly:
                Task8IsTrustedBclAssembly(stackAssembly),
            isParameterDirection: false));
        Assert.True(Task8DependencyIdentityIsAllowed(
            "System.Collections.ObjectModel",
            "System.Collections.ObjectModel.ReadOnlyCollection`1",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: false,
            isTrustedBclAssembly:
                Task8IsTrustedBclAssembly(readOnlyCollectionAssembly),
            isParameterDirection: false));
        Assert.True(Task8DependencyIdentityIsAllowed(
            "System", "System.IComparable",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: false, isTrustedBclAssembly: true,
            isParameterDirection: false));
        Assert.True(Task8DependencyIdentityIsAllowed(
            "System", "System.IConvertible",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: false, isTrustedBclAssembly: true,
            isParameterDirection: false));
        Assert.True(Task8DependencyIdentityIsAllowed(
            "System.Runtime.Serialization",
            "System.Runtime.Serialization.ISerializable",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: false, isTrustedBclAssembly: true,
            isParameterDirection: false));
        Assert.True(Task8DependencyIdentityIsAllowed(
            "System.Runtime.CompilerServices",
            "System.Runtime.CompilerServices.RuntimeHelpers",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: false, isTrustedBclAssembly: true,
            isParameterDirection: false));
        foreach (var debuggerMetadataType in new[]
                 {
                     "System.Diagnostics.DebuggerBrowsableAttribute",
                     "System.Diagnostics.DebuggerBrowsableState",
                     "System.Diagnostics.DebuggerDisplayAttribute",
                     "System.Diagnostics.DebuggerHiddenAttribute",
                     "System.Diagnostics.DebuggerNonUserCodeAttribute",
                     "System.Diagnostics.DebuggerStepThroughAttribute"
                 })
        {
            Assert.True(Task8DependencyIdentityIsAllowed(
                "System.Diagnostics", debuggerMetadataType,
                isOwned: false, isGenericParameter: false,
                isDosOrmAssembly: false, isTrustedBclAssembly: true,
                isParameterDirection: false));
        }
        foreach (var parameterMetadataType in new[]
                 {
                     "System.Runtime.InteropServices.InAttribute",
                     "System.Runtime.InteropServices.OutAttribute",
                     "System.Runtime.InteropServices.OptionalAttribute",
                     "System.Runtime.InteropServices.DefaultParameterValueAttribute"
                 })
        {
            Assert.True(Task8DependencyIdentityIsAllowed(
                "System.Runtime.InteropServices", parameterMetadataType,
                isOwned: false, isGenericParameter: false,
                isDosOrmAssembly: false, isTrustedBclAssembly: true,
                isParameterDirection: false));
        }
        Assert.True(Task8DependencyIdentityIsAllowed(
            "System.Reflection", "System.Reflection.DefaultMemberAttribute",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: false, isTrustedBclAssembly: true,
            isParameterDirection: false));
        Assert.True(Task8DependencyIdentityIsAllowed(
            "System.Data", "System.Data.ParameterDirection",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: false, isTrustedBclAssembly: false,
            isParameterDirection: true));

        var poison = new[]
        {
            ("Dos.ORM.SqlCompilation", "Dos.ORM.SqlCompilation.SqlCompilationOptions", true, false),
            ("Dos.ORM.Platform", "Dos.ORM.Platform.DialectProfile", true, false),
            ("Dos.ORM.SqlAst", "Dos.ORM.SqlAst.NativeSqlText", true, false),
            ("System.Data", "System.Data.DbType", false, true),
            ("System", "System.IServiceProvider", false, true),
            ("System", "System.Uri", false, true),
            ("System", "System.Console", false, true),
            ("System", "System.Activator", false, true),
            ("System", "System.AppDomain", false, true),
            ("System", "System.Environment", false, true),
            ("System", "System.RuntimeMethodHandle", false, true),
            ("System.IO", "System.IO.Stream", false, true),
            ("System.IO", "System.IO.FileStream", false, true),
            ("System.Net.Http", "System.Net.Http.HttpClient", false, true),
            ("System.Reflection", "System.Reflection.MethodInfo", false, true),
            ("System.Data.Common", "System.Data.Common.DbConnection", false, true),
            ("System.Diagnostics", "System.Diagnostics.Trace", false, true),
            ("System.Linq.Expressions", "System.Linq.Expressions.Expression", false, true),
            ("System.Runtime.Loader", "System.Runtime.Loader.AssemblyLoadContext", false, true),
            ("System.Runtime.Serialization", "System.Runtime.Serialization.FormatterServices", false, true),
            ("System.Runtime.CompilerServices", "System.Runtime.CompilerServices.CallSite", false, true),
            ("System.Runtime.CompilerServices", "System.Runtime.CompilerServices.CallSite`1", false, true),
            ("System.Runtime.CompilerServices", "System.Runtime.CompilerServices.CallSiteBinder", false, true),
            ("System.ServiceProcess", "System.ServiceProcess.ServiceController", false, true),
            ("lcpi.data.oledb", "lcpi.data.oledb.OleDbConnection", false, false),
            ("FastExpressionCompiler", "FastExpressionCompiler.ExpressionCompiler", false, false),
            ("Microsoft.Extensions.Caching.Memory", "Microsoft.Extensions.Caching.Memory.MemoryCache", false, false),
            ("Microsoft.Extensions.DependencyInjection", "Microsoft.Extensions.DependencyInjection.ServiceProvider", false, false),
            ("Microsoft.Extensions.Logging", "Microsoft.Extensions.Logging.ILogger", false, false),
            ("ThirdParty.Provider", "ThirdParty.Provider.Connection", false, false)
        };
        foreach (var item in poison)
        {
            Assert.False(Task8DependencyIdentityIsAllowed(
                item.Item1, item.Item2,
                isOwned: false, isGenericParameter: false,
                isDosOrmAssembly: item.Item3,
                isTrustedBclAssembly: item.Item4,
                isParameterDirection: false));
        }

        Assert.False(Task8DependencyIdentityIsAllowed(
            "System.Collections.Generic", "Spoofed.System.List`1",
            isOwned: false, isGenericParameter: false,
            isDosOrmAssembly: false, isTrustedBclAssembly: false,
            isParameterDirection: false));
    }

    [Fact]
    public void Task8_dependency_closure_rejects_hidden_metadata_and_native_poison()
    {
        var localMethod = typeof(CompilationCoreTests).GetMethod(
            nameof(Task8LocalProviderDependencyPoison),
            BindingFlags.Static | BindingFlags.NonPublic)!;
        var localDependencies = Task8MethodBodyDependencyTypes(localMethod)
            .SelectMany(Task8TypeShape)
            .ToArray();
        Assert.Contains(typeof(Task8LocalProviderPoison), localDependencies);

        var catchMethod = typeof(CompilationCoreTests).GetMethod(
            nameof(Task8CatchProviderDependencyPoison),
            BindingFlags.Static | BindingFlags.NonPublic)!;
        var catchDependencies = Task8MethodBodyDependencyTypes(catchMethod)
            .SelectMany(Task8TypeShape)
            .ToArray();
        Assert.Contains(
            typeof(Task8CatchProviderPoisonException),
            catchDependencies);

        var constraintDependencies = Task8MetadataDependencyTypes(
                typeof(Task8GenericConstraintDependencyPoison<>))
            .SelectMany(Task8TypeShape)
            .ToArray();
        Assert.Contains(
            typeof(Task8GenericConstraintProviderPoison),
            constraintDependencies);

        var attributeDependencies = Task8MetadataDependencyTypes(
                typeof(Task8CustomAttributeDependencyPoison))
            .SelectMany(Task8TypeShape)
            .ToArray();
        Assert.Contains(
            typeof(Task8ProviderPoisonAttribute),
            attributeDependencies);
        Assert.Contains(
            typeof(Task8CustomAttributeProviderPoison),
            attributeDependencies);

        var noOwnedTypes = new HashSet<Type>();
        Assert.True(IsTask8ForbiddenDependency(
            typeof(Task8LocalProviderPoison), noOwnedTypes));
        Assert.True(IsTask8ForbiddenDependency(
            typeof(Task8CatchProviderPoisonException), noOwnedTypes));
        Assert.True(IsTask8ForbiddenDependency(
            typeof(Task8GenericConstraintProviderPoison), noOwnedTypes));
        Assert.True(IsTask8ForbiddenDependency(
            typeof(Task8ProviderPoisonAttribute), noOwnedTypes));

        var pinvoke = typeof(CompilationCoreTests).GetMethod(
            nameof(Task8PInvokeDependencyPoison),
            BindingFlags.Static | BindingFlags.NonPublic)!;
        Assert.True(Task8HasForbiddenMethodImplementation(pinvoke));

        Assert.True(Task8IsForbiddenIlOpcode(OpCodes.Calli));
        Assert.False(Task8IsForbiddenIlOpcode(OpCodes.Call));

        foreach (var poisonName in new[]
                 {
                     nameof(Task8RunClassConstructorPoison),
                     nameof(Task8GetUninitializedObjectPoison)
                 })
        {
            var poisonMethod = typeof(CompilationCoreTests).GetMethod(
                poisonName,
                BindingFlags.Static | BindingFlags.NonPublic)!;
            Assert.Contains(
                ReadReferencedMembers(poisonMethod),
                Task8IsForbiddenBclMember);
        }
        var allowedRuntimeHelper = typeof(CompilationCoreTests).GetMethod(
            nameof(Task8RuntimeHelpersGetHashCodeAllowed),
            BindingFlags.Static | BindingFlags.NonPublic)!;
        Assert.DoesNotContain(
            ReadReferencedMembers(allowedRuntimeHelper),
            Task8IsForbiddenBclMember);
    }

    [Fact]
    public void Task8_reflection_gate_rejects_type_factory_and_delegate_poison()
    {
        var poisonNames = new[]
        {
            nameof(Task8TypeGetTypePoison),
            nameof(Task8MakeGenericTypePoison),
            nameof(Task8MakeArrayTypePoison),
            nameof(Task8MakeByRefTypePoison),
            nameof(Task8MakePointerTypePoison),
            nameof(Task8CreateDelegatePoison)
        };
        foreach (var name in poisonNames)
        {
            var method = typeof(CompilationCoreTests).GetMethod(
                name,
                BindingFlags.Static | BindingFlags.NonPublic)!;
            Assert.Contains(
                ReadReferencedMembers(method),
                IsTask8ReflectionExecution);
        }

        var allowed = typeof(CompilationCoreTests).GetMethod(
            nameof(Task8GetTypeFromHandleAllowed),
            BindingFlags.Static | BindingFlags.NonPublic)!;
        Assert.DoesNotContain(
            ReadReferencedMembers(allowed),
            IsTask8ReflectionExecution);
    }

    [Fact]
    public void Task8_reflection_gate_rejects_object_get_type_poison()
    {
        var poison = typeof(CompilationCoreTests).GetMethod(
            nameof(Task8ObjectGetTypePoison),
            BindingFlags.Static | BindingFlags.NonPublic)!;

        Assert.Contains(
            ReadReferencedMembers(poison),
            IsTask8ReflectionExecution);

        var allowed = typeof(CompilationCoreTests).GetMethod(
            nameof(Task8GetTypeFromHandleAllowed),
            BindingFlags.Static | BindingFlags.NonPublic)!;
        Assert.DoesNotContain(
            ReadReferencedMembers(allowed),
            IsTask8ReflectionExecution);
    }

    [Fact]
    public void Task8_compiler_generated_fields_do_not_bypass_state_gate()
    {
        var poisonFields = typeof(Task8CompilerGeneratedStatePoison)
            .GetFields(
                BindingFlags.Static | BindingFlags.Public |
                BindingFlags.NonPublic | BindingFlags.DeclaredOnly);
        Assert.Equal(2, poisonFields.Length);
        Assert.All(poisonFields, field =>
            Assert.False(Task8FieldStateIsSafe(field)));

        var readonlyContainer = Assert.Single(
            typeof(Task8CompilerGeneratedReadonlyStatePoison).GetFields(
                BindingFlags.Static | BindingFlags.Public |
                BindingFlags.NonPublic | BindingFlags.DeclaredOnly));
        Assert.True(readonlyContainer.IsInitOnly);
        Assert.False(Task8FieldStateIsSafe(readonlyContainer));
    }

    [Fact]
    public void Task8_mutable_interface_static_state_is_rejected()
    {
        var mutableInterface = Assert.Single(
            typeof(Task8CompilerGeneratedMutableInterfaceStatePoison)
                .GetFields(
                    BindingFlags.Static | BindingFlags.Public |
                    BindingFlags.NonPublic | BindingFlags.DeclaredOnly));

        Assert.True(mutableInterface.IsInitOnly);
        Assert.Equal(typeof(ICollection<int>), mutableInterface.FieldType);
        Assert.False(Task8FieldStateIsSafe(mutableInterface));
    }

    [Fact]
    public void Task8_object_value_state_is_rejected_exactly()
    {
        var valueField = Assert.Single(
            typeof(Task8ObjectValueFieldStatePoison).GetFields(
                BindingFlags.Instance | BindingFlags.Public |
                BindingFlags.NonPublic | BindingFlags.DeclaredOnly));
        var valueProperty = Assert.Single(
            typeof(Task8ObjectValuePropertyStatePoison).GetProperties(
                BindingFlags.Instance | BindingFlags.Public |
                BindingFlags.NonPublic | BindingFlags.DeclaredOnly));

        Assert.Equal("Value", valueField.Name);
        Assert.Equal(typeof(object), valueField.FieldType);
        Assert.False(Task8FieldStateIsSafe(valueField));
        Assert.Equal("Value", valueProperty.Name);
        Assert.Equal(typeof(object), valueProperty.PropertyType);
        Assert.False(Task8PropertyStateIsSafe(valueProperty));

        var nullValue = typeof(SqlAstValidator).Assembly.GetType(
                "Dos.ORM.SqlCompilation.SqlAstCollectionInspectionLedger",
                throwOnError: true)!
            .GetField(
                "NullValue",
                BindingFlags.Static | BindingFlags.NonPublic)!;
        Assert.True(Task8FieldStateIsSafe(nullValue));

        var holder = Assert.Single(
            typeof(Task8ObjectHolderStateAllowed).GetProperties(
                BindingFlags.Instance | BindingFlags.Public |
                BindingFlags.NonPublic | BindingFlags.DeclaredOnly));
        Assert.Equal(typeof(object), holder.PropertyType);
        Assert.NotEqual("Value", holder.Name);
        Assert.True(Task8PropertyStateIsSafe(holder));
    }

    [Fact]
    public void Closed_catalog_covers_all_93_concrete_nodes()
    {
        var nodes = AstSamples.AllConcreteNodes();
        Assert.Equal(93, nodes.Count);
        Assert.Equal(93, nodes.Select(node => node.GetType()).Distinct().ToArray().Length);

        var validator = new SqlAstValidator();
        foreach (var node in nodes)
        {
            Assert.DoesNotContain(validator.Validate(node), diagnostic =>
                diagnostic.Code == "AST_UNKNOWN_NODE");
        }
    }

    [Fact]
    public void Missing_required_child_has_exact_code_message_path()
    {
        var expression = new BinaryExpression(
            BooleanExpression.True, SqlBinaryOperator.And, BooleanExpression.False);
        SetAutoProperty(expression, nameof(BinaryExpression.Left), null);

        var diagnostic = Assert.Single(new SqlAstValidator().Validate(expression));
        Assert.Equal("AST_REQUIRED_CHILD_MISSING", diagnostic.Code);
        Assert.Equal("SQL AST contains a missing required child.", diagnostic.Message);
        Assert.Equal("$.Left", diagnostic.Path);
    }

    [Fact]
    public void Traversal_depth_128_is_accepted()
    {
        Assert.DoesNotContain(
            new SqlAstValidator().Validate(UnaryChain(128)),
            diagnostic => diagnostic.Code == "AST_TRAVERSAL_DEPTH_EXCEEDED");
    }

    [Fact]
    public void Traversal_depth_129_is_rejected()
    {
        var diagnostic = Assert.Single(
            new SqlAstValidator().Validate(UnaryChain(129)),
            item => item.Code == "AST_TRAVERSAL_DEPTH_EXCEEDED");
        Assert.Equal("SQL AST traversal exceeds maximum depth 128.", diagnostic.Message);
        Assert.Equal("$" + string.Concat(Enumerable.Repeat(".Operand", 129)), diagnostic.Path);
    }

    [Fact]
    public void Traversal_occurrence_4096_is_accepted()
    {
        Assert.DoesNotContain(
            new SqlAstValidator().Validate(WideIn(4094)),
            diagnostic => diagnostic.Code == "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED");
    }

    [Fact]
    public void Traversal_occurrence_4097_is_rejected()
    {
        var diagnostic = Assert.Single(
            new SqlAstValidator().Validate(WideIn(4095)),
            item => item.Code == "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED");
        Assert.Equal("SQL AST traversal exceeds maximum node occurrence count 4096.", diagnostic.Message);
        Assert.Equal("$.Values[4094]", diagnostic.Path);
    }

    [Fact]
    public void Traversal_probes_but_does_not_schedule_or_visit_the_prospective_4097th_non_null_child()
    {
        var expression = new InExpression(
            BooleanExpression.True, Array.Empty<SqlExpression>());
        var values = new IndexedSlotList<SqlExpression>(
            count: 4095,
            valueFactory: index => index == 4094
                ? new UnknownSqlExpression()
                : BooleanExpression.False,
            throwOnSecondRead: true);
        SetAutoProperty(expression, nameof(InExpression.Values), values);

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum node occurrence count 4096.\u001f$.Values[4094]"
            },
            Snapshot(new SqlAstValidator().Validate(expression)));
        Assert.Equal(1, values.ReadsAt(4094));
        Assert.Equal(4095, values.TotalReads);
    }

    [Fact]
    public void Traversal_collection_slot_16384_is_accepted()
    {
        var aliases = new IndexedSlotList<SqlIdentifier>(
            16383,
            index => AstSamples.Id("C" + index),
            throwOnSecondRead: true);
        var query = new SelectStatement(new[]
        {
            new SelectProjection(new WildcardExpression())
        });
        var cte = new CommonTableExpression(
            AstSamples.Id("Cte"), query, new[] { AstSamples.Id("C0") });
        SetAutoProperty(cte, nameof(CommonTableExpression.Columns), aliases);

        Assert.Empty(new SqlAstValidator().Validate(cte));
        Assert.Equal(16383, aliases.TotalReads);
    }

    [Fact]
    public void Traversal_collection_slot_16385_is_terminal_before_reading_the_slot()
    {
        var aliases = new IndexedSlotList<SqlIdentifier>(
            int.MaxValue,
            index => AstSamples.Id("C" + index),
            poisonIndex: 16384,
            throwOnSecondRead: true);
        var query = new SelectStatement(new[]
        {
            new SelectProjection(new UnknownSqlExpression())
        });
        var cte = new CommonTableExpression(
            AstSamples.Id("Cte"), query, new[] { AstSamples.Id("C0") });
        SetAutoProperty(cte, nameof(CommonTableExpression.Columns), aliases);

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.Columns[16384]"
            },
            Snapshot(new SqlAstValidator().Validate(cte)));
        Assert.False(aliases.PoisonIndexWasRead);
        Assert.Equal(16383, aliases.HighestReadIndex);
        Assert.Equal(16384, aliases.TotalReads);
    }

    [Fact]
    public void Collection_slot_budget_is_global_and_counts_logical_collection_occurrences()
    {
        var shared = new IndexedSlotList<SqlIdentifier>(
            8193, index => AstSamples.Id("C" + index));
        var columns = new ForeignKeyColumnSet(
            new[] { AstSamples.Id("L") },
            new[] { AstSamples.Id("R") });
        SetAutoProperty(columns, nameof(ForeignKeyColumnSet.LocalColumns), shared);
        SetAutoProperty(columns, nameof(ForeignKeyColumnSet.ReferencedColumns), shared);

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.ReferencedColumns[8191]"
            },
            Snapshot(new SqlAstValidator().Validate(columns)));
        Assert.Equal(16384, shared.TotalReads);
    }

    [Fact]
    public void Null_collection_items_count_toward_the_slot_limit()
    {
        var local = new IndexedSlotList<SqlIdentifier>(
            16383,
            index => AstSamples.Id("L" + index),
            throwOnSecondRead: true);
        var referenced = new IndexedSlotList<SqlIdentifier>(
            2,
            index => index == 0 ? null! : AstSamples.Id("poison"),
            poisonIndex: 1,
            throwOnSecondRead: true);
        var columns = new ForeignKeyColumnSet(
            new[] { AstSamples.Id("L") },
            new[] { AstSamples.Id("R") });
        SetAutoProperty(columns, nameof(ForeignKeyColumnSet.LocalColumns), local);
        SetAutoProperty(
            columns, nameof(ForeignKeyColumnSet.ReferencedColumns), referenced);

        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_NULL_ITEM\u001fSQL AST collection contains a null item.\u001f$.ReferencedColumns[0]",
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.ReferencedColumns[1]"
            },
            Snapshot(new SqlAstValidator().Validate(columns)));
        Assert.False(referenced.PoisonIndexWasRead);
        Assert.Equal(16383, local.TotalReads);
        Assert.Equal(1, referenced.TotalReads);
    }

    [Fact]
    public void Null_at_node_boundary_does_not_consume_a_node_occurrence()
    {
        var values = new IndexedSlotList<SqlExpression>(
            4096,
            index => index == 4094 ? null! : BooleanExpression.False,
            throwOnSecondRead: true);
        var expression = new InExpression(
            BooleanExpression.True, Array.Empty<SqlExpression>());
        SetAutoProperty(expression, nameof(InExpression.Values), values);

        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_NULL_ITEM\u001fSQL AST collection contains a null item.\u001f$.Values[4094]",
                "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum node occurrence count 4096.\u001f$.Values[4095]"
            },
            Snapshot(new SqlAstValidator().Validate(expression)));
        Assert.Equal(4096, values.TotalReads);
    }

    [Fact]
    public void Collection_observation_is_shared_by_local_validation_and_child_traversal()
    {
        var values = new IndexedSlotList<SqlExpression>(
            1,
            _ => new UnknownSqlExpression(),
            throwOnSecondRead: true);
        var expression = new InExpression(
            BooleanExpression.True, Array.Empty<SqlExpression>());
        SetAutoProperty(expression, nameof(InExpression.Values), values);

        Assert.Equal(
            new[]
            {
                "AST_UNKNOWN_NODE\u001fSQL AST contains an unknown node subtype.\u001f$.Values[0]"
            },
            Snapshot(new SqlAstValidator().Validate(expression)));
        Assert.Equal(1, values.TotalReads);
    }

    [Fact]
    public void Collection_local_diagnostics_precede_child_diagnostics()
    {
        var values = new IndexedSlotList<SqlExpression>(
            2,
            index => index == 0 ? new UnknownSqlExpression() : null!,
            throwOnSecondRead: true);
        var expression = new InExpression(
            BooleanExpression.True, Array.Empty<SqlExpression>());
        SetAutoProperty(expression, nameof(InExpression.Values), values);

        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_NULL_ITEM\u001fSQL AST collection contains a null item.\u001f$.Values[1]",
                "AST_UNKNOWN_NODE\u001fSQL AST contains an unknown node subtype.\u001f$.Values[0]"
            },
            Snapshot(new SqlAstValidator().Validate(expression)));
        Assert.Equal(2, values.TotalReads);
    }

    [Fact]
    public void Collection_slot_limit_is_final_and_skips_dependent_rules_and_later_children()
    {
        var local = new IndexedSlotList<SqlIdentifier>(
            16383,
            index => AstSamples.Id("L" + index),
            throwOnSecondRead: true);
        var referenced = new IndexedSlotList<SqlIdentifier>(
            2,
            index => AstSamples.Id("R" + index),
            poisonIndex: 1,
            throwOnSecondRead: true);
        var columns = new ForeignKeyColumnSet(
            new[] { AstSamples.Id("L") },
            new[] { AstSamples.Id("R") });
        SetAutoProperty(columns, nameof(ForeignKeyColumnSet.LocalColumns), local);
        SetAutoProperty(
            columns, nameof(ForeignKeyColumnSet.ReferencedColumns), referenced);
        var actions = new ReferentialActions(
            ReferentialAction.NoAction, ReferentialAction.NoAction);
        SetAutoProperty(
            actions, nameof(ReferentialActions.OnUpdate), (ReferentialAction)999);
        var foreignKey = new ForeignKeyDefinition(
            AstSamples.Id("FK"), AstSamples.ObjectName("Parent"), columns, actions);

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.Columns.ReferencedColumns[1]"
            },
            Snapshot(new SqlAstValidator().Validate(foreignKey)));
        Assert.False(referenced.PoisonIndexWasRead);
        Assert.Equal(16383, local.TotalReads);
        Assert.Equal(1, referenced.TotalReads);
    }

    [Fact]
    public void Collection_terminal_is_final_before_later_scalar_and_property_rules()
    {
        var boundaries = new IndexedSlotList<SqlExpression>(
            int.MaxValue,
            _ => BooleanExpression.False,
            poisonIndex: 16384,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var keyset = new KeysetPageSpec(
            new[] { BooleanExpression.True }, 1);
        SetAutoProperty(keyset, nameof(KeysetPageSpec.Boundaries), boundaries);
        SetAutoProperty(keyset, nameof(KeysetPageSpec.Limit), 0);

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.Boundaries[16384]"
            },
            Snapshot(new SqlAstValidator().Validate(keyset)));
        Assert.False(boundaries.PoisonIndexWasRead);
        Assert.Equal(1, boundaries.CountReads);
        Assert.Equal(16384, boundaries.TotalReads);

        var arguments = new IndexedSlotList<SqlExpression>(
            int.MaxValue,
            _ => BooleanExpression.False,
            poisonIndex: 16384,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var function = new FunctionExpression(
            SemanticFunctions.Concat,
            new[] { BooleanExpression.True, BooleanExpression.False });
        SetAutoProperty(function, nameof(FunctionExpression.Arguments), arguments);
        SetAutoProperty(function, nameof(FunctionExpression.Function), null);

        Assert.Equal(
            new[]
            {
                "AST_FUNCTION_NOT_REGISTERED\u001fFunction must use the registered semantic catalog instance.\u001f$.Function",
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.Arguments[16384]"
            },
            Snapshot(new SqlAstValidator().Validate(function)));
        Assert.False(arguments.PoisonIndexWasRead);
        Assert.Equal(1, arguments.CountReads);
        Assert.Equal(16384, arguments.TotalReads);
    }

    [Fact]
    public void Collection_terminal_does_not_observe_later_select_or_upsert_collections()
    {
        var projection = new SelectProjection(BooleanExpression.True);
        var terminalProjections = new IndexedSlotList<SelectProjection>(
            int.MaxValue,
            _ => projection,
            poisonIndex: 16384,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var laterGroupBy = new IndexedSlotList<SqlExpression>(
            1, _ => BooleanExpression.False);
        var laterOrderBy = new IndexedSlotList<OrderByExpression>(
            1,
            _ => new OrderByExpression(
                BooleanExpression.True, SqlSortDirection.Ascending));
        var select = new SelectStatement(new[] { projection });
        SetAutoProperty(
            select, nameof(SelectStatement.Projections), terminalProjections);
        SetAutoProperty(select, nameof(SelectStatement.GroupBy), laterGroupBy);
        SetAutoProperty(select, nameof(SelectStatement.OrderBy), laterOrderBy);

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.Projections[16384]"
            },
            Snapshot(new SqlAstValidator().Validate(select)));
        Assert.Equal(0, laterGroupBy.CountReads);
        Assert.Equal(0, laterOrderBy.CountReads);

        var conflictKey = AstSamples.Id("Id");
        var insertAssignment = new SqlAssignment(
            conflictKey, BooleanExpression.True);
        var updateAssignment = new SqlAssignment(
            AstSamples.Id("Value"), BooleanExpression.False);
        var terminalConflictKeys = new IndexedSlotList<SqlIdentifier>(
            int.MaxValue,
            _ => conflictKey,
            poisonIndex: 16384,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var laterInserts = new IndexedSlotList<SqlAssignment>(
            1, _ => insertAssignment);
        var laterUpdates = new IndexedSlotList<SqlAssignment>(
            1, _ => updateAssignment);
        var upsert = new UpsertStatement(
            AstSamples.ObjectName("T"),
            new[] { conflictKey },
            new[] { insertAssignment },
            new[] { updateAssignment });
        SetAutoProperty(
            upsert, nameof(UpsertStatement.ConflictKeys), terminalConflictKeys);
        SetAutoProperty(
            upsert, nameof(UpsertStatement.InsertAssignments), laterInserts);
        SetAutoProperty(
            upsert, nameof(UpsertStatement.UpdateAssignments), laterUpdates);
        SetAutoProperty(upsert, nameof(UpsertStatement.Policy), (ConflictPolicy)999);

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.ConflictKeys[16384]"
            },
            Snapshot(new SqlAstValidator().Validate(upsert)));
        Assert.Equal(0, laterInserts.CountReads);
        Assert.Equal(0, laterUpdates.CountReads);
    }

    [Fact]
    public void Collection_terminal_contract_uses_a_local_control_signal()
    {
        var contextType = typeof(SqlAstValidator).GetNestedType(
            "ValidationContext", BindingFlags.NonPublic);
        Assert.NotNull(contextType);
        var signalType = contextType!.GetNestedType(
            "TerminalCollectionSignalException", BindingFlags.NonPublic);
        Assert.NotNull(signalType);
        var stopOnIssue = contextType.GetMethod(
            "StopOnTraversalIssue",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(stopOnIssue);
        var validateOccurrence = contextType.GetMethod(
            "ValidateOccurrence",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(validateOccurrence);
        Assert.Contains(
            validateOccurrence!.GetMethodBody()!.ExceptionHandlingClauses,
            clause => clause.Flags == ExceptionHandlingClauseOptions.Clause &&
                      clause.CatchType == signalType);

        var ledgerType = typeof(SqlAstValidator).Assembly.GetType(
            "Dos.ORM.SqlCompilation.SqlAstCollectionInspectionLedger",
            throwOnError: true)!;
        var tryObserve = Assert.Single(
            ledgerType.GetMethods(BindingFlags.Instance | BindingFlags.NonPublic),
            method => method.Name == "TryObserve");
        Assert.Contains(
            ReadReferencedMethods(tryObserve),
            method => method.Name == "Invoke" &&
                      method.DeclaringType?.IsGenericType == true &&
                      method.DeclaringType.GetGenericTypeDefinition() ==
                          typeof(Action<>));

        var addTraversalIssue = contextType.GetMethod(
            "AddTraversalIssue",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(addTraversalIssue);
        var localObservationMethods = contextType
            .GetMethods(BindingFlags.Instance | BindingFlags.NonPublic)
            .Where(method => ReadReferencedMethods(method).Any(
                referenced => referenced is MethodInfo referencedMethod &&
                              referencedMethod.IsGenericMethod &&
                              referencedMethod.GetGenericMethodDefinition() ==
                                  tryObserve))
            .ToArray();
        Assert.NotEmpty(localObservationMethods);
        foreach (var method in localObservationMethods)
        {
            var references = ReadReferencedMethods(method).ToArray();
            Assert.Contains(stopOnIssue!, references);
            Assert.DoesNotContain(addTraversalIssue!, references);
        }
    }

    [Fact]
    public void Deferred_resolution_is_ast_property_getter_free()
    {
        var contextType = typeof(SqlAstValidator).GetNestedType(
            "ValidationContext", BindingFlags.NonPublic)!;
        var resolverMethods = new[]
        {
            "ComputeSelectCoreWidth",
            "ResolveSelectKeysetPolicies",
            "ResolveUpsertAssignmentShape",
            "ResolveTableCrossReferences",
            "TryAppendReferences",
            "TryAppendReferentialAction"
        };

        foreach (var methodName in resolverMethods)
        {
            var method = contextType.GetMethod(
                methodName,
                BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.NotNull(method);
            var astGetters = ReadReferencedMethods(method!)
                .Where(referenced =>
                    referenced.Name.StartsWith("get_", StringComparison.Ordinal) &&
                    referenced.DeclaringType?.Namespace == "Dos.ORM.SqlAst")
                .Select(referenced =>
                    referenced.DeclaringType!.Name + "." + referenced.Name)
                .Distinct(StringComparer.Ordinal)
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToArray();
            Assert.True(
                astGetters.Length == 0,
                methodName + " reads SQL AST properties during deferred resolution: " +
                string.Join(", ", astGetters));
        }
    }

    [Fact]
    public void Terminal_preserves_deferred_diagnostics_from_previously_closed_independent_subtree()
    {
        var earlierProjection = new SelectProjection(BooleanExpression.True);
        var widerBranch = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True),
            new SelectProjection(BooleanExpression.False)
        });
        var earlierIndependentQuery = new SelectStatement(
            new[] { earlierProjection },
            setOperations: new[]
            {
                new SetOperationClause(SqlSetOperator.UnionAll, widerBranch)
            });

        var mutationObserved = false;
        var terminalArguments = new IndexedSlotList<SqlExpression>(
            int.MaxValue,
            index =>
            {
                if (index == 16378)
                {
                    SetAutoProperty(
                        earlierProjection,
                        nameof(SelectProjection.Expression),
                        null);
                    mutationObserved = true;
                }
                return BooleanExpression.False;
            },
            poisonIndex: 16379,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var terminalFunction = new FunctionExpression(
            SemanticFunctions.Concat,
            new[] { BooleanExpression.True });
        SetAutoProperty(
            terminalFunction,
            nameof(FunctionExpression.Arguments),
            terminalArguments);
        var root = new SelectStatement(
            new DerivedTableSource(
                earlierIndependentQuery, new SqlAlias("Earlier")),
            new[] { new SelectProjection(terminalFunction) });

        Assert.Equal(
            new[]
            {
                "AST_SET_OPERATION_ARITY_MISMATCH\u001fSet-operation branches must have the same statically known result-column count.\u001f$.From.Query.SetOperations[0].RightQuery.Projections",
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.Projections[0].Expression.Arguments[16379]"
            },
            Snapshot(new SqlAstValidator().Validate(root)));
        Assert.True(mutationObserved);
        Assert.False(terminalArguments.PoisonIndexWasRead);
    }

    [Fact]
    public void Terminal_suppresses_deferred_diagnostics_owned_by_incomplete_ancestor()
    {
        var terminalArguments = new IndexedSlotList<SqlExpression>(
            int.MaxValue,
            _ => BooleanExpression.False,
            poisonIndex: 16378,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var terminalFunction = new FunctionExpression(
            SemanticFunctions.Concat,
            new[] { BooleanExpression.True });
        SetAutoProperty(
            terminalFunction,
            nameof(FunctionExpression.Arguments),
            terminalArguments);
        var terminalQuery = new SelectStatement(new[]
        {
            new SelectProjection(terminalFunction)
        });
        var root = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            orderBy: new[]
            {
                new OrderByExpression(
                    BooleanExpression.True,
                    SqlSortDirection.Ascending)
            },
            page: new KeysetPageSpec(
                new[]
                {
                    BooleanExpression.True,
                    BooleanExpression.False
                },
                10),
            commonTableExpressions: new[]
            {
                new CommonTableExpression(
                    AstSamples.Id("Later"), terminalQuery)
            });

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.CommonTableExpressions[0].Query.Projections[0].Expression.Arguments[16378]"
            },
            Snapshot(new SqlAstValidator().Validate(root)));
        Assert.False(terminalArguments.PoisonIndexWasRead);
        Assert.Equal(1, terminalArguments.CountReads);
        Assert.Equal(16378, terminalArguments.TotalReads);
    }

    [Fact]
    public void Row_arity_requires_a_complete_valid_values_observation()
    {
        var nullableValues = new IndexedSlotList<SqlExpression>(
            2,
            index => index == 0 ? BooleanExpression.True : null!,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var nullableRow = new SqlInsertRow(new[] { BooleanExpression.True });
        var nullableInsert = InsertStatement.Values(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Only") },
            new[] { nullableRow });
        SetAutoProperty(nullableRow, nameof(SqlInsertRow.Values), nullableValues);

        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_NULL_ITEM\u001fSQL AST collection contains a null item.\u001f$.Rows[0].Values[1]"
            },
            Snapshot(new SqlAstValidator().Validate(nullableInsert)));
        Assert.Equal(1, nullableValues.CountReads);
        Assert.Equal(2, nullableValues.TotalReads);

        var targetColumns = new IndexedSlotList<SqlIdentifier>(
            16382,
            index => AstSamples.Id("C" + index),
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var terminalValues = new IndexedSlotList<SqlExpression>(
            2,
            _ => BooleanExpression.True,
            poisonIndex: 1,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var terminalRow = new SqlInsertRow(new[] { BooleanExpression.True });
        var terminalInsert = InsertStatement.Values(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Only") },
            new[] { terminalRow });
        SetAutoProperty(terminalRow, nameof(SqlInsertRow.Values), terminalValues);
        SetAutoProperty(
            terminalInsert, nameof(InsertStatement.Columns), targetColumns);

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.Rows[0].Values[1]"
            },
            Snapshot(new SqlAstValidator().Validate(terminalInsert)));
        Assert.False(terminalValues.PoisonIndexWasRead);
        Assert.Equal(1, terminalValues.CountReads);
        Assert.Equal(1, terminalValues.TotalReads);
    }

    [Fact]
    public void Descendant_arity_preflight_cannot_observe_slots_before_earlier_children()
    {
        var tableName = AstSamples.Id("T");
        var from = new NamedTableSource(new SqlObjectName(tableName));
        SetAutoProperty(tableName, nameof(SqlIdentifier.Value), "invalid.name");

        var values = new IndexedSlotList<SqlExpression>(
            int.MaxValue,
            _ => BooleanExpression.False,
            poisonIndex: 16383,
            throwOnSecondRead: true);
        var expression = new InExpression(
            BooleanExpression.True, Array.Empty<SqlExpression>());
        SetAutoProperty(expression, nameof(InExpression.Values), values);
        var root = new SelectStatement(
            from,
            new[] { new SelectProjection(expression) });

        Assert.Equal(
            new[]
            {
                "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.From.Name.Name",
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.Projections[0].Expression.Values[16383]"
            },
            Snapshot(new SqlAstValidator().Validate(root)));
        Assert.False(values.PoisonIndexWasRead);
        Assert.Equal(16383, values.TotalReads);
    }

    [Fact]
    public void Arity_preflight_does_not_observe_a_later_projection_before_the_canonical_from_child()
    {
        var fromProjections = new IndexedSlotList<SelectProjection>(
            int.MaxValue,
            _ => new SelectProjection(BooleanExpression.True),
            poisonIndex: 16383,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var fromQuery = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True)
        });
        SetAutoProperty(
            fromQuery, nameof(SelectStatement.Projections), fromProjections);

        var laterValues = new IndexedSlotList<SqlExpression>(
            int.MaxValue,
            _ => BooleanExpression.False,
            poisonIndex: 16383,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var laterExpression = new InExpression(
            BooleanExpression.True, Array.Empty<SqlExpression>());
        SetAutoProperty(
            laterExpression, nameof(InExpression.Values), laterValues);

        var root = new SelectStatement(
            new DerivedTableSource(fromQuery, new SqlAlias("d")),
            new[] { new SelectProjection(laterExpression) });

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.From.Query.Projections[16383]"
            },
            Snapshot(new SqlAstValidator().Validate(root)));
        Assert.False(fromProjections.PoisonIndexWasRead);
        Assert.Equal(1, fromProjections.CountReads);
        Assert.Equal(16383, fromProjections.TotalReads);
        Assert.Equal(0, laterValues.CountReads);
        Assert.Equal(0, laterValues.TotalReads);
    }

    [Fact]
    public void Nested_arity_uses_the_outer_absolute_depth_and_remaining_node_budget()
    {
        var depthValues = new IndexedSlotList<SqlExpression>(
            1,
            _ => BooleanExpression.False,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var deepest = new InExpression(
            BooleanExpression.True, Array.Empty<SqlExpression>());
        SetAutoProperty(deepest, nameof(InExpression.Values), depthValues);
        SqlExpression deepExpression = deepest;
        for (var index = 0; index < 126; index++)
        {
            deepExpression = new UnaryExpression(
                SqlUnaryOperator.Not, deepExpression);
        }
        var deepSource = new SelectStatement(new[]
        {
            new SelectProjection(deepExpression)
        });
        var deepInsert = InsertStatement.FromSelect(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Only") },
            deepSource);

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_DEPTH_EXCEEDED\u001fSQL AST traversal exceeds maximum depth 128.\u001f$.Source.Projections[0].Expression" +
                string.Concat(Enumerable.Repeat(".Operand", 126))
            },
            Snapshot(new SqlAstValidator().Validate(deepInsert)));
        Assert.Equal(0, depthValues.CountReads);
        Assert.Equal(0, depthValues.TotalReads);

        var rejectedArguments = new IndexedSlotList<SqlExpression>(
            1,
            _ => BooleanExpression.True,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var rejectedFunction = new FunctionExpression(
            SemanticFunctions.Length,
            new[] { BooleanExpression.True });
        SetAutoProperty(
            rejectedFunction,
            nameof(FunctionExpression.Arguments),
            rejectedArguments);
        var wideValues = Enumerable.Range(0, 4092)
            .Select(index => index == 4091
                ? (SqlExpression)rejectedFunction
                : BooleanExpression.False)
            .ToArray();
        var wideSource = new SelectStatement(new[]
        {
            new SelectProjection(new InExpression(
                BooleanExpression.True, wideValues))
        });
        var wideInsert = InsertStatement.FromSelect(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Only") },
            wideSource);

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum node occurrence count 4096.\u001f$.Source.Projections[0].Expression.Values[4091]"
            },
            Snapshot(new SqlAstValidator().Validate(wideInsert)));
        Assert.Equal(0, rejectedArguments.CountReads);
        Assert.Equal(0, rejectedArguments.TotalReads);
    }

    [Fact]
    public void Shared_dag_occurrences_are_counted()
    {
        var shared = BooleanExpression.True;
        var expression = new InExpression(shared, Enumerable.Repeat<SqlExpression>(shared, 4095));

        Assert.Contains(
            new SqlAstValidator().Validate(expression),
            diagnostic => diagnostic.Code == "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED");
    }

    [Fact]
    public void Static_arity_shared_dag_occurrences_are_charged_by_logical_path()
    {
        var sharedProjections = new IndexedSlotList<SelectProjection>(
            1,
            _ => new SelectProjection(BooleanExpression.True));
        var sharedRight = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True)
        });
        SetAutoProperty(
            sharedRight, nameof(SelectStatement.Projections), sharedProjections);
        var root = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            setOperations: new[]
            {
                new SetOperationClause(SqlSetOperator.Union, sharedRight),
                new SetOperationClause(SqlSetOperator.UnionAll, sharedRight)
            });

        Assert.Empty(new SqlAstValidator().Validate(root));
        Assert.Equal(2, sharedProjections.CountReads);
        Assert.Equal(2, sharedProjections.TotalReads);
        Assert.Equal(2, sharedProjections.ReadsAt(0));
    }

    [Fact]
    public void Static_arity_cycle_consumes_only_the_existing_bounded_occurrence_plan()
    {
        var function = new FunctionExpression(
            SemanticFunctions.Length,
            new[] { BooleanExpression.True });
        var cyclicArguments = new IndexedSlotList<SqlExpression>(
            1,
            _ => function);
        SetAutoProperty(
            function, nameof(FunctionExpression.Arguments), cyclicArguments);
        var source = new SelectStatement(new[]
        {
            new SelectProjection(function)
        });
        var insert = InsertStatement.FromSelect(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("First"), AstSamples.Id("Second") },
            source);
        var functionPath =
            "$.Source.Projections[0].Expression" +
            string.Concat(Enumerable.Repeat(".Arguments[0]", 126));

        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_DEPTH_EXCEEDED\u001fSQL AST traversal exceeds maximum depth 128.\u001f" +
                functionPath
            },
            Snapshot(new SqlAstValidator().Validate(insert)));
        Assert.Equal(126, cyclicArguments.CountReads);
        Assert.Equal(126, cyclicArguments.TotalReads);
    }

    [Fact]
    public void Forged_cycle_is_bounded_without_recursion()
    {
        var expression = new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.True);
        SetAutoProperty(expression, nameof(UnaryExpression.Operand), expression);

        Assert.Contains(
            new SqlAstValidator().Validate(expression),
            diagnostic => diagnostic.Code == "AST_TRAVERSAL_DEPTH_EXCEEDED");
    }

    [Fact]
    public void Unknown_subtype_fails_closed_without_leaking_its_name()
    {
        var diagnostic = Assert.Single(new SqlAstValidator().Validate(new UnknownSqlNode()));
        Assert.Equal("AST_UNKNOWN_NODE", diagnostic.Code);
        Assert.Equal("SQL AST contains an unknown node subtype.", diagnostic.Message);
        Assert.Equal("$", diagnostic.Path);
        Assert.DoesNotContain(nameof(UnknownSqlNode), diagnostic.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Identifier_enum_scalar_and_collection_invariants_have_exact_paths()
    {
        var invalidIdentifier = Forge<SqlIdentifier>();
        SetAutoProperty(invalidIdentifier, nameof(SqlIdentifier.Value), "bad.identifier");
        AssertDiagnostic(
            new ColumnExpression(invalidIdentifier),
            "AST_INVALID_IDENTIFIER",
            "SQL identifier is not one valid unquoted segment.",
            "$.Name");

        var binary = new BinaryExpression(
            BooleanExpression.True, SqlBinaryOperator.And, BooleanExpression.False);
        SetAutoProperty(binary, nameof(BinaryExpression.Operator), (SqlBinaryOperator)999);
        AssertDiagnostic(
            binary,
            "AST_UNDEFINED_ENUM",
            "SQL AST contains an undefined enumeration value.",
            "$.Operator");

        var page = new OffsetPageSpec(0, 1);
        SetAutoProperty(page, nameof(OffsetPageSpec.Offset), -1);
        SetAutoProperty(page, nameof(OffsetPageSpec.Limit), 0);
        Assert.Equal(
            new[] { "$.Offset", "$.Limit" },
            new SqlAstValidator().Validate(page)
                .Where(item => item.Code == "AST_SCALAR_INVALID")
                .Select(item => item.Path).ToArray());

        var @case = new CaseExpression(
            new[] { new CaseWhenClause(BooleanExpression.True, BooleanExpression.False) });
        SetAutoProperty(@case, nameof(CaseExpression.WhenClauses),
            Array.AsReadOnly<CaseWhenClause>(Array.Empty<CaseWhenClause>()));
        AssertDiagnostic(
            @case,
            "AST_COLLECTION_EMPTY",
            "Required SQL AST collection is empty.",
            "$.WhenClauses");

        var @in = new InExpression(BooleanExpression.True, Array.Empty<SqlExpression>());
        SetAutoProperty(@in, nameof(InExpression.Values),
            Array.AsReadOnly<SqlExpression>(new SqlExpression[] { null! }));
        AssertDiagnostic(
            @in,
            "AST_COLLECTION_NULL_ITEM",
            "SQL AST collection contains a null item.",
            "$.Values[0]");
    }

    [Fact]
    public void Parameter_definition_and_conflict_diagnostics_are_value_safe()
    {
        var invalid = new ParameterDefinition(
            "sentinel", new SqlTypeDescriptor(LogicalDbType.Int32));
        SetAutoProperty(invalid, nameof(ParameterDefinition.Name), "@secret");
        SetAutoProperty(invalid, nameof(ParameterDefinition.Direction), (ParameterDirection)999);
        var diagnostics = new SqlAstValidator().Validate(new ParameterExpression(invalid));
        Assert.Equal(
            new[]
            {
                "AST_PARAMETER_NAME_INVALID\u001fLogical parameter name is invalid.\u001f$.Definition.Name",
                "AST_PARAMETER_DIRECTION_INVALID\u001fLogical parameter direction is undefined.\u001f$.Definition.Direction"
            },
            Snapshot(diagnostics));
        Assert.DoesNotContain("secret", string.Join("|", diagnostics.Select(item => item.Message)), StringComparison.Ordinal);

        var left = new ParameterExpression(new ParameterDefinition(
            "same", new SqlTypeDescriptor(LogicalDbType.Int32)));
        var right = new ParameterExpression(new ParameterDefinition(
            "same", new SqlTypeDescriptor(LogicalDbType.String)));
        var conflict = Assert.Single(
            new SqlAstValidator().Validate(
                new BinaryExpression(left, SqlBinaryOperator.Equal, right)),
            item => item.Code == "AST_PARAMETER_DEFINITION_CONFLICT");
        Assert.Equal("$.Right.Definition", conflict.Path);
        Assert.Equal("Logical parameter name has conflicting definitions.", conflict.Message);
    }

    [Fact]
    public void Invalid_parameter_definition_does_not_enter_or_conflict_with_the_catalog()
    {
        foreach (var invalidFirst in new[] { true, false })
        {
            var invalidType = new SqlTypeDescriptor(LogicalDbType.Int32);
            SetAutoProperty(invalidType, nameof(SqlTypeDescriptor.Length), 0);
            var invalid = new ParameterDefinition("same", invalidType);
            SetAutoProperty(invalid, nameof(ParameterDefinition.Direction),
                (ParameterDirection)999);
            var valid = new ParameterDefinition(
                "same", new SqlTypeDescriptor(LogicalDbType.Int32));
            var left = new ParameterExpression(invalidFirst ? invalid : valid);
            var right = new ParameterExpression(invalidFirst ? valid : invalid);

            var diagnostics = new SqlAstValidator().Validate(
                new BinaryExpression(left, SqlBinaryOperator.Equal, right));
            var invalidPath = invalidFirst ? "$.Left.Definition" : "$.Right.Definition";

            Assert.Equal(
                new[]
                {
                    "AST_PARAMETER_TYPE_INVALID\u001fLogical parameter type descriptor is invalid.\u001f" + invalidPath + ".Type",
                    "AST_PARAMETER_DIRECTION_INVALID\u001fLogical parameter direction is undefined.\u001f" + invalidPath + ".Direction"
                },
                Snapshot(diagnostics));
        }
    }

    [Fact]
    public void Join_subquery_function_and_aggregate_rules_are_fail_closed()
    {
        var table = new NamedTableSource(AstSamples.ObjectName("T"));
        var inner = new JoinSource(
            table, SqlJoinType.Inner,
            new NamedTableSource(AstSamples.ObjectName("R")),
            BooleanExpression.True);
        SetAutoProperty(inner, nameof(JoinSource.Condition), null);
        AssertDiagnostic(inner, "AST_JOIN_CONDITION_REQUIRED",
            "Non-cross join requires a condition.", "$.Condition");

        var cross = new JoinSource(
            table, SqlJoinType.Cross,
            new NamedTableSource(AstSamples.ObjectName("R")));
        SetAutoProperty(cross, nameof(JoinSource.Condition), BooleanExpression.True);
        AssertDiagnostic(cross, "AST_JOIN_CONDITION_FORBIDDEN",
            "Cross join cannot have a condition.", "$.Condition");

        AssertDiagnostic(new SubqueryExpression(BooleanExpression.True),
            "AST_SUBQUERY_SELECT_REQUIRED",
            "Subquery must contain a SelectStatement.", "$.Query");

        var unregistered = (SemanticFunctionId)Assert.Single(
            typeof(SemanticFunctionId).GetConstructors(
                BindingFlags.Instance | BindingFlags.NonPublic)).Invoke(
                    new object?[] { "Private", 0, 0, false });
        var function = Forge<FunctionExpression>();
        SetAutoProperty(function, nameof(FunctionExpression.Function), unregistered);
        SetAutoProperty(function, nameof(FunctionExpression.Arguments),
            Array.AsReadOnly<SqlExpression>(Array.Empty<SqlExpression>()));
        AssertDiagnostic(function, "AST_FUNCTION_NOT_REGISTERED",
            "Function must use the registered semantic catalog instance.", "$.Function");

        AssertDiagnostic(new FunctionExpression(SemanticFunctions.Length, Array.Empty<SqlExpression>()),
            "AST_FUNCTION_ARITY",
            "Function argument count is outside its semantic contract.", "$.Arguments");
        AssertDiagnostic(new AggregateExpression(SemanticFunctions.Sum),
            "AST_AGGREGATE_ARITY",
            "Aggregate argument count is outside its semantic contract.", "$.Argument");
        AssertDiagnostic(new AggregateExpression(SemanticFunctions.Count, distinct: true),
            "AST_AGGREGATE_DISTINCT_ARGUMENT_REQUIRED",
            "DISTINCT aggregate requires an argument.", "$.Distinct");
    }

    [Fact]
    public void Forged_semantic_function_with_null_key_fails_closed_without_throwing()
    {
        var forged = Forge<SemanticFunctionId>();
        var function = Forge<FunctionExpression>();
        SetAutoProperty(function, nameof(FunctionExpression.Function), forged);
        SetAutoProperty(function, nameof(FunctionExpression.Arguments),
            Array.AsReadOnly<SqlExpression>(Array.Empty<SqlExpression>()));
        Assert.Equal(
            new[]
            {
                "AST_FUNCTION_NOT_REGISTERED\u001fFunction must use the registered semantic catalog instance.\u001f$.Function"
            },
            Snapshot(new SqlAstValidator().Validate(function)));

        var aggregate = new AggregateExpression(SemanticFunctions.Count);
        SetAutoProperty(aggregate, nameof(AggregateExpression.Function), forged);
        Assert.Equal(
            new[]
            {
                "AST_AGGREGATE_FUNCTION_REQUIRED\u001fAggregate must use a registered aggregate semantic function.\u001f$.Function"
            },
            Snapshot(new SqlAstValidator().Validate(aggregate)));
    }

    [Fact]
    public void Aggregate_requires_registered_aggregate_function()
    {
        var unregistered = (SemanticFunctionId)Assert.Single(
            typeof(SemanticFunctionId).GetConstructors(
                BindingFlags.Instance | BindingFlags.NonPublic)).Invoke(
                    new object?[] { "PrivateAggregate", 0, 1, true });
        foreach (var function in new SemanticFunctionId?[]
                 {
                     null, SemanticFunctions.Length, unregistered
                 })
        {
            var aggregate = new AggregateExpression(SemanticFunctions.Count);
            SetAutoProperty(aggregate, nameof(AggregateExpression.Function), function);
            Assert.Equal(
                new[]
                {
                    "AST_AGGREGATE_FUNCTION_REQUIRED\u001fAggregate must use a registered aggregate semantic function.\u001f$.Function"
                },
                Snapshot(new SqlAstValidator().Validate(aggregate)));
        }
    }

    [Fact]
    public void Schema_name_catalog_precedes_name_and_undefined_semantic_default_has_only_enum_diagnostic()
    {
        var name = AstSamples.Id("Name");
        var catalog = AstSamples.Id("Catalog");
        SetAutoProperty(name, nameof(SqlIdentifier.Value), "bad.name");
        SetAutoProperty(catalog, nameof(SqlIdentifier.Value), "bad.catalog");
        Assert.Equal(
            new[]
            {
                "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.Catalog",
                "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.Name"
            },
            Snapshot(new SqlAstValidator().Validate(new SchemaName(name, catalog))));

        var semantic = new SemanticDefaultDefinition(SemanticDefaultKind.CurrentDate);
        SetAutoProperty(semantic, nameof(SemanticDefaultDefinition.Kind),
            (SemanticDefaultKind)999);
        var column = new ColumnDefinition(
            AstSamples.Id("CreatedAt"),
            new SqlTypeDescriptor(LogicalDbType.String),
            ColumnNullability.NotNullable,
            defaultValue: semantic);
        Assert.Equal(
            new[]
            {
                "AST_UNDEFINED_ENUM\u001fSQL AST contains an undefined enumeration value.\u001f$.DefaultValue.Kind"
            },
            Snapshot(new SqlAstValidator().Validate(column)));
    }

    [Fact]
    public void Page_rules_keep_exact_task4_codes_messages_and_paths()
    {
        var offset = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            page: new OffsetPageSpec(0, 10));
        AssertDiagnostic(offset, "AST_PAGE_ORDER_REQUIRED",
            "Offset pagination requires at least one ORDER BY expression.", "$.Page");

        var keyset = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            page: new KeysetPageSpec(Array.Empty<SqlExpression>(), 10));
        var diagnostics = new SqlAstValidator().Validate(keyset);
        Assert.Equal(
            new[]
            {
                "AST_KEYSET_ORDER_REQUIRED\u001fKeyset pagination requires at least one ORDER BY expression.\u001f$.Page",
                "AST_KEYSET_BOUNDARY_REQUIRED\u001fKeyset pagination requires at least one boundary expression.\u001f$.Page"
            },
            Snapshot(diagnostics));

        var arity = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            orderBy: new[] { new OrderByExpression(BooleanExpression.True) },
            page: new KeysetPageSpec(Array.Empty<SqlExpression>(), 10));
        AssertDiagnostic(arity, "AST_KEYSET_ARITY_MISMATCH",
            "Keyset ORDER BY and boundary expression counts must match.", "$.Page");
    }

    [Fact]
    public void Wildcard_result_arity_is_unknown_not_one()
    {
        Assert.Null(GetKnownResultColumnCount(new SelectStatement(
            new[] { new SelectProjection(new WildcardExpression()) })));
        Assert.Null(GetKnownResultColumnCount(new SelectStatement(
            new[] { new SelectProjection(new WildcardExpression(new SqlAlias("t"))) })));
        Assert.Equal(2, GetKnownResultColumnCount(new SelectStatement(
            new[]
            {
                new SelectProjection(BooleanExpression.True),
                new SelectProjection(BooleanExpression.False)
            })));
    }

    [Fact]
    public void Invalid_projection_alias_does_not_make_static_result_arity_unknown()
    {
        var invalidAlias = new SqlAlias("Alias");
        SetAutoProperty(
            invalidAlias.Identifier,
            nameof(SqlIdentifier.Value),
            "bad.alias");
        var right = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True, invalidAlias),
            new SelectProjection(BooleanExpression.False)
        });

        Assert.Equal(2, GetKnownResultColumnCount(right));

        var root = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            setOperations: new[]
            {
                new SetOperationClause(SqlSetOperator.Union, right)
            });
        Assert.Equal(
            new[]
            {
                "AST_SET_OPERATION_ARITY_MISMATCH\u001fSet-operation branches must have the same statically known result-column count.\u001f$.SetOperations[0].RightQuery.Projections",
                "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.SetOperations[0].RightQuery.Projections[0].Alias.Identifier"
            },
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Fact]
    public void Insert_cte_and_set_known_result_arity_is_validated_without_wildcard_false_positives()
    {
        var twoColumns = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True),
            new SelectProjection(BooleanExpression.False)
        });
        var insert = InsertStatement.FromSelect(
            AstSamples.ObjectName("T"), new[] { AstSamples.Id("Only") }, twoColumns);
        AssertDiagnostic(insert, "AST_INSERT_SOURCE_ARITY_MISMATCH",
            "Insert target columns must match the statically known source result-column count.",
            "$.Source.Projections");

        var cte = new CommonTableExpression(
            AstSamples.Id("C"), twoColumns, new[] { AstSamples.Id("Only") });
        AssertDiagnostic(cte, "AST_CTE_COLUMN_ARITY_MISMATCH",
            "CTE column aliases must match the statically known query result-column count.",
            "$.Columns");

        var wildcard = new SelectStatement(
            new[] { new SelectProjection(new WildcardExpression()) });
        Assert.DoesNotContain(
            new SqlAstValidator().Validate(InsertStatement.FromSelect(
                AstSamples.ObjectName("T"),
                new[] { AstSamples.Id("A"), AstSamples.Id("B") }, wildcard)),
            item => item.Code == "AST_INSERT_SOURCE_ARITY_MISMATCH");

        var setRoot = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            setOperations: new[]
            {
                new SetOperationClause(SqlSetOperator.UnionAll, twoColumns),
                new SetOperationClause(SqlSetOperator.UnionAll, wildcard),
                new SetOperationClause(SqlSetOperator.UnionAll, twoColumns)
            });
        Assert.Equal(
            new[]
            {
                "$.SetOperations[0].RightQuery.Projections",
                "$.SetOperations[2].RightQuery.Projections"
            },
            new SqlAstValidator().Validate(setRoot)
                .Where(item => item.Code == "AST_SET_OPERATION_ARITY_MISMATCH")
                .Select(item => item.Path).ToArray());
    }

    [Fact]
    public void Unknown_projection_expression_makes_insert_source_arity_unknown()
    {
        var source = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True),
            new SelectProjection(new UnknownSqlExpression())
        });
        var insert = InsertStatement.FromSelect(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Only") },
            source);

        Assert.Equal(
            new[]
            {
                "AST_UNKNOWN_NODE\u001fSQL AST contains an unknown node subtype.\u001f$.Source.Projections[1].Expression"
            },
            Snapshot(new SqlAstValidator().Validate(insert)));
    }

    [Fact]
    public void Deferred_cte_arity_skips_invalid_alias_prerequisites()
    {
        var query = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True),
            new SelectProjection(BooleanExpression.False)
        });
        var invalidAlias = AstSamples.Id("Alias");
        SetAutoProperty(
            invalidAlias,
            nameof(SqlIdentifier.Value),
            "bad.alias");
        var cte = new CommonTableExpression(
            AstSamples.Id("C"),
            query,
            new[] { invalidAlias });

        Assert.Equal(
            new[]
            {
                "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.Columns[0]"
            },
            Snapshot(new SqlAstValidator().Validate(cte)));
    }

    [Fact]
    public void Deferred_insert_arities_skip_invalid_or_duplicate_targets()
    {
        var duplicateFirst = AstSamples.Id("A");
        var duplicateRow = new SqlInsertRow(new SqlExpression[]
        {
            BooleanExpression.True,
            BooleanExpression.False
        });
        var duplicate = InsertStatement.Values(
            AstSamples.ObjectName("T"),
            new[] { duplicateFirst, AstSamples.Id("B") },
            new[] { duplicateRow });
        SetAutoProperty(
            duplicate,
            nameof(InsertStatement.Columns),
            Array.AsReadOnly(new[] { duplicateFirst, duplicateFirst }));
        SetAutoProperty(
            duplicateRow,
            nameof(SqlInsertRow.Values),
            Array.AsReadOnly<SqlExpression>(new[]
            {
                BooleanExpression.True
            }));
        Assert.Equal(
            new[]
            {
                "AST_DML_COLUMN_DUPLICATE\u001fDML target columns must be ordinally unique.\u001f$.Columns[1]"
            },
            Snapshot(new SqlAstValidator().Validate(duplicate)));

        var invalidTarget = AstSamples.Id("Target");
        var invalid = InsertStatement.FromSelect(
            AstSamples.ObjectName("T"),
            new[] { invalidTarget },
            new SelectStatement(new[]
            {
                new SelectProjection(BooleanExpression.True),
                new SelectProjection(BooleanExpression.False)
            }));
        SetAutoProperty(
            invalidTarget,
            nameof(SqlIdentifier.Value),
            "bad.target");
        Assert.Equal(
            new[]
            {
                "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.Columns[0]"
            },
            Snapshot(new SqlAstValidator().Validate(invalid)));
    }

    [Fact]
    public void Deferred_keyset_arity_skips_invalid_child_prerequisites()
    {
        var invalidBoundary = new BinaryExpression(
            BooleanExpression.True,
            SqlBinaryOperator.Equal,
            BooleanExpression.False);
        SetAutoProperty(
            invalidBoundary,
            nameof(BinaryExpression.Left),
            null);
        var select = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            orderBy: new[]
            {
                new OrderByExpression(BooleanExpression.True)
            },
            page: new KeysetPageSpec(
                new SqlExpression[]
                {
                    invalidBoundary,
                    BooleanExpression.False
                },
                10));

        Assert.Equal(
            new[]
            {
                "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f$.Page.Boundaries[0].Left"
            },
            Snapshot(new SqlAstValidator().Validate(select)));
    }

    [Fact]
    public void Deferred_table_cross_references_skip_ambiguous_columns()
    {
        var duplicateColumn = new ColumnDefinition(
            AstSamples.Id("Other"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.NotNullable);
        var table = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    AstSamples.Id("Id"),
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable),
                duplicateColumn
            },
            new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(
                    AstSamples.Id("PK"),
                    new[] { AstSamples.Id("Id") })
            });
        SetAutoProperty(
            duplicateColumn,
            nameof(ColumnDefinition.Name),
            AstSamples.Id("Id"));

        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_DUPLICATE\u001fSQL AST collection contains a duplicate logical name.\u001f$.Columns[1].Name"
            },
            Snapshot(new SqlAstValidator().Validate(table)));
    }

    [Fact]
    public void Static_arity_is_unknown_when_projection_parameters_conflict_in_the_canonical_catalog()
    {
        var source = new SelectStatement(new[]
        {
            new SelectProjection(new ParameterExpression(
                new ParameterDefinition(
                    "p", new SqlTypeDescriptor(LogicalDbType.Int32)))),
            new SelectProjection(new ParameterExpression(
                new ParameterDefinition(
                    "p", new SqlTypeDescriptor(LogicalDbType.String))))
        });
        var insert = InsertStatement.FromSelect(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Only") },
            source);

        Assert.Equal(
            new[]
            {
                "AST_PARAMETER_DEFINITION_CONFLICT\u001fLogical parameter name has conflicting definitions.\u001f$.Source.Projections[1].Expression.Definition"
            },
            Snapshot(new SqlAstValidator().Validate(insert)));
    }

    [Fact]
    public void Collection_count_and_slots_are_read_once_across_validation_and_deferred_arity()
    {
        IndexedSlotList<SelectProjection> OneProjection() => new(
            1,
            _ => new SelectProjection(BooleanExpression.True),
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);

        var rightProjections = OneProjection();
        var right = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True)
        });
        SetAutoProperty(right, nameof(SelectStatement.Projections), rightProjections);

        var cteProjections = OneProjection();
        var cteQuery = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True)
        });
        SetAutoProperty(
            cteQuery, nameof(SelectStatement.Projections), cteProjections);
        var cteColumns = new IndexedSlotList<SqlIdentifier>(
            1,
            _ => AstSamples.Id("C"),
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var cte = new CommonTableExpression(
            AstSamples.Id("Cte"), cteQuery, new[] { AstSamples.Id("C") });
        SetAutoProperty(cte, nameof(CommonTableExpression.Columns), cteColumns);

        var sourceProjections = OneProjection();
        var sourceCtes = new IndexedSlotList<CommonTableExpression>(
            1,
            _ => cte,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var sourceSets = new IndexedSlotList<SetOperationClause>(
            1,
            _ => new SetOperationClause(SqlSetOperator.Union, right),
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var source = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True)
        });
        SetAutoProperty(
            source, nameof(SelectStatement.Projections), sourceProjections);
        SetAutoProperty(
            source, nameof(SelectStatement.CommonTableExpressions), sourceCtes);
        SetAutoProperty(
            source, nameof(SelectStatement.SetOperations), sourceSets);

        var targetColumns = new IndexedSlotList<SqlIdentifier>(
            1,
            _ => AstSamples.Id("Only"),
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var insert = InsertStatement.FromSelect(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Only") },
            source);
        SetAutoProperty(insert, nameof(InsertStatement.Columns), targetColumns);

        Assert.Empty(new SqlAstValidator().Validate(insert));
        foreach (var list in new[]
                 {
                     sourceProjections, cteProjections, rightProjections
                 })
        {
            Assert.Equal(1, list.CountReads);
            Assert.Equal(1, list.TotalReads);
        }
        Assert.Equal(1, sourceCtes.CountReads);
        Assert.Equal(1, sourceCtes.TotalReads);
        Assert.Equal(1, sourceSets.CountReads);
        Assert.Equal(1, sourceSets.TotalReads);
        Assert.Equal(1, cteColumns.CountReads);
        Assert.Equal(1, cteColumns.TotalReads);
        Assert.Equal(1, targetColumns.CountReads);
        Assert.Equal(1, targetColumns.TotalReads);
    }

    [Fact]
    public void Retained_malformed_projection_makes_each_arity_caller_unknown_but_known_siblings_still_report()
    {
        var insert = InsertStatement.FromSelect(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Only") },
            SelectWithMissingProjectionChild());
        Assert.Equal(
            new[]
            {
                "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f$.Source.Projections[1].Expression.Left"
            },
            Snapshot(new SqlAstValidator().Validate(insert)));

        var cte = new CommonTableExpression(
            AstSamples.Id("C"),
            SelectWithMissingProjectionChild(),
            new[] { AstSamples.Id("Only") });
        Assert.Equal(
            new[]
            {
                "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f$.Query.Projections[1].Expression.Left"
            },
            Snapshot(new SqlAstValidator().Validate(cte)));

        var malformedSibling = SelectWithMissingProjectionChild();
        var knownSibling = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True),
            new SelectProjection(BooleanExpression.False)
        });
        var setRoot = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            setOperations: new[]
            {
                new SetOperationClause(SqlSetOperator.UnionAll, malformedSibling),
                new SetOperationClause(SqlSetOperator.UnionAll, knownSibling)
            });
        Assert.Equal(
            new[]
            {
                "AST_SET_OPERATION_ARITY_MISMATCH\u001fSet-operation branches must have the same statically known result-column count.\u001f$.SetOperations[1].RightQuery.Projections",
                "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f$.SetOperations[0].RightQuery.Projections[1].Expression.Left"
            },
            Snapshot(new SqlAstValidator().Validate(setRoot)));
    }

    [Fact]
    public void Select_local_page_diagnostic_precedes_set_arity()
    {
        var query = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            page: new OffsetPageSpec(0, 10),
            setOperations: new[]
            {
                new SetOperationClause(
                    SqlSetOperator.Union,
                    new SelectStatement(new[]
                    {
                        new SelectProjection(BooleanExpression.True),
                        new SelectProjection(BooleanExpression.False)
                    }))
            });

        Assert.Equal(
            new[] { "AST_PAGE_ORDER_REQUIRED", "AST_SET_OPERATION_ARITY_MISMATCH" },
            new SqlAstValidator().Validate(query).Select(item => item.Code).ToArray());
    }

    [Fact]
    public void Safe_write_truth_table_is_exact()
    {
        var unknown = new ParameterExpression(new ParameterDefinition(
            "predicate", new SqlTypeDescriptor(LogicalDbType.Boolean)));
        var reflectedTrue = Forge<BooleanExpression>();
        SetAutoProperty(reflectedTrue, nameof(BooleanExpression.Value), true);
        var reflectedFalse = Forge<BooleanExpression>();
        SetAutoProperty(reflectedFalse, nameof(BooleanExpression.Value), false);

        var cases = new List<(SqlExpression Predicate, bool ProvenTrue)>
        {
            (BooleanExpression.True, true),
            (BooleanExpression.False, false),
            (reflectedTrue, true),
            (reflectedFalse, false),
            (new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.True), false),
            (new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.False), true),
            (new UnaryExpression(SqlUnaryOperator.Not, unknown), false)
        };

        foreach (var left in new[]
                 {
                     (Expression: (SqlExpression)BooleanExpression.True, Value: (bool?)true),
                     (Expression: (SqlExpression)BooleanExpression.False, Value: (bool?)false),
                     (Expression: (SqlExpression)unknown, Value: (bool?)null)
                 })
        {
            foreach (var right in new[]
                     {
                         (Expression: (SqlExpression)BooleanExpression.True, Value: (bool?)true),
                         (Expression: (SqlExpression)BooleanExpression.False, Value: (bool?)false),
                         (Expression: (SqlExpression)unknown, Value: (bool?)null)
                     })
            {
                cases.Add((
                    new BinaryExpression(left.Expression, SqlBinaryOperator.And, right.Expression),
                    left.Value == true && right.Value == true));
                cases.Add((
                    new BinaryExpression(left.Expression, SqlBinaryOperator.Or, right.Expression),
                    left.Value == true || right.Value == true));
            }
        }

        foreach (var item in cases)
        {
            var diagnostics = new SqlAstValidator().Validate(
                UnsafeUpdate(item.Predicate));
            Assert.Equal(
                item.ProvenTrue,
                diagnostics.Any(diagnostic =>
                    diagnostic.Code == "AST_WRITE_ALL_ROWS_NOT_ALLOWED"));
        }
    }

    [Fact]
    public void Safe_write_truth_table_not_branch_is_exact()
    {
        var unknown = new ParameterExpression(new ParameterDefinition(
            "p", new SqlTypeDescriptor(LogicalDbType.Boolean)));
        Assert.False(IsSafeWriteProvenTrue(
            new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.True)));
        Assert.True(IsSafeWriteProvenTrue(
            new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.False)));
        Assert.False(IsSafeWriteProvenTrue(
            new UnaryExpression(SqlUnaryOperator.Not, unknown)));
    }

    [Fact]
    public void Safe_write_truth_table_and_true_branch_is_exact()
    {
        Assert.True(IsSafeWriteProvenTrue(new BinaryExpression(
            BooleanExpression.True,
            SqlBinaryOperator.And,
            BooleanExpression.True)));
    }

    [Fact]
    public void Safe_write_truth_table_and_false_branch_is_exact()
    {
        var unknown = new ParameterExpression(new ParameterDefinition(
            "p", new SqlTypeDescriptor(LogicalDbType.Boolean)));
        Assert.True(IsSafeWriteProvenTrue(new UnaryExpression(
            SqlUnaryOperator.Not,
            new BinaryExpression(
                BooleanExpression.False, SqlBinaryOperator.And, unknown))));
        Assert.True(IsSafeWriteProvenTrue(new UnaryExpression(
            SqlUnaryOperator.Not,
            new BinaryExpression(
                unknown, SqlBinaryOperator.And, BooleanExpression.False))));
    }

    [Fact]
    public void Safe_write_truth_table_or_true_branch_is_exact()
    {
        var unknown = new ParameterExpression(new ParameterDefinition(
            "p", new SqlTypeDescriptor(LogicalDbType.Boolean)));
        Assert.True(IsSafeWriteProvenTrue(new BinaryExpression(
            BooleanExpression.True, SqlBinaryOperator.Or, unknown)));
        Assert.True(IsSafeWriteProvenTrue(new BinaryExpression(
            unknown, SqlBinaryOperator.Or, BooleanExpression.True)));
    }

    [Fact]
    public void Safe_write_truth_table_or_false_branch_is_exact()
    {
        Assert.True(IsSafeWriteProvenTrue(new UnaryExpression(
            SqlUnaryOperator.Not,
            new BinaryExpression(
                BooleanExpression.False,
                SqlBinaryOperator.Or,
                BooleanExpression.False))));
    }

    [Fact]
    public void Safe_write_does_not_prove_general_tautologies()
    {
        var column = new ColumnExpression(AstSamples.Id("Flag"));
        Assert.False(IsSafeWriteProvenTrue(new BinaryExpression(
            column, SqlBinaryOperator.Equal, column)));
        Assert.False(IsSafeWriteProvenTrue(new BinaryExpression(
            column,
            SqlBinaryOperator.Or,
            new UnaryExpression(SqlUnaryOperator.Not, column))));
    }

    [Fact]
    public void Safe_write_shared_dag_logical_occurrence_4096_is_accepted()
    {
        var falseTree = SharedTruthDag(
            BooleanExpression.False, SqlBinaryOperator.Or, layers: 11);
        Assert.True(IsSafeWriteProvenTrue(
            new UnaryExpression(SqlUnaryOperator.Not, falseTree)));
    }

    [Fact]
    public void Safe_write_shared_dag_logical_occurrence_4097_is_unknown()
    {
        var trueTree = SharedTruthDag(
            BooleanExpression.True, SqlBinaryOperator.And, layers: 11);
        var logicallyTrue = new UnaryExpression(
            SqlUnaryOperator.Not,
            new UnaryExpression(SqlUnaryOperator.Not, trueTree));
        var diagnostics = new SqlAstValidator().Validate(
            UnsafeUpdate(logicallyTrue));
        Assert.DoesNotContain(diagnostics,
            item => item.Code == "AST_WRITE_ALL_ROWS_NOT_ALLOWED");
        Assert.Contains(diagnostics,
            item => item.Code == "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED");
    }

    [Fact]
    public void Safe_write_does_not_prove_general_tautologies_or_excluded_families()
    {
        var column = new ColumnExpression(AstSamples.Id("Flag"));
        var parameter = new ParameterExpression(new ParameterDefinition(
            "flag", new SqlTypeDescriptor(LogicalDbType.Boolean)));
        var excluded = new SqlExpression[]
        {
            column,
            parameter,
            NullExpression.Instance,
            new BinaryExpression(column, SqlBinaryOperator.Equal, column),
            new BinaryExpression(column, SqlBinaryOperator.Or,
                new UnaryExpression(SqlUnaryOperator.Not, column)),
            new InExpression(column, new[] { BooleanExpression.True }),
            new BetweenExpression(column, BooleanExpression.False, BooleanExpression.True),
            new CaseExpression(new[] { new CaseWhenClause(BooleanExpression.True, BooleanExpression.True) }),
            new CastExpression(BooleanExpression.True, new SqlTypeDescriptor(LogicalDbType.Boolean)),
            new FunctionExpression(SemanticFunctions.Coalesce, new[] { BooleanExpression.True, BooleanExpression.False }),
            new AggregateExpression(SemanticFunctions.Count),
            new WildcardExpression(),
            new SubqueryExpression(new SelectStatement(new[] { new SelectProjection(BooleanExpression.True) })),
            new ExistsExpression(new SubqueryExpression(new SelectStatement(new[] { new SelectProjection(BooleanExpression.True) })))
        };

        foreach (var expression in excluded)
        {
            Assert.DoesNotContain(
                new SqlAstValidator().Validate(UnsafeUpdate(expression)),
                diagnostic => diagnostic.Code == "AST_WRITE_ALL_ROWS_NOT_ALLOWED");
        }

        AssertDiagnostic(UnsafeUpdate(null), "AST_WRITE_ALL_ROWS_NOT_ALLOWED",
            "Full-table write requires explicit AllowAllRows.", "$.Where");
    }

    [Fact]
    public void Safe_write_malformed_and_budget_cases_are_unknown_not_exceptions()
    {
        var missing = new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.False);
        SetAutoProperty(missing, nameof(UnaryExpression.Operand), null);
        var missingDiagnostics = new SqlAstValidator().Validate(UnsafeUpdate(missing));
        Assert.Contains(missingDiagnostics, item => item.Code == "AST_REQUIRED_CHILD_MISSING");
        Assert.DoesNotContain(missingDiagnostics, item => item.Code == "AST_WRITE_ALL_ROWS_NOT_ALLOWED");

        var undefined = new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.False);
        SetAutoProperty(undefined, nameof(UnaryExpression.Operator), (SqlUnaryOperator)999);
        var undefinedDiagnostics = new SqlAstValidator().Validate(UnsafeUpdate(undefined));
        Assert.Contains(undefinedDiagnostics, item => item.Code == "AST_UNDEFINED_ENUM");
        Assert.DoesNotContain(undefinedDiagnostics, item => item.Code == "AST_WRITE_ALL_ROWS_NOT_ALLOWED");

        var deep = UnaryChain(129);
        var deepDiagnostics = new SqlAstValidator().Validate(UnsafeUpdate(deep));
        Assert.Contains(deepDiagnostics, item => item.Code == "AST_TRAVERSAL_DEPTH_EXCEEDED");
        Assert.DoesNotContain(deepDiagnostics, item => item.Code == "AST_WRITE_ALL_ROWS_NOT_ALLOWED");
    }

    [Fact]
    public void Dml_duplicates_rows_source_upsert_and_bulk_shapes_are_validated()
    {
        var id = AstSamples.Id("Id");
        var table = AstSamples.ObjectName("T");
        var assignment = new SqlAssignment(id, BooleanExpression.True);

        var update = new UpdateStatement(table, new[] { assignment }, BooleanExpression.False);
        SetAutoProperty(update, nameof(UpdateStatement.Assignments),
            Array.AsReadOnly(new[] { assignment, assignment }));
        AssertDiagnostic(update, "AST_DML_ASSIGNMENT_DUPLICATE",
            "DML assignments must target ordinally unique columns.",
            "$.Assignments[1].Column");

        var row = new SqlInsertRow(new[] { BooleanExpression.True });
        var insert = InsertStatement.Values(table, new[] { id }, new[] { row });
        SetAutoProperty(insert, nameof(InsertStatement.Source),
            new SelectStatement(new[] { new SelectProjection(BooleanExpression.True) }));
        AssertDiagnostic(insert, "AST_INSERT_SOURCE_SHAPE_INVALID",
            "Insert must contain exactly one values or select source.", "$.Source");
        SetAutoProperty(row, nameof(SqlInsertRow.Values),
            Array.AsReadOnly<SqlExpression>(new[] { BooleanExpression.True, BooleanExpression.False }));
        AssertDiagnostic(insert, "AST_DML_ROW_ARITY_MISMATCH",
            "DML row value count must match target column count.", "$.Rows[0].Values");

        var upsert = new UpsertStatement(
            table, new[] { id },
            new[] { assignment, new SqlAssignment(AstSamples.Id("Value"), BooleanExpression.True) },
            new[] { new SqlAssignment(AstSamples.Id("Value"), BooleanExpression.False) });
        SetAutoProperty(upsert, nameof(UpsertStatement.UpdateAssignments),
            Array.AsReadOnly(new[] { assignment }));
        AssertDiagnostic(upsert, "AST_UPSERT_SHAPE_INVALID",
            "Upsert conflict policy, keys, and assignments are inconsistent.",
            "$.UpdateAssignments[0].Column");

        var bulk = new BulkInsertOperation(
            table, new[] { id },
            new[] { new SqlInsertRow(new[] { BooleanExpression.True }) }, 1);
        SetAutoProperty(bulk, nameof(BulkInsertOperation.BatchSize), 0);
        AssertDiagnostic(bulk, "AST_BULK_BATCH_SIZE_INVALID",
            "Bulk batch-size maximum must be positive.", "$.BatchSize");
    }

    [Fact]
    public void Dml_target_column_duplicates_have_exact_later_paths()
    {
        var table = AstSamples.ObjectName("T");
        var id = AstSamples.Id("Id");
        var other = AstSamples.Id("Other");
        var duplicateColumns = Array.AsReadOnly(new[] { id, id });
        var row = new SqlInsertRow(new SqlExpression[]
        {
            BooleanExpression.True, BooleanExpression.False
        });

        var insert = InsertStatement.Values(
            table, new[] { id, other }, new[] { row });
        SetAutoProperty(insert, nameof(InsertStatement.Columns), duplicateColumns);
        Assert.Equal(
            new[]
            {
                "AST_DML_COLUMN_DUPLICATE\u001fDML target columns must be ordinally unique.\u001f$.Columns[1]"
            },
            Snapshot(new SqlAstValidator().Validate(insert)));

        var bulk = new BulkInsertOperation(
            table, new[] { id, other }, new[] { row }, batchSize: 10);
        SetAutoProperty(bulk, nameof(BulkInsertOperation.Columns), duplicateColumns);
        Assert.Equal(
            new[]
            {
                "AST_DML_COLUMN_DUPLICATE\u001fDML target columns must be ordinally unique.\u001f$.Columns[1]"
            },
            Snapshot(new SqlAstValidator().Validate(bulk)));

        var upsert = new UpsertStatement(
            table,
            new[] { id },
            new[]
            {
                new SqlAssignment(id, BooleanExpression.True),
                new SqlAssignment(other, BooleanExpression.False)
            },
            new[] { new SqlAssignment(other, BooleanExpression.True) });
        SetAutoProperty(upsert, nameof(UpsertStatement.ConflictKeys),
            duplicateColumns);
        Assert.Equal(
            new[]
            {
                "AST_DML_COLUMN_DUPLICATE\u001fDML target columns must be ordinally unique.\u001f$.ConflictKeys[1]"
            },
            Snapshot(new SqlAstValidator().Validate(upsert)));
    }

    [Fact]
    public void Schema_comment_ids_scope_and_resource_scalars_have_exact_paths()
    {
        var comment = new SchemaComment("valid");
        SetAutoProperty(comment, nameof(SchemaComment.Text), " ");
        AssertDiagnostic(
            new SetTableCommentOperation(AstSamples.ObjectName("T"), comment),
            "AST_SCALAR_INVALID", "SQL AST scalar value is invalid.",
            "$.Comment.Text");

        var stepId = new MigrationStepId("step");
        var operation = new SetTableCommentOperation(
            AstSamples.ObjectName("T"), new SchemaComment("x"));
        var step = new MigrationStep(
            stepId, operation, MigrationIdempotencyMode.RequireChange);
        var planId = new MigrationPlanId("plan");
        var plan = new MigrationPlan(planId, new[] { step });
        SetAutoProperty(planId, nameof(MigrationPlanId.Value), "");
        SetAutoProperty(stepId, nameof(MigrationStepId.Value), " ");
        Assert.Equal(
            new[] { "$.Id.Value", "$.Steps[0].Id.Value" },
            new SqlAstValidator().Validate(plan)
                .Where(item => item.Code == "AST_SCALAR_INVALID")
                .Select(item => item.Path).ToArray());

        var scope = SchemaScope.ForCatalogAndSchema(
            AstSamples.Id("catalog"), AstSamples.Id("schema"));
        SetAutoProperty(scope, nameof(SchemaScope.Schema), null);
        AssertDiagnostic(scope, "AST_STRUCTURAL_SHAPE_INVALID",
            "SQL AST structural shape is invalid.", "$.Schema");

        var digest = new ResourceContentDigest(new string('a', 64));
        var resource = new DatabaseResourceHandle(Guid.NewGuid(), digest);
        SetAutoProperty(resource, nameof(DatabaseResourceHandle.Id), Guid.Empty);
        SetAutoProperty(digest, nameof(ResourceContentDigest.Value), "ABC");
        var export = new DatabaseExportOperation(
            AstSamples.Id("db"), resource,
            DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaAndData);
        Assert.Equal(
            new[] { "$.Resource.Id", "$.Resource.ContentDigest.Value" },
            new SqlAstValidator().Validate(export)
                .Where(item => item.Code == "AST_SCALAR_INVALID")
                .Select(item => item.Path).ToArray());
    }

    [Fact]
    public void Generation_default_and_schema_collections_are_revalidated()
    {
        var column = new ColumnDefinition(
            AstSamples.Id("Id"), new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.NotNullable);
        SetAutoProperty(column, nameof(ColumnDefinition.Generation),
            new IdentityGenerationDefinition(1, 1));
        SetAutoProperty(column, nameof(ColumnDefinition.DefaultValue),
            new Int64DefaultDefinition(1));
        AssertDiagnostic(column, "AST_STRUCTURAL_SHAPE_INVALID",
            "SQL AST structural shape is invalid.", "$.DefaultValue");

        var firstIndexColumn = new IndexColumnDefinition(
            AstSamples.Id("Id"), SqlSortDirection.Ascending);
        var secondIndexColumn = new IndexColumnDefinition(
            AstSamples.Id("Value"), SqlSortDirection.Descending);
        var index = new IndexDefinition(
            AstSamples.Id("IX"), new[] { firstIndexColumn, secondIndexColumn },
            IndexUniqueness.NonUnique);
        SetAutoProperty(secondIndexColumn, nameof(IndexColumnDefinition.Column),
            firstIndexColumn.Column);
        AssertDiagnostic(index, "AST_COLLECTION_DUPLICATE",
            "SQL AST collection contains a duplicate logical name.",
            "$.Columns[1].Column");

        var fkColumns = new ForeignKeyColumnSet(
            new[] { AstSamples.Id("Id") }, new[] { AstSamples.Id("OtherId") });
        SetAutoProperty(fkColumns, nameof(ForeignKeyColumnSet.ReferencedColumns),
            Array.AsReadOnly(new[] { AstSamples.Id("OtherId"), AstSamples.Id("OtherId2") }));
        AssertDiagnostic(fkColumns, "AST_SCHEMA_FOREIGN_KEY_ARITY_MISMATCH",
            "Foreign-key local and referenced column counts must match.",
            "$.ReferencedColumns");
    }

    [Fact]
    public void Table_references_primary_key_and_foreign_key_actions_are_portable()
    {
        var id = AstSamples.Id("Id");
        var value = AstSamples.Id("Value");
        var columns = new[]
        {
            new ColumnDefinition(id, new SqlTypeDescriptor(LogicalDbType.Int32), ColumnNullability.Nullable),
            new ColumnDefinition(value, new SqlTypeDescriptor(LogicalDbType.Int32), ColumnNullability.NotNullable)
        };
        var primary = new PrimaryKeyDefinition(AstSamples.Id("PK"), new[] { id });
        var index = new IndexDefinition(
            AstSamples.Id("IX"),
            new[] { new IndexColumnDefinition(AstSamples.Id("Missing"), SqlSortDirection.Ascending) },
            IndexUniqueness.NonUnique);
        var foreign = new ForeignKeyDefinition(
            AstSamples.Id("FK"), AstSamples.ObjectName("Other"),
            new ForeignKeyColumnSet(new[] { value }, new[] { AstSamples.Id("OtherId") }),
            new ReferentialActions(ReferentialAction.SetNull, ReferentialAction.SetDefault));
        var table = new TableDefinition(
            AstSamples.ObjectName("T"), columns,
            new ConstraintDefinition[] { primary, foreign }, new[] { index });

        Assert.Equal(
            new[]
            {
                "AST_SCHEMA_PRIMARY_KEY_NULLABLE",
                "AST_SCHEMA_COLUMN_REFERENCE_MISSING",
                "AST_SCHEMA_REFERENTIAL_ACTION_INVALID",
                "AST_SCHEMA_REFERENTIAL_ACTION_INVALID"
            },
            new SqlAstValidator().Validate(table)
                .Where(item => item.Code.StartsWith("AST_SCHEMA_", StringComparison.Ordinal))
                .Select(item => item.Code).ToArray());
        var schemaPaths = new SqlAstValidator().Validate(table)
            .Where(item => item.Code.StartsWith("AST_SCHEMA_", StringComparison.Ordinal))
            .Select(item => item.Path).ToArray();
        Assert.Equal(
            new[]
            {
                "$.Columns[0].Nullability", "$.Indexes[0].Columns[0].Column",
                "$.Constraints[1].Actions.OnUpdate", "$.Constraints[1].Actions.OnDelete"
            }, schemaPaths);
    }

    [Fact]
    public void Column_default_and_generation_matrix_is_exact()
    {
        var badDefault = new ColumnDefinition(
            AstSamples.Id("Value"), new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable, defaultValue: new StringDefaultDefinition("x"));
        AssertDiagnostic(badDefault, "AST_SCHEMA_DEFAULT_TYPE_MISMATCH",
            "Column default is incompatible with its logical type.", "$.DefaultValue");

        var identity = new IdentityGenerationDefinition(40000, 1);
        var generated = new ColumnDefinition(
            AstSamples.Id("Id"), new SqlTypeDescriptor(LogicalDbType.Int64),
            ColumnNullability.NotNullable, generation: identity);
        SetAutoProperty(generated, nameof(ColumnDefinition.Type),
            new SqlTypeDescriptor(LogicalDbType.Int16));
        AssertDiagnostic(generated, "AST_SCHEMA_GENERATION_TYPE_MISMATCH",
            "Column generation is incompatible with its logical type.",
            "$.Generation.Seed");

        var nullDefault = new ColumnDefinition(
            AstSamples.Id("Required"), new SqlTypeDescriptor(LogicalDbType.String),
            ColumnNullability.NotNullable);
        SetAutoProperty(nullDefault, nameof(ColumnDefinition.DefaultValue),
            new NullDefaultDefinition());
        AssertDiagnostic(nullDefault, "AST_SCHEMA_DEFAULT_TYPE_MISMATCH",
            "Column default is incompatible with its logical type.", "$.DefaultValue");
    }

    [Fact]
    public void Sequence_range_and_alter_rules_have_exact_paths()
    {
        var options = new SequenceOptions(
            1, 40000, SequenceBounds.Between(1, 100), 10,
            SequenceCycleBehavior.NoCycle);
        var sequence = new SequenceDefinition(
            AstSamples.ObjectName("S"), LogicalDbType.Int16, options);
        AssertDiagnostic(sequence, "AST_SCHEMA_SEQUENCE_INVALID",
            "Sequence type, bounds, start, increment, or cache is invalid.",
            "$.Options.IncrementBy");

        var bounds = SequenceBounds.Between(1, 10);
        SetAutoProperty(bounds, nameof(SequenceBounds.MinimumValue), 20L);
        AssertDiagnostic(bounds, "AST_SCHEMA_SEQUENCE_INVALID",
            "Sequence type, bounds, start, increment, or cache is invalid.",
            "$.MaximumValue");

        var rename = new RenameTableOperation(
            AstSamples.ObjectName("A"), AstSamples.ObjectName("B"));
        SetAutoProperty(rename, nameof(RenameTableOperation.Target), rename.Source);
        AssertDiagnostic(rename, "AST_STRUCTURAL_SHAPE_INVALID",
            "SQL AST structural shape is invalid.", "$.Target");

        var before = new ColumnDefinition(
            AstSamples.Id("Value"), new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable);
        var after = new ColumnDefinition(
            AstSamples.Id("Value"), new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable);
        var alter = new AlterColumnOperation(AstSamples.ObjectName("T"), before, after);
        SetAutoProperty(after, nameof(ColumnDefinition.Name), AstSamples.Id("Changed"));
        AssertDiagnostic(alter, "AST_SCHEMA_ALTER_MISMATCH",
            "Before and after schema definitions do not identify the same object.",
            "$.After.Name");
    }

    [Fact]
    public void Migration_and_admin_shape_rules_are_revalidated()
    {
        var create = new CreateTableOperation(
            new TableDefinition(
                AstSamples.ObjectName("T"),
                new[]
                {
                    new ColumnDefinition(AstSamples.Id("Id"),
                        new SqlTypeDescriptor(LogicalDbType.Int32),
                        ColumnNullability.NotNullable)
                }),
            CreateObjectBehavior.FailIfExists);
        var step = new MigrationStep(
            new MigrationStepId("same"), create,
            MigrationIdempotencyMode.RequireChange);
        SetAutoProperty(step, nameof(MigrationStep.Idempotency),
            MigrationIdempotencyMode.AcceptAlreadySatisfied);
        AssertDiagnostic(step, "AST_MIGRATION_IDEMPOTENCY_MISMATCH",
            "Migration idempotency contradicts create or drop behavior.",
            "$.Idempotency");

        var plan = new MigrationPlan(new MigrationPlanId("plan"), new[] { step });
        SetAutoProperty(plan, nameof(MigrationPlan.Steps),
            Array.AsReadOnly(new[] { step, step }));
        AssertDiagnostic(plan, "AST_MIGRATION_STEP_ID_DUPLICATE",
            "Migration step IDs must be ordinally unique.", "$.Steps[1].Id");

        var resource = new DatabaseResourceHandle(
            Guid.NewGuid(), new ResourceContentDigest(new string('b', 64)));
        var import = new DatabaseImportOperation(
            AstSamples.Id("db"), resource,
            DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaOnly,
            DatabaseImportConflictPolicy.FailOnConflict);
        SetAutoProperty(import, nameof(DatabaseImportOperation.Policy),
            DatabaseImportConflictPolicy.ReplaceTargetDatabase);
        AssertDiagnostic(import, "AST_STRUCTURAL_SHAPE_INVALID",
            "SQL AST structural shape is invalid.", "$.Scope");
    }

    [Fact]
    public void Task8_pagination_order_is_root_from_cte_set()
    {
        SelectStatement InvalidPage() => new(
            new[] { new SelectProjection(BooleanExpression.True) },
            page: new OffsetPageSpec(0, 10));

        var root = new SelectStatement(
            new DerivedTableSource(InvalidPage(), new SqlAlias("d")),
            new[] { new SelectProjection(BooleanExpression.True) },
            page: new OffsetPageSpec(0, 10),
            commonTableExpressions: new[]
            {
                new CommonTableExpression(AstSamples.Id("c"), InvalidPage())
            },
            setOperations: new[]
            {
                new SetOperationClause(SqlSetOperator.Union, InvalidPage())
            });

        Assert.Equal(
            new[]
            {
                "$.Page", "$.From.Query.Page",
                "$.CommonTableExpressions[0].Query.Page",
                "$.SetOperations[0].RightQuery.Page"
            },
            new SqlAstValidator().Validate(root)
                .Where(item => item.Code == "AST_PAGE_ORDER_REQUIRED")
                .Select(item => item.Path).ToArray());
        Assert.Equal(
            new[]
            {
                "$.Page", "$.CommonTableExpressions[0].Query.Page",
                "$.From.Query.Page", "$.SetOperations[0].RightQuery.Page"
            },
            SqlAstRules.ValidateShape(root)
                .Select(item => item.Path).ToArray());
    }

    [Fact]
    public void Static_result_arity_requires_a_coherent_complete_set_chain()
    {
        SelectStatement Width(int count, params SetOperationClause[] sets) =>
            new(Enumerable.Range(0, count)
                    .Select(_ => new SelectProjection(BooleanExpression.True))
                    .ToArray(),
                setOperations: sets);

        var coherent = Width(1,
            new SetOperationClause(SqlSetOperator.Union, Width(1,
                new SetOperationClause(SqlSetOperator.UnionAll, Width(1)))));
        Assert.Equal(1, GetKnownResultColumnCount(coherent));
        Assert.DoesNotContain(new SqlAstValidator().Validate(coherent),
            item => item.Code == "AST_SET_OPERATION_ARITY_MISMATCH");

        var incoherentRight = Width(2,
            new SetOperationClause(SqlSetOperator.Union, Width(1)));
        var root = Width(1,
            new SetOperationClause(SqlSetOperator.Union, incoherentRight),
            new SetOperationClause(SqlSetOperator.Union, Width(2)));
        Assert.Null(GetKnownResultColumnCount(root));
        Assert.Equal(
            new[]
            {
                "$.SetOperations[1].RightQuery.Projections",
                "$.SetOperations[0].RightQuery.SetOperations[0].RightQuery.Projections"
            },
            new SqlAstValidator().Validate(root)
                .Where(item => item.Code == "AST_SET_OPERATION_ARITY_MISMATCH")
                .Select(item => item.Path).ToArray());
    }

    [Fact]
    public void Invalid_fingerprint_is_format_checked_and_unknown_nested_node_emits_once()
    {
        var step = new MigrationStep(
            new MigrationStepId("s"),
            new SetTableCommentOperation(
                AstSamples.ObjectName("T"), new SchemaComment("x")),
            MigrationIdempotencyMode.RequireChange);
        var plan = new MigrationPlan(new MigrationPlanId("p"), new[] { step });
        SetAutoProperty(plan.Fingerprint, nameof(StructuralFingerprint.Value),
            "sha256:NOT-LOWER-HEX");
        AssertDiagnostic(plan, "AST_SCALAR_INVALID",
            "SQL AST scalar value is invalid.", "$.Fingerprint.Value");

        var computed = Forge<ComputedGenerationDefinition>();
        SetAutoProperty(computed, nameof(ComputedGenerationDefinition.Expression),
            new UnknownSqlExpression());
        SetAutoProperty(computed, nameof(ComputedGenerationDefinition.Storage),
            ComputedStorageKind.Virtual);
        var diagnostics = new SqlAstValidator().Validate(computed)
            .Where(item => item.Code == "AST_UNKNOWN_NODE").ToArray();
        var diagnostic = Assert.Single(diagnostics);
        Assert.Equal("$.Expression", diagnostic.Path);
    }

    [Fact]
    public void Schema_leaf_occurrences_count_toward_4096()
    {
        TableDefinition WideTable(int count)
        {
            return new TableDefinition(
                AstSamples.ObjectName("Wide"),
                Enumerable.Range(0, count)
                    .Select(index => new ColumnDefinition(
                        AstSamples.Id("C" + index),
                        new SqlTypeDescriptor(LogicalDbType.Int32),
                        ColumnNullability.Nullable))
                    .ToArray());
        }

        Assert.DoesNotContain(
            new SqlAstValidator().Validate(WideTable(4095)),
            item => item.Code == "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED");
        var diagnostic = Assert.Single(
            new SqlAstValidator().Validate(WideTable(4096)),
            item => item.Code == "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED");
        Assert.Equal("$.Columns[4095]", diagnostic.Path);
    }

    [Fact]
    public async Task Diagnostics_are_deterministic_under_concurrency()
    {
        var root = UnsafeUpdate(new BinaryExpression(
            BooleanExpression.True, SqlBinaryOperator.Or,
            new ParameterExpression(new ParameterDefinition(
                "p", new SqlTypeDescriptor(LogicalDbType.Boolean)))));
        var validator = new SqlAstValidator();
        var expected = Snapshot(validator.Validate(root));

        var snapshots = await Task.WhenAll(
            Enumerable.Range(0, 50).Select(_ => Task.Run(() =>
                Snapshot(validator.Validate(root)))));

        Assert.All(snapshots, snapshot => Assert.Equal(expected, snapshot));
    }

    [Fact]
    public void Validator_rejects_null_root_with_exact_parameter_name()
    {
        var exception = Assert.Throws<ArgumentNullException>(() =>
            new SqlAstValidator().Validate(null!));

        Assert.Equal("root", exception.ParamName);
    }

    [Fact]
    public void Validator_returns_fresh_immutable_diagnostic_snapshots()
    {
        var validator = new SqlAstValidator();
        var root = new UnknownSqlNode();

        var first = validator.Validate(root);
        var second = validator.Validate(root);

        Assert.NotSame(first, second);
        Assert.Equal(Snapshot(first), Snapshot(second));
        var collection = Assert.IsAssignableFrom<ICollection<SqlAstDiagnostic>>(first);
        Assert.True(collection.IsReadOnly);
        Assert.Throws<NotSupportedException>(() => collection.Add(Assert.Single(first)));
    }

    [Fact]
    public void Parameter_type_and_migration_required_holders_fail_closed()
    {
        var type = new SqlTypeDescriptor(LogicalDbType.Int32);
        SetAutoProperty(type, nameof(SqlTypeDescriptor.Length), 0);
        var definition = new ParameterDefinition("p", type);
        AssertDiagnostic(new ParameterExpression(definition),
            "AST_PARAMETER_TYPE_INVALID",
            "Logical parameter type descriptor is invalid.",
            "$.Definition.Type");

        var step = new MigrationStep(
            new MigrationStepId("s"),
            new SetTableCommentOperation(
                AstSamples.ObjectName("T"), new SchemaComment("x")),
            MigrationIdempotencyMode.RequireChange);
        SetAutoProperty(step, nameof(MigrationStep.Id), null);
        AssertDiagnostic(step, "AST_REQUIRED_CHILD_MISSING",
            "SQL AST contains a missing required child.", "$.Id");
    }

    [Fact]
    public void Join_and_set_local_diagnostics_follow_frozen_order()
    {
        var join = new JoinSource(
            new NamedTableSource(AstSamples.ObjectName("L")),
            SqlJoinType.Inner,
            new NamedTableSource(AstSamples.ObjectName("R")),
            BooleanExpression.True);
        SetAutoProperty(join, nameof(JoinSource.Left), null);
        SetAutoProperty(join, nameof(JoinSource.Right), null);
        SetAutoProperty(join, nameof(JoinSource.JoinType), (SqlJoinType)999);
        SetAutoProperty(join, nameof(JoinSource.Condition), null);

        Assert.Equal(
            new[]
            {
                "AST_REQUIRED_CHILD_MISSING@$.Left",
                "AST_UNDEFINED_ENUM@$.JoinType",
                "AST_REQUIRED_CHILD_MISSING@$.Right"
            },
            new SqlAstValidator().Validate(join)
                .Select(item => item.Code + "@" + item.Path).ToArray());

        var set = new SetOperationClause(
            SqlSetOperator.Union,
            new SelectStatement(new[] { new SelectProjection(BooleanExpression.True) }));
        SetAutoProperty(set, nameof(SetOperationClause.RightQuery), null);
        SetAutoProperty(set, nameof(SetOperationClause.Operator), (SqlSetOperator)999);
        Assert.Equal(
            new[]
            {
                "AST_UNDEFINED_ENUM@$.Operator",
                "AST_REQUIRED_CHILD_MISSING@$.RightQuery"
            },
            new SqlAstValidator().Validate(set)
                .Select(item => item.Code + "@" + item.Path).ToArray());
    }

    [Fact]
    public void Unary_operator_diagnostic_precedes_missing_operand()
    {
        var unary = new UnaryExpression(
            SqlUnaryOperator.Not,
            BooleanExpression.True);
        SetAutoProperty(unary, nameof(UnaryExpression.Operator), (SqlUnaryOperator)999);
        SetAutoProperty(unary, nameof(UnaryExpression.Operand), null);

        Assert.Equal(
            new[]
            {
                "AST_UNDEFINED_ENUM\u001fSQL AST contains an undefined enumeration value.\u001f$.Operator",
                "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f$.Operand"
            },
            Snapshot(new SqlAstValidator().Validate(unary)));
    }

    [Fact]
    public void Function_registration_diagnostic_precedes_terminal_argument_observation()
    {
        var unregistered = (SemanticFunctionId)Assert.Single(
            typeof(SemanticFunctionId).GetConstructors(
                BindingFlags.Instance | BindingFlags.NonPublic)).Invoke(
                    new object?[] { "Private", 0, 0, false });
        var arguments = new IndexedSlotList<SqlExpression>(
            int.MaxValue,
            _ => BooleanExpression.False,
            poisonIndex: 16384,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var function = new FunctionExpression(
            SemanticFunctions.Concat,
            new[] { BooleanExpression.True });
        SetAutoProperty(function, nameof(FunctionExpression.Function), unregistered);
        SetAutoProperty(function, nameof(FunctionExpression.Arguments), arguments);

        Assert.Equal(
            new[]
            {
                "AST_FUNCTION_NOT_REGISTERED\u001fFunction must use the registered semantic catalog instance.\u001f$.Function",
                "AST_TRAVERSAL_COLLECTION_SLOT_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum collection slot inspection count 16384.\u001f$.Arguments[16384]"
            },
            Snapshot(new SqlAstValidator().Validate(function)));
        Assert.False(arguments.PoisonIndexWasRead);
        Assert.Equal(1, arguments.CountReads);
        Assert.Equal(16384, arguments.TotalReads);
    }

    [Fact]
    public void Page_scalar_ranges_are_fail_closed()
    {
        var offset = new OffsetPageSpec(0, 10);
        SetAutoProperty(offset, nameof(OffsetPageSpec.Offset), -1);
        SetAutoProperty(offset, nameof(OffsetPageSpec.Limit), 0);
        Assert.Equal(
            new[]
            {
                "AST_SCALAR_INVALID\u001fSQL AST scalar value is invalid.\u001f$.Offset",
                "AST_SCALAR_INVALID\u001fSQL AST scalar value is invalid.\u001f$.Limit"
            },
            Snapshot(new SqlAstValidator().Validate(offset)));

        var keyset = new KeysetPageSpec(Array.Empty<SqlExpression>(), 10);
        SetAutoProperty(keyset, nameof(KeysetPageSpec.Limit), 0);
        Assert.Equal(
            new[]
            {
                "AST_SCALAR_INVALID\u001fSQL AST scalar value is invalid.\u001f$.Limit"
            },
            Snapshot(new SqlAstValidator().Validate(keyset)));
    }

    [Fact]
    public void Schema_comment_and_ids_have_exact_scalar_paths()
    {
        var comment = new SchemaComment("valid");
        SetAutoProperty(comment, nameof(SchemaComment.Text), " ");
        Assert.Equal(
            new[]
            {
                "AST_SCALAR_INVALID\u001fSQL AST scalar value is invalid.\u001f$.Comment.Text"
            },
            Snapshot(new SqlAstValidator().Validate(
                new SetTableCommentOperation(
                    AstSamples.ObjectName("T"), comment))));

        var stepId = new MigrationStepId("step");
        var step = new MigrationStep(
            stepId,
            new SetTableCommentOperation(
                AstSamples.ObjectName("T"), new SchemaComment("x")),
            MigrationIdempotencyMode.RequireChange);
        var planId = new MigrationPlanId("plan");
        var plan = new MigrationPlan(planId, new[] { step });
        SetAutoProperty(planId, nameof(MigrationPlanId.Value), "");
        SetAutoProperty(stepId, nameof(MigrationStepId.Value), " ");
        Assert.Equal(
            new[]
            {
                "AST_SCALAR_INVALID\u001fSQL AST scalar value is invalid.\u001f$.Id.Value",
                "AST_SCALAR_INVALID\u001fSQL AST scalar value is invalid.\u001f$.Steps[0].Id.Value"
            },
            Snapshot(new SqlAstValidator().Validate(plan)));
    }

    [Fact]
    public void Resource_handle_id_and_digest_are_validated()
    {
        var digest = new ResourceContentDigest(new string('a', 64));
        var resource = new DatabaseResourceHandle(Guid.NewGuid(), digest);
        SetAutoProperty(resource, nameof(DatabaseResourceHandle.Id), Guid.Empty);
        SetAutoProperty(digest, nameof(ResourceContentDigest.Value), "ABC");
        var export = new DatabaseExportOperation(
            AstSamples.Id("db"), resource,
            DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaAndData);

        Assert.Equal(
            new[]
            {
                "AST_SCALAR_INVALID\u001fSQL AST scalar value is invalid.\u001f$.Resource.Id",
                "AST_SCALAR_INVALID\u001fSQL AST scalar value is invalid.\u001f$.Resource.ContentDigest.Value"
            },
            Snapshot(new SqlAstValidator().Validate(export)));
    }

    [Fact]
    public void Schema_scope_shape_is_fail_closed()
    {
        var scope = SchemaScope.ForCatalogAndSchema(
            AstSamples.Id("catalog"), AstSamples.Id("schema"));
        SetAutoProperty(scope, nameof(SchemaScope.Schema), null);
        Assert.Equal(
            new[]
            {
                "AST_STRUCTURAL_SHAPE_INVALID\u001fSQL AST structural shape is invalid.\u001f$.Schema"
            },
            Snapshot(new SqlAstValidator().Validate(scope)));
    }

    [Fact]
    public void Duplicate_diagnostic_belongs_to_later_item()
    {
        var query = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) });
        var select = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            commonTableExpressions: new[]
            {
                new CommonTableExpression(AstSamples.Id("dup"), query),
                new CommonTableExpression(AstSamples.Id("dup"), query)
            });
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_DUPLICATE\u001fSQL AST collection contains a duplicate logical name.\u001f$.CommonTableExpressions[1].Name"
            },
            Snapshot(new SqlAstValidator().Validate(select)));
    }

    [Fact]
    public void Parameter_conflict_has_exact_later_definition_path()
    {
        var expression = new BinaryExpression(
            new ParameterExpression(new ParameterDefinition(
                "same", new SqlTypeDescriptor(LogicalDbType.Int32))),
            SqlBinaryOperator.Equal,
            new ParameterExpression(new ParameterDefinition(
                "same", new SqlTypeDescriptor(LogicalDbType.String))));
        Assert.Equal(
            new[]
            {
                "AST_PARAMETER_DEFINITION_CONFLICT\u001fLogical parameter name has conflicting definitions.\u001f$.Right.Definition"
            },
            Snapshot(new SqlAstValidator().Validate(expression)));
    }

    [Fact]
    public void Local_diagnostics_precede_child_diagnostics()
    {
        var identifier = AstSamples.Id("valid");
        SetAutoProperty(identifier, nameof(SqlIdentifier.Value), "bad.identifier");
        var expression = new BinaryExpression(
            new ColumnExpression(identifier),
            SqlBinaryOperator.And,
            BooleanExpression.True);
        SetAutoProperty(expression, nameof(BinaryExpression.Operator),
            (SqlBinaryOperator)999);
        Assert.Equal(
            new[]
            {
                "AST_UNDEFINED_ENUM\u001fSQL AST contains an undefined enumeration value.\u001f$.Operator",
                "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.Left.Name"
            },
            Snapshot(new SqlAstValidator().Validate(expression)));
    }

    [Fact]
    public void Insert_select_known_result_arity_is_validated()
    {
        var source = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True),
            new SelectProjection(BooleanExpression.False)
        });
        var insert = InsertStatement.FromSelect(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Only") },
            source);
        Assert.Equal(
            new[]
            {
                "AST_INSERT_SOURCE_ARITY_MISMATCH\u001fInsert target columns must match the statically known source result-column count.\u001f$.Source.Projections"
            },
            Snapshot(new SqlAstValidator().Validate(insert)));
    }

    [Fact]
    public void Generation_and_default_are_mutually_exclusive()
    {
        var column = new ColumnDefinition(
            AstSamples.Id("Id"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.NotNullable);
        SetAutoProperty(column, nameof(ColumnDefinition.Generation),
            new IdentityGenerationDefinition(1, 1));
        SetAutoProperty(column, nameof(ColumnDefinition.DefaultValue),
            new Int64DefaultDefinition(1));
        Assert.Equal(
            new[]
            {
                "AST_STRUCTURAL_SHAPE_INVALID\u001fSQL AST structural shape is invalid.\u001f$.DefaultValue"
            },
            Snapshot(new SqlAstValidator().Validate(column)));
    }

    [Fact]
    public void Rename_noop_has_exact_target_path()
    {
        var rename = new RenameTableOperation(
            AstSamples.ObjectName("A"), AstSamples.ObjectName("B"));
        SetAutoProperty(rename, nameof(RenameTableOperation.Target), rename.Source);
        Assert.Equal(
            new[]
            {
                "AST_STRUCTURAL_SHAPE_INVALID\u001fSQL AST structural shape is invalid.\u001f$.Target"
            },
            Snapshot(new SqlAstValidator().Validate(rename)));
    }

    [Fact]
    public void Invalid_equal_rename_object_names_do_not_cascade_to_noop_shape()
    {
        var invalidIdentifier = AstSamples.Id("InvalidName");
        SetAutoProperty(
            invalidIdentifier, nameof(SqlIdentifier.Value), "bad.name");
        var invalidName = new SqlObjectName(invalidIdentifier);
        var rename = new RenameTableOperation(
            AstSamples.ObjectName("Source"), AstSamples.ObjectName("Target"));
        SetAutoProperty(rename, nameof(RenameTableOperation.Source), invalidName);
        SetAutoProperty(rename, nameof(RenameTableOperation.Target), invalidName);

        Assert.Equal(
            new[]
            {
                "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.Source.Name",
                "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.Target.Name"
            },
            Snapshot(new SqlAstValidator().Validate(rename)));
    }

    [Fact]
    public void Index_pk_unique_fk_collections_are_revalidated()
    {
        var id = AstSamples.Id("Id");
        var other = AstSamples.Id("Other");

        var firstIndexColumn = new IndexColumnDefinition(
            id, SqlSortDirection.Ascending);
        var secondIndexColumn = new IndexColumnDefinition(
            other, SqlSortDirection.Descending);
        var index = new IndexDefinition(
            AstSamples.Id("IX"),
            new[] { firstIndexColumn, secondIndexColumn },
            IndexUniqueness.NonUnique);
        SetAutoProperty(secondIndexColumn,
            nameof(IndexColumnDefinition.Column), id);
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_DUPLICATE\u001fSQL AST collection contains a duplicate logical name.\u001f$.Columns[1].Column"
            },
            Snapshot(new SqlAstValidator().Validate(index)));

        var primary = new PrimaryKeyDefinition(
            AstSamples.Id("PK"), new[] { id, other });
        SetAutoProperty(primary, nameof(PrimaryKeyDefinition.Columns),
            Array.AsReadOnly(new[] { id, id }));
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_DUPLICATE\u001fSQL AST collection contains a duplicate logical name.\u001f$.Columns[1]"
            },
            Snapshot(new SqlAstValidator().Validate(primary)));

        var unique = new UniqueConstraintDefinition(
            AstSamples.Id("UQ"), new[] { id, other });
        SetAutoProperty(unique, nameof(UniqueConstraintDefinition.Columns),
            Array.AsReadOnly(new[] { id, id }));
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_DUPLICATE\u001fSQL AST collection contains a duplicate logical name.\u001f$.Columns[1]"
            },
            Snapshot(new SqlAstValidator().Validate(unique)));

        var referenced = AstSamples.Id("Referenced");
        var referencedOther = AstSamples.Id("ReferencedOther");
        var foreign = new ForeignKeyColumnSet(
            new[] { id, other }, new[] { referenced, referencedOther });
        SetAutoProperty(foreign, nameof(ForeignKeyColumnSet.LocalColumns),
            Array.AsReadOnly(new[] { id, id }));
        SetAutoProperty(foreign, nameof(ForeignKeyColumnSet.ReferencedColumns),
            Array.AsReadOnly(new[] { referenced, referenced }));
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_DUPLICATE\u001fSQL AST collection contains a duplicate logical name.\u001f$.LocalColumns[1]",
                "AST_COLLECTION_DUPLICATE\u001fSQL AST collection contains a duplicate logical name.\u001f$.ReferencedColumns[1]"
            },
            Snapshot(new SqlAstValidator().Validate(foreign)));
    }

    [Fact]
    public void Table_index_reference_must_exist()
    {
        var table = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    AstSamples.Id("Id"),
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.NotNullable)
            },
            indexes: new[]
            {
                new IndexDefinition(
                    AstSamples.Id("IX"),
                    new[]
                    {
                        new IndexColumnDefinition(
                            AstSamples.Id("Missing"),
                            SqlSortDirection.Ascending)
                    },
                    IndexUniqueness.NonUnique)
            });
        Assert.Equal(
            new[]
            {
                "AST_SCHEMA_COLUMN_REFERENCE_MISSING\u001fSchema object references a column not declared by its table.\u001f$.Indexes[0].Columns[0].Column"
            },
            Snapshot(new SqlAstValidator().Validate(table)));
    }

    [Fact]
    public void Primary_key_column_must_be_not_nullable()
    {
        var id = AstSamples.Id("Id");
        var table = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    id,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable)
            },
            new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(AstSamples.Id("PK"), new[] { id })
            });
        Assert.Equal(
            new[]
            {
                "AST_SCHEMA_PRIMARY_KEY_NULLABLE\u001fPrimary-key columns must be not nullable.\u001f$.Columns[0].Nullability"
            },
            Snapshot(new SqlAstValidator().Validate(table)));
    }

    [Fact]
    public void Primary_key_missing_references_precede_all_nullable_diagnostics()
    {
        var id = AstSamples.Id("Id");
        var table = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    id,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable)
            },
            new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(
                    AstSamples.Id("PK"),
                    new[] { id, AstSamples.Id("Missing") })
            });

        Assert.Equal(
            new[]
            {
                "AST_SCHEMA_COLUMN_REFERENCE_MISSING\u001fSchema object references a column not declared by its table.\u001f$.Constraints[0].Columns[1]",
                "AST_SCHEMA_PRIMARY_KEY_NULLABLE\u001fPrimary-key columns must be not nullable.\u001f$.Columns[0].Nullability"
            },
            Snapshot(new SqlAstValidator().Validate(table)));
    }

    [Fact]
    public void Foreign_key_actions_use_update_then_delete_order()
    {
        var id = AstSamples.Id("Id");
        var foreign = new ForeignKeyDefinition(
            AstSamples.Id("FK"),
            AstSamples.ObjectName("Other"),
            new ForeignKeyColumnSet(
                new[] { id }, new[] { AstSamples.Id("OtherId") }),
            new ReferentialActions(
                ReferentialAction.SetNull,
                ReferentialAction.SetDefault));
        var table = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    id,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.NotNullable)
            },
            new ConstraintDefinition[] { foreign });
        Assert.Equal(
            new[]
            {
                "AST_SCHEMA_REFERENTIAL_ACTION_INVALID\u001fForeign-key referential action is incompatible with local columns.\u001f$.Constraints[0].Actions.OnUpdate",
                "AST_SCHEMA_REFERENTIAL_ACTION_INVALID\u001fForeign-key referential action is incompatible with local columns.\u001f$.Constraints[0].Actions.OnDelete"
            },
            Snapshot(new SqlAstValidator().Validate(table)));
    }

    [Fact]
    public void Column_default_matrix_is_exact()
    {
        var column = new ColumnDefinition(
            AstSamples.Id("Value"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable,
            defaultValue: new StringDefaultDefinition("x"));
        Assert.Equal(
            new[]
            {
                "AST_SCHEMA_DEFAULT_TYPE_MISMATCH\u001fColumn default is incompatible with its logical type.\u001f$.DefaultValue"
            },
            Snapshot(new SqlAstValidator().Validate(column)));
    }

    [Fact]
    public void Sequence_integer_values_fit_declared_type()
    {
        var sequence = new SequenceDefinition(
            AstSamples.ObjectName("S"),
            LogicalDbType.Int16,
            new SequenceOptions(
                1, 40000, SequenceBounds.Between(1, 100), 10,
                SequenceCycleBehavior.NoCycle));
        Assert.Equal(
            new[]
            {
                "AST_SCHEMA_SEQUENCE_INVALID\u001fSequence type, bounds, start, increment, or cache is invalid.\u001f$.Options.IncrementBy"
            },
            Snapshot(new SqlAstValidator().Validate(sequence)));
    }

    [Fact]
    public void Migration_idempotency_mapping_is_exact()
    {
        var id = AstSamples.Id("Id");
        var tableName = AstSamples.ObjectName("T");
        var table = new TableDefinition(
            tableName,
            new[]
            {
                new ColumnDefinition(
                    id, new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.NotNullable)
            });
        var index = new IndexDefinition(
            AstSamples.Id("IX"),
            new[]
            {
                new IndexColumnDefinition(id, SqlSortDirection.Ascending)
            },
            IndexUniqueness.NonUnique);
        var sequence = new SequenceDefinition(
            AstSamples.ObjectName("S"), LogicalDbType.Int64,
            new SequenceOptions(
                1, 1, SequenceBounds.Between(1, 100), 10,
                SequenceCycleBehavior.NoCycle));
        var schema = new SchemaName(AstSamples.Id("app"));

        var requireChangeCreates = new SchemaOperation[]
        {
            new CreateSchemaOperation(schema, CreateObjectBehavior.FailIfExists),
            new CreateTableOperation(table, CreateObjectBehavior.FailIfExists),
            new CreateIndexOperation(tableName, index, CreateObjectBehavior.FailIfExists),
            new CreateSequenceOperation(sequence, CreateObjectBehavior.FailIfExists)
        };
        var acceptSatisfiedCreates = new SchemaOperation[]
        {
            new CreateSchemaOperation(schema, CreateObjectBehavior.AlreadySatisfiedIfExists),
            new CreateTableOperation(table, CreateObjectBehavior.AlreadySatisfiedIfExists),
            new CreateIndexOperation(tableName, index, CreateObjectBehavior.AlreadySatisfiedIfExists),
            new CreateSequenceOperation(sequence, CreateObjectBehavior.AlreadySatisfiedIfExists)
        };
        var requireChangeDrops = new SchemaOperation[]
        {
            new DropSchemaOperation(schema, DropObjectBehavior.FailIfMissing, DropScope.Restrict),
            new DropTableOperation(tableName, DropObjectBehavior.FailIfMissing, DropScope.Restrict),
            new DropColumnOperation(tableName, id, DropObjectBehavior.FailIfMissing),
            new DropConstraintOperation(tableName, AstSamples.Id("PK"), DropObjectBehavior.FailIfMissing),
            new DropIndexOperation(tableName, index.Name, DropObjectBehavior.FailIfMissing),
            new DropSequenceOperation(sequence.Name, DropObjectBehavior.FailIfMissing)
        };
        var acceptSatisfiedDrops = new SchemaOperation[]
        {
            new DropSchemaOperation(schema, DropObjectBehavior.AlreadySatisfiedIfMissing, DropScope.Restrict),
            new DropTableOperation(tableName, DropObjectBehavior.AlreadySatisfiedIfMissing, DropScope.Restrict),
            new DropColumnOperation(tableName, id, DropObjectBehavior.AlreadySatisfiedIfMissing),
            new DropConstraintOperation(tableName, AstSamples.Id("PK"), DropObjectBehavior.AlreadySatisfiedIfMissing),
            new DropIndexOperation(tableName, index.Name, DropObjectBehavior.AlreadySatisfiedIfMissing),
            new DropSequenceOperation(sequence.Name, DropObjectBehavior.AlreadySatisfiedIfMissing)
        };

        foreach (var operation in requireChangeCreates.Concat(requireChangeDrops))
        {
            AssertIdempotencyMismatch(
                operation, MigrationIdempotencyMode.AcceptAlreadySatisfied);
        }
        foreach (var operation in acceptSatisfiedCreates.Concat(acceptSatisfiedDrops))
        {
            AssertIdempotencyMismatch(
                operation, MigrationIdempotencyMode.RequireChange);
        }
    }

    [Fact]
    public void Replacement_import_requires_schema_and_data()
    {
        var resource = new DatabaseResourceHandle(
            Guid.NewGuid(),
            new ResourceContentDigest(new string('b', 64)));
        var import = new DatabaseImportOperation(
            AstSamples.Id("db"), resource,
            DatabaseTransferFormat.PortableJson,
            DatabaseTransferScope.SchemaOnly,
            DatabaseImportConflictPolicy.FailOnConflict);
        SetAutoProperty(import, nameof(DatabaseImportOperation.Policy),
            DatabaseImportConflictPolicy.ReplaceTargetDatabase);
        Assert.Equal(
            new[]
            {
                "AST_STRUCTURAL_SHAPE_INVALID\u001fSQL AST structural shape is invalid.\u001f$.Scope"
            },
            Snapshot(new SqlAstValidator().Validate(import)));
    }

    [Fact]
    public void Diagnostics_never_leak_subtype_or_values()
    {
        var unknown = Assert.Single(
            new SqlAstValidator().Validate(new UnknownSqlNode()));
        Assert.Equal(
            "AST_UNKNOWN_NODE\u001fSQL AST contains an unknown node subtype.\u001f$",
            Snapshot(new[] { unknown })[0]);
        Assert.DoesNotContain(nameof(UnknownSqlNode), unknown.Message,
            StringComparison.Ordinal);

        var identifier = AstSamples.Id("valid");
        SetAutoProperty(identifier, nameof(SqlIdentifier.Value),
            "sentinel.identifier");
        var invalid = Assert.Single(new SqlAstValidator().Validate(
            new ColumnExpression(identifier)));
        Assert.Equal(
            "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.Name",
            Snapshot(new[] { invalid })[0]);
        Assert.DoesNotContain("sentinel", invalid.Message,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Node_limit_diagnostic_is_final()
    {
        var invalidIdentifier = AstSamples.Id("valid");
        SetAutoProperty(invalidIdentifier, nameof(SqlIdentifier.Value),
            "later.invalid");
        var root = new SelectStatement(new[]
        {
            new SelectProjection(WideIn(4095)),
            new SelectProjection(new ColumnExpression(invalidIdentifier))
        });
        Assert.Equal(
            new[]
            {
                "AST_TRAVERSAL_NODE_LIMIT_EXCEEDED\u001fSQL AST traversal exceeds maximum node occurrence count 4096.\u001f$.Projections[0].Expression.Values[4092]"
            },
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Fact]
    public void Cte_known_result_arity_is_validated()
    {
        var query = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True),
            new SelectProjection(BooleanExpression.False)
        });
        var cte = new CommonTableExpression(
            AstSamples.Id("C"), query,
            new[] { AstSamples.Id("Only") });
        Assert.Equal(
            new[]
            {
                "AST_CTE_COLUMN_ARITY_MISMATCH\u001fCTE column aliases must match the statically known query result-column count.\u001f$.Columns"
            },
            Snapshot(new SqlAstValidator().Validate(cte)));
    }

    [Fact]
    public void Set_operation_known_branch_arity_is_validated_in_order()
    {
        SelectStatement Width(int count) => new(
            Enumerable.Range(0, count)
                .Select(_ => new SelectProjection(BooleanExpression.True))
                .ToArray());
        var root = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            setOperations: new[]
            {
                new SetOperationClause(SqlSetOperator.Union, Width(2)),
                new SetOperationClause(SqlSetOperator.UnionAll, Width(2))
            });
        Assert.Equal(
            new[]
            {
                "AST_SET_OPERATION_ARITY_MISMATCH\u001fSet-operation branches must have the same statically known result-column count.\u001f$.SetOperations[0].RightQuery.Projections",
                "AST_SET_OPERATION_ARITY_MISMATCH\u001fSet-operation branches must have the same statically known result-column count.\u001f$.SetOperations[1].RightQuery.Projections"
            },
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Fact]
    public void Invalid_collection_prerequisites_do_not_cascade()
    {
        var id = AstSamples.Id("Id");
        var tableName = AstSamples.ObjectName("T");
        var insert = InsertStatement.Values(
            tableName,
            new[] { id },
            new[]
            {
                new SqlInsertRow(new[] { BooleanExpression.True })
            });
        SetAutoProperty(insert, nameof(InsertStatement.Columns),
            Array.AsReadOnly(Array.Empty<SqlIdentifier>()));
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_EMPTY\u001fRequired SQL AST collection is empty.\u001f$.Columns"
            },
            Snapshot(new SqlAstValidator().Validate(insert)));

        var nullRowInsert = InsertStatement.Values(
            tableName,
            new[] { id },
            new[]
            {
                new SqlInsertRow(new[] { BooleanExpression.True })
            });
        SetAutoProperty(nullRowInsert, nameof(InsertStatement.Rows),
            Array.AsReadOnly<SqlInsertRow>(new SqlInsertRow[] { null! }));
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_NULL_ITEM\u001fSQL AST collection contains a null item.\u001f$.Rows[0]"
            },
            Snapshot(new SqlAstValidator().Validate(nullRowInsert)));

        var other = AstSamples.Id("Other");
        var upsert = new UpsertStatement(
            tableName,
            new[] { id },
            new[]
            {
                new SqlAssignment(id, BooleanExpression.True),
                new SqlAssignment(other, BooleanExpression.False)
            },
            new[]
            {
                new SqlAssignment(other, BooleanExpression.True)
            });
        SetAutoProperty(upsert, nameof(UpsertStatement.InsertAssignments),
            Array.AsReadOnly(Array.Empty<SqlAssignment>()));
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_EMPTY\u001fRequired SQL AST collection is empty.\u001f$.InsertAssignments"
            },
            Snapshot(new SqlAstValidator().Validate(upsert)));

        var cteQuery = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True),
            new SelectProjection(BooleanExpression.False)
        });
        var cte = new CommonTableExpression(
            AstSamples.Id("C"), cteQuery,
            new[] { AstSamples.Id("Only") });
        SetAutoProperty(cte, nameof(CommonTableExpression.Columns),
            Array.AsReadOnly<SqlIdentifier>(new SqlIdentifier[] { null! }));
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_NULL_ITEM\u001fSQL AST collection contains a null item.\u001f$.Columns[0]"
            },
            Snapshot(new SqlAstValidator().Validate(cte)));

        var nullCteSelect = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) });
        SetAutoProperty(
            nullCteSelect,
            nameof(SelectStatement.CommonTableExpressions),
            Array.AsReadOnly<CommonTableExpression>(
                new CommonTableExpression[] { null! }));
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_NULL_ITEM\u001fSQL AST collection contains a null item.\u001f$.CommonTableExpressions[0]"
            },
            Snapshot(new SqlAstValidator().Validate(nullCteSelect)));

        var table = new TableDefinition(
            tableName,
            new[]
            {
                new ColumnDefinition(
                    id, new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.NotNullable)
            },
            new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(AstSamples.Id("PK"), new[] { id })
            },
            new[]
            {
                new IndexDefinition(
                    AstSamples.Id("IX"),
                    new[]
                    {
                        new IndexColumnDefinition(
                            id, SqlSortDirection.Ascending)
                    },
                    IndexUniqueness.Unique)
            });
        SetAutoProperty(table, nameof(TableDefinition.Columns),
            Array.AsReadOnly(Array.Empty<ColumnDefinition>()));
        Assert.Equal(
            new[]
            {
                "AST_COLLECTION_EMPTY\u001fRequired SQL AST collection is empty.\u001f$.Columns"
            },
            Snapshot(new SqlAstValidator().Validate(table)));
    }

    [Fact]
    public void Invalid_upsert_assignment_column_does_not_cascade_to_shape()
    {
        var conflictKey = AstSamples.Id("Id");
        var insertKey = AstSamples.Id("Id");
        var valueColumn = AstSamples.Id("Value");
        var keyAssignment = new SqlAssignment(
            insertKey, BooleanExpression.True);
        var upsert = new UpsertStatement(
            AstSamples.ObjectName("T"),
            new[] { conflictKey },
            new[]
            {
                keyAssignment,
                new SqlAssignment(valueColumn, BooleanExpression.False)
            },
            new[]
            {
                new SqlAssignment(valueColumn, BooleanExpression.True)
            });
        SetAutoProperty(insertKey, nameof(SqlIdentifier.Value), "bad.name");

        Assert.Equal(
            new[]
            {
                "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f$.InsertAssignments[0].Column"
            },
            Snapshot(new SqlAstValidator().Validate(upsert)));
    }

    [Fact]
    public void Invalid_upsert_assignment_value_preserves_column_shape_diagnostic()
    {
        var insertColumn = AstSamples.Id("Id");
        var valueAssignment = new SqlAssignment(
            insertColumn, BooleanExpression.True);
        var upsert = new UpsertStatement(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Id") },
            new[] { valueAssignment },
            Array.Empty<SqlAssignment>(),
            ConflictPolicy.DoNothing);
        SetAutoProperty(
            insertColumn, nameof(SqlIdentifier.Value), "Value");
        SetAutoProperty(
            valueAssignment, nameof(SqlAssignment.Value), null);

        Assert.Equal(
            new[]
            {
                "AST_UPSERT_SHAPE_INVALID\u001fUpsert conflict policy, keys, and assignments are inconsistent.\u001f$.InsertAssignments",
                "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f$.InsertAssignments[0].Value"
            },
            Snapshot(new SqlAstValidator().Validate(upsert)));
    }

    [Fact]
    public void Invalid_upsert_update_value_preserves_conflict_key_shape_diagnostic()
    {
        var conflictKey = AstSamples.Id("Id");
        var updateAssignment = new SqlAssignment(
            AstSamples.Id("Value"), BooleanExpression.True);
        var upsert = new UpsertStatement(
            AstSamples.ObjectName("T"),
            new[] { conflictKey },
            new[]
            {
                new SqlAssignment(
                    AstSamples.Id("Id"), BooleanExpression.True)
            },
            new[] { updateAssignment });
        SetAutoProperty(
            updateAssignment, nameof(SqlAssignment.Column), conflictKey);
        SetAutoProperty(
            updateAssignment, nameof(SqlAssignment.Value), null);

        Assert.Equal(
            new[]
            {
                UpsertShapeInvalidEntry("$.UpdateAssignments[0].Column"),
                RequiredMissingEntry("$.UpdateAssignments[0].Value")
            },
            Snapshot(new SqlAstValidator().Validate(upsert)));
    }

    [Fact]
    public void Invalid_upsert_update_column_does_not_hide_later_conflict_key_shape()
    {
        var conflictKey = AstSamples.Id("Id");
        var firstColumn = AstSamples.Id("First");
        var secondAssignment = new SqlAssignment(
            AstSamples.Id("Second"), BooleanExpression.False);
        var upsert = new UpsertStatement(
            AstSamples.ObjectName("T"),
            new[] { conflictKey },
            new[]
            {
                new SqlAssignment(
                    AstSamples.Id("Id"), BooleanExpression.True)
            },
            new[]
            {
                new SqlAssignment(firstColumn, BooleanExpression.True),
                secondAssignment
            });
        SetAutoProperty(
            firstColumn, nameof(SqlIdentifier.Value), "bad.name");
        SetAutoProperty(
            secondAssignment, nameof(SqlAssignment.Column), conflictKey);

        Assert.Equal(
            new[]
            {
                UpsertShapeInvalidEntry("$.UpdateAssignments[1].Column"),
                InvalidIdentifierEntry("$.UpdateAssignments[0].Column")
            },
            Snapshot(new SqlAstValidator().Validate(upsert)));
    }

    [Fact]
    public void Upsert_policy_shape_diagnostics_have_exact_anchors()
    {
        var updateExisting = new UpsertStatement(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Id") },
            new[]
            {
                new SqlAssignment(
                    AstSamples.Id("Id"), BooleanExpression.True)
            },
            new[]
            {
                new SqlAssignment(
                    AstSamples.Id("Value"), BooleanExpression.False)
            });
        SetAutoProperty(
            updateExisting,
            nameof(UpsertStatement.UpdateAssignments),
            Array.AsReadOnly(Array.Empty<SqlAssignment>()));
        Assert.Equal(
            new[]
            {
                UpsertShapeInvalidEntry("$.UpdateAssignments")
            },
            Snapshot(new SqlAstValidator().Validate(updateExisting)));

        var malformedUpdate = new SqlAssignment(
            AstSamples.Id("Value"), BooleanExpression.True);
        var doNothing = new UpsertStatement(
            AstSamples.ObjectName("T"),
            new[] { AstSamples.Id("Id") },
            new[]
            {
                new SqlAssignment(
                    AstSamples.Id("Id"), BooleanExpression.True)
            },
            Array.Empty<SqlAssignment>(),
            ConflictPolicy.DoNothing);
        SetAutoProperty(
            malformedUpdate, nameof(SqlAssignment.Value), null);
        SetAutoProperty(
            doNothing,
            nameof(UpsertStatement.UpdateAssignments),
            Array.AsReadOnly(new[] { malformedUpdate }));
        Assert.Equal(
            new[]
            {
                UpsertShapeInvalidEntry("$.Policy"),
                RequiredMissingEntry("$.UpdateAssignments[0].Value")
            },
            Snapshot(new SqlAstValidator().Validate(doNothing)));
    }

    [Fact]
    public void Invalid_assignment_value_preserves_duplicate_column_diagnostic()
    {
        var secondColumn = AstSamples.Id("Other");
        var first = new SqlAssignment(
            AstSamples.Id("Value"), BooleanExpression.True);
        var second = new SqlAssignment(
            secondColumn, BooleanExpression.False);
        var update = new UpdateStatement(
            AstSamples.ObjectName("T"),
            new[] { first, second },
            allowAllRows: true);
        SetAutoProperty(
            secondColumn, nameof(SqlIdentifier.Value), "Value");
        SetAutoProperty(first, nameof(SqlAssignment.Value), null);

        Assert.Equal(
            new[]
            {
                "AST_DML_ASSIGNMENT_DUPLICATE\u001fDML assignments must target ordinally unique columns.\u001f$.Assignments[1].Column",
                "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f$.Assignments[0].Value"
            },
            Snapshot(new SqlAstValidator().Validate(update)));
    }

    [Fact]
    public void Invalid_alter_column_names_do_not_cascade_to_mismatch()
    {
        var beforeName = AstSamples.Id("Value");
        var afterName = AstSamples.Id("Value");
        var before = new ColumnDefinition(
            beforeName,
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable);
        var after = new ColumnDefinition(
            afterName,
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable);
        var alter = new AlterColumnOperation(
            AstSamples.ObjectName("T"), before, after);
        SetAutoProperty(
            beforeName, nameof(SqlIdentifier.Value), "bad.before");
        SetAutoProperty(
            afterName, nameof(SqlIdentifier.Value), "bad.after");

        Assert.Equal(
            new[]
            {
                InvalidIdentifierEntry("$.Before.Name"),
                InvalidIdentifierEntry("$.After.Name")
            },
            Snapshot(new SqlAstValidator().Validate(alter)));
    }

    [Fact]
    public void Invalid_alter_column_comment_does_not_cascade_to_mismatch()
    {
        var beforeComment = new SchemaComment("same");
        var afterComment = new SchemaComment("same");
        var before = new ColumnDefinition(
            AstSamples.Id("Value"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable,
            comment: beforeComment);
        var after = new ColumnDefinition(
            AstSamples.Id("Value"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable,
            comment: afterComment);
        var alter = new AlterColumnOperation(
            AstSamples.ObjectName("T"), before, after);
        SetAutoProperty(
            beforeComment, nameof(SchemaComment.Text), " ");
        SetAutoProperty(after, nameof(ColumnDefinition.Comment), null);

        Assert.Equal(
            new[]
            {
                ScalarInvalidEntry("$.Before.Comment.Text")
            },
            Snapshot(new SqlAstValidator().Validate(alter)));
    }

    [Fact]
    public void Alter_column_comment_mismatch_has_exact_after_comment_path()
    {
        var before = new ColumnDefinition(
            AstSamples.Id("Value"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable,
            comment: new SchemaComment("before"));
        var after = new ColumnDefinition(
            AstSamples.Id("Value"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable,
            comment: new SchemaComment("before"));
        var alter = new AlterColumnOperation(
            AstSamples.ObjectName("T"), before, after);
        SetAutoProperty(
            after,
            nameof(ColumnDefinition.Comment),
            new SchemaComment("after"));

        Assert.Equal(
            new[]
            {
                SchemaAlterMismatchEntry("$.After.Comment")
            },
            Snapshot(new SqlAstValidator().Validate(alter)));
    }

    [Fact]
    public void Invalid_alter_column_comment_preserves_name_mismatch()
    {
        var invalidComment = new SchemaComment("before");
        var before = new ColumnDefinition(
            AstSamples.Id("Value"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable,
            comment: invalidComment);
        var after = new ColumnDefinition(
            AstSamples.Id("Value"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable,
            comment: new SchemaComment("before"));
        var alter = new AlterColumnOperation(
            AstSamples.ObjectName("T"), before, after);
        SetAutoProperty(
            after,
            nameof(ColumnDefinition.Name),
            AstSamples.Id("Changed"));
        SetAutoProperty(
            invalidComment, nameof(SchemaComment.Text), " ");

        Assert.Equal(
            new[]
            {
                SchemaAlterMismatchEntry("$.After.Name"),
                ScalarInvalidEntry("$.Before.Comment.Text")
            },
            Snapshot(new SqlAstValidator().Validate(alter)));
    }

    [Fact]
    public void Invalid_alter_sequence_names_do_not_cascade_to_mismatch()
    {
        var beforeName = AstSamples.ObjectName("Sequence");
        var afterName = AstSamples.ObjectName("Sequence");
        var options = new SequenceOptions(
            1,
            1,
            SequenceBounds.Between(1, 100),
            10,
            SequenceCycleBehavior.NoCycle);
        var before = new SequenceDefinition(
            beforeName, LogicalDbType.Int64, options);
        var after = new SequenceDefinition(
            afterName, LogicalDbType.Int64, options);
        var alter = new AlterSequenceOperation(before, after);
        SetAutoProperty(
            beforeName.Name, nameof(SqlIdentifier.Value), "bad.before");
        SetAutoProperty(
            afterName.Name, nameof(SqlIdentifier.Value), "bad.after");

        Assert.Equal(
            new[]
            {
                InvalidIdentifierEntry("$.Before.Name.Name"),
                InvalidIdentifierEntry("$.After.Name.Name")
            },
            Snapshot(new SqlAstValidator().Validate(alter)));
    }

    [Fact]
    public void Invalid_alter_sequence_options_preserve_name_mismatch()
    {
        var beforeOptions = new SequenceOptions(
            1,
            1,
            SequenceBounds.Between(1, 100),
            10,
            SequenceCycleBehavior.NoCycle);
        var before = new SequenceDefinition(
            AstSamples.ObjectName("Sequence"),
            LogicalDbType.Int64,
            beforeOptions);
        var after = new SequenceDefinition(
            AstSamples.ObjectName("Sequence"),
            LogicalDbType.Int64,
            new SequenceOptions(
                1,
                1,
                SequenceBounds.Between(1, 100),
                10,
                SequenceCycleBehavior.NoCycle));
        var alter = new AlterSequenceOperation(before, after);
        SetAutoProperty(
            after,
            nameof(SequenceDefinition.Name),
            AstSamples.ObjectName("Changed"));
        SetAutoProperty(
            beforeOptions, nameof(SequenceOptions.IncrementBy), 0L);

        Assert.Equal(
            new[]
            {
                SchemaAlterMismatchEntry("$.After.Name"),
                SequenceInvalidEntry("$.Before.Options.IncrementBy")
            },
            Snapshot(new SqlAstValidator().Validate(alter)));
    }

    [Fact]
    public void Invalid_schema_scope_catalog_does_not_cascade_to_shape()
    {
        var catalog = AstSamples.Id("Catalog");
        var scope = SchemaScope.ForCatalogAndSchema(
            catalog, AstSamples.Id("Schema"));
        SetAutoProperty(
            catalog, nameof(SqlIdentifier.Value), "bad.catalog");
        SetAutoProperty(scope, nameof(SchemaScope.Schema), null);

        Assert.Equal(
            new[]
            {
                InvalidIdentifierEntry("$.Catalog")
            },
            Snapshot(new SqlAstValidator().Validate(scope)));
    }

    [Theory]
    [MemberData(nameof(InvalidDuplicatePrerequisiteCases))]
    public void Invalid_duplicate_prerequisites_do_not_emit_duplicate(
        string caseName,
        SqlNode root,
        string[] expectedSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        Assert.Equal(
            expectedSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Theory]
    [MemberData(nameof(InvalidDuplicateNonKeyCases))]
    public void Valid_duplicate_keys_survive_invalid_non_key_fields(
        string caseName,
        SqlNode root,
        string[] expectedSnapshot)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        Assert.Equal(
            expectedSnapshot,
            Snapshot(new SqlAstValidator().Validate(root)));
    }

    [Fact]
    public void Unknown_constraint_occurrence_emits_exactly_one_diagnostic()
    {
        var table = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    AstSamples.Id("Id"),
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.NotNullable)
            });
        SetAutoProperty(table, nameof(TableDefinition.Constraints),
            Array.AsReadOnly<ConstraintDefinition>(new ConstraintDefinition[]
            {
                new UnknownConstraintDefinition(AstSamples.Id("Unknown"))
            }));

        Assert.Equal(
            new[]
            {
                "AST_UNKNOWN_NODE\u001fSQL AST contains an unknown node subtype.\u001f$.Constraints[0]"
            },
            Snapshot(new SqlAstValidator().Validate(table)));
    }

    private static SqlExpression UnaryChain(int edges)
    {
        SqlExpression current = BooleanExpression.True;
        for (var index = 0; index < edges; index++)
        {
            current = new UnaryExpression(SqlUnaryOperator.Not, current);
        }
        return current;
    }

    private static IEnumerable<object[]> InvalidDuplicatePrerequisiteSamples()
    {
        var identifierInvalid = AstSamples.Id("Invalid");
        var identifierDuplicateFirst = AstSamples.Id("Duplicate");
        var identifierDuplicateSecond = AstSamples.Id("Other");
        var primary = new PrimaryKeyDefinition(
            AstSamples.Id("PK"),
            new[]
            {
                identifierInvalid,
                identifierDuplicateFirst,
                identifierDuplicateSecond
            });
        SetAutoProperty(
            identifierInvalid, nameof(SqlIdentifier.Value), "bad.name");
        SetAutoProperty(
            identifierDuplicateSecond,
            nameof(SqlIdentifier.Value),
            identifierDuplicateFirst.Value);
        yield return new object[]
        {
            "identifier-collection",
            primary,
            new[]
            {
                InvalidIdentifierEntry("$.Columns[0]"),
                CollectionDuplicateEntry("$.Columns[2]")
            }
        };

        var assignmentInvalid = AstSamples.Id("Invalid");
        var assignmentDuplicateFirst = AstSamples.Id("Duplicate");
        var assignmentDuplicateSecond = AstSamples.Id("Other");
        var update = new UpdateStatement(
            AstSamples.ObjectName("T"),
            new[]
            {
                new SqlAssignment(
                    assignmentInvalid, BooleanExpression.True),
                new SqlAssignment(
                    assignmentDuplicateFirst, BooleanExpression.False),
                new SqlAssignment(
                    assignmentDuplicateSecond, BooleanExpression.True)
            },
            allowAllRows: true);
        SetAutoProperty(
            assignmentInvalid, nameof(SqlIdentifier.Value), "bad.name");
        SetAutoProperty(
            assignmentDuplicateSecond,
            nameof(SqlIdentifier.Value),
            assignmentDuplicateFirst.Value);
        yield return new object[]
        {
            "assignment-collection",
            update,
            new[]
            {
                AssignmentDuplicateEntry("$.Assignments[2].Column"),
                InvalidIdentifierEntry("$.Assignments[0].Column")
            }
        };

        var cteNameInvalid = AstSamples.Id("Invalid");
        var cteNameDuplicateFirst = AstSamples.Id("Duplicate");
        var cteNameDuplicateSecond = AstSamples.Id("Other");
        var malformedDuplicateCte = new CommonTableExpression(
            cteNameDuplicateSecond,
            new SelectStatement(new[]
            {
                new SelectProjection(BooleanExpression.True)
            }));
        var cteRoot = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            commonTableExpressions: new[]
            {
                new CommonTableExpression(
                    cteNameInvalid,
                    new SelectStatement(new[]
                    {
                        new SelectProjection(BooleanExpression.True)
                    })),
                new CommonTableExpression(
                    cteNameDuplicateFirst,
                    new SelectStatement(new[]
                    {
                        new SelectProjection(BooleanExpression.True)
                    })),
                malformedDuplicateCte
            });
        SetAutoProperty(
            cteNameInvalid, nameof(SqlIdentifier.Value), "bad.name");
        SetAutoProperty(
            cteNameDuplicateSecond,
            nameof(SqlIdentifier.Value),
            cteNameDuplicateFirst.Value);
        SetAutoProperty(
            malformedDuplicateCte,
            nameof(CommonTableExpression.Query),
            null);
        yield return new object[]
        {
            "named-cte-collection",
            cteRoot,
            new[]
            {
                CollectionDuplicateEntry(
                    "$.CommonTableExpressions[2].Name"),
                InvalidIdentifierEntry(
                    "$.CommonTableExpressions[0].Name"),
                RequiredMissingEntry(
                    "$.CommonTableExpressions[2].Query")
            }
        };

        var columnNameInvalid = AstSamples.Id("Invalid");
        var columnNameDuplicateFirst = AstSamples.Id("Duplicate");
        var columnNameDuplicateSecond = AstSamples.Id("Other");
        var namedColumns = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    columnNameInvalid,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable),
                new ColumnDefinition(
                    columnNameDuplicateFirst,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable),
                new ColumnDefinition(
                    columnNameDuplicateSecond,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable)
            });
        SetAutoProperty(
            columnNameInvalid, nameof(SqlIdentifier.Value), "bad.name");
        SetAutoProperty(
            columnNameDuplicateSecond,
            nameof(SqlIdentifier.Value),
            columnNameDuplicateFirst.Value);
        yield return new object[]
        {
            "named-column-collection",
            namedColumns,
            new[]
            {
                CollectionDuplicateEntry("$.Columns[2].Name"),
                InvalidIdentifierEntry("$.Columns[0].Name")
            }
        };

        var tableColumn = AstSamples.Id("Id");
        var constraintNameInvalid = AstSamples.Id("Invalid");
        var constraintNameDuplicateFirst = AstSamples.Id("Duplicate");
        var constraintNameDuplicateSecond = AstSamples.Id("Other");
        var namedConstraints = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    tableColumn,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.NotNullable)
            },
            new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(
                    constraintNameInvalid, new[] { tableColumn }),
                new UniqueConstraintDefinition(
                    constraintNameDuplicateFirst, new[] { tableColumn }),
                new UniqueConstraintDefinition(
                    constraintNameDuplicateSecond, new[] { tableColumn })
            });
        SetAutoProperty(
            constraintNameInvalid, nameof(SqlIdentifier.Value), "bad.name");
        SetAutoProperty(
            constraintNameDuplicateSecond,
            nameof(SqlIdentifier.Value),
            constraintNameDuplicateFirst.Value);
        yield return new object[]
        {
            "named-constraint-collection",
            namedConstraints,
            new[]
            {
                CollectionDuplicateEntry("$.Constraints[2].Name"),
                InvalidIdentifierEntry("$.Constraints[0].Name")
            }
        };

        var indexTableColumn = AstSamples.Id("Id");
        var indexNameInvalid = AstSamples.Id("Invalid");
        var indexNameDuplicateFirst = AstSamples.Id("Duplicate");
        var indexNameDuplicateSecond = AstSamples.Id("Other");
        var namedIndexes = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    indexTableColumn,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable)
            },
            indexes: new[]
            {
                new IndexDefinition(
                    indexNameInvalid,
                    new[]
                    {
                        new IndexColumnDefinition(
                            indexTableColumn,
                            SqlSortDirection.Ascending)
                    },
                    IndexUniqueness.NonUnique),
                new IndexDefinition(
                    indexNameDuplicateFirst,
                    new[]
                    {
                        new IndexColumnDefinition(
                            indexTableColumn,
                            SqlSortDirection.Ascending)
                    },
                    IndexUniqueness.NonUnique),
                new IndexDefinition(
                    indexNameDuplicateSecond,
                    new[]
                    {
                        new IndexColumnDefinition(
                            indexTableColumn,
                            SqlSortDirection.Ascending)
                    },
                    IndexUniqueness.NonUnique)
            });
        SetAutoProperty(
            indexNameInvalid, nameof(SqlIdentifier.Value), "bad.name");
        SetAutoProperty(
            indexNameDuplicateSecond,
            nameof(SqlIdentifier.Value),
            indexNameDuplicateFirst.Value);
        yield return new object[]
        {
            "named-index-collection",
            namedIndexes,
            new[]
            {
                CollectionDuplicateEntry("$.Indexes[2].Name"),
                InvalidIdentifierEntry("$.Indexes[0].Name")
            }
        };

        var indexColumnInvalid = AstSamples.Id("Invalid");
        var indexColumnDuplicateFirst = AstSamples.Id("Duplicate");
        var indexColumnDuplicateSecond = AstSamples.Id("Other");
        var indexDefinition = new IndexDefinition(
            AstSamples.Id("IX"),
            new[]
            {
                new IndexColumnDefinition(
                    indexColumnInvalid, SqlSortDirection.Ascending),
                new IndexColumnDefinition(
                    indexColumnDuplicateFirst,
                    SqlSortDirection.Descending),
                new IndexColumnDefinition(
                    indexColumnDuplicateSecond,
                    SqlSortDirection.Ascending)
            },
            IndexUniqueness.NonUnique);
        SetAutoProperty(
            indexColumnInvalid, nameof(SqlIdentifier.Value), "bad.name");
        SetAutoProperty(
            indexColumnDuplicateSecond,
            nameof(SqlIdentifier.Value),
            indexColumnDuplicateFirst.Value);
        yield return new object[]
        {
            "index-column-collection",
            indexDefinition,
            new[]
            {
                CollectionDuplicateEntry("$.Columns[2].Column"),
                InvalidIdentifierEntry("$.Columns[0].Column")
            }
        };

        var stepIdInvalid = new MigrationStepId("invalid");
        var stepIdDuplicateFirst = new MigrationStepId("duplicate");
        var stepIdDuplicateSecond = new MigrationStepId("other");
        var migrationPlan = new MigrationPlan(
            new MigrationPlanId("plan"),
            new[]
            {
                new MigrationStep(
                    stepIdInvalid,
                    new SetTableCommentOperation(
                        AstSamples.ObjectName("T"),
                        new SchemaComment("first")),
                    MigrationIdempotencyMode.RequireChange),
                new MigrationStep(
                    stepIdDuplicateFirst,
                    new SetTableCommentOperation(
                        AstSamples.ObjectName("T"),
                        new SchemaComment("second")),
                    MigrationIdempotencyMode.RequireChange),
                new MigrationStep(
                    stepIdDuplicateSecond,
                    new SetTableCommentOperation(
                        AstSamples.ObjectName("T"),
                        new SchemaComment("third")),
                    MigrationIdempotencyMode.RequireChange)
            });
        SetAutoProperty(stepIdInvalid, nameof(MigrationStepId.Value), " ");
        SetAutoProperty(
            stepIdDuplicateSecond,
            nameof(MigrationStepId.Value),
            stepIdDuplicateFirst.Value);
        yield return new object[]
        {
            "migration-step-collection",
            migrationPlan,
            new[]
            {
                MigrationStepDuplicateEntry("$.Steps[2].Id"),
                ScalarInvalidEntry("$.Steps[0].Id.Value")
            }
        };
    }

    private static IEnumerable<object[]> InvalidDuplicateNonKeySamples()
    {
        var columnNameFirst = AstSamples.Id("First");
        var columnNameDuplicateFirst = AstSamples.Id("Duplicate");
        var columnNameDuplicateSecond = AstSamples.Id("Other");
        var invalidTypeColumn = new ColumnDefinition(
            columnNameDuplicateSecond,
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable);
        var namedColumns = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    columnNameFirst,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable),
                new ColumnDefinition(
                    columnNameDuplicateFirst,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable),
                invalidTypeColumn
            });
        SetAutoProperty(
            columnNameDuplicateSecond,
            nameof(SqlIdentifier.Value),
            columnNameDuplicateFirst.Value);
        SetAutoProperty(
            invalidTypeColumn, nameof(ColumnDefinition.Type), null);
        yield return new object[]
        {
            "named-column-non-key-invalid",
            namedColumns,
            new[]
            {
                CollectionDuplicateEntry("$.Columns[2].Name"),
                RequiredMissingEntry("$.Columns[2].Type")
            }
        };

        var tableColumn = AstSamples.Id("Id");
        var constraintNameDuplicateFirst = AstSamples.Id("Duplicate");
        var constraintNameDuplicateSecond = AstSamples.Id("Other");
        var invalidColumnsConstraint = new UniqueConstraintDefinition(
            constraintNameDuplicateSecond, new[] { tableColumn });
        var namedConstraints = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    tableColumn,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.NotNullable)
            },
            new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(
                    AstSamples.Id("First"), new[] { tableColumn }),
                new UniqueConstraintDefinition(
                    constraintNameDuplicateFirst, new[] { tableColumn }),
                invalidColumnsConstraint
            });
        SetAutoProperty(
            constraintNameDuplicateSecond,
            nameof(SqlIdentifier.Value),
            constraintNameDuplicateFirst.Value);
        SetAutoProperty(
            invalidColumnsConstraint,
            nameof(UniqueConstraintDefinition.Columns),
            Array.AsReadOnly(Array.Empty<SqlIdentifier>()));
        yield return new object[]
        {
            "named-constraint-non-key-invalid",
            namedConstraints,
            new[]
            {
                CollectionDuplicateEntry("$.Constraints[2].Name"),
                CollectionEmptyEntry("$.Constraints[2].Columns")
            }
        };

        var indexTableColumn = AstSamples.Id("Id");
        var indexNameDuplicateFirst = AstSamples.Id("Duplicate");
        var indexNameDuplicateSecond = AstSamples.Id("Other");
        var invalidColumnsIndex = new IndexDefinition(
            indexNameDuplicateSecond,
            new[]
            {
                new IndexColumnDefinition(
                    indexTableColumn, SqlSortDirection.Ascending)
            },
            IndexUniqueness.NonUnique);
        var namedIndexes = new TableDefinition(
            AstSamples.ObjectName("T"),
            new[]
            {
                new ColumnDefinition(
                    indexTableColumn,
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable)
            },
            indexes: new[]
            {
                new IndexDefinition(
                    AstSamples.Id("First"),
                    new[]
                    {
                        new IndexColumnDefinition(
                            indexTableColumn,
                            SqlSortDirection.Ascending)
                    },
                    IndexUniqueness.NonUnique),
                new IndexDefinition(
                    indexNameDuplicateFirst,
                    new[]
                    {
                        new IndexColumnDefinition(
                            indexTableColumn,
                            SqlSortDirection.Ascending)
                    },
                    IndexUniqueness.NonUnique),
                invalidColumnsIndex
            });
        SetAutoProperty(
            indexNameDuplicateSecond,
            nameof(SqlIdentifier.Value),
            indexNameDuplicateFirst.Value);
        SetAutoProperty(
            invalidColumnsIndex,
            nameof(IndexDefinition.Columns),
            Array.AsReadOnly(Array.Empty<IndexColumnDefinition>()));
        yield return new object[]
        {
            "named-index-non-key-invalid",
            namedIndexes,
            new[]
            {
                CollectionDuplicateEntry("$.Indexes[2].Name"),
                CollectionEmptyEntry("$.Indexes[2].Columns")
            }
        };

        var indexColumnDuplicateFirst = AstSamples.Id("Duplicate");
        var indexColumnDuplicateSecond = AstSamples.Id("Other");
        var invalidDirectionColumn = new IndexColumnDefinition(
            indexColumnDuplicateSecond, SqlSortDirection.Ascending);
        var indexDefinition = new IndexDefinition(
            AstSamples.Id("IX"),
            new[]
            {
                new IndexColumnDefinition(
                    AstSamples.Id("First"), SqlSortDirection.Ascending),
                new IndexColumnDefinition(
                    indexColumnDuplicateFirst,
                    SqlSortDirection.Descending),
                invalidDirectionColumn
            },
            IndexUniqueness.NonUnique);
        SetAutoProperty(
            indexColumnDuplicateSecond,
            nameof(SqlIdentifier.Value),
            indexColumnDuplicateFirst.Value);
        SetAutoProperty(
            invalidDirectionColumn,
            nameof(IndexColumnDefinition.Direction),
            (SqlSortDirection)999);
        yield return new object[]
        {
            "index-column-non-key-invalid",
            indexDefinition,
            new[]
            {
                CollectionDuplicateEntry("$.Columns[2].Column"),
                UndefinedEnumEntry("$.Columns[2].Direction")
            }
        };

        var stepIdDuplicateFirst = new MigrationStepId("duplicate");
        var stepIdDuplicateSecond = new MigrationStepId("other");
        var invalidOperationStep = new MigrationStep(
            stepIdDuplicateSecond,
            new SetTableCommentOperation(
                AstSamples.ObjectName("T"), new SchemaComment("third")),
            MigrationIdempotencyMode.RequireChange);
        var migrationPlan = new MigrationPlan(
            new MigrationPlanId("plan"),
            new[]
            {
                new MigrationStep(
                    new MigrationStepId("first"),
                    new SetTableCommentOperation(
                        AstSamples.ObjectName("T"),
                        new SchemaComment("first")),
                    MigrationIdempotencyMode.RequireChange),
                new MigrationStep(
                    stepIdDuplicateFirst,
                    new SetTableCommentOperation(
                        AstSamples.ObjectName("T"),
                        new SchemaComment("second")),
                    MigrationIdempotencyMode.RequireChange),
                invalidOperationStep
            });
        SetAutoProperty(
            stepIdDuplicateSecond,
            nameof(MigrationStepId.Value),
            stepIdDuplicateFirst.Value);
        SetAutoProperty(
            invalidOperationStep, nameof(MigrationStep.Operation), null);
        yield return new object[]
        {
            "migration-step-non-key-invalid",
            migrationPlan,
            new[]
            {
                MigrationStepDuplicateEntry("$.Steps[2].Id"),
                RequiredMissingEntry("$.Steps[2].Operation")
            }
        };
    }

    private static string InvalidIdentifierEntry(string path) =>
        "AST_INVALID_IDENTIFIER\u001fSQL identifier is not one valid unquoted segment.\u001f" +
        path;

    private static string CollectionDuplicateEntry(string path) =>
        "AST_COLLECTION_DUPLICATE\u001fSQL AST collection contains a duplicate logical name.\u001f" +
        path;

    private static string CollectionEmptyEntry(string path) =>
        "AST_COLLECTION_EMPTY\u001fRequired SQL AST collection is empty.\u001f" +
        path;

    private static string AssignmentDuplicateEntry(string path) =>
        "AST_DML_ASSIGNMENT_DUPLICATE\u001fDML assignments must target ordinally unique columns.\u001f" +
        path;

    private static string MigrationStepDuplicateEntry(string path) =>
        "AST_MIGRATION_STEP_ID_DUPLICATE\u001fMigration step IDs must be ordinally unique.\u001f" +
        path;

    private static string RequiredMissingEntry(string path) =>
        "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f" +
        path;

    private static string UpsertShapeInvalidEntry(string path) =>
        "AST_UPSERT_SHAPE_INVALID\u001fUpsert conflict policy, keys, and assignments are inconsistent.\u001f" +
        path;

    private static string SchemaAlterMismatchEntry(string path) =>
        "AST_SCHEMA_ALTER_MISMATCH\u001fBefore and after schema definitions do not identify the same object.\u001f" +
        path;

    private static string SequenceInvalidEntry(string path) =>
        "AST_SCHEMA_SEQUENCE_INVALID\u001fSequence type, bounds, start, increment, or cache is invalid.\u001f" +
        path;

    private static string UndefinedEnumEntry(string path) =>
        "AST_UNDEFINED_ENUM\u001fSQL AST contains an undefined enumeration value.\u001f" +
        path;

    private static string ScalarInvalidEntry(string path) =>
        "AST_SCALAR_INVALID\u001fSQL AST scalar value is invalid.\u001f" + path;

    private static InExpression WideIn(int valueCount) =>
        new(BooleanExpression.True,
            Enumerable.Repeat<SqlExpression>(BooleanExpression.False, valueCount));

    private static SelectStatement SelectWithMissingProjectionChild()
    {
        var malformed = new BinaryExpression(
            BooleanExpression.True,
            SqlBinaryOperator.And,
            BooleanExpression.False);
        SetAutoProperty(malformed, nameof(BinaryExpression.Left), null);
        return new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.True),
            new SelectProjection(malformed)
        });
    }

    private static SqlExpression SharedTruthDag(
        SqlExpression leaf,
        SqlBinaryOperator @operator,
        int layers)
    {
        var current = leaf;
        for (var index = 0; index < layers; index++)
        {
            current = new BinaryExpression(current, @operator, current);
        }
        return current;
    }

    private static UpdateStatement UnsafeUpdate(SqlExpression? where)
    {
        var update = new UpdateStatement(
            AstSamples.ObjectName("T"),
            new[] { new SqlAssignment(AstSamples.Id("Value"), BooleanExpression.True) },
            where,
            allowAllRows: true);
        SetAutoProperty(update, nameof(UpdateStatement.AllowAllRows), false);
        return update;
    }

    private static int? GetKnownResultColumnCount(SelectStatement query)
    {
        var type = typeof(SqlAstValidator).Assembly.GetType(
            "Dos.ORM.SqlCompilation.SqlStaticResultArity", throwOnError: true)!;
        var method = type.GetMethod(
            "GetKnownResultColumnCount",
            BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public)!;
        return (int?)method.Invoke(null, new object[] { query });
    }

    private static bool IsSafeWriteProvenTrue(SqlExpression expression)
    {
        return new SqlAstValidator().Validate(UnsafeUpdate(expression))
            .Any(item => item.Code == "AST_WRITE_ALL_ROWS_NOT_ALLOWED");
    }

    private static void AssertCaseCatalog(
        IEnumerable<object[]> cases,
        int expectedCount)
    {
        var count = 0;
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var row in cases)
        {
            count++;
            Assert.True(row.Length != 0);
            Assert.True(row[0] is string);
            Assert.True(names.Add((string)row[0]));
        }
        Assert.Equal(expectedCount, count);
    }

    private static string[] Snapshot(IReadOnlyList<SqlAstDiagnostic> diagnostics) =>
        diagnostics.Select(item => item.Code + "\u001f" + item.Message + "\u001f" + item.Path)
            .ToArray();

    private static T Forge<T>() where T : class =>
        (T)RuntimeHelpers.GetUninitializedObject(typeof(T));

    private static void AssertIdempotencyMismatch(
        SchemaOperation operation,
        MigrationIdempotencyMode mode)
    {
        var validMode = mode == MigrationIdempotencyMode.RequireChange
            ? MigrationIdempotencyMode.AcceptAlreadySatisfied
            : MigrationIdempotencyMode.RequireChange;
        var step = new MigrationStep(
            new MigrationStepId("step"), operation, validMode);
        SetAutoProperty(step, nameof(MigrationStep.Idempotency), mode);
        Assert.Equal(
            new[]
            {
                "AST_MIGRATION_IDEMPOTENCY_MISMATCH\u001fMigration idempotency contradicts create or drop behavior.\u001f$.Idempotency"
            },
            Snapshot(new SqlAstValidator().Validate(step)));
    }

    private static void AssertDiagnostic(
        SqlNode root, string code, string message, string path)
    {
        var diagnostic = Assert.Single(
            new SqlAstValidator().Validate(root), item => item.Code == code);
        Assert.Equal(message, diagnostic.Message);
        Assert.Equal(path, diagnostic.Path);
    }

    private static string[] Task8ProductionSourcePaths()
    {
        var testDirectory = Path.GetDirectoryName(Task8CurrentFilePath())!;
        var serverDirectory = Directory.GetParent(
            Directory.GetParent(
                Directory.GetParent(testDirectory)!.FullName)!.FullName)!.FullName;
        return new[]
        {
            Path.Combine(serverDirectory, "Dos.ORM", "SqlCompilation",
                "SqlAstTraversal.cs"),
            Path.Combine(serverDirectory, "Dos.ORM", "SqlCompilation",
                "SqlAstNormalizer.cs"),
            Path.Combine(serverDirectory, "Dos.ORM", "SqlCompilation",
                "SqlAstValidator.cs"),
            Path.Combine(serverDirectory, "Dos.ORM", "SqlCompilation",
                "SqlParameterAllocator.cs")
        };
    }

    private static string Task8CurrentFilePath(
        [CallerFilePath] string path = "") => path;

    private static Type[] Task8OwnedTypes()
    {
        var paths = Task8ProductionSourcePaths();
        Assert.All(paths, path => Assert.True(File.Exists(path), path));

        const string ownedNamespace = "Dos.ORM.SqlCompilation";
        var declaredIdentities = new HashSet<string>(StringComparer.Ordinal);
        foreach (var path in paths)
        {
            foreach (var identity in Task8DeclaredTypeNames(
                         File.ReadAllText(path)))
            {
                Assert.StartsWith(
                    ownedNamespace + "::",
                    identity,
                    StringComparison.Ordinal);
                declaredIdentities.Add(identity);
            }
        }
        Assert.NotEmpty(declaredIdentities);

        var assemblyTypes = typeof(SqlAstValidator).Assembly.GetTypes()
            .Where(type => declaredIdentities.Contains(
                Task8DeclaredTypeIdentity(
                    type.Namespace,
                    RemoveTask8GenericArity(type.Name))))
            .ToArray();
        foreach (var declaredIdentity in declaredIdentities)
        {
            Assert.Contains(assemblyTypes, type => string.Equals(
                Task8DeclaredTypeIdentity(
                    type.Namespace,
                    RemoveTask8GenericArity(type.Name)),
                declaredIdentity,
                StringComparison.Ordinal));
        }

        var owned = new HashSet<Type>();
        foreach (var type in assemblyTypes)
        {
            AddTask8TypeAndNestedTypes(owned, type);
        }
        return owned.OrderBy(
                type => type.FullName,
                StringComparer.Ordinal)
            .ToArray();
    }

    private static void AddTask8TypeAndNestedTypes(
        ISet<Type> owned,
        Type type)
    {
        if (!owned.Add(type))
        {
            return;
        }
        foreach (var nested in type.GetNestedTypes(
                     BindingFlags.Public | BindingFlags.NonPublic))
        {
            AddTask8TypeAndNestedTypes(owned, nested);
        }
    }

    private static string RemoveTask8GenericArity(string name)
    {
        var tick = name.IndexOf('`');
        return tick < 0 ? name : name.Substring(0, tick);
    }

    private static IReadOnlyList<string> Task8DeclaredTypeNames(string source)
    {
        var tokens = Task8TokenizeCSharpStructure(
            Task8StripCSharpCommentsAndLiterals(source));
        var declarations = new List<string>();
        var namespaceScopes = new Stack<(string Namespace, int Depth)>();
        string? fileNamespace = null;
        var braceDepth = 0;

        for (var index = 0; index < tokens.Count; index++)
        {
            var token = tokens[index];
            if (token == "namespace")
            {
                var parts = new List<string>();
                var cursor = index + 1;
                while (cursor < tokens.Count &&
                       Task8IsCSharpIdentifierToken(tokens[cursor]))
                {
                    parts.Add(tokens[cursor].TrimStart('@'));
                    cursor++;
                    if (cursor >= tokens.Count || tokens[cursor] != ".")
                    {
                        break;
                    }
                    cursor++;
                }
                if (parts.Count != 0 && cursor < tokens.Count &&
                    (tokens[cursor] == "{" || tokens[cursor] == ";"))
                {
                    var parent = namespaceScopes.Count != 0
                        ? namespaceScopes.Peek().Namespace
                        : fileNamespace;
                    var relative = string.Join(".", parts);
                    var fullName = string.IsNullOrEmpty(parent)
                        ? relative
                        : parent + "." + relative;
                    if (tokens[cursor] == ";")
                    {
                        fileNamespace = fullName;
                    }
                    else
                    {
                        braceDepth++;
                        namespaceScopes.Push((fullName, braceDepth));
                    }
                    index = cursor;
                    continue;
                }
            }

            if (token == "{")
            {
                braceDepth++;
                continue;
            }
            if (token == "}")
            {
                if (namespaceScopes.Count != 0 &&
                    namespaceScopes.Peek().Depth == braceDepth)
                {
                    namespaceScopes.Pop();
                }
                braceDepth = Math.Max(0, braceDepth - 1);
                continue;
            }

            var typeName = Task8TryReadDeclaredTypeName(tokens, index);
            if (typeName != null)
            {
                var currentNamespace = namespaceScopes.Count != 0
                    ? namespaceScopes.Peek().Namespace
                    : fileNamespace;
                declarations.Add(Task8DeclaredTypeIdentity(
                    currentNamespace,
                    typeName));
            }
        }
        return declarations.Distinct(StringComparer.Ordinal).ToArray();
    }

    private static string Task8DeclaredTypeIdentity(
        string? typeNamespace,
        string name)
    {
        return (typeNamespace ?? "<global>") + "::" + name;
    }

    private static IReadOnlyList<string> Task8TokenizeCSharpStructure(
        string source)
    {
        var tokens = new List<string>();
        var index = 0;
        while (index < source.Length)
        {
            if (Task8TryReadCSharpIdentifier(
                    source, index, out var identifier, out var nextIndex))
            {
                tokens.Add(identifier);
                index = nextIndex;
                continue;
            }
            var current = source[index];
            if (current is '{' or '}' or ';' or '.' or '=' or '<' or '>' or
                '(' or ')' or '[' or ']' or ',' or ':' or '*' or '?')
            {
                tokens.Add(current.ToString());
            }
            index++;
        }
        return tokens;
    }

    private static bool Task8TryReadCSharpIdentifier(
        string source,
        int start,
        out string identifier,
        out int nextIndex)
    {
        var index = start;
        var value = new StringBuilder();
        if (index < source.Length && source[index] == '@')
        {
            value.Append('@');
            index++;
        }

        if (!Task8TryReadCSharpIdentifierCharacter(
                source, index, first: true,
                out var character, out var consumed))
        {
            identifier = string.Empty;
            nextIndex = start;
            return false;
        }
        value.Append(character);
        index += consumed;

        while (Task8TryReadCSharpIdentifierCharacter(
                   source, index, first: false,
                   out character, out consumed))
        {
            value.Append(character);
            index += consumed;
        }

        identifier = value.ToString();
        nextIndex = index;
        return true;
    }

    private static bool Task8TryReadCSharpIdentifierCharacter(
        string source,
        int index,
        bool first,
        out string character,
        out int consumed)
    {
        character = string.Empty;
        consumed = 0;
        if (index >= source.Length)
        {
            return false;
        }

        if (Task8TryDecodeCSharpUnicodeEscape(
                source, index, out var escaped, out var escapeLength))
        {
            if (!Task8IsCSharpIdentifierCharacter(escaped, first))
            {
                return false;
            }
            character = escaped;
            consumed = escapeLength;
            return true;
        }

        if (!Rune.TryGetRuneAt(source, index, out var literalRune))
        {
            return false;
        }
        var literal = literalRune.ToString();
        if (!Task8IsCSharpIdentifierCharacter(literal, first))
        {
            return false;
        }
        character = literal;
        consumed = literalRune.Utf16SequenceLength;
        return true;
    }

    private static bool Task8TryDecodeCSharpUnicodeEscape(
        string source,
        int index,
        out string value,
        out int consumed)
    {
        value = string.Empty;
        consumed = 0;
        if (index + 1 >= source.Length || source[index] != '\\' ||
            source[index + 1] is not ('u' or 'U'))
        {
            return false;
        }

        var digitCount = source[index + 1] == 'u' ? 4 : 8;
        if (index > source.Length - digitCount - 2)
        {
            return false;
        }
        var digits = source.AsSpan(index + 2, digitCount);
        if (!int.TryParse(
                digits,
                NumberStyles.AllowHexSpecifier,
                CultureInfo.InvariantCulture,
                out var scalar) ||
            scalar > 0x10ffff ||
            (digitCount == 8 && scalar is >= 0xd800 and <= 0xdfff))
        {
            return false;
        }

        value = digitCount == 4
            ? ((char)scalar).ToString()
            : char.ConvertFromUtf32(scalar);
        consumed = digitCount + 2;
        return true;
    }

    private static bool Task8IsCSharpIdentifierCharacter(
        string value,
        bool first)
    {
        var enumerator = value.EnumerateRunes().GetEnumerator();
        if (!enumerator.MoveNext())
        {
            return false;
        }
        var rune = enumerator.Current;
        return !enumerator.MoveNext() &&
               Task8IsCSharpIdentifierRune(rune, first);
    }

    private static bool Task8IsCSharpIdentifierRune(Rune rune, bool first)
    {
        if (rune.Value == '_')
        {
            return true;
        }
        var category = Rune.GetUnicodeCategory(rune);
        return category is UnicodeCategory.UppercaseLetter or
                   UnicodeCategory.LowercaseLetter or
                   UnicodeCategory.TitlecaseLetter or
                   UnicodeCategory.ModifierLetter or
                   UnicodeCategory.OtherLetter or
                   UnicodeCategory.LetterNumber ||
               (!first && category is UnicodeCategory.NonSpacingMark or
                   UnicodeCategory.SpacingCombiningMark or
                   UnicodeCategory.DecimalDigitNumber or
                   UnicodeCategory.ConnectorPunctuation or
                   UnicodeCategory.Format);
    }

    private static string? Task8TryReadDeclaredTypeName(
        IReadOnlyList<string> tokens,
        int keywordIndex)
    {
        var keyword = tokens[keywordIndex];
        if (keyword is "class" or "interface" or "struct" or "enum")
        {
            return keywordIndex + 1 < tokens.Count &&
                   Task8IsCSharpDeclarationIdentifierToken(
                       tokens[keywordIndex + 1])
                ? tokens[keywordIndex + 1].TrimStart('@')
                : null;
        }
        if (keyword == "record")
        {
            var nameIndex = keywordIndex + 1;
            if (nameIndex < tokens.Count &&
                tokens[nameIndex] is "class" or "struct")
            {
                nameIndex++;
            }
            return nameIndex < tokens.Count &&
                   Task8IsCSharpDeclarationIdentifierToken(tokens[nameIndex])
                ? tokens[nameIndex].TrimStart('@')
                : null;
        }
        if (keyword != "delegate" || keywordIndex + 1 >= tokens.Count ||
            tokens[keywordIndex + 1] == "*")
        {
            return null;
        }

        var angleDepth = 0;
        for (var cursor = keywordIndex + 1; cursor < tokens.Count; cursor++)
        {
            if (tokens[cursor] == "<")
            {
                angleDepth++;
            }
            else if (tokens[cursor] == ">" && angleDepth != 0)
            {
                angleDepth--;
            }
            else if (tokens[cursor] == "(" && angleDepth == 0)
            {
                var nameCursor = cursor - 1;
                if (nameCursor >= 0 && tokens[nameCursor] == ">")
                {
                    var genericDepth = 1;
                    nameCursor--;
                    while (nameCursor >= 0 && genericDepth != 0)
                    {
                        if (tokens[nameCursor] == ">") genericDepth++;
                        if (tokens[nameCursor] == "<") genericDepth--;
                        nameCursor--;
                    }
                }
                return nameCursor > keywordIndex &&
                       Task8IsCSharpDeclarationIdentifierToken(
                           tokens[nameCursor])
                    ? tokens[nameCursor].TrimStart('@')
                    : null;
            }
            else if (tokens[cursor] is ";" or "{")
            {
                return null;
            }
        }
        return null;
    }

    private static bool Task8IsCSharpIdentifierToken(string token)
    {
        var start = token.Length != 0 && token[0] == '@' ? 1 : 0;
        if (start == token.Length)
        {
            return false;
        }

        var first = true;
        foreach (var rune in token.AsSpan(start).EnumerateRunes())
        {
            if (!Task8IsCSharpIdentifierRune(rune, first))
            {
                return false;
            }
            first = false;
        }
        return !first;
    }

    private static bool Task8IsCSharpDeclarationIdentifierToken(string token)
    {
        if (!Task8IsCSharpIdentifierToken(token))
        {
            return false;
        }
        if (token[0] == '@')
        {
            return true;
        }

        return token is not
            "abstract" and not "add" and not "alias" and not "allows" and not
            "and" and not "as" and not "ascending" and not "async" and not
            "await" and not "base" and not "bool" and not "break" and not
            "by" and not "byte" and not "case" and not "catch" and not
            "char" and not "checked" and not "class" and not "const" and not
            "continue" and not "decimal" and not "default" and not
            "delegate" and not "descending" and not "do" and not "double" and
            not "dynamic" and not "else" and not "enum" and not "equals" and
            not "event" and not "explicit" and not "extern" and not "false" and
            not "field" and not "file" and not "finally" and not "fixed" and
            not "float" and not "for" and not "foreach" and not "from" and not
            "get" and not "global" and not "goto" and not "group" and not "if" and
            not "implicit" and not "in" and not "init" and not "int" and not
            "interface" and not "internal" and not "into" and not "is" and not
            "join" and not "let" and not "lock" and not "long" and not
            "managed" and not "nameof" and not "namespace" and not "new" and
            not "nint" and not "not" and not "notnull" and not "nuint" and not
            "null" and not "object" and not "on" and not "operator" and not
            "or" and not "orderby" and not "out" and not "override" and not
            "params" and not "partial" and not "private" and not "protected" and
            not "public" and not "readonly" and not "record" and not "ref" and
            not "remove" and not "required" and not "return" and not "sbyte" and
            not "scoped" and not "sealed" and not "select" and not "set" and not
            "short" and not "sizeof" and not "stackalloc" and not "static" and
            not "string" and not "struct" and not "switch" and not "this" and not
            "throw" and not "true" and not "try" and not "typeof" and not
            "uint" and not "ulong" and not "unchecked" and not "unmanaged" and
            not "unsafe" and not "ushort" and not "using" and not "value" and not
            "var" and not "virtual" and not "void" and not "volatile" and not
            "when" and not "where" and not "while" and not "with" and not
            "yield" and not "__arglist" and not "__makeref" and not
            "__reftype" and not "__refvalue";
    }

    private static string Task8StripCSharpCommentsAndLiterals(string source)
    {
        var result = new StringBuilder(source.Length);
        var index = 0;
        while (index < source.Length)
        {
            if (Task8TryFindRawStringEnd(source, index, out var rawEnd))
            {
                while (index < rawEnd)
                {
                    result.Append(source[index] is '\r' or '\n'
                        ? source[index]
                        : ' ');
                    index++;
                }
                continue;
            }
            if (Task8TryStripInterpolatedString(source, ref index, result))
            {
                continue;
            }
            if (index + 1 < source.Length && source[index] == '/' &&
                source[index + 1] == '/')
            {
                result.Append("  ");
                index += 2;
                while (index < source.Length && source[index] != '\r' &&
                       source[index] != '\n')
                {
                    result.Append(' ');
                    index++;
                }
                continue;
            }
            if (index + 1 < source.Length && source[index] == '/' &&
                source[index + 1] == '*')
            {
                result.Append("  ");
                index += 2;
                while (index < source.Length)
                {
                    if (index + 1 < source.Length && source[index] == '*' &&
                        source[index + 1] == '/')
                    {
                        result.Append("  ");
                        index += 2;
                        break;
                    }
                    result.Append(source[index] is '\r' or '\n'
                        ? source[index]
                        : ' ');
                    index++;
                }
                continue;
            }

            var verbatim = index + 1 < source.Length && source[index] == '@' &&
                           source[index + 1] == '"';
            var regular = source[index] == '"';
            var character = source[index] == '\'';
            if (verbatim || regular || character)
            {
                var quote = character ? '\'' : '"';
                if (verbatim)
                {
                    result.Append("  ");
                    index += 2;
                }
                else
                {
                    result.Append(' ');
                    index++;
                }
                while (index < source.Length)
                {
                    var current = source[index];
                    result.Append(current is '\r' or '\n' ? current : ' ');
                    index++;
                    if (verbatim && current == '"' && index < source.Length &&
                        source[index] == '"')
                    {
                        result.Append(' ');
                        index++;
                        continue;
                    }
                    if (!verbatim && current == '\\' && index < source.Length)
                    {
                        result.Append(source[index] is '\r' or '\n'
                            ? source[index]
                            : ' ');
                        index++;
                        continue;
                    }
                    if (current == quote)
                    {
                        break;
                    }
                }
                continue;
            }

            result.Append(source[index]);
            index++;
        }
        return result.ToString();
    }

    private static bool Task8TryFindRawStringEnd(
        string source,
        int start,
        out int end)
    {
        var quoteStart = start;
        while (quoteStart < source.Length && source[quoteStart] == '$')
        {
            quoteStart++;
        }

        var delimiterEnd = quoteStart;
        while (delimiterEnd < source.Length && source[delimiterEnd] == '"')
        {
            delimiterEnd++;
        }
        var delimiterLength = delimiterEnd - quoteStart;
        if (delimiterLength < 3)
        {
            end = start;
            return false;
        }

        var index = delimiterEnd;
        while (index < source.Length)
        {
            if (source[index] != '"')
            {
                index++;
                continue;
            }

            var quoteEnd = index + 1;
            while (quoteEnd < source.Length && source[quoteEnd] == '"')
            {
                quoteEnd++;
            }
            if (quoteEnd - index >= delimiterLength)
            {
                end = quoteEnd;
                return true;
            }
            index = quoteEnd;
        }

        end = source.Length;
        return true;
    }

    private static bool Task8TryStripInterpolatedString(
        string source,
        ref int index,
        StringBuilder result)
    {
        var verbatim = false;
        var prefixLength = 0;
        if (index + 1 < source.Length && source[index] == '$' &&
            source[index + 1] == '"')
        {
            prefixLength = 2;
        }
        else if (index + 2 < source.Length && source[index] == '$' &&
                 source[index + 1] == '@' && source[index + 2] == '"')
        {
            verbatim = true;
            prefixLength = 3;
        }
        else if (index + 2 < source.Length && source[index] == '@' &&
                 source[index + 1] == '$' && source[index + 2] == '"')
        {
            verbatim = true;
            prefixLength = 3;
        }
        if (prefixLength == 0)
        {
            return false;
        }

        result.Append(' ', prefixLength);
        index += prefixLength;
        while (index < source.Length)
        {
            var current = source[index];
            if (current == '"')
            {
                if (verbatim && index + 1 < source.Length &&
                    source[index + 1] == '"')
                {
                    result.Append("  ");
                    index += 2;
                    continue;
                }
                result.Append(' ');
                index++;
                return true;
            }
            if (!verbatim && current == '\\' && index + 1 < source.Length)
            {
                result.Append("  ");
                index += 2;
                continue;
            }
            if (current == '{' && index + 1 < source.Length &&
                source[index + 1] == '{')
            {
                result.Append("  ");
                index += 2;
                continue;
            }
            if (current == '}' && index + 1 < source.Length &&
                source[index + 1] == '}')
            {
                result.Append("  ");
                index += 2;
                continue;
            }
            if (current == '{')
            {
                result.Append('{');
                index++;
                var expressionEnd = Task8FindInterpolationExpressionEnd(
                    source, index);
                result.Append(Task8StripCSharpCommentsAndLiterals(
                    source[index..expressionEnd]));
                index = expressionEnd;
                if (index < source.Length && source[index] == '}')
                {
                    result.Append('}');
                    index++;
                }
                continue;
            }

            result.Append(current is '\r' or '\n' ? current : ' ');
            index++;
        }
        return true;
    }

    private static int Task8FindInterpolationExpressionEnd(
        string source,
        int start)
    {
        var depth = 0;
        var index = start;
        while (index < source.Length)
        {
            if (Task8TrySkipCommentOrLiteralForBraceScan(source, ref index))
            {
                continue;
            }
            if (source[index] == '{')
            {
                depth++;
                index++;
                continue;
            }
            if (source[index] == '}')
            {
                if (depth == 0)
                {
                    return index;
                }
                depth--;
            }
            index++;
        }
        return source.Length;
    }

    private static bool Task8TrySkipCommentOrLiteralForBraceScan(
        string source,
        ref int index)
    {
        if (Task8TryFindRawStringEnd(source, index, out var rawEnd))
        {
            index = rawEnd;
            return true;
        }
        if (index + 1 < source.Length && source[index] == '/' &&
            source[index + 1] == '/')
        {
            index += 2;
            while (index < source.Length && source[index] is not '\r' and not '\n')
            {
                index++;
            }
            return true;
        }
        if (index + 1 < source.Length && source[index] == '/' &&
            source[index + 1] == '*')
        {
            index += 2;
            while (index + 1 < source.Length &&
                   (source[index] != '*' || source[index + 1] != '/'))
            {
                index++;
            }
            index = Math.Min(source.Length, index + 2);
            return true;
        }

        var verbatim = index + 1 < source.Length && source[index] == '@' &&
                       source[index + 1] == '"';
        var interpolatedVerbatim = index + 2 < source.Length &&
            ((source[index] == '$' && source[index + 1] == '@') ||
             (source[index] == '@' && source[index + 1] == '$')) &&
            source[index + 2] == '"';
        var interpolated = index + 1 < source.Length && source[index] == '$' &&
                           source[index + 1] == '"';
        var character = source[index] == '\'';
        var regular = source[index] == '"';
        if (!verbatim && !interpolatedVerbatim && !interpolated &&
            !character && !regular)
        {
            return false;
        }

        var isVerbatim = verbatim || interpolatedVerbatim;
        var quote = character ? '\'' : '"';
        index += interpolatedVerbatim ? 3 :
            verbatim || interpolated ? 2 : 1;
        while (index < source.Length)
        {
            var current = source[index++];
            if (isVerbatim && current == '"' && index < source.Length &&
                source[index] == '"')
            {
                index++;
                continue;
            }
            if (!isVerbatim && current == '\\' && index < source.Length)
            {
                index++;
                continue;
            }
            if (current == quote)
            {
                break;
            }
        }
        return true;
    }

    private static MethodInfo AssertTask8PublicMethod(
        Type type,
        string name,
        Type returnType,
        params Type[] parameterTypes)
    {
        var method = Assert.Single(type.GetMethods(
                BindingFlags.Instance | BindingFlags.Public |
                BindingFlags.DeclaredOnly),
            candidate =>
                string.Equals(candidate.Name, name, StringComparison.Ordinal) &&
                candidate.GetParameters()
                    .Select(parameter => parameter.ParameterType)
                    .SequenceEqual(parameterTypes));
        Assert.Equal(returnType, method.ReturnType);
        Assert.False(method.ReturnType.IsByRef);
        Assert.False(method.IsStatic);
        Assert.False(method.IsGenericMethod);
        Assert.False(method.ContainsGenericParameters);
        Assert.All(method.GetParameters(), parameter =>
        {
            Assert.False(parameter.IsOptional);
            Assert.False(parameter.IsOut);
            Assert.False(parameter.ParameterType.IsByRef);
        });
        return method;
    }

    private static IEnumerable<MemberInfo> Task8DeclaredMembers(Type type)
    {
        const BindingFlags flags =
            BindingFlags.Instance | BindingFlags.Static |
            BindingFlags.Public | BindingFlags.NonPublic |
            BindingFlags.DeclaredOnly;
        foreach (var field in type.GetFields(flags))
        {
            yield return field;
        }
        foreach (var property in type.GetProperties(flags))
        {
            yield return property;
        }
        foreach (var eventInfo in type.GetEvents(flags))
        {
            yield return eventInfo;
        }
        foreach (var method in type.GetMethods(flags))
        {
            yield return method;
        }
        foreach (var constructor in type.GetConstructors(
                     BindingFlags.Instance | BindingFlags.Public |
                     BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
        {
            yield return constructor;
        }
        if (type.TypeInitializer != null)
        {
            yield return type.TypeInitializer;
        }
    }

    private static IEnumerable<Type> Task8MemberSignatureTypes(
        MemberInfo member)
    {
        if (member is Type type)
        {
            yield return type;
        }
        if (member.DeclaringType != null)
        {
            yield return member.DeclaringType;
        }

        switch (member)
        {
            case FieldInfo field:
                yield return field.FieldType;
                break;
            case PropertyInfo property:
                yield return property.PropertyType;
                foreach (var parameter in property.GetIndexParameters())
                {
                    yield return parameter.ParameterType;
                }
                break;
            case EventInfo eventInfo when eventInfo.EventHandlerType != null:
                yield return eventInfo.EventHandlerType;
                break;
            case MethodInfo method:
                yield return method.ReturnType;
                foreach (var parameter in method.GetParameters())
                {
                    yield return parameter.ParameterType;
                }
                foreach (var argument in method.GetGenericArguments())
                {
                    yield return argument;
                }
                break;
            case ConstructorInfo constructor:
                foreach (var parameter in constructor.GetParameters())
                {
                    yield return parameter.ParameterType;
                }
                break;
        }
    }

    private static IEnumerable<Type> Task8MetadataDependencyTypes(
        MemberInfo member)
    {
        foreach (var dependency in Task8CustomAttributeDependencyTypes(
                     member.GetCustomAttributesData()))
        {
            yield return dependency;
        }

        switch (member)
        {
            case Type type:
                foreach (var genericParameter in type.GetGenericArguments()
                             .Where(argument => argument.IsGenericParameter))
                {
                    foreach (var dependency in
                             Task8GenericParameterDependencyTypes(
                                 genericParameter))
                    {
                        yield return dependency;
                    }
                }
                break;
            case MethodBase method:
                var genericArguments = method is MethodInfo genericMethod
                    ? genericMethod.GetGenericArguments()
                    : Type.EmptyTypes;
                foreach (var genericParameter in genericArguments
                             .Where(argument => argument.IsGenericParameter))
                {
                    foreach (var dependency in
                             Task8GenericParameterDependencyTypes(
                                 genericParameter))
                    {
                        yield return dependency;
                    }
                }
                foreach (var parameter in method.GetParameters())
                {
                    foreach (var dependency in
                             Task8CustomAttributeDependencyTypes(
                                 parameter.GetCustomAttributesData()))
                    {
                        yield return dependency;
                    }
                }
                if (method is MethodInfo methodInfo)
                {
                    foreach (var dependency in
                             Task8CustomAttributeDependencyTypes(
                                 methodInfo.ReturnParameter
                                     .GetCustomAttributesData()))
                    {
                        yield return dependency;
                    }
                }
                break;
            case PropertyInfo property:
                foreach (var parameter in property.GetIndexParameters())
                {
                    foreach (var dependency in
                             Task8CustomAttributeDependencyTypes(
                                 parameter.GetCustomAttributesData()))
                    {
                        yield return dependency;
                    }
                }
                break;
        }
    }

    private static IEnumerable<Type> Task8GenericParameterDependencyTypes(
        Type genericParameter)
    {
        Assert.True(genericParameter.IsGenericParameter);
        foreach (var constraint in genericParameter
                     .GetGenericParameterConstraints())
        {
            yield return constraint;
        }
        foreach (var dependency in Task8CustomAttributeDependencyTypes(
                     genericParameter.GetCustomAttributesData()))
        {
            yield return dependency;
        }
    }

    private static IEnumerable<Type> Task8CustomAttributeDependencyTypes(
        IEnumerable<CustomAttributeData> attributes)
    {
        foreach (var attribute in attributes)
        {
            yield return attribute.AttributeType;
            foreach (var dependency in Task8MemberSignatureTypes(
                         attribute.Constructor))
            {
                yield return dependency;
            }
            foreach (var argument in attribute.ConstructorArguments)
            {
                foreach (var dependency in
                         Task8CustomAttributeArgumentDependencyTypes(argument))
                {
                    yield return dependency;
                }
            }
            foreach (var argument in attribute.NamedArguments)
            {
                foreach (var dependency in Task8MemberSignatureTypes(
                             argument.MemberInfo))
                {
                    yield return dependency;
                }
                foreach (var dependency in
                         Task8CustomAttributeArgumentDependencyTypes(
                             argument.TypedValue))
                {
                    yield return dependency;
                }
            }
        }
    }

    private static IEnumerable<Type>
        Task8CustomAttributeArgumentDependencyTypes(
            CustomAttributeTypedArgument argument)
    {
        yield return argument.ArgumentType;
        if (argument.Value is Type type)
        {
            yield return type;
        }
        if (argument.Value is IEnumerable<CustomAttributeTypedArgument> items)
        {
            foreach (var item in items)
            {
                foreach (var dependency in
                         Task8CustomAttributeArgumentDependencyTypes(item))
                {
                    yield return dependency;
                }
            }
        }
    }

    private static IEnumerable<Type> Task8MethodBodyDependencyTypes(
        MethodBase method)
    {
        var body = method.GetMethodBody();
        if (body == null)
        {
            yield break;
        }
        foreach (var local in body.LocalVariables)
        {
            yield return local.LocalType;
        }
        foreach (var clause in body.ExceptionHandlingClauses)
        {
            if (clause.CatchType != null)
            {
                yield return clause.CatchType;
            }
        }
    }

    private static bool Task8HasForbiddenMethodImplementation(
        MethodBase method)
    {
        if ((method.Attributes & MethodAttributes.PinvokeImpl) != 0)
        {
            return true;
        }

        var implementation = method.GetMethodImplementationFlags();
        return (implementation & MethodImplAttributes.CodeTypeMask) ==
                   MethodImplAttributes.Native ||
               (implementation & MethodImplAttributes.ManagedMask) ==
                   MethodImplAttributes.Unmanaged ||
               (implementation & MethodImplAttributes.InternalCall) != 0;
    }

    private static IEnumerable<Type> Task8TypeShape(Type root)
    {
        var pending = new Stack<Type>();
        var visited = new HashSet<Type>();
        pending.Push(root);
        while (pending.Count != 0)
        {
            var type = pending.Pop();
            if (!visited.Add(type))
            {
                continue;
            }

            yield return type;
            if (type.HasElementType && type.GetElementType() != null)
            {
                pending.Push(type.GetElementType()!);
            }
            if (type.IsGenericType)
            {
                var definition = type.GetGenericTypeDefinition();
                if (definition != type)
                {
                    pending.Push(definition);
                }
                foreach (var argument in type.GetGenericArguments())
                {
                    pending.Push(argument);
                }
            }
            if (type.IsGenericParameter)
            {
                foreach (var constraint in type.GetGenericParameterConstraints())
                {
                    pending.Push(constraint);
                }
            }
        }
    }

    private static MethodBase[] Task8OwnedMethods(
        IReadOnlyCollection<Type> ownedTypes)
    {
        return ownedTypes
            .SelectMany(Task8DeclaredMembers)
            .OfType<MethodBase>()
            .GroupBy(Task8MethodKey)
            .Select(group => group.First())
            .OrderBy(method => method.Module.Name, StringComparer.Ordinal)
            .ThenBy(method => method.MetadataToken)
            .ToArray();
    }

    private static (Module Module, int Token) Task8MethodKey(
        MethodBase method)
    {
        if (method is MethodInfo methodInfo &&
            methodInfo.IsGenericMethod &&
            !methodInfo.IsGenericMethodDefinition)
        {
            method = methodInfo.GetGenericMethodDefinition();
        }
        return (method.Module, method.MetadataToken);
    }

    private static bool Task8MethodCanReach(
        (Module Module, int Token) start,
        IReadOnlyDictionary<
            (Module Module, int Token),
            (Module Module, int Token)[]> graph)
    {
        if (!graph.TryGetValue(start, out var firstEdges))
        {
            return false;
        }

        var pending = new Stack<(Module Module, int Token)>(firstEdges);
        var visited = new HashSet<(Module Module, int Token)>();
        while (pending.Count != 0)
        {
            var current = pending.Pop();
            if (current == start)
            {
                return true;
            }
            if (!visited.Add(current) ||
                !graph.TryGetValue(current, out var nextEdges))
            {
                continue;
            }
            foreach (var next in nextEdges)
            {
                pending.Push(next);
            }
        }
        return false;
    }

    private static bool IsTask8RuntimeValueType(Type type)
    {
        return type == typeof(ParameterBag) ||
               type == typeof(BoundParameter);
    }

    private static bool Task8FieldStateIsSafe(FieldInfo field)
    {
        if (field.IsStatic && !field.IsLiteral && !field.IsInitOnly)
        {
            return false;
        }
        if (field.IsStatic && field.IsInitOnly &&
            Task8IsMutableStaticContainerType(field.FieldType))
        {
            return false;
        }
        return Task8MemberStateIsSafe(field.Name, field.FieldType);
    }

    private static bool Task8PropertyStateIsSafe(PropertyInfo property)
    {
        return Task8MemberStateIsSafe(property.Name, property.PropertyType);
    }

    private static bool Task8MemberStateIsSafe(string name, Type type)
    {
        if (string.Equals(name, "Value", StringComparison.Ordinal) &&
            type == typeof(object))
        {
            return false;
        }
        return !Task8TypeShape(type).Any(IsTask8RuntimeValueType);
    }

    private static bool Task8IsMutableStaticContainerType(Type type)
    {
        if (type.IsArray || typeof(Delegate).IsAssignableFrom(type))
        {
            return true;
        }

        var definition = type.IsGenericType
            ? type.GetGenericTypeDefinition()
            : type;
        return (definition.FullName ?? definition.Name) is
            "System.Collections.ICollection" or
            "System.Collections.IList" or
            "System.Collections.IDictionary" or
            "System.Collections.Generic.ICollection`1" or
            "System.Collections.Generic.IList`1" or
            "System.Collections.Generic.IDictionary`2" or
            "System.Collections.Generic.ISet`1" or
            "System.Collections.Generic.List`1" or
            "System.Collections.Generic.Dictionary`2" or
            "System.Collections.Generic.HashSet`1" or
            "System.Collections.Generic.Queue`1" or
            "System.Collections.Generic.Stack`1" or
            "System.Collections.Generic.LinkedList`1" or
            "System.Collections.Generic.SortedDictionary`2" or
            "System.Collections.Generic.SortedList`2" or
            "System.Collections.Generic.SortedSet`1" or
            "System.Collections.Concurrent.ConcurrentBag`1" or
            "System.Collections.Concurrent.ConcurrentDictionary`2" or
            "System.Collections.Concurrent.ConcurrentQueue`1" or
            "System.Collections.Concurrent.ConcurrentStack`1" or
            "System.Lazy`1" or
            "System.Threading.ThreadLocal`1" or
            "System.Threading.AsyncLocal`1" or
            "System.Runtime.CompilerServices.ConditionalWeakTable`2";
    }

    private static void AssertTask8DependencyAllowed(
        MemberInfo owner,
        Type dependency,
        ISet<Type> ownedTypes)
    {
        foreach (var type in Task8TypeShape(dependency))
        {
            // Coverlet rewrites the built assembly for coverage collection and injects
            // a tracker type into method bodies. It is test tooling, not a production
            // source dependency, so it must not invalidate this architecture contract.
            if (type.FullName?.StartsWith(
                    "Coverlet.Core.Instrumentation.Tracker.",
                    StringComparison.Ordinal) == true)
            {
                continue;
            }
            Assert.False(
                IsTask8ForbiddenDependency(type, ownedTypes),
                $"{owner.DeclaringType?.FullName ?? (owner as Type)?.FullName}." +
                $"{owner.Name} references forbidden dependency " +
                $"{type.FullName ?? type.Name}.");
        }
    }

    private static bool IsTask8ForbiddenDependency(
        Type type,
        ISet<Type> ownedTypes)
    {
        while (type.HasElementType && type.GetElementType() != null)
        {
            type = type.GetElementType()!;
        }
        if (type.IsGenericType && !type.IsGenericTypeDefinition)
        {
            type = type.GetGenericTypeDefinition();
        }
        if (Task8IsCompilerInfrastructure(type))
        {
            return false;
        }
        return !Task8DependencyIdentityIsAllowed(
            type.Namespace ?? string.Empty,
            type.FullName ?? type.Name,
            ownedTypes.Contains(type),
            type.IsGenericParameter,
            type.Assembly == typeof(SqlNode).Assembly,
            Task8IsTrustedBclAssembly(type.Assembly),
            type == typeof(ParameterDirection));
    }

    private static bool Task8IsCompilerInfrastructure(Type type)
    {
        var container = type.DeclaringType ?? type;
        return Task8CompilerInfrastructureIdentityIsAllowed(
            type.Assembly == typeof(SqlNode).Assembly,
            type.Namespace ?? string.Empty,
            type.IsPublic,
            type.IsNestedPublic,
            container.DeclaringType != null,
            container.Name,
            container.IsDefined(
                typeof(CompilerGeneratedAttribute),
                inherit: false),
            type == container,
            type.DeclaringType == container,
            type.IsValueType,
            type.Name);
    }

    private static bool Task8CompilerInfrastructureIdentityIsAllowed(
        bool isDosOrmAssembly,
        string namespaceName,
        bool isPublic,
        bool isNestedPublic,
        bool containerHasDeclaringType,
        string containerName,
        bool containerIsCompilerGenerated,
        bool isContainer,
        bool isDirectNested,
        bool isValueType,
        string typeName)
    {
        if (!isDosOrmAssembly ||
            !string.IsNullOrEmpty(namespaceName) ||
            isPublic ||
            isNestedPublic ||
            containerHasDeclaringType ||
            !string.Equals(
                containerName,
                "<PrivateImplementationDetails>",
                StringComparison.Ordinal) ||
            !containerIsCompilerGenerated)
        {
            return false;
        }

        if (isContainer)
        {
            return true;
        }

        return isDirectNested &&
               isValueType &&
               typeName.StartsWith(
                   "__StaticArrayInitTypeSize=",
                   StringComparison.Ordinal);
    }

    private static bool Task8IsTrustedBclAssembly(Assembly assembly)
    {
        var identity = assembly.GetName();
        var simpleName = identity.Name ?? string.Empty;
        var isCoreOrFacade = simpleName is
            "System.Private.CoreLib" or "mscorlib" or
            "netstandard" or "System";
        if (!isCoreOrFacade &&
            !simpleName.StartsWith("System.", StringComparison.Ordinal))
        {
            return false;
        }

        var publicKeyToken = identity.GetPublicKeyToken();
        if (publicKeyToken == null || publicKeyToken.Length == 0)
        {
            return false;
        }

        var token = Convert.ToHexString(publicKeyToken);
        return token is
            "7CEC85D7BEA7798E" or
            "B03F5F7F11D50A3A" or
            "CC7B13FFCD2DDD51" or
            "B77A5C561934E089";
    }

    private static bool Task8DependencyIdentityIsAllowed(
        string typeNamespace,
        string fullName,
        bool isOwned,
        bool isGenericParameter,
        bool isDosOrmAssembly,
        bool isTrustedBclAssembly,
        bool isParameterDirection)
    {
        if (isOwned || isGenericParameter || isParameterDirection)
        {
            return true;
        }

        if (isDosOrmAssembly)
        {
            if (!string.Equals(
                    typeNamespace,
                    "Dos.ORM.SqlAst",
                    StringComparison.Ordinal) &&
                !typeNamespace.StartsWith(
                    "Dos.ORM.SqlAst.",
                    StringComparison.Ordinal))
            {
                return false;
            }

            return fullName is not
                "Dos.ORM.SqlAst.NativeSqlText" and not
                "Dos.ORM.SqlAst.NativeSqlCommandKind" and not
                "Dos.ORM.SqlAst.SqlSafetyOrigin" and not
                "Dos.ORM.SqlAst.SchemaToken";
        }

        if (!isTrustedBclAssembly)
        {
            return false;
        }

        if (Task8IsForbiddenBclType(fullName))
        {
            return false;
        }

        if (string.Equals(typeNamespace, "System", StringComparison.Ordinal))
        {
            return fullName is not
                "System.IServiceProvider" and not
                "System.Uri" and not
                "System.Console" and not
                "System.Activator";
        }

        if (string.Equals(
                typeNamespace,
                "System.Diagnostics",
                StringComparison.Ordinal))
        {
            return fullName is
                "System.Diagnostics.DebuggerBrowsableAttribute" or
                "System.Diagnostics.DebuggerBrowsableState" or
                "System.Diagnostics.DebuggerDisplayAttribute" or
                "System.Diagnostics.DebuggerHiddenAttribute" or
                "System.Diagnostics.DebuggerNonUserCodeAttribute" or
                "System.Diagnostics.DebuggerStepThroughAttribute";
        }

        if (string.Equals(
                typeNamespace,
                "System.Runtime.InteropServices",
                StringComparison.Ordinal))
        {
            return fullName is
                "System.Runtime.InteropServices.InAttribute" or
                "System.Runtime.InteropServices.OutAttribute" or
                "System.Runtime.InteropServices.OptionalAttribute" or
                "System.Runtime.InteropServices.DefaultParameterValueAttribute";
        }

        if (string.Equals(
                typeNamespace,
                "System.Reflection",
                StringComparison.Ordinal))
        {
            return fullName is "System.Reflection.DefaultMemberAttribute";
        }

        return typeNamespace is
            "System.Collections" or
            "System.Collections.Generic" or
            "System.Collections.ObjectModel" or
            "System.Globalization" or
            "System.Runtime.CompilerServices" or
            "System.Runtime.Serialization";
    }

    private static bool Task8IsForbiddenBclType(string fullName)
    {
        return fullName is
            "System.AppDomain" or
            "System.Environment" or
            "System.RuntimeMethodHandle" or
            "System.Runtime.Serialization.FormatterServices" or
            "System.Runtime.CompilerServices.CallSite" or
            "System.Runtime.CompilerServices.CallSite`1" or
            "System.Runtime.CompilerServices.CallSiteBinder";
    }

    private static bool Task8IsForbiddenBclMember(MemberInfo member)
    {
        var declaringType = member as Type ?? member.DeclaringType;
        if (declaringType != typeof(RuntimeHelpers))
        {
            return false;
        }

        if (member is not MethodInfo method ||
            !string.Equals(
                method.Name,
                nameof(RuntimeHelpers.GetHashCode),
                StringComparison.Ordinal) ||
            method.ReturnType != typeof(int))
        {
            return true;
        }

        var parameters = method.GetParameters();
        return parameters.Length != 1 ||
               parameters[0].ParameterType != typeof(object);
    }

    private static bool IsTask8ReflectionExecution(MemberInfo member)
    {
        var declaringType = member as Type ?? member.DeclaringType;
        var typeNamespace = declaringType?.Namespace ?? string.Empty;
        if (typeNamespace.StartsWith(
                "System.Reflection",
                StringComparison.Ordinal) ||
            declaringType == typeof(Activator))
        {
            return true;
        }
        if (declaringType == typeof(object) &&
            member is MethodInfo objectMethod &&
            string.Equals(
                objectMethod.Name,
                nameof(object.GetType),
                StringComparison.Ordinal) &&
            objectMethod.ReturnType == typeof(Type) &&
            objectMethod.GetParameters().Length == 0)
        {
            return true;
        }
        if (declaringType == typeof(Type) && member is MethodBase typeMethod)
        {
            return typeMethod.Name is not
                "GetTypeFromHandle" and not
                "op_Equality" and not
                "op_Inequality";
        }
        if (declaringType != null &&
            typeof(Delegate).IsAssignableFrom(declaringType) &&
            (member.Name is "DynamicInvoke" or "CreateDelegate"))
        {
            return true;
        }
        return declaringType == typeof(Attribute) &&
               member.Name.StartsWith(
                   "GetCustomAttribute",
                   StringComparison.Ordinal);
    }

    private static IEnumerable<MethodBase> ReadReferencedMethods(
        MethodBase method) =>
        ReadReferencedMembers(method).OfType<MethodBase>();

    private static bool Task8IsForbiddenIlOpcode(OpCode opcode)
    {
        return opcode.Value == OpCodes.Calli.Value ||
               opcode.OperandType == OperandType.InlineSig;
    }

    private static IEnumerable<MemberInfo> ReadReferencedMembers(
        MethodBase method)
    {
        var il = method.GetMethodBody()?.GetILAsByteArray();
        if (il == null)
        {
            yield break;
        }

        var typeArguments = method.DeclaringType?.GetGenericArguments();
        var methodArguments = method.IsGenericMethod
            ? method.GetGenericArguments()
            : null;
        var offset = 0;
        while (offset < il.Length)
        {
            short opcodeValue = il[offset++];
            if (opcodeValue == 0xfe)
            {
                opcodeValue = unchecked((short)(0xfe00 | il[offset++]));
            }
            Assert.True(
                CompilationIlOpCodes.TryGetValue(opcodeValue, out var opcode),
                $"Unknown IL opcode 0x{opcodeValue:x4} in {method}.");
            Assert.False(
                Task8IsForbiddenIlOpcode(opcode),
                $"{method.DeclaringType?.FullName}.{method.Name} uses " +
                $"forbidden indirect IL opcode {opcode.Name}.");

            switch (opcode.OperandType)
            {
                case OperandType.InlineNone:
                    break;
                case OperandType.ShortInlineBrTarget:
                case OperandType.ShortInlineI:
                case OperandType.ShortInlineVar:
                    offset += 1;
                    break;
                case OperandType.InlineVar:
                    offset += 2;
                    break;
                case OperandType.InlineBrTarget:
                case OperandType.InlineI:
                case OperandType.ShortInlineR:
                case OperandType.InlineString:
                    offset += 4;
                    break;
                case OperandType.InlineI8:
                case OperandType.InlineR:
                    offset += 8;
                    break;
                case OperandType.InlineSwitch:
                    var targetCount = BitConverter.ToInt32(il, offset);
                    offset += 4 + (targetCount * 4);
                    break;
                case OperandType.InlineField:
                case OperandType.InlineMethod:
                case OperandType.InlineTok:
                case OperandType.InlineType:
                    var token = BitConverter.ToInt32(il, offset);
                    offset += 4;
                    var referencedMember = method.Module.ResolveMember(
                        token,
                        typeArguments,
                        methodArguments);
                    if (referencedMember != null)
                    {
                        yield return referencedMember;
                    }
                    break;
                default:
                    throw new InvalidOperationException(
                        $"Unsupported IL operand {opcode.OperandType} in {method}.");
            }
        }
    }

    private static readonly IReadOnlyDictionary<short, OpCode>
        CompilationIlOpCodes = typeof(OpCodes)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(field => field.FieldType == typeof(OpCode))
            .Select(field => (OpCode)field.GetValue(null)!)
            .ToDictionary(opcode => opcode.Value);

    private static void SetAutoProperty(object target, string propertyName, object? value)
    {
        var field = target.GetType().GetField(
            $"<{propertyName}>k__BackingField",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field);
        field!.SetValue(target, value);
    }

    private static Type? Task8TypeGetTypePoison(string typeName) =>
        Type.GetType(typeName);

    private static Type Task8MakeGenericTypePoison(
        Type genericType,
        Type argument) =>
        genericType.MakeGenericType(argument);

    private static Type Task8MakeArrayTypePoison(Type type) =>
        type.MakeArrayType();

    private static Type Task8MakeByRefTypePoison(Type type) =>
        type.MakeByRefType();

    private static Type Task8MakePointerTypePoison(Type type) =>
        type.MakePointerType();

    private static Delegate Task8CreateDelegatePoison(
        Type delegateType,
        MethodInfo method) =>
        Delegate.CreateDelegate(delegateType, method);

    private static Type Task8GetTypeFromHandleAllowed(
        RuntimeTypeHandle handle) =>
        Type.GetTypeFromHandle(handle);

    private static Type Task8ObjectGetTypePoison(object value) =>
        value.GetType();

    private static void Task8RunClassConstructorPoison() =>
        RuntimeHelpers.RunClassConstructor(
            typeof(Task8CustomAttributeDependencyPoison).TypeHandle);

    private static object Task8GetUninitializedObjectPoison() =>
        RuntimeHelpers.GetUninitializedObject(
            typeof(Task8CustomAttributeDependencyPoison));

    // This fixture deliberately exercises RuntimeHelpers.GetHashCode as emitted IL;
    // it is not comparing Roslyn symbols, so RS1024 is not applicable here.
#pragma warning disable RS1024
    private static int Task8RuntimeHelpersGetHashCodeAllowed(object value) =>
        RuntimeHelpers.GetHashCode(value);
#pragma warning restore RS1024

    private struct Task8LocalProviderPoison
    {
        internal int Value;
    }

    [MethodImpl(MethodImplOptions.NoInlining | MethodImplOptions.NoOptimization)]
    private static int Task8LocalProviderDependencyPoison()
    {
        var provider = new Task8LocalProviderPoison();
        Task8ConsumeLocalProviderPoison(ref provider);
        return provider.Value;
    }

    private static void Task8ConsumeLocalProviderPoison(
        ref Task8LocalProviderPoison provider)
    {
        provider.Value++;
    }

    private sealed class Task8CatchProviderPoisonException : Exception
    {
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static void Task8ThrowCatchProviderPoison()
    {
        throw new Task8CatchProviderPoisonException();
    }

    private static void Task8CatchProviderDependencyPoison()
    {
        try
        {
            Task8ThrowCatchProviderPoison();
        }
        catch (Task8CatchProviderPoisonException)
        {
        }
    }

    private class Task8GenericConstraintProviderPoison
    {
    }

    private sealed class Task8GenericConstraintDependencyPoison<T>
        where T : Task8GenericConstraintProviderPoison
    {
    }

    private sealed class Task8CustomAttributeProviderPoison
    {
    }

    [AttributeUsage(AttributeTargets.Class)]
    private sealed class Task8ProviderPoisonAttribute : Attribute
    {
        public Task8ProviderPoisonAttribute(Type providerType)
        {
            ProviderType = providerType;
        }

        public Type ProviderType { get; }

        public Type NamedProviderType { get; set; } = typeof(object);
    }

    [Task8ProviderPoison(
        typeof(Task8CustomAttributeProviderPoison),
        NamedProviderType = typeof(Task8CustomAttributeProviderPoison))]
    private sealed class Task8CustomAttributeDependencyPoison
    {
    }

    [System.Runtime.InteropServices.DllImport(
        "task8-poison",
        EntryPoint = "task8_pinvoke_poison")]
    private static extern void Task8PInvokeDependencyPoison();

    [CompilerGenerated]
    private sealed class Task8CompilerGeneratedStatePoison
    {
        internal static int MutableCounter = 1;
        internal static ParameterBag RuntimeValues = new();
    }

    [CompilerGenerated]
    private sealed class Task8CompilerGeneratedReadonlyStatePoison
    {
        internal static readonly List<int> MutableValues = new();
    }

    [CompilerGenerated]
    private sealed class Task8CompilerGeneratedMutableInterfaceStatePoison
    {
        internal static readonly ICollection<int> MutableValues =
            new List<int>();
    }

    private sealed class Task8ObjectValueFieldStatePoison
    {
        internal readonly object Value = new object();
    }

    private sealed class Task8ObjectValuePropertyStatePoison
    {
        internal object Value { get; } = new object();
    }

    private sealed class Task8ObjectHolderStateAllowed
    {
        internal object Holder { get; } = new object();
    }

    private sealed class UnknownSqlNode : SqlNode
    {
    }

    private sealed class UnknownSqlExpression : SqlExpression
    {
    }

    private sealed class UnknownConstraintDefinition : ConstraintDefinition
    {
        internal UnknownConstraintDefinition(SqlIdentifier name) : base(name)
        {
        }
    }

    private sealed class IndexedSlotList<T> : IReadOnlyList<T>
        where T : class
    {
        private readonly Func<int, T> _valueFactory;
        private readonly int _count;
        private readonly int? _poisonIndex;
        private readonly bool _throwOnSecondRead;
        private readonly bool _throwOnSecondCountRead;
        private readonly Dictionary<int, int> _reads = new();

        internal IndexedSlotList(
            int count,
            Func<int, T> valueFactory,
            int? poisonIndex = null,
            bool throwOnSecondRead = false,
            bool throwOnSecondCountRead = false)
        {
            _count = count;
            _valueFactory = valueFactory;
            _poisonIndex = poisonIndex;
            _throwOnSecondRead = throwOnSecondRead;
            _throwOnSecondCountRead = throwOnSecondCountRead;
            HighestReadIndex = -1;
        }

        public int Count
        {
            get
            {
                if (_throwOnSecondCountRead && CountReads != 0)
                {
                    throw new InvalidOperationException(
                        "Collection Count was read more than once.");
                }
                CountReads++;
                return _count;
            }
        }

        internal int CountReads { get; private set; }
        internal int HighestReadIndex { get; private set; }
        internal int TotalReads { get; private set; }
        internal bool PoisonIndexWasRead { get; private set; }

        internal int ReadsAt(int index) =>
            _reads.TryGetValue(index, out var count) ? count : 0;

        public T this[int index]
        {
            get
            {
                if (_poisonIndex.HasValue && index == _poisonIndex.Value)
                {
                    PoisonIndexWasRead = true;
                    throw new InvalidOperationException(
                        "Poison collection slot was read.");
                }
                var reads = ReadsAt(index);
                if (_throwOnSecondRead && reads != 0)
                {
                    throw new InvalidOperationException(
                        "Collection slot was read more than once.");
                }
                _reads[index] = reads + 1;
                TotalReads++;
                HighestReadIndex = Math.Max(HighestReadIndex, index);
                return _valueFactory(index);
            }
        }

        public IEnumerator<T> GetEnumerator()
        {
            throw new InvalidOperationException(
                "Collection must use bounded indexed access.");
        }

        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator()
        {
            return GetEnumerator();
        }
    }
}
