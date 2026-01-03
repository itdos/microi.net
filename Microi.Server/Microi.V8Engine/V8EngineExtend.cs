using System;
using Dos.Common;
using Microi.Model.Aliyun;

namespace Microi.net
{
    public partial class V8EngineExtend
    {
        
        /// <summary>
        /// 扩展 V8.Alipay 对象
        /// </summary>
        public Alipay Alipay
        {
            get { return new Alipay(); }
        }
        /// <summary>
        /// 扩展 V8.WeChat 对象
        /// </summary>
        public WeChat WeChat
        {
            get { return new WeChat(); }
        }
        /// <summary>
        /// 扩展 V8.AlipayV3 对象
        /// </summary>
        public AlipayV3 AlipayV3
        {
            get { return new AlipayV3(); }
        }
        /// <summary>
        /// 扩展 V8.Alidns 对象
        /// </summary>
        public Alidns Alidns
        {
            get { return new Alidns(); }
        }

        /// <summary>
        /// 扩展 V8.TestV8Extend3('test') 方法
        /// </summary>
        /// <returns></returns>
        public string TestV8Extend3(string testParam)
        {
            return "TestV8Extend3：" + testParam;
        }

        /// <summary>
        /// 注意：这种方式不支持。
        /// </summary>
        // public class Tencent
        // {
        //     public static string Test1()
        //     {
        //         return "111";
        //     }
        //     public string Test2()
        //     {
        //         return "222";
        //     }
        // }
    }
}


