using System;
using Dos.Common;
using Microi.Model.Aliyun;

namespace Microi.net{
    public partial class V8EngineExtend
    {
        /// <summary>
        /// 这种方式支持。测试扩展V8.TestV8Extend3('test')方法
        /// </summary>
        /// <param name="testParam"></param>
        /// <returns></returns>
        public string TestV8Extend3(string testParam)
        {
            return "TestV8Extend3：" + testParam;
        }
        /// <summary>
        /// 注意：这种方式不支持。
        /// </summary>
        public class Tencent
        {
            public static string Test1()
            {
                return "111";
            }
            public string Test2()
            {
                return "222";
            }
        }
        /// <summary>
        /// 新增V8.Alipay对象。
        /// 这种方式支持V8.Alipay.Test22('test')，也支持V8.Alipay.CreatePay({ AppId : '11' })
        /// </summary>
        public Alipay Alipay
        {
            get { return new Alipay(); }
        }
        public AlipayV3 AlipayV3
        {
            get { return new AlipayV3(); }
        }
        /// <summary>
        /// 新增V8.Alipay()函数。
        /// 这种方式支持【V8.Alipay().Test22('test')】，也支持【V8.Alipay().CreatePay({ AppId : '11' })】
        /// </summary>
        /// <returns></returns>
        // public Alipay Alipay()
        // {
        //     return new Alipay();
        // }
    }
}


