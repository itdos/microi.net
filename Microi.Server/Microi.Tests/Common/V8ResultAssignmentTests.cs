using System.Reflection;
using Jint;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common
{
    public class V8ResultAssignmentTests
    {
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
