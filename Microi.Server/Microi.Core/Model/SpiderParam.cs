using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

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

    public class MicroiSpiderSessionParam
    {
        /// <summary>
        /// 会话Id。为空时由采集引擎自动生成。
        /// </summary>
        public string SessionId { get; set; }

        /// <summary>
        /// 登录态配置Key。相同ProfileKey会复用同一个浏览器用户目录。
        /// </summary>
        public string ProfileKey { get; set; }

        /// <summary>
        /// 指定浏览器用户数据目录。为空时使用系统临时目录下的 Microi.Spider/profiles。
        /// </summary>
        public string UserDataDir { get; set; }

        public string Url { get; set; }

        /// <summary>
        /// 是否无头。人工登录场景默认false。
        /// </summary>
        public bool? Headless { get; set; }

        public bool? VirtualWindows { get; set; }

        public string ExecutablePath { get; set; }

        public int? TimeoutMs { get; set; }

        /// <summary>
        /// DOMContentLoaded / Networkidle0 / Networkidle2，默认 Networkidle2。
        /// </summary>
        public string WaitUntil { get; set; }

        public List<string> CaptureResponseUrlStarts { get; set; }

        public int? CaptureResponseBodyMaxLength { get; set; }
    }

    public class MicroiSpiderRecipeStepParam
    {
        /// <summary>
        /// open / waitForSelector / manual / extract / fill / click / wait / assert / snapshot。
        /// </summary>
        public string Type { get; set; }

        /// <summary>
        /// 步骤名称，也可作为 extract 保存变量名。
        /// </summary>
        public string Name { get; set; }

        public string Url { get; set; }

        public string Selector { get; set; }

        public string Script { get; set; }

        public string Value { get; set; }

        public JObject Fields { get; set; }

        public string Text { get; set; }

        public int? TimeoutMs { get; set; }

        public string WaitUntil { get; set; }

        public List<string> ResponseUrlStarts { get; set; }

        public List<string> RequiredFields { get; set; }

        public bool? SaveHtml { get; set; }

        public bool? SaveScreenshot { get; set; }

        public int? CaptureResponseBodyMaxLength { get; set; }
    }

    public class MicroiSpiderRecipeParam : MicroiSpiderSessionParam
    {
        /// <summary>
        /// 从第几个步骤开始执行。用于人工登录后继续执行。
        /// </summary>
        public int? StartStepIndex { get; set; }

        /// <summary>
        /// 配方变量，比如账号、密码、项目名称、已提取姓名等。
        /// </summary>
        public JObject Variables { get; set; }

        public List<MicroiSpiderRecipeStepParam> Steps { get; set; }

        /// <summary>
        /// 执行完成后是否关闭会话，默认false，便于复用登录态。
        /// </summary>
        public bool? CloseWhenDone { get; set; }
    }
}

