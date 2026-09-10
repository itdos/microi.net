using System.Reflection;
using Jint;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common
{
    public class V8ResultAssignmentTests
    {
        [Theory]
        [InlineData(false, "V8.Result = payload;")]
        [InlineData(false, "V8.Result = payload; return;")]
        [InlineData(false, "return payload;")]
        [InlineData(true, "V8.Result = await Promise.resolve(payload);")]
        [InlineData(true, "V8.Result = payload; return;")]
        [InlineData(true, "return await Promise.resolve(payload);")]
        public async Task BothResultStyles_PreserveRedirectAndTokenPayload(bool asynchronous, string source)
        {
            using var engine = new V8Engine().CreateEngine();
            var param = new V8EngineParam();
            engine.SetValue("V8", param);
            engine.Execute("var payload = {Code:1, Data:{Token:'test-ticket'}, RedirectUrl:'https://example.test/#/detail?token=test-ticket'};");
            var script = $"({(asynchronous ? "async " : "")}function(){{{source}}})()";
            var completion = asynchronous
                ? await engine.EvaluateAsync(script, cancellationToken: TestContext.Current.CancellationToken)
                : engine.Evaluate(script);
            ApplySyncEvaluationResult(param, completion);
            var result = JObject.FromObject(param.Result);
            Assert.Equal(1, result.Value<int>("Code"));
            Assert.Equal("test-ticket", result["Data"]?.Value<string>("Token"));
            Assert.Equal("https://example.test/#/detail?token=test-ticket", result.Value<string>("RedirectUrl"));
        }

        [Theory]
        [InlineData("V8.Result={Code:0,Msg:'refused'}; return;", 0)]
        [InlineData("V8.Result={Code:0}; return {Code:1};", 1)]
        public void ExplicitFailureAndNewReturnPrecedenceRemainCompatible(string source, int code)
        {
            using var engine = new Engine();
            var param = new V8EngineParam();
            engine.SetValue("V8",param);
            ApplySyncEvaluationResult(param,engine.Evaluate($"(function(){{{source}}})()"));
            Assert.Equal(code,JObject.FromObject(param.Result).Value<int>("Code"));
        }

        [Fact]
        public void SyncEvaluation_PreservesExplicitV8Result_WhenIifeCompletesWithUndefined()
        {
            var engine = new Engine();
            var param = new V8EngineParam();
            engine.SetValue("V8", param);

            var completion = engine.Evaluate(@"
                (function () {
                    V8.Result = { Code: 1, Msg: 'ok' };
                    return;
                })();");

            Assert.True(completion.IsUndefined());
            Assert.NotNull(param.Result);

            ApplySyncEvaluationResult(param, completion);

            var result = JObject.FromObject(param.Result);
            Assert.Equal(1, result.Value<int>("Code"));
            Assert.Equal("ok", result.Value<string>("Msg"));
        }

        [Fact]
        public void SyncEvaluation_UsesConcreteCompletionValue_WhenScriptReturnsOne()
        {
            var engine = new Engine();
            var param = new V8EngineParam { Result = new { Code = 0 } };
            var completion = engine.Evaluate("({ Code: 1, Msg: 'returned' })");

            ApplySyncEvaluationResult(param, completion);

            var result = JObject.FromObject(param.Result);
            Assert.Equal(1, result.Value<int>("Code"));
            Assert.Equal("returned", result.Value<string>("Msg"));
        }

        private static void ApplySyncEvaluationResult(V8EngineParam param, Jint.Native.JsValue completion)
        {
            var method = typeof(V8Engine).GetMethod(
                "ApplySyncEvaluationResult",
                BindingFlags.NonPublic | BindingFlags.Static);

            Assert.NotNull(method);
            method.Invoke(null, new object[] { param, completion });
        }
    }
}
