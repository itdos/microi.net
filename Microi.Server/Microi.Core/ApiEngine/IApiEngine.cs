using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    public interface IApiEngine
    {
        dynamic Run(dynamic dynamicParam, DbTrans _trans = null);
        dynamic Run(string apiEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        Task<dynamic> RunAsync(string apiEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        Task<dynamic> RunAsync(dynamic dynamicParam, DbTrans _trans = null);
        Task<DosResult<dynamic>> GetApiEngineModel(ApiEngineParam param);
    }
}
