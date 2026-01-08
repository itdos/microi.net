using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    public partial class DiyTokenParam<T>
    {
        /// <summary>
        /// 必须包含：Id
        /// </summary>
        public T CurrentUser { get; set; }
        public string OsClient { get; set; }
        public string _ClientType { get; set; }
    }
}
