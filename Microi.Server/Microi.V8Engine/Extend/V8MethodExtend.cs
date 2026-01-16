using System;
using System.Security.Cryptography;
using System.Text;

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
    }
}