using System.Reflection;
using System.Runtime.Loader;

// 测试启动器不访问内核内部成员，不新增生产友元。执行逻辑仍编译在既有 Microi.Tests 边界内。
var testAssembly = Environment.GetEnvironmentVariable("MICROI_POOL_TEST_ASSEMBLY")!;
var directory = Path.GetDirectoryName(testAssembly)!;
AssemblyLoadContext.Default.Resolving += (context, name) =>
{
    var dependency = Path.Combine(directory, name.Name + ".dll");
    return File.Exists(dependency) ? context.LoadFromAssemblyPath(dependency) : null;
};
var assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(testAssembly);
var mode = Environment.GetEnvironmentVariable("MICROI_POOL_TEST_MODE");
var method = mode == "startup" ? "RunStartupAsync" : "RunAsync";
var run = assembly.GetType("Microi.Tests.Common.DatabasePoolNodeHarness", true)!.GetMethod(method, BindingFlags.Public | BindingFlags.Static)!;
await (Task)run.Invoke(null, null)!;
