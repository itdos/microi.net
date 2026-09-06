using System;
using Dos.Common;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>给表单事件使用的纯语法校验原子，不执行源码，不读写配置。</summary>
        public DosResult ValidateGlobalFunction(string name, string code)
        {
            try
            {
                GlobalFunctionRegistry.ValidateDefinition(name, GlobalFunctionRegistry.Decode(code));
                return new DosResult(1);
            }
            catch (Exception ex) { return new DosResult(0, null, "全局函数校验失败：" + ex.Message); }
        }
    }
}
