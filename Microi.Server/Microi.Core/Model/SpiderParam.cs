using System;
using System.Collections.Generic;

namespace Microi.net
{
    public class MicroiSpiderParamSelectorModel
    {
        /// <summary>
        /// 形如：.long-image-container img
        /// </summary>
        public string Selector { get; set; }
        /// <summary>
        /// 形如：(element) => element.src
        /// </summary>
        public string Script { get; set; }
        public string Key { get; set; }
    }
    public class MicroiSpiderParam
    {
        public string Url { get; set; }
        /// <summary>
        /// 形如：.long-image-container img
        /// </summary>
        public string Selector { get; set; }
        /// <summary>
        /// 形如：(element) => element.src
        /// </summary>
        public string Script { get; set; }

        /// <summary>
        /// 批量Selector+Script
        /// </summary>
        public List<MicroiSpiderParamSelectorModel> Selectors { get; set; }

        /// <summary>
        /// 返回指定ResponseUrl的数据
        /// </summary>
        public string ResponseUrlStart { get; set; }

        /// <summary>
        /// 返回指定ResponseUrl的数据
        /// </summary>
        public List<string> ResponseUrlsStart { get; set; }
        /// <summary>
        /// 是否无头，默认true
        /// </summary>
        public bool? Headless { get; set; }
        /// <summary>
        /// 运行完毕后，是否关闭浏览器，默认true
        /// </summary>
        public bool? IsCloseBrowser { get; set; }
        /// <summary>
        /// 运行完毕后，是否关闭页签，默认true
        /// </summary>
        public bool? IsClosePage { get; set; }
        /// <summary>
        /// 采集成功后，是否关闭页签，默认true
        /// </summary>
        //public bool? SuccessClosePage { get; set; }
        /// <summary>
        /// 模拟windows用户
        /// </summary>
        public bool? VirtualWindows { get; set; }
        /// <summary>
        /// 指定chrome的路径
        /// </summary>
        public string ExecutablePath { get; set; }
    }
}

