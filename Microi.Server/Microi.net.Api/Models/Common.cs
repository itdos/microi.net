using System;
using System.Collections.Generic;
using System.Text;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary>
    public class SsoPengruiModel
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string? email { get; set; }
        public string? id { get; set; }
        //public bool? isSuper { get; set; }
        //public string mainmenu { get; set; }
        //public List<string> permissions { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string? token { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string? username { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    public class DiySso
    {
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string? TokenName { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string? GetTokenType { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string? ClientSsoApi { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string? ServerSsoApi { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public bool IsEnable { get; set; }
    }
}
