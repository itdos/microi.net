using System.Reflection;

namespace Microi.Tests.Common;

public sealed class ApiRuntimeDependencyCompatibilityTests
{
    [Fact]
    public void SwashbuckleAnnotationAssembly_ExposesLoadableTypes()
    {
        var annotations = Assembly.Load("Swashbuckle.AspNetCore.Annotations");

        var loadError = Record.Exception(() => annotations.GetTypes());

        Assert.Null(loadError);
    }
}
