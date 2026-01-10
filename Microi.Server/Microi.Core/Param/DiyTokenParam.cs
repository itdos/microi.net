using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class DiyTokenParam
    {
        /// <summary>
        /// 必须包含：Id
        /// </summary>
        public JObject CurrentUser { get; set; }
        public string OsClient { get; set; }
        public string _ClientType { get; set; }
    }
}
