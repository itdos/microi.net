using System;
using Newtonsoft.Json.Linq;
using System.IO;
using System.Collections.Generic;

namespace Microi.net
{
    public partial class EmailParam : BaseParam
    {
        public string EmailServerKey { get; set; }
        public string SmtpServer { get; set; }
        public int SmtpPort { get; set; }
        public bool EnableSSL { get; set; }
        public string SystemEmail { get; set; }
        public List<string> Receivers { get; set; }
        public string SystemEmailPwd { get; set; }
        public string EmailSubject { get; set; }
        public string EmailBody { get; set; }
    }
}

