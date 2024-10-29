using System;
using System.Collections;
using System.Collections.Generic;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public static partial class DiyMessage
    {
        /// <summary>
        /// 默认语言
        /// </summary>
        public static string Lang = "cn";
        public static Dictionary<string, int> Code = new Dictionary<string, int>();
        public static Dictionary<string, Dictionary<string, string>> Msg = new Dictionary<string, Dictionary<string, string>>();
    }
}