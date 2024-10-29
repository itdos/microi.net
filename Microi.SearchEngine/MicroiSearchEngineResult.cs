using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public  class MicroiSearchEngineResult
    {
        public MicroiSearchEngineResult() { }
        public MicroiSearchEngineResult(int code,string msg) 
        { 
           Code = code;
            Msg = msg;
        }
        public object Data { get; set; }
        public long DataCount { get; set; }

        public int Code {  get; set; }

        public string Msg {  get; set; }
        public object SearchAfter { get; set; }

    }
}
