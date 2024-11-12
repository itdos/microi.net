using System;
using System.Security.Cryptography;
using System.Text;

namespace Microi.net
{
    public partial class V8EngineMethodExtend
    {
        /// <summary>
        /// 测试扩展V8.Method.TestV8Extend2('test')方法
        /// </summary>
        /// <param name="testParam"></param>
        /// <returns></returns>
        public string TestV8Extend2(string testParam)
        {
            return "TestV8Extend2：" + testParam;
        }
    }
}