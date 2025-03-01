using System;
using Newtonsoft.Json.Linq;
using System.IO;

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
}

