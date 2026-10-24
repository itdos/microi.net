using System.Net.Sockets;
using System.Reflection;
using System.Reflection.Emit;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class BackgroundTaskFailureDiagnosticsTests
{
    private const string Secret = "password=private-test-secret;Authorization=Bearer PRIVATE_TOKEN;SELECT secret FROM private_table";

    [Fact]
    public void ProviderAndSocketInnerExceptionsRetainSafeCodesWithoutSecretText()
    {
        var socket = new SocketException((int)SocketError.ConnectionReset);
        var provider = new ProviderFailure(Secret, socket) { Number = 1205, SqlState = "HY000" };
        var error = new TargetInvocationException(Secret, provider);
        error.Data["ConnectionString"] = Secret;
        var snapshot = BackgroundTaskFailureDiagnostics.CreateSnapshot(Claim(), "runtime-tenant",
            BackgroundTaskExecutionStage.ApiEngineExecution, error);
        var chain = (JArray)snapshot["Exceptions"]!;
        Assert.Equal(3, chain.Count);
        Assert.Equal(-1, (int)chain[0]["Parent"]!);
        Assert.Equal(0, (int)chain[1]["Parent"]!);
        Assert.Equal(1, (int)chain[2]["Parent"]!);
        Assert.Equal(1205, (int)chain[1]["Number"]!);
        Assert.Equal("HY000", (string?)chain[1]["SqlState"]);
        Assert.Equal((int)SocketError.ConnectionReset, (int)chain[2]["SocketErrorCode"]!);
        Assert.Equal(provider.HResult, (int)chain[1]["HResult"]!);
        Assert.DoesNotContain(Secret, snapshot.ToString());
        Assert.DoesNotContain("PRIVATE_TOKEN", snapshot.ToString());
        Assert.Equal(Secret.Length, (int)chain[1]["MessageLength"]!);
        Assert.Equal(Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Secret))).ToLowerInvariant(),
            (string?)chain[1]["MessageSha256"]);
    }

    [Theory]
    [InlineData("ApiEngineExecution")]
    [InlineData("ContinuationProgress")]
    [InlineData("ContinuationPersist")]
    [InlineData("TerminalPersist")]
    public void InjectedFailureReportsItsStageAndDoesNotMutateTaskState(string stageName)
    {
        var stage = Enum.Parse<BackgroundTaskExecutionStage>(stageName);
        var item = Claim();
        var before = JsonConvert.SerializeObject(item);
        var error = InjectFailure();
        string? written = null;
        Assert.True(BackgroundTaskFailureDiagnostics.TryReport(item, "runtime-tenant", stage, error,
            payload => { written = payload; return true; }));
        var snapshot = JObject.Parse(written!);
        Assert.Equal(stageName, (string?)snapshot["Stage"]);
        Assert.Equal("owner-tenant", (string?)snapshot["OwnerOsClient"]);
        Assert.Equal("runtime-tenant", (string?)snapshot["ExecutionOsClient"]);
        Assert.Equal("Product", (string?)snapshot["RuntimeOsClientType"]);
        Assert.Equal("Internal", (string?)snapshot["RuntimeOsClientNetwork"]);
        Assert.Equal("task-123", (string?)snapshot["TaskId"]);
        Assert.Equal(7L, (long)snapshot["Fence"]!);
        Assert.Equal(before, JsonConvert.SerializeObject(item));
        Assert.DoesNotContain(Secret, written!);
        Assert.Contains("InjectFailure", snapshot["Exceptions"]![0]!["Methods"]!.ToString());
        Assert.DoesNotContain(".cs", snapshot["Exceptions"]![0]!["Methods"]!.ToString());
        Assert.DoesNotContain("\\", snapshot["Exceptions"]![0]!["Methods"]!.ToString());
    }

    [Theory]
    [InlineData(7L)]
    [InlineData(long.MaxValue)]
    public void ProductionQueueSanitizerPreservesDiagnosticJsonAndFence(long fence)
    {
        var item = Claim();
        item.FencingToken = fence;
        var before = JsonConvert.SerializeObject(item);
        // 经过真实队列的脱敏入口，防止安全字段名误命中秘密规则而破坏 JSON。
        var sanitize = typeof(SysLogQueueService).GetMethod("Sanitize", BindingFlags.NonPublic | BindingFlags.Static)!;
        string? queuedContent = null;
        Assert.True(BackgroundTaskFailureDiagnostics.TryReport(item, "runtime-tenant",
            BackgroundTaskExecutionStage.ContinuationPersist, InjectFailure(), content =>
            {
                queuedContent = (string?)sanitize.Invoke(null, new object[] { content, 16384 });
                return true;
            }));
        var persisted = JObject.Parse(queuedContent!);
        Assert.Equal(fence, (long)persisted["Fence"]!);
        Assert.Null(persisted["FencingToken"]);
        Assert.Equal("ContinuationPersist", (string?)persisted["Stage"]);
        Assert.Equal("task-123", (string?)persisted["TaskId"]);
        Assert.NotEmpty((JArray)persisted["Exceptions"]!);
        Assert.DoesNotContain("PRIVATE_TOKEN", queuedContent!);
        Assert.DoesNotContain(Secret, queuedContent!);
        Assert.Equal(before, JsonConvert.SerializeObject(item));
    }

    [Fact]
    public void ProductionQueuePreservesFourFullLengthExceptionStacksWithinContentLimit()
    {
        var item = Claim();
        item.Id = new string('i', 128);
        item.OsClient = new string('o', 128);
        item.RuntimeOsClientType = new string('t', 128);
        item.RuntimeOsClientNetwork = new string('n', 128);
        item.FencingToken = long.MaxValue;
        var before = JsonConvert.SerializeObject(item);
        var error = FullLengthExceptionChain();
        string? queuedContent = null;
        var sanitize = typeof(SysLogQueueService).GetMethod("Sanitize", BindingFlags.NonPublic | BindingFlags.Static)!;
        Assert.True(BackgroundTaskFailureDiagnostics.TryReport(item, new string('e', 128),
            BackgroundTaskExecutionStage.ContinuationPersist, error, content =>
            {
                queuedContent = (string?)sanitize.Invoke(null, new object[] { content, 16384 });
                return true;
            }));
        var persisted = JObject.Parse(queuedContent!);
        Assert.True(queuedContent!.Length < 16384);
        Assert.Equal(long.MaxValue, (long)persisted["Fence"]!);
        Assert.Equal(item.Id, (string?)persisted["TaskId"]);
        var exceptions = (JArray)persisted["Exceptions"]!;
        Assert.Equal(4, exceptions.Count);
        Assert.All(exceptions, entry =>
        {
            Assert.Equal(256, ((string)entry["Type"]!).Length);
            var methods = (JArray)entry["Methods"]!;
            Assert.Equal(4, methods.Count);
            Assert.All(methods, method => Assert.Equal(256 + 1 + 128, ((string)method!).Length));
        });
        Assert.False((bool)persisted["ExceptionsTruncated"]!);
        Assert.DoesNotContain(Secret, queuedContent);
        Assert.Equal(before, JsonConvert.SerializeObject(item));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void QueueRejectionOrExceptionCannotReplaceOriginalFailureOrSpendRetryBudget(bool throws)
    {
        var item = Claim();
        var before = JsonConvert.SerializeObject(item);
        var original = InjectFailure();
        var writes = 0;
        Assert.False(BackgroundTaskFailureDiagnostics.TryReport(item, "runtime-tenant",
            BackgroundTaskExecutionStage.TerminalPersist, original, _ =>
            {
                writes++;
                if (throws) throw new InvalidOperationException(Secret);
                return false;
            }));
        Assert.Equal(1, writes);
        Assert.Equal(before, JsonConvert.SerializeObject(item));
        Assert.Equal(Secret, original.Message);
        Assert.Equal(0, item.AttemptCount);
        Assert.Equal("Running", item.Status);
        Assert.Equal("old-result", item.ResultJson);
        Assert.Equal("old-checkpoint", item.CheckpointJson);
    }

    [Fact]
    public void UnexpectedProviderPropertiesAreNotSerializedOrStringified()
    {
        var error = new UnsafeProviderFailure();
        var snapshot = BackgroundTaskFailureDiagnostics.CreateSnapshot(Claim(), "runtime-tenant",
            BackgroundTaskExecutionStage.ApiEngineExecution, error);
        var entry = snapshot["Exceptions"]![0]!;
        Assert.Null(entry["Number"]);
        Assert.Null(entry["SqlState"]);
        Assert.True((bool)entry["SocketErrorCodeUnavailable"]!);
        Assert.True((bool)entry["MessageUnavailable"]!);
        Assert.False(error.Stringified);
        Assert.DoesNotContain("PRIVATE_TOKEN", snapshot.ToString());
    }

    [Fact]
    public void ExceptionBreadthAndMessageHashingAreBoundedAndExplicit()
    {
        var large = new string('z', BackgroundTaskFailureDiagnostics.MaximumMessageHashChars + 123);
        var error = new AggregateException(Enumerable.Range(0, 20).Select(_ => new IOException(large)));
        var snapshot = BackgroundTaskFailureDiagnostics.CreateSnapshot(Claim(), "runtime-tenant",
            BackgroundTaskExecutionStage.ContinuationPersist, error);
        var chain = (JArray)snapshot["Exceptions"]!;
        Assert.Equal(BackgroundTaskFailureDiagnostics.MaximumExceptions, chain.Count);
        Assert.True((bool)snapshot["ExceptionsTruncated"]!);
        Assert.True((bool)chain[1]["MessageHashTruncated"]!);
        Assert.Equal(large.Length, (int)chain[1]["MessageLength"]!);
        Assert.Equal(BackgroundTaskFailureDiagnostics.MaximumMessageHashChars, (int)chain[1]["MessageHashChars"]!);
        Assert.All(chain, entry => Assert.True(((JArray)entry["Methods"]!).Count <= BackgroundTaskFailureDiagnostics.MaximumFrames));
        Assert.True(snapshot.ToString(Formatting.None).Length < 20000);
    }

    [Fact]
    public void MalformedIdentifiersAndUnknownStageCannotExposeUntrustedText()
    {
        var item = Claim();
        item.Id = Secret;
        item.OsClient = "tenant\nAuthorization=PRIVATE_TOKEN";
        item.RuntimeOsClientType = new string('x', 129);
        item.RuntimeOsClientNetwork = "https://private.invalid/?token=PRIVATE_TOKEN";
        var before = JsonConvert.SerializeObject(item);
        var snapshot = BackgroundTaskFailureDiagnostics.CreateSnapshot(item, "runtime/path?secret=value",
            (BackgroundTaskExecutionStage)999, InjectFailure());
        Assert.Equal("Unknown", (string?)snapshot["Stage"]);
        foreach (var key in new[] { "OwnerOsClient", "ExecutionOsClient", "RuntimeOsClientType", "RuntimeOsClientNetwork", "TaskId" })
            Assert.Equal("[omitted]", (string?)snapshot[key]);
        Assert.DoesNotContain("PRIVATE_TOKEN", snapshot.ToString());
        Assert.DoesNotContain("private.invalid", snapshot.ToString());
        Assert.DoesNotContain(Secret, snapshot.ToString());
        Assert.Equal(before, JsonConvert.SerializeObject(item));
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static Exception InjectFailure()
    {
        try { throw new IOException(Secret); }
        catch (IOException error) { return error; }
    }

    private static Exception FullLengthExceptionChain()
    {
        // 用真实 CLR 元数据和不内联调用栈覆盖长度上限，不伪造 StackTrace 字符串。
        var assembly = AssemblyBuilder.DefineDynamicAssembly(new AssemblyName("DiagnosticBoundary"), AssemblyBuilderAccess.Run);
        var type = assembly.DefineDynamicModule("Boundary").DefineType(new string('T', 256), TypeAttributes.Public, typeof(IOException));
        var constructor = type.DefineConstructor(MethodAttributes.Public, CallingConventions.Standard, new[] { typeof(string), typeof(Exception) });
        var constructorIl = constructor.GetILGenerator();
        constructorIl.Emit(OpCodes.Ldarg_0);
        constructorIl.Emit(OpCodes.Ldarg_1);
        constructorIl.Emit(OpCodes.Ldarg_2);
        constructorIl.Emit(OpCodes.Call, typeof(IOException).GetConstructor(new[] { typeof(string), typeof(Exception) })!);
        constructorIl.Emit(OpCodes.Ret);
        MethodBuilder? previous = null;
        string? outerName = null;
        for (var index = 0; index < 4; index++)
        {
            outerName = new string('M', 127) + index;
            var method = type.DefineMethod(outerName, MethodAttributes.Public | MethodAttributes.Static, typeof(void), new[] { typeof(Exception) });
            method.SetImplementationFlags(MethodImplAttributes.NoInlining);
            var il = method.GetILGenerator();
            if (previous == null)
            {
                il.Emit(OpCodes.Ldstr, Secret);
                il.Emit(OpCodes.Ldarg_0);
                il.Emit(OpCodes.Newobj, constructor);
                il.Emit(OpCodes.Throw);
            }
            else
            {
                il.Emit(OpCodes.Ldarg_0);
                il.Emit(OpCodes.Call, previous);
                il.Emit(OpCodes.Ret);
            }
            previous = method;
        }
        var invoke = type.CreateType()!.GetMethod(outerName!)!;
        Exception? error = null;
        for (var index = 0; index < 4; index++)
        {
            try { invoke.Invoke(null, new object?[] { error }); }
            catch (TargetInvocationException caught) { error = caught.InnerException!; }
        }
        return error!;
    }

    private static BackgroundTaskRecord Claim() => new()
    {
        Id = "task-123", OsClient = "owner-tenant", Status = "Running", FencingToken = 7,
        RuntimeOsClientType = "Product", RuntimeOsClientNetwork = "Internal", LeaseOwner = "original-owner",
        AttemptCount = 0, MaxAttempts = 1, RetryOnFailure = 0, ResultJson = "old-result",
        CheckpointJson = "old-checkpoint", ParamJson = Secret, TrustedUserJson = Secret, LastError = Secret
    };

    private sealed class ProviderFailure(string message, Exception inner) : Exception(message, inner)
    {
        public int Number { get; init; }
        public string? SqlState { get; init; }
    }

    private sealed class UnsafeProviderFailure : Exception
    {
        public bool Stringified;
        public object Number => this;
        public string SqlState => Secret;
        public int SocketErrorCode => throw new InvalidOperationException(Secret);
        public override string Message => throw new InvalidOperationException(Secret);
        public override string ToString() { Stringified = true; return Secret; }
    }
}
