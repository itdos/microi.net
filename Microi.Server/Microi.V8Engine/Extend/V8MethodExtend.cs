using System;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8EngineMethodExtend
    {
        /// <summary>
        /// 扩展 V8.Method.TestExtend 方法
        /// </summary>
        /// <param name="testParam"></param>
        /// <returns></returns>
        public string TestExtend(string testParam)
        {
            return "V8.Method.TestExtend：" + testParam;
        }
        /// <summary>
        /// 测试故意抛出异常
        /// </summary>
        /// <param name="testParam"></param>
        /// <returns></returns>
        public JObject TestException()
        {
            return JObject.FromObject(null);
        }
    }
}