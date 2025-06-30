using System;
using System.Collections.Generic;
using System.Text;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary>
    public partial class UploadParam
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string OsClient { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string Path { get; set; }
        /// <summary>
        /// 压缩后最大体积。单位：kb
        /// </summary>
        public int? CompressMaxSize { get; set; }
        /// <summary>
        /// 压缩后最大宽度，单位：px
        /// </summary>
        public int? CompressMaxWidth { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public bool? Limit { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public bool? Multiple { get; set; }
        /// <summary>
        /// 是否是预览图，如果是预览图则压缩
        /// </summary>
        public bool? Preview { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    public partial class DiyMacReg
    {
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string ButongGLY { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string DangqianZT { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string Macdz { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public Guid Id { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    public partial class SysConfig
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string SysTitle { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string CompanyName { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    public class SsoPengruiModel
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string email { get; set; }
        public string id { get; set; }
        //public bool? isSuper { get; set; }
        //public string mainmenu { get; set; }
        //public List<string> permissions { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string token { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string username { get; set; }
    }
    /// <summary>
    /// 
    /// </summary> <summary>
    /// 
    /// </summary>
    public class SsoPengruiModelDepartment
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string id { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string name { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public List<string> node { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string parent { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public List<string> users { get; set; }
    }
    /// <summary>
    /// 
    /// </summary> <summary>
    /// 
    /// </summary>
    public class SsoPengruiModelRole
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string description { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string id { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string name { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public List<string> permission { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public List<string> users { get; set; }
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
        public string TokenName { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string GetTokenType { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string ClientSsoApi { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string ServerSsoApi { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public bool IsEnable { get; set; }
    }
}
