using System.Threading;
using Jint;
using Jint.Runtime;
using Jint.Runtime.Interop;
using Microi.net;

namespace Microi.Tests.Common;

// 使用生产 CreateEngine 的默认程序集、MemberFilter、对象转换器；不复制沙箱配置。
// 不执行数据库命令。Mongo 真实业务表正例由配套 Full HTTP 测试执行。
[Collection("TenantContextGlobal")]
public sealed class ManagedStorageClrBoundaryTests
{
    private static Engine Create()
    {
        // 生产宿主已经加载 Mongo 服务；这里保证同样的程序集加载前提，未额外 AllowClr。
        GC.KeepAlive(typeof(V8MongoDB));
        return new V8Engine().CreateEngine(new CreateV8EngineParam { Timeout = 10 });
    }

    [Fact]
    public void Ordinary_clr_utilities_and_wrapped_Mongo_object_remain_usable()
    {
        using var engine = Create();
        engine.SetValue("mongo", new V8MongoDB());
        Assert.Equal(3, engine.Evaluate("System.Threading.Thread.Sleep(1); System.Math.Abs(-3)").AsNumber());
        Assert.Matches("^[a-f0-9]{24}$", engine.Evaluate("mongo.NewId()").AsString());
    }

    [Theory]
    [InlineData("ManagedStorageAdmissionRuntime", "Enter")]
    [InlineData("MongoManagedStorageAdmissionStore", "Read")]
    public void Admission_control_types_cannot_expose_mutable_or_callable_members(string type, string member)
    {
        using var engine = Create();
        var clrType = type == "ManagedStorageAdmissionRuntime"
            ? typeof(ManagedStorageAdmissionRuntime)
            : typeof(V8MongoDB).Assembly.GetType("Microi.net.MongoManagedStorageAdmissionStore", throwOnError: true)!;
        // NamespaceReference is itself ICallable: typeof an unresolved namespace is
        // "function" too. Resolve a real TypeReference before testing the boundary.
        engine.SetValue("typePath", clrType.AssemblyQualifiedName);
        Assert.IsType<TypeReference>(engine.Evaluate("importNamespace('')[typePath]"));
        engine.Execute("var controlType=importNamespace('')[typePath];");
        if (type == "ManagedStorageAdmissionRuntime")
        {
            Assert.True(engine.Evaluate("controlType.Enter").IsUndefined());
            // A non-managed Key returns null immediately if Enter is really callable;
            // no store/database can be reached by this probe.
            Assert.Throws<JavaScriptException>(() => engine.Execute("controlType.Enter('ordinary-probe','tenant',null)"));
        }
        else
        {
            Assert.Throws<JavaScriptException>(() => engine.Execute("new controlType()"));
            engine.SetValue("controlObject", Activator.CreateInstance(clrType, nonPublic: true));
            Assert.True(engine.Evaluate("controlObject.Read").IsUndefined());
        }
    }

    [Fact]
    public void Unresolved_namespace_callable_is_not_a_CLR_runtime_method()
    {
        using var engine = Create();
        const string expression = "importNamespace('Microi.net').ManagedStorageAdmissionRuntime.Enter";
        var resolved = engine.Evaluate(expression);
        TestContext.Current.TestOutputHelper?.WriteLine("Unqualified runtime member resolved as " + resolved.GetType().FullName);
        if (resolved is NamespaceReference)
        {
            Assert.True(engine.Evaluate("typeof " + expression + " === 'function'").AsBoolean());
            Assert.Throws<JavaScriptException>(() => engine.Execute(expression + "('ordinary-probe','tenant',null)"));
        }
        else
        {
            Assert.True(resolved.IsUndefined());
        }
    }

    [Fact]
    public void Admission_objects_cannot_mutate_CLR_fields_even_if_accidentally_exposed()
    {
        using var engine = Create();
        var ticket = new ManagedStorageTicket { Token = "host-token" };
        var gate = new ManagedStorageGate { Phase = "Maintenance" };
        engine.SetValue("ticket", ticket); engine.SetValue("gate", gate);
        engine.Execute("try{ticket.Token='attacker';}catch(e){} try{gate.Phase='Open';}catch(e){}");
        // 直接检查真实 CLR 对象，不能将 Jint wrapper 上的 JS 影子属性当作真实宿主修改。
        Assert.Equal("host-token", ticket.Token); Assert.Equal("Maintenance", gate.Phase);
    }

    [Theory]
    [InlineData("(function(){var c=new (importNamespace('MongoDB.Driver').MongoClient)('mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=1000&connectTimeoutMS=1000'); try {return c.GetDatabase('diy_chat_fixture').DatabaseNamespace.DatabaseName;} finally {try{c.Dispose();}catch(e){}}})()")]
    public void Raw_Mongo_capability_is_not_exposed_beside_controlled_V8_methods(string expression)
    {
        using var engine = Create();
        // 这是候选安全门禁，尚未证明当前产品会拒绝。成功返回即真实能力暴露，不能改成 Skip。
        engine.SetValue("probeCode", expression);
        Assert.False(engine.Evaluate("(function(){try{eval(probeCode);return true;}catch(e){return false;}})()").AsBoolean(),
            "Raw Mongo CLR capability is accessible; reserved V8 collection guard alone is insufficient");
    }

    [Fact]
    public async Task Ordinary_Task_Run_flows_the_real_tenant_context()
    {
        using var tenant = V8TenantContext.Enter("standard-admission-flow", "ordinary-api", "test");
        using var engine = Create();
        var result = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        engine.SetValue("callback", (Action)(() => result.TrySetResult(V8TenantContext.Current?.OsClient)));
        engine.Evaluate("System.Threading.Tasks.Task.Run(callback)");
        Assert.Equal("standard-admission-flow", await result.Task.WaitAsync(TimeSpan.FromSeconds(5)));
    }

    [Fact]
    public async Task Ordinary_ThreadPool_queue_flows_the_real_tenant_context()
    {
        using var tenant = V8TenantContext.Enter("standard-admission-flow", "ordinary-api", "test");
        using var engine = Create();
        var result = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        engine.SetValue("callback", new WaitCallback(_ => result.TrySetResult(V8TenantContext.Current?.OsClient)));
        Assert.True(engine.Evaluate("System.Threading.ThreadPool.QueueUserWorkItem(callback,null)").AsBoolean());
        Assert.Equal("standard-admission-flow", await result.Task.WaitAsync(TimeSpan.FromSeconds(5)));
    }

    [Theory]
    [InlineData("System.Threading.ExecutionContext.suppressFlow")]
    [InlineData("System.Threading.ThreadPool.unsafeQueueUserWorkItem")]
    [InlineData("System.Threading.ThreadPool.UnsafeRegisterWaitForSingleObject")]
    [InlineData("System.Threading.ThreadPool.UnsafeQueueNativeOverlapped")]
    public void Context_detaching_members_and_aliases_are_unavailable(string expression)
    {
        using var engine = Create();
        Assert.True(engine.Evaluate(expression).IsUndefined());
    }

    [Fact]
    public void Thread_UnsafeStart_is_unavailable_while_normal_Start_keeps_context()
    {
        using var tenant = V8TenantContext.Enter("standard-admission-flow", "ordinary-api", "test");
        using var engine = Create();
        string? observedTenant = null;
        var thread = new Thread(() => observedTenant = V8TenantContext.Current?.OsClient);
        engine.SetValue("thread", thread);
        Assert.True(engine.Evaluate("thread.UnsafeStart").IsUndefined());
        engine.Execute("thread.Start()");
        Assert.True(thread.Join(TimeSpan.FromSeconds(5)));
        Assert.Equal("standard-admission-flow", observedTenant);
    }

    [Fact]
    public async Task Scripts_cannot_suppress_execution_context_before_Task_Run()
    {
        using var tenant = V8TenantContext.Enter("standard-admission-flow", "ordinary-api", "test");
        using var engine = Create();
        var result = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        engine.SetValue("callback", (Action)(() => result.TrySetResult(V8TenantContext.Current?.OsClient)));
        Assert.False(ExecutionContext.IsFlowSuppressed());
        bool scheduled;
        try
        {
            scheduled = engine.Evaluate("""
                (function(){
                  var flow=null;
                  try {flow=System.Threading.ExecutionContext.SuppressFlow(); System.Threading.Tasks.Task.Run(callback); return true;}
                  catch(e){return false;}
                  finally {if(flow!==null) flow.Undo();}
                })()
                """).AsBoolean();
        }
        finally
        {
            // 即使生产过滤器只拦 Undo，也不允许污染测试线程之后的上下文。
            if (ExecutionContext.IsFlowSuppressed()) ExecutionContext.RestoreFlow();
        }
        var inherited = scheduled ? await result.Task.WaitAsync(TimeSpan.FromSeconds(5)) : "not-scheduled";
        Assert.False(scheduled, "Script dispatched a callback after SuppressFlow; observed tenant=" + (inherited ?? "<null>"));
    }

    [Fact]
    public async Task Scripts_cannot_dispatch_UnsafeQueueUserWorkItem_without_context()
    {
        using var tenant = V8TenantContext.Enter("standard-admission-flow", "ordinary-api", "test");
        using var engine = Create();
        var result = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        engine.SetValue("callback", new WaitCallback(_ => result.TrySetResult(V8TenantContext.Current?.OsClient)));
        var scheduled = engine.Evaluate("(function(){try{return System.Threading.ThreadPool.UnsafeQueueUserWorkItem(callback,null);}catch(e){return false;}})()").AsBoolean();
        var inherited = scheduled ? await result.Task.WaitAsync(TimeSpan.FromSeconds(5)) : "not-scheduled";
        Assert.False(scheduled, "Script dispatched unsafe callback; observed tenant=" + (inherited ?? "<null>"));
    }
}
