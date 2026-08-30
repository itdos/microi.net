using System.Collections.Concurrent;
using System.Linq.Expressions;
using System.Reflection;
using Dos.ORM;

namespace Microi.Tests.ORM;

public sealed class NavigateHardeningTests
{
    [Fact]
    public void IncludeOne_RejectsMissingSessionAndExpression()
    {
        var rows = new List<NavigateSource> { new() { TargetId = "1" } };
        Expression<Func<NavigateSource, NavigateTarget>> expression = row => row.Target;

        Assert.Throws<ArgumentNullException>(() =>
            NavigateExtensions.IncludeOne<NavigateSource, NavigateTarget>(null!, rows, expression));

        var session = new DbSession(
            DatabaseType.MySql,
            "Server=127.0.0.1;Database=microi_navigate_test;Uid=test;Pwd=test;");
        Assert.Throws<ArgumentNullException>(() =>
            NavigateExtensions.IncludeOne<NavigateSource, NavigateTarget>(session, rows, null!));
    }

    [Fact]
    public void SetterMapCache_IsStableDuringConcurrentReads()
    {
        var method = typeof(NavigateExtensions)
            .GetMethod("BuildSetterMap", BindingFlags.NonPublic | BindingFlags.Static)
            ?.MakeGenericMethod(typeof(NavigateTarget));
        Assert.NotNull(method);

        var results = new ConcurrentBag<object>();
        Parallel.For(0, 256, _ => results.Add(method.Invoke(null, null)!));

        var first = results.First();
        Assert.All(results, result => Assert.Same(first, result));
    }

    private sealed class NavigateSource : Entity
    {
        public string? TargetId { get; set; }

        [Navigate(NavigateType.OneToOne, nameof(TargetId))]
        public NavigateTarget? Target { get; set; }
    }

    private sealed class NavigateTarget : Entity
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
    }
}
