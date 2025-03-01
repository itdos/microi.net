using System;

namespace Microi.net{
    public partial class V8EngineExtend
    {
        /// <summary>
        /// 测试扩展V8.TestV8Extend3('test')方法
        /// </summary>
        /// <param name="testParam"></param>
        /// <returns></returns>
        public string TestV8Extend3(string testParam)
        {
            return "TestV8Extend3：" + testParam;
        }
        public class Tencent
        {
            public string Test1()
            {
                return "111";
            }
        }
    }
}


