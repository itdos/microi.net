using System;
using Newtonsoft.Json.Linq;
using System.IO;
using System.Collections.Generic;

namespace Microi.net
{
    public partial class OfficeExportParam : BaseParam
    {
        public string FormEngineKey { get; set; }
        public string FormDataId { get; set; }
        public JObject FormData { get; set; }
        public byte[] TplFileByte { get; set; }
        public string TplKey { get; set; }
        public string TplId { get; set; }
    }

    public partial class OfficeExportWordTextParam : BaseParam
    {
        public string FileName { get; set; }
        public string Title { get; set; }
        public string Content { get; set; }
        public List<string> Lines { get; set; } = new List<string>();
        public string FontFamily { get; set; } = "Microsoft YaHei";
        public int? FontSize { get; set; } = 9;
        public int? TitleFontSize { get; set; } = 14;
        public int? SpacingAfter { get; set; } = 40;
        public bool? Compact { get; set; } = true;
    }
}

