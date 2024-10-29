using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiSearchJobModel
    {
        // job名称
        public string ModuleEngineKey { get; set; }
        // 分页
        public int _PageIndex { get; set; }
        // 分页数量
        public int _PageSize { get; set; }

        // job名称
        public string _Key { get; set; }

        public string Id { get; set; }
        public string Name { get; set; }
    }
}
